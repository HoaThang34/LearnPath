'use strict';

/**
 * Admin write path for the two editable career configuration files:
 *
 *   backend/src/data/career_group_weights.json      (12 group weights L/H/M)
 *   backend/src/data/career_subject_priorities.json (subject priority r 1–4)
 *
 * There is deliberately no schema change here: the JSON files stay the single
 * source of truth. Every write is validated, backed up, serialised and replaced
 * atomically, then the in-process cache is cleared so the next request reads the
 * new values without a restart.
 *
 * Do not edit these files by hand while the backend is running: use the admin
 * UI/API. `derive-career-weights.js --write` refuses to overwrite a file with
 * admin edits unless `--force` is passed.
 */

const fs = require('fs');
const path = require('path');
const { HttpError } = require('../admin/errors');
const { clearCache: clearGroupCache, getGroupConfig } = require('./groupMatch');
const { clearCache: clearPriorityCache, getPriorityConfig, rowKey } = require('./hocLuc');

const DATA_DIR = path.join(__dirname, '..', 'data');

const GROUPS_FILE =
  process.env.LEARNPATH_GROUP_WEIGHTS_PATH ||
  path.join(DATA_DIR, 'career_group_weights.json');
const PRIORITIES_FILE =
  process.env.LEARNPATH_SUBJECT_PRIORITIES_PATH ||
  path.join(DATA_DIR, 'career_subject_priorities.json');
const BACKUP_DIR =
  process.env.LEARNPATH_CONFIG_BACKUP_DIR ||
  path.join(__dirname, '..', '..', 'database', 'backups');

const MAX_BACKUPS = 5;
const WEIGHT_TOLERANCE = 0.002;
const WEIGHT_MIN = 0;
const PRIORITY_MIN = 1;
const PRIORITY_MAX = 4;

function stamp(date = new Date()) {
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    '-',
    pad(date.getMilliseconds(), 3),
  ].join('');
}

function readJson(file, label) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`[career-config] Cannot read ${file}:`, error.message);
    throw new HttpError(500, `Không đọc được tệp cấu hình ${label}.`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(`[career-config] Invalid JSON in ${file}:`, error.message);
    throw new HttpError(500, `Tệp cấu hình ${label} không phải JSON hợp lệ.`);
  }
}

function pruneBackups(prefix) {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith('.json'))
    .sort()
    .reverse();
  for (const name of backups.slice(MAX_BACKUPS)) {
    fs.rmSync(path.join(BACKUP_DIR, name), { force: true });
  }
}

function backupFile(file, reason) {
  if (!fs.existsSync(file)) return null;
  const prefix = path.basename(file, '.json');
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const target = path.join(BACKUP_DIR, `${prefix}-${stamp()}-${reason}.json`);
    fs.copyFileSync(file, target);
    const sourceSize = fs.statSync(file).size;
    const targetSize = fs.statSync(target).size;
    if (sourceSize !== targetSize) {
      throw new Error('backup size does not match the source file');
    }
    pruneBackups(prefix);
    return target;
  } catch (error) {
    console.error(`[career-config] Backup failed for ${file}:`, error.message);
    throw new HttpError(500, `Không thể sao lưu cấu hình trước khi ghi: ${error.message}`);
  }
}

function writeJsonAtomic(file, value) {
  const directory = path.dirname(file);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });

  const text = `${JSON.stringify(value, null, 2)}\n`;
  const tempPath = `${file}.${process.pid}.${Date.now()}.tmp`;
  const previousPath = `${file}.${process.pid}.${Date.now()}.previous`;

  try {
    fs.writeFileSync(tempPath, text, 'utf8');
    try {
      const descriptor = fs.openSync(tempPath, 'r+');
      try {
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
    } catch (syncError) {
      // Best effort. The rename still prevents a half-written target file.
    }

    try {
      fs.renameSync(tempPath, file);
    } catch (renameError) {
      // Windows can refuse to replace an existing file in some states.
      if (fs.existsSync(file)) fs.renameSync(file, previousPath);
      try {
        fs.renameSync(tempPath, file);
      } catch (secondRenameError) {
        if (fs.existsSync(previousPath)) fs.renameSync(previousPath, file);
        throw secondRenameError;
      }
      fs.rmSync(previousPath, { force: true });
    }
  } catch (error) {
    console.error(`[career-config] Write failed for ${file}:`, error.message);
    throw new HttpError(500, `Không thể ghi tệp cấu hình: ${error.message}`);
  } finally {
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
    if (fs.existsSync(previousPath)) fs.rmSync(previousPath, { force: true });
  }
}

function roundWeight(value) {
  return Math.round(value * 1e8) / 1e8;
}

