const fs = require('fs');
const path = require('path');
const { DB_PATH, getDb, reloadDb, runSql } = require('../database/db');
const { HttpError } = require('./errors');

const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups');
const MAX_BACKUPS = 5;

let writing = false;
let blocked = false;
let firstWriteBackedUp = false;
let lastBackupPath = null;
let lastWriteAt = null;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function formatStamp(date = new Date()) {
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

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith('learnpath-') && name.endsWith('.db'))
    .sort()
    .reverse()
    .map((name) => {
      const fullPath = path.join(BACKUP_DIR, name);
      const stats = fs.statSync(fullPath);
      return {
        name,
        path: fullPath,
        size: stats.size,
        createdAt: stats.mtime.toISOString(),
      };
    });
}

function pruneBackups() {
  const backups = listBackups();
  for (const backup of backups.slice(MAX_BACKUPS)) {
    fs.rmSync(backup.path, { force: true });
  }
}

function backupNow(reason = 'manual') {
  if (!fs.existsSync(DB_PATH)) {
    throw new HttpError(500, 'Không tìm thấy cơ sở dữ liệu tuyển sinh để sao lưu.');
  }

  ensureBackupDir();
  const safeReason = String(reason).replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'manual';
  const target = path.join(
    BACKUP_DIR,
    `learnpath-${formatStamp()}-${safeReason}.db`
  );

  try {
    fs.copyFileSync(DB_PATH, target);
    const sourceSize = fs.statSync(DB_PATH).size;
    const backupSize = fs.statSync(target).size;
    if (sourceSize !== backupSize) {
      throw new Error('backup size does not match the source database');
    }
  } catch (error) {
    fs.rmSync(target, { force: true });
    throw new HttpError(
      500,
      `Không thể sao lưu cơ sở dữ liệu trước khi ghi: ${error.message}`
    );
  }

  lastBackupPath = target;
  pruneBackups();
  return target;
}

function ensureFirstWriteBackup() {
  if (firstWriteBackedUp) return;
  backupNow('auto-before-write');
  firstWriteBackedUp = true;
}

function writeAtomic(buffer) {
  const directory = path.dirname(DB_PATH);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const tempPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
  const previousPath = `${DB_PATH}.${process.pid}.${Date.now()}.previous`;

  try {
    fs.writeFileSync(tempPath, buffer);

    try {
      const descriptor = fs.openSync(tempPath, 'r+');
      try {
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
    } catch (syncError) {
      // Best effort; the rename below still prevents a partial target file.
    }

    try {
      fs.renameSync(tempPath, DB_PATH);
    } catch (renameError) {
      fs.renameSync(DB_PATH, previousPath);
      try {
        fs.renameSync(tempPath, DB_PATH);
      } catch (secondRenameError) {
        fs.renameSync(previousPath, DB_PATH);
        throw secondRenameError;
      }
      fs.rmSync(previousPath, { force: true });
    }
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
    if (fs.existsSync(previousPath)) {
      fs.rmSync(previousPath, { force: true });
    }
  }
}

async function reloadOrBlock(error) {
  try {
    await reloadDb();
  } catch (reloadError) {
    blocked = true;
    console.error(
      '[admission-write] Failed to reload the database after an error:',
      reloadError.message
    );
    throw new HttpError(
      503,
      'Không thể khôi phục cơ sở dữ liệu sau lỗi ghi. Quản trị viên đã bị chặn ghi để bảo vệ dữ liệu.'
    );
  }

  throw error;
}

/**
 * Serialize an admission write: optional backup, transaction, integrity check,
 * atomic replacement of the database file, and reload on any failure.
 * The mutator must be synchronous.
 */
async function writeAdmission(mutator, { backup = false, reason = 'admin-write' } = {}) {
  if (blocked) {
    throw new HttpError(
      503,
      'Hệ thống đang chặn ghi cơ sở dữ liệu để bảo vệ dữ liệu. Kiểm tra log máy chủ.'
    );
  }

  if (writing) {
    throw new HttpError(503, 'Hệ thống đang lưu một thay đổi khác. Vui lòng thử lại sau.');
  }

  writing = true;
  let needsReload = false;

  try {
    const db = await getDb();

    ensureFirstWriteBackup();
    if (backup) backupNow(reason);

    runSql('BEGIN');
    let result;
    try {
      result = mutator(db);
      runSql('COMMIT');
    } catch (error) {
      try {
        runSql('ROLLBACK');
      } catch (rollbackError) {
        // The original error is more useful; the transaction may already be closed.
      }
      throw error;
    }

    const check = db.exec('PRAGMA quick_check');
    const checkValue =
      check.length && check[0].values.length ? String(check[0].values[0][0]) : 'failed';
    if (checkValue !== 'ok') {
      needsReload = true;
      throw new HttpError(500, 'Kiểm tra toàn vẹn dữ liệu thất bại. Thay đổi đã được hủy.');
    }

    try {
      writeAtomic(Buffer.from(db.export()));
    } catch (error) {
      needsReload = true;
      throw new HttpError(500, `Không thể ghi cơ sở dữ liệu: ${error.message}`);
    }

    lastWriteAt = new Date().toISOString();
    return result;
  } catch (error) {
    if (needsReload) {
      return reloadOrBlock(error);
    }
    throw error;
  } finally {
    writing = false;
  }
}

function getWriteState() {
  return {
    blocked,
    writing,
    lastBackupPath,
    lastWriteAt,
    backups: listBackups(),
  };
}

module.exports = {
  BACKUP_DIR,
  MAX_BACKUPS,
  backupNow,
  listBackups,
  writeAdmission,
  getWriteState,
};
