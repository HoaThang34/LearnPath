'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..', '..');
const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'learnpath-career-config-unit-'));
const GROUPS_COPY = path.join(TEMP_DIR, 'career_group_weights.json');
const PRIORITIES_COPY = path.join(TEMP_DIR, 'career_subject_priorities.json');

fs.copyFileSync(path.join(REPO, 'src', 'data', 'career_group_weights.json'), GROUPS_COPY);
fs.copyFileSync(path.join(REPO, 'src', 'data', 'career_subject_priorities.json'), PRIORITIES_COPY);

process.env.LEARNPATH_GROUP_WEIGHTS_PATH = GROUPS_COPY;
process.env.LEARNPATH_SUBJECT_PRIORITIES_PATH = PRIORITIES_COPY;
process.env.LEARNPATH_CONFIG_BACKUP_DIR = path.join(TEMP_DIR, 'backups');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BACKUP_DIR,
  updateGroupWeights,
  listPriorityRows,
  updatePriorityRow,
} = require('../../src/career/configStore');
const { getGroupConfig, groupFit, clearCache: clearGroupCache } = require('../../src/career/groupMatch');
const {
  findPriorityRow,
  hocLucSubjectFit,
  getPriorityConfig,
  rowKey,
  clearCache: clearPriorityCache,
} = require('../../src/career/hocLuc');

function readGroups() {
  return JSON.parse(fs.readFileSync(GROUPS_COPY, 'utf8'));
}

function readPriorities() {
  return JSON.parse(fs.readFileSync(PRIORITIES_COPY, 'utf8'));
}

function backupNames(prefix) {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith('.json'));
}

test.after(() => {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});

test('U1: rejects an unknown group code without touching the file', () => {
  const before = fs.readFileSync(GROUPS_COPY, 'utf8');
  assert.throws(
    () => updateGroupWeights({ groups: [{ code: 'khong_ton_tai', wHocLuc: 0.5, wHolland: 0.3, wMbti: 0.2 }] }),
    (error) => error.status === 400 && /Không tìm thấy khối/.test(error.message)
  );
  assert.equal(fs.readFileSync(GROUPS_COPY, 'utf8'), before);
});

test('U2: rejects a weight triple whose sum is not 1', () => {
  assert.throws(
    () => updateGroupWeights({ groups: [{ code: 'cntt', wHocLuc: 0.5, wHolland: 0.3, wMbti: 0.3 }] }),
    (error) => error.status === 400 && /phải bằng 1/.test(error.message)
  );
});

test('U3: rejects zero, negative, and above-one weights', () => {
  for (const bad of [0, -0.1, 1.1]) {
    assert.throws(
      () => updateGroupWeights({ groups: [{ code: 'cntt', wHocLuc: bad, wHolland: 0.5, wMbti: 0.5 }] }),
      (error) => error.status === 400
    );
  }
  assert.throws(
    () => updateGroupWeights({ groups: [{ code: 'cntt', wHocLuc: '', wHolland: 0.5, wMbti: 0.5 }] }),
    (error) => error.status === 400
  );
});

test('U4: writes a valid triple atomically, backs it up, and refreshes the in-memory cache', () => {
  const before = readGroups();
  const old = before.groups.find((group) => group.code === 'cntt');
  assert.equal(backupNames('career_group_weights').length, 0);

  const result = updateGroupWeights(
    { groups: [{ code: 'cntt', wHocLuc: 0.5, wHolland: 0.3, wMbti: 0.2 }] },
    { updatedBy: 'unit_admin' }
  );

  assert.equal(result.changed, true);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].old.wHocLuc, old.wHocLuc);
  assert.equal(result.changes[0].new.wHocLuc, 0.5);

  const after = readGroups();
  const updated = after.groups.find((group) => group.code === 'cntt');
  assert.equal(updated.wHocLuc, 0.5);
  assert.equal(updated.wHolland, 0.3);
  assert.equal(updated.wMbti, 0.2);
  assert.equal(typeof after.updatedAt, 'string');
  assert.equal(after.updatedBy, 'unit_admin');

  const config = getGroupConfig();
  const fromCache = config.groups.find((group) => group.code === 'cntt');
  assert.equal(fromCache.wHocLuc, 0.5);
  assert.equal(config.updatedAt, after.updatedAt);
  assert.equal(config.updatedBy, 'unit_admin');

  assert.equal(backupNames('career_group_weights').length, 1);

  const fit = groupFit({ groupCode: 'cntt', hocLuc: 80, holland: 60, mbti: 40 });
  assert.equal(fit.value, 66);
  assert.deepEqual(fit.missing, []);
});

