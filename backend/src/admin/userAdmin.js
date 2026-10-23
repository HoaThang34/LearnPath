const {
  getAuthDb,
  queryAll,
  queryOne,
  runSql,
  lastInsertId,
  runAuthMutation,
} = require('../auth/authDb');
const { hashPassword, generateTemporaryPassword } = require('../auth/password');
const { validateUsername } = require('../auth/validation');
const { HttpError, isUniqueConstraintError } = require('./errors');

const MAX_BULK_CREATE = 50;
const USER_STATUSES = ['active', 'locked', 'deleted'];

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    status: row.status,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: row.updated_at ? new Date(Number(row.updated_at)).toISOString() : null,
    lastLoginAt: row.last_login_at ? new Date(Number(row.last_login_at)).toISOString() : null,
    mustChangePassword: Boolean(Number(row.must_change_password || 0)),
    deletedAt: row.deleted_at ? new Date(Number(row.deleted_at)).toISOString() : null,
  };
}

function parsePositiveInteger(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) return fallback;
  return parsed;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

async function listUsers({ query = '', status = 'all', page = 1, limit = 50 } = {}) {
  await getAuthDb();

  const safeLimit = parsePositiveInteger(limit, 50, 100);
  const safePage = parsePositiveInteger(page, 1, 100000);
  const offset = (safePage - 1) * safeLimit;
  const safeStatus = USER_STATUSES.includes(status) ? status : 'all';

  const conditions = [];
  const params = [];

  if (safeStatus !== 'all') {
    conditions.push('status = ?');
    params.push(safeStatus);
  }

  const search = typeof query === 'string' ? query.trim().slice(0, 100) : '';
  if (search) {
    conditions.push("username LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(search)}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const totalRow = queryOne(`SELECT COUNT(*) AS total FROM users ${where}`, params);
  const rows = queryAll(
    `SELECT id, username, status, created_at, updated_at, last_login_at,
            must_change_password, deleted_at
       FROM users
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  return {
    data: rows.map(toPublicUser),
    total: Number(totalRow ? totalRow.total : 0),
    page: safePage,
    limit: safeLimit,
  };
}

async function getUserById(id) {
  await getAuthDb();
  const row = queryOne('SELECT * FROM users WHERE id = ?', [id]);
  return row ? toPublicUser(row) : null;
}

async function findUserRow(id) {
  await getAuthDb();
  return queryOne('SELECT * FROM users WHERE id = ?', [id]);
}

async function createUser(username) {
  const validation = validateUsername(username);
  if (!validation.ok) throw new HttpError(400, validation.error);

  await getAuthDb();
  const existing = queryOne('SELECT id FROM users WHERE username_lower = ?', [
    validation.usernameLower,
  ]);
  if (existing) throw new HttpError(409, 'Tên đăng nhập đã tồn tại.');

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  try {
    const user = await runAuthMutation(() => {
      runSql(
        `INSERT INTO users
           (username, username_lower, password_hash, created_at, status, updated_at,
            must_change_password)
         VALUES (?, ?, ?, ?, 'active', ?, 1)`,
        [validation.username, validation.usernameLower, passwordHash, now, now]
      );
      const id = lastInsertId();
      return toPublicUser(queryOne('SELECT * FROM users WHERE id = ?', [id]));
    });

    return { user, password };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, 'Tên đăng nhập đã tồn tại.');
    }
    throw error;
  }
}

function normalizeBulkInput(input) {
  let values = [];

  if (Array.isArray(input.usernames)) {
    values = input.usernames;
  } else if (typeof input.text === 'string') {
    values = input.text.split(/\r?\n/);
  } else {
    throw new HttpError(400, 'Vui lòng gửi danh sách tên đăng nhập.');
  }

  const nonEmpty = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  if (nonEmpty.length === 0) {
    throw new HttpError(400, 'Danh sách tên đăng nhập đang trống.');
  }

  if (nonEmpty.length > MAX_BULK_CREATE) {
    throw new HttpError(400, `Mỗi lần chỉ được tạo tối đa ${MAX_BULK_CREATE} tài khoản.`);
  }

  return nonEmpty;
}

async function createUsersBulk(input) {
  const rawUsernames = normalizeBulkInput(input || {});

  await getAuthDb();

  const skipped = [];
  const seen = new Set();
  const candidates = [];

  for (const rawUsername of rawUsernames) {
    const validation = validateUsername(rawUsername);
    if (!validation.ok) {
      skipped.push({ username: rawUsername, reason: validation.error });
      continue;
    }

    if (seen.has(validation.usernameLower)) {
      skipped.push({ username: validation.username, reason: 'Tên đăng nhập bị lặp trong danh sách.' });
      continue;
    }
    seen.add(validation.usernameLower);

    const existing = queryOne('SELECT id FROM users WHERE username_lower = ?', [
      validation.usernameLower,
    ]);
    if (existing) {
      skipped.push({ username: validation.username, reason: 'Tên đăng nhập đã tồn tại.' });
      continue;
    }

    candidates.push(validation);
  }

  const prepared = [];
  for (const candidate of candidates) {
    const password = generateTemporaryPassword();
    const passwordHash = await hashPassword(password);
    prepared.push({ ...candidate, password, passwordHash });
  }

  const now = Date.now();
  const created = await runAuthMutation(() => {
    const output = [];

    for (const candidate of prepared) {
      const conflict = queryOne('SELECT id FROM users WHERE username_lower = ?', [
        candidate.usernameLower,
      ]);
      if (conflict) {
        skipped.push({ username: candidate.username, reason: 'Tên đăng nhập đã tồn tại.' });
        continue;
      }

      runSql(
        `INSERT INTO users
           (username, username_lower, password_hash, created_at, status, updated_at,
            must_change_password)
         VALUES (?, ?, ?, ?, 'active', ?, 1)`,
        [
          candidate.username,
          candidate.usernameLower,
          candidate.passwordHash,
          now,
          now,
        ]
      );

      output.push({
        id: lastInsertId(),
        username: candidate.username,
        password: candidate.password,
      });
    }

    return output;
  });

  return { data: created, skipped };
}

async function updateUsername(id, username) {
  const validation = validateUsername(username);
  if (!validation.ok) throw new HttpError(400, validation.error);

  const user = await findUserRow(id);
  if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.');
  if (user.status === 'deleted') {
    throw new HttpError(409, 'Tài khoản đã bị xóa. Hãy khôi phục trước khi sửa.');
  }

  await getAuthDb();
  const conflict = queryOne(
    'SELECT id FROM users WHERE username_lower = ? AND id <> ?',
    [validation.usernameLower, id]
  );
  if (conflict) throw new HttpError(409, 'Tên đăng nhập đã tồn tại.');

  try {
    return await runAuthMutation(() => {
      runSql(
        'UPDATE users SET username = ?, username_lower = ?, updated_at = ? WHERE id = ?',
        [validation.username, validation.usernameLower, Date.now(), id]
      );
      return toPublicUser(queryOne('SELECT * FROM users WHERE id = ?', [id]));
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, 'Tên đăng nhập đã tồn tại.');
    }
    throw error;
  }
}

async function setUserStatus(id, status) {
  if (status !== 'active' && status !== 'locked') {
    throw new HttpError(400, 'Trạng thái tài khoản không hợp lệ.');
  }

  const user = await findUserRow(id);
  if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.');
  if (user.status === 'deleted') {
    throw new HttpError(409, 'Tài khoản đã bị xóa. Hãy khôi phục trước.');
  }

  const now = Date.now();
  return runAuthMutation(() => {
    runSql('UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
    if (status === 'locked') {
      runSql('DELETE FROM sessions WHERE user_id = ?', [id]);
    }
    return toPublicUser(queryOne('SELECT * FROM users WHERE id = ?', [id]));
  });
}

async function resetUserPassword(id) {
  const user = await findUserRow(id);
  if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.');
  if (user.status === 'deleted') {
    throw new HttpError(409, 'Tài khoản đã bị xóa. Hãy khôi phục trước.');
  }

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  await runAuthMutation(() => {
    runSql(
      `UPDATE users
          SET password_hash = ?, must_change_password = 1, updated_at = ?
        WHERE id = ?`,
      [passwordHash, now, id]
    );
    runSql('DELETE FROM sessions WHERE user_id = ?', [id]);
  });

  return { user: await getUserById(id), password };
}

async function softDeleteUser(id, confirmUsername) {
  const user = await findUserRow(id);
  if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.');
  if (user.status === 'deleted') {
    throw new HttpError(409, 'Tài khoản đã được xóa trước đó.');
  }

  if (
    typeof confirmUsername !== 'string' ||
    confirmUsername.trim() !== user.username
  ) {
    throw new HttpError(400, 'Tên đăng nhập xác nhận không khớp.');
  }

  const now = Date.now();
  const snapshot = toPublicUser(user);

  await runAuthMutation(() => {
    runSql(
      `UPDATE users
          SET status = 'deleted', deleted_at = ?, updated_at = ?
        WHERE id = ?`,
      [now, now, id]
    );
    runSql('DELETE FROM sessions WHERE user_id = ?', [id]);
  });

  return { ...snapshot, status: 'deleted', deletedAt: new Date(now).toISOString() };
}

async function restoreUser(id) {
  const user = await findUserRow(id);
  if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.');
  if (user.status !== 'deleted') {
    throw new HttpError(409, 'Chỉ có thể khôi phục tài khoản đã xóa.');
  }

  const now = Date.now();
  return runAuthMutation(() => {
    runSql(
      `UPDATE users
          SET status = 'active', deleted_at = NULL, updated_at = ?
        WHERE id = ?`,
      [now, id]
    );
    return toPublicUser(queryOne('SELECT * FROM users WHERE id = ?', [id]));
  });
}

async function countUsersByStatus() {
  await getAuthDb();
  const rows = queryAll('SELECT status, COUNT(*) AS total FROM users GROUP BY status');
  const result = { active: 0, locked: 0, deleted: 0, total: 0 };
  for (const row of rows) {
    const count = Number(row.total);
    result[row.status] = count;
    result.total += count;
  }
  return result;
}

module.exports = {
  MAX_BULK_CREATE,
  USER_STATUSES,
  toPublicUser,
  listUsers,
  getUserById,
  createUser,
  createUsersBulk,
  updateUsername,
  setUserStatus,
  resetUserPassword,
  softDeleteUser,
  restoreUser,
  countUsersByStatus,
};
