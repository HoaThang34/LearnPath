const {
  getAuthDb,
  queryAll,
  queryOne,
  runSql,
  lastInsertId,
  runAuthMutation,
} = require('./authDb');
const { hashPassword, verifyPassword, verifyDummyPassword } = require('./password');
const { validateUsername, validateAdminPassword } = require('./validation');
const { HttpError, isUniqueConstraintError } = require('../admin/errors');

function toPublicAdmin(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    status: row.status,
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: row.updated_at ? new Date(Number(row.updated_at)).toISOString() : null,
    lastLoginAt: row.last_login_at ? new Date(Number(row.last_login_at)).toISOString() : null,
  };
}

async function findAdminByUsername(usernameLower) {
  await getAuthDb();
  return queryOne('SELECT * FROM admins WHERE username_lower = ?', [usernameLower]);
}

async function verifyAdminCredentials(usernameLower, password) {
  const admin = await findAdminByUsername(usernameLower);

  const passwordMatches = admin
    ? await verifyPassword(password, admin.password_hash)
    : await verifyDummyPassword(password);

  return { admin, passwordMatches };
}

async function updateAdminLastLogin(adminId) {
  const now = Date.now();
  await runAuthMutation(() => {
    runSql('UPDATE admins SET last_login_at = ? WHERE id = ?', [now, adminId]);
  });
  return now;
}

async function createAdmin({ username, password }) {
  const usernameResult = validateUsername(username);
  if (!usernameResult.ok) throw new HttpError(400, usernameResult.error);

  const passwordResult = validateAdminPassword(password);
  if (!passwordResult.ok) throw new HttpError(400, passwordResult.error);

  await getAuthDb();
  const existing = queryOne('SELECT id FROM admins WHERE username_lower = ?', [
    usernameResult.usernameLower,
  ]);
  if (existing) {
    throw new HttpError(409, 'Tên đăng nhập quản trị đã tồn tại.');
  }

  const passwordHash = await hashPassword(password);
  const now = Date.now();

  try {
    return await runAuthMutation(() => {
      runSql(
        `INSERT INTO admins
           (username, username_lower, password_hash, status, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)`,
        [usernameResult.username, usernameResult.usernameLower, passwordHash, now, now]
      );
      const id = lastInsertId();
      return toPublicAdmin(
        queryOne('SELECT * FROM admins WHERE id = ?', [id])
      );
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, 'Tên đăng nhập quản trị đã tồn tại.');
    }
    throw error;
  }
}

async function setAdminStatus(username, status) {
  if (status !== 'active' && status !== 'disabled') {
    throw new HttpError(400, 'Trạng thái quản trị không hợp lệ.');
  }

  const usernameResult = validateUsername(username);
  if (!usernameResult.ok) throw new HttpError(400, usernameResult.error);

  const admin = await findAdminByUsername(usernameResult.usernameLower);
  if (!admin) throw new HttpError(404, 'Không tìm thấy tài khoản quản trị.');

  const now = Date.now();
  await runAuthMutation(() => {
    runSql('UPDATE admins SET status = ?, updated_at = ? WHERE id = ?', [
      status,
      now,
      admin.id,
    ]);
    runSql('DELETE FROM admin_sessions WHERE admin_id = ?', [admin.id]);
  });

  return toPublicAdmin(queryOne('SELECT * FROM admins WHERE id = ?', [admin.id]));
}

async function resetAdminPassword(username, password) {
  const usernameResult = validateUsername(username);
  if (!usernameResult.ok) throw new HttpError(400, usernameResult.error);

  const passwordResult = validateAdminPassword(password);
  if (!passwordResult.ok) throw new HttpError(400, passwordResult.error);

  const admin = await findAdminByUsername(usernameResult.usernameLower);
  if (!admin) throw new HttpError(404, 'Không tìm thấy tài khoản quản trị.');

  const passwordHash = await hashPassword(password);
  const now = Date.now();
  await runAuthMutation(() => {
    runSql('UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?', [
      passwordHash,
      now,
      admin.id,
    ]);
    runSql('DELETE FROM admin_sessions WHERE admin_id = ?', [admin.id]);
  });

  return toPublicAdmin(queryOne('SELECT * FROM admins WHERE id = ?', [admin.id]));
}

async function listAdmins() {
  await getAuthDb();
  return queryAll(
    `SELECT id, username, status, created_at, updated_at, last_login_at
       FROM admins
      ORDER BY id ASC`
  ).map(toPublicAdmin);
}

module.exports = {
  toPublicAdmin,
  findAdminByUsername,
  verifyAdminCredentials,
  updateAdminLastLogin,
  createAdmin,
  setAdminStatus,
  resetAdminPassword,
  listAdmins,
};