function parseWeight(value, label) {
  if (value === null || value === undefined || value === '') {
    throw new HttpError(400, `${label} không được để trống.`);
  }
  if (typeof value === 'boolean') {
    throw new HttpError(400, `${label} phải là số.`);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new HttpError(400, `${label} phải là số.`);
  }
  if (numeric <= WEIGHT_MIN || numeric > 1) {
    throw new HttpError(400, `${label} phải lớn hơn 0 và không vượt quá 1.`);
  }
  return roundWeight(numeric);
}

/**
 * Validate a partial list of group-weight updates against the current file.
 * Pure, so the unit tests do not need to touch the real data files.
 *
 * @param {object|Array} input  `{ groups: [...] }` or the array itself
 * @param {Array} existingGroups  Current `groups` array
 */
function validateGroupUpdates(input, existingGroups) {
  const rows = Array.isArray(input) ? input : input?.groups;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new HttpError(400, 'Cần gửi danh sách trọng số cần cập nhật.');
  }

  const existing = new Map((existingGroups || []).map((group) => [group.code, group]));
  const seen = new Set();
  const updates = [];

  for (const row of rows) {
    const code = typeof row?.code === 'string' ? row.code.trim() : '';
    const current = existing.get(code);
    if (!current) {
      throw new HttpError(400, `Không tìm thấy khối ngành "${code || '(trống)'}".`);
    }
    if (seen.has(code)) {
      throw new HttpError(400, `Khối "${code}" bị lặp trong yêu cầu.`);
    }
    seen.add(code);

    const label = current.label || code;
    const wHocLuc = parseWeight(row.wHocLuc, `Trọng số học lực của "${label}"`);
    const wHolland = parseWeight(row.wHolland, `Trọng số Holland của "${label}"`);
    const wMbti = parseWeight(row.wMbti, `Trọng số MBTI của "${label}"`);
    const total = wHocLuc + wHolland + wMbti;
    if (Math.abs(total - 1) > WEIGHT_TOLERANCE) {
      throw new HttpError(
        400,
        `Tổng ba trọng số của "${label}" phải bằng 1 (hiện tại ${total.toFixed(6)}).`
      );
    }

    updates.push({ code, label, wHocLuc, wHolland, wMbti });
  }

  return updates;
}

function sameWeights(group, update) {
  return (
    Math.abs(Number(group.wHocLuc) - update.wHocLuc) < 1e-9 &&
    Math.abs(Number(group.wHolland) - update.wHolland) < 1e-9 &&
    Math.abs(Number(group.wMbti) - update.wMbti) < 1e-9
  );
}

function updateGroupWeights(input, { updatedBy = null } = {}) {
  const raw = readJson(GROUPS_FILE, 'trọng số 12 khối');
  if (!Array.isArray(raw.groups)) {
    throw new HttpError(500, 'Tệp trọng số 12 khối thiếu mảng "groups".');
  }

  const updates = validateGroupUpdates(input, raw.groups);
  const changes = [];
  for (const update of updates) {
    const group = raw.groups.find((row) => row.code === update.code);
    if (sameWeights(group, update)) continue;
    changes.push({
      code: update.code,
      label: update.label,
      old: {
        wHocLuc: group.wHocLuc,
        wHolland: group.wHolland,
        wMbti: group.wMbti,
      },
      new: {
        wHocLuc: update.wHocLuc,
        wHolland: update.wHolland,
        wMbti: update.wMbti,
      },
    });
    group.wHocLuc = update.wHocLuc;
    group.wHolland = update.wHolland;
    group.wMbti = update.wMbti;
  }

  if (changes.length === 0) {
    return { changed: false, changes, config: getGroupConfig(), updatedAt: raw.updatedAt || null };
  }

  const updatedAt = new Date().toISOString();
  raw.updatedAt = updatedAt;
  raw.updatedBy = updatedBy ? String(updatedBy).slice(0, 64) : null;

  backupFile(GROUPS_FILE, 'group-weights');
  writeJsonAtomic(GROUPS_FILE, raw);
  clearGroupCache();

  return { changed: true, changes, config: getGroupConfig(), updatedAt };
}

function priorityRowView(row) {
  const subjects = (row.subjects || []).map((subject) => ({
    subject: subject.subject,
    weight: Number(subject.weight),
    r: Number(subject.r),
  }));
  return {
    key: rowKey(row),
    schoolCode: row.schoolCode || null,
    schoolName: row.schoolName || null,
    majorName: row.majorName || null,
    admissionBlock: row.admissionBlock || null,
    method: row.method || null,
    year: row.year ?? null,
    entryScore: row.entryScore ?? null,
    subjects,
    priorityTotal: subjects.reduce((sum, subject) => sum + subject.r, 0),
  };
}