test('U5: a no-op update reports changed=false and writes no backup', () => {
  clearGroupCache();
  const current = getGroupConfig().groups.find((group) => group.code === 'cntt');
  const backupsBefore = backupNames('career_group_weights').length;
  const result = updateGroupWeights({
    groups: [
      {
        code: 'cntt',
        wHocLuc: current.wHocLuc,
        wHolland: current.wHolland,
        wMbti: current.wMbti,
      },
    ],
  });
  assert.equal(result.changed, false);
  assert.deepEqual(result.changes, []);
  assert.equal(backupNames('career_group_weights').length, backupsBefore);
});

test('U6: the priority list exposes a unique key for every row', () => {
  const list = listPriorityRows();
  assert.equal(list.total, 143);
  assert.equal(list.rows.length, 143);
  assert.equal(new Set(list.rows.map((row) => row.key)).size, 143);
  for (const row of list.rows) {
    assert.ok(row.subjects.length > 0);
    assert.ok(row.subjects.every((subject) => Number.isInteger(subject.r) && subject.r >= 1 && subject.r <= 4));
  }
});

test('U7: rejects a non-integer or out-of-range priority', () => {
  const list = listPriorityRows();
  const row = list.rows[0];
  const values = Object.fromEntries(row.subjects.map((subject) => [subject.subject, subject.r]));
  const first = row.subjects[0].subject;

  for (const bad of [0, 5, 2.5, 'x', true]) {
    assert.throws(
      () => updatePriorityRow({ key: row.key, priorities: { ...values, [first]: bad } }),
      (error) => error.status === 400
    );
  }
});

test('U8: rejects a missing subject, an unknown subject, and an unknown row', () => {
  const list = listPriorityRows();
  const row = list.rows[0];
  const values = Object.fromEntries(row.subjects.map((subject) => [subject.subject, subject.r]));
  const first = row.subjects[0].subject;

  const missing = { ...values };
  delete missing[first];
  assert.throws(
    () => updatePriorityRow({ key: row.key, priorities: missing }),
    (error) => error.status === 400 && /Thiếu mức ưu tiên/.test(error.message)
  );

  assert.throws(
    () => updatePriorityRow({ key: row.key, priorities: { ...values, 'Môn không tồn tại': 2 } }),
    (error) => error.status === 400 && /không thuộc dòng này/.test(error.message)
  );

  assert.throws(
    () => updatePriorityRow({ key: 'khong|co|dong|nay', priorities: values }),
    (error) => error.status === 404
  );
});

test('U9: writes one priority row, refreshes the cache, and changes L exactly as the formula says', () => {
  clearPriorityCache();
  const list = listPriorityRows();
  const target = list.rows.find((row) => row.subjects.length >= 2) || list.rows[0];
  const values = Object.fromEntries(target.subjects.map((subject) => [subject.subject, subject.r]));
  const first = target.subjects[0].subject;
  values[first] = values[first] === 4 ? 1 : Number(values[first]) + 1;

  const backupsBefore = backupNames('career_subject_priorities').length;
  const result = updatePriorityRow(
    { key: target.key, priorities: values },
    { updatedBy: 'unit_admin' }
  );

  assert.equal(result.changed, true);
  assert.equal(result.row.key, target.key);
  assert.equal(result.row.priorityTotal, Object.values(values).reduce((sum, value) => sum + Number(value), 0));
  assert.equal(backupNames('career_subject_priorities').length, backupsBefore + 1);

  const raw = readPriorities().rows.find((row) => rowKey(row) === target.key);
  assert.equal(raw.subjects.find((subject) => subject.subject === first).r, values[first]);
  const config = getPriorityConfig();
  assert.equal(typeof config.updatedAt, 'string');
  assert.equal(config.updatedBy, 'unit_admin');
  assert.equal(config.rowCount, 143);

  const found = findPriorityRow({
    schoolCode: raw.schoolCode,
    majorName: raw.majorName,
    admissionBlock: raw.admissionBlock,
    method: raw.method,
    year: raw.year,
    entryScore: raw.entryScore,
  });
  assert.equal(found.matchedBy, 'exact');

  const scores = new Map(found.row.subjects.map((subject, index) => [subject.subject, index === 0 ? 10 : 0]));
  const expected = Math.round((10 * (found.row.subjects[0].r / found.row.priorityTotal) * 10) * 10) / 10;
  const fit = hocLucSubjectFit({ row: found.row, scores });
  assert.equal(fit.value, expected);
});

test('U10: a no-op priority save reports changed=false and writes no backup', () => {
  clearPriorityCache();
  const list = listPriorityRows();
  const row = list.rows[0];
  const values = Object.fromEntries(row.subjects.map((subject) => [subject.subject, subject.r]));
  const backupsBefore = backupNames('career_subject_priorities').length;
  const result = updatePriorityRow({ key: row.key, priorities: values });
  assert.equal(result.changed, false);
  assert.deepEqual(result.changes, []);
  assert.equal(backupNames('career_subject_priorities').length, backupsBefore);
});