function listPriorityRows() {
  const raw = readJson(PRIORITIES_FILE, 'ưu tiên môn');
  if (!Array.isArray(raw.rows)) {
    throw new HttpError(500, 'Tệp ưu tiên môn thiếu mảng "rows".');
  }
  return {
    version: raw.version || 1,
    scale: raw.scale || { 4: 'Cốt lõi', 3: 'Quan trọng', 2: 'Liên quan', 1: 'Hỗ trợ' },
    formula: raw.formula || 'a_mj = r_mj / Σ_j r_mj ; L_m = 10 × Σ_j a_mj x_j',
    note: raw.note || '',
    updatedAt: raw.updatedAt || null,
    updatedBy: raw.updatedBy || null,
    total: raw.rows.length,
    rows: raw.rows.map(priorityRowView),
  };
}

/**
 * Validate and apply a priority change for one exact row.
 *
 * The subject set is intentionally fixed: this endpoint changes only `r` on
 * existing subjects. Adding/removing subjects would change the L denominator
 * and needs a separate reviewed migration.
 */
function updatePriorityRow({ key, priorities } = {}, { updatedBy = null } = {}) {
  if (typeof key !== 'string' || key.trim() === '') {
    throw new HttpError(400, 'Thiếu khóa dòng ưu tiên môn.');
  }
  if (!priorities || typeof priorities !== 'object' || Array.isArray(priorities)) {
    throw new HttpError(400, 'Danh sách mức ưu tiên không hợp lệ.');
  }

  const raw = readJson(PRIORITIES_FILE, 'ưu tiên môn');
  if (!Array.isArray(raw.rows)) {
    throw new HttpError(500, 'Tệp ưu tiên môn thiếu mảng "rows".');
  }

  const index = raw.rows.findIndex((row) => rowKey(row) === key);
  if (index === -1) {
    throw new HttpError(404, 'Không tìm thấy dòng ưu tiên môn cần cập nhật.');
  }
  const row = raw.rows[index];
  const subjects = Array.isArray(row.subjects) ? row.subjects : [];
  const names = subjects.map((subject) => subject.subject);
  if (names.length === 0) {
    throw new HttpError(409, 'Dòng ưu tiên môn không có môn nào để cập nhật.');
  }
  if (new Set(names).size !== names.length) {
    throw new HttpError(409, 'Dòng ưu tiên môn có tên môn trùng; hãy sửa dữ liệu gốc trước.');
  }

  const unknown = Object.keys(priorities).filter((name) => !names.includes(name));
  if (unknown.length > 0) {
    throw new HttpError(400, `Môn không thuộc dòng này: ${unknown.join(', ')}.`);
  }

  const changes = [];
  const next = subjects.map((subject) => {
    if (!Object.prototype.hasOwnProperty.call(priorities, subject.subject)) {
      throw new HttpError(400, `Thiếu mức ưu tiên cho môn "${subject.subject}".`);
    }
    const value = priorities[subject.subject];
    const numeric = Number(value);
    if (
      typeof value === 'boolean' ||
      !Number.isInteger(numeric) ||
      numeric < PRIORITY_MIN ||
      numeric > PRIORITY_MAX
    ) {
      throw new HttpError(
        400,
        `Mức ưu tiên của môn "${subject.subject}" phải là số nguyên ${PRIORITY_MIN}–${PRIORITY_MAX}.`
      );
    }
    if (Number(subject.r) !== numeric) {
      changes.push({ subject: subject.subject, oldR: Number(subject.r), newR: numeric });
    }
    return { ...subject, r: numeric };
  });

  const view = priorityRowView({ ...row, subjects: next });
  if (changes.length === 0) {
    return { changed: false, changes, row: view, updatedAt: raw.updatedAt || null };
  }

  const updatedAt = new Date().toISOString();
  raw.rows[index] = { ...row, subjects: next };
  raw.updatedAt = updatedAt;
  raw.updatedBy = updatedBy ? String(updatedBy).slice(0, 64) : null;

  backupFile(PRIORITIES_FILE, 'subject-priorities');
  writeJsonAtomic(PRIORITIES_FILE, raw);
  clearPriorityCache();

  return {
    changed: true,
    changes,
    row: view,
    updatedAt,
    updatedBy: raw.updatedBy,
    config: getPriorityConfig(),
  };
}

module.exports = {
  GROUPS_FILE,
  PRIORITIES_FILE,
  BACKUP_DIR,
  validateGroupUpdates,
  updateGroupWeights,
  listPriorityRows,
  updatePriorityRow,
  priorityRowView,
};
