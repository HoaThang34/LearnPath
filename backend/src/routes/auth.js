const express = require('express');
const {
  getAuthDb,
  queryOne,
  runSql,
  lastInsertId,
  saveAuthDb,
  runAuthMutation,
} = require('../auth/authDb');
const { hashPassword, verifyPassword, verifyDummyPassword } = require('../auth/password');
const {
  validateRegistration,
  validateLogin,
  validateChangePassword,
} = require('../auth/validation');
const {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  checkRegisterRateLimit,
  recordRegisterAttempt,
  getClientIp,
} = require('../auth/rateLimit');
const {
  createSession,
  destroySession,
  getSessionToken,
  hashSessionToken,
  revokeOtherSessions,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
} = require('../auth/session');
const { requireTrustedOrigin } = require('../auth/origin');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
});

router.use(requireTrustedOrigin);

function sendRateLimit(res, retryAfter, message) {
  res.set('Retry-After', String(retryAfter));
  return res.status(429).json({ error: message });
}

function isUniqueConstraintError(error) {
  return error && typeof error.message === 'string' && error.message.includes('UNIQUE constraint failed');
}

function toPublicUser(row, createdAt) {
  return {
    id: Number(row.id),
    username: row.username,
    status: row.status || 'active',
    mustChangePassword: Boolean(Number(row.must_change_password || 0)),
    createdAt: createdAt || new Date(Number(row.created_at)).toISOString(),
  };
}

router.post('/register', async (req, res, next) => {
  const ip = getClientIp(req);
  const rate = checkRegisterRateLimit(ip);
  if (!rate.allowed) {
    return sendRateLimit(
      res,
      rate.retryAfter,
      'Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau.'
    );
  }
  recordRegisterAttempt(ip);

  const validation = validateRegistration(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  let userId = null;

  try {
    await getAuthDb();

    const existing = queryOne('SELECT id FROM users WHERE username_lower = ?', [
      validation.usernameLower,
    ]);
    if (existing) {
      return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại.' });
    }

    const passwordHash = await hashPassword(validation.password);
    const now = Date.now();

    userId = await runAuthMutation(() => {
      runSql(
        `INSERT INTO users
           (username, username_lower, password_hash, created_at, status, updated_at,
            must_change_password)
         VALUES (?, ?, ?, ?, 'active', ?, 0)`,
        [validation.username, validation.usernameLower, passwordHash, now, now]
      );
      return lastInsertId();
    });

    const session = await createSession(userId);
    setSessionCookie(res, session.token);

    return res.status(201).json({
      data: {
        user: {
          id: userId,
          username: validation.username,
          status: 'active',
          mustChangePassword: false,
          createdAt: new Date(now).toISOString(),
        },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại.' });
    }
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  const validation = validateLogin(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const ip = getClientIp(req);
  const rate = checkLoginRateLimit(ip, validation.usernameLower);
  if (!rate.allowed) {
    return sendRateLimit(
      res,
      rate.retryAfter,
      'Quá nhiều lần đăng nhập. Vui lòng thử lại sau.'
    );
  }

  try {
    await getAuthDb();

    const row = queryOne(
      `SELECT id, username, password_hash, created_at, status, must_change_password
         FROM users
        WHERE username_lower = ?`,
      [validation.usernameLower]
    );

    const passwordMatches = row
      ? await verifyPassword(validation.password, row.password_hash)
      : await verifyDummyPassword(validation.password);

    if (!passwordMatches) {
      recordLoginFailure(ip, validation.usernameLower);
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    if (row.status === 'locked') {
      return res.status(403).json({
        code: 'ACCOUNT_LOCKED',
        error: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.',
      });
    }

    if (row.status === 'deleted') {
      return res.status(403).json({
        code: 'ACCOUNT_DELETED',
        error: 'Tài khoản đã bị xóa. Vui lòng liên hệ quản trị viên.',
      });
    }

    clearLoginFailures(ip, validation.usernameLower);

    const now = Date.now();
    runSql('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      row.id,
    ]);
    saveAuthDb();

    const session = await createSession(row.id);
    setSessionCookie(res, session.token);

    return res.json({
      data: {
        user: toPublicUser(row),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ data: { user: req.user } });
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  const validation = validateChangePassword(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    await getAuthDb();
    const row = queryOne('SELECT id, username, password_hash, created_at FROM users WHERE id = ?', [
      req.user.id,
    ]);

    if (!row) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Vui lòng đăng nhập lại để tiếp tục.' });
    }

    const currentMatches = await verifyPassword(
      validation.currentPassword,
      row.password_hash
    );

    if (!currentMatches) {
      return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng.' });
    }

    const passwordHash = await hashPassword(validation.newPassword);
    const now = Date.now();
    const token = getSessionToken(req);
    const currentTokenHash = token ? hashSessionToken(token) : '';

    await runAuthMutation(() => {
      runSql(
        `UPDATE users
            SET password_hash = ?, must_change_password = 0, updated_at = ?
          WHERE id = ?`,
        [passwordHash, now, row.id]
      );
      revokeOtherSessions(row.id, currentTokenHash);
    });

    return res.json({
      data: {
        user: {
          id: Number(row.id),
          username: row.username,
          status: 'active',
          mustChangePassword: false,
          createdAt: new Date(Number(row.created_at)).toISOString(),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    await destroySession(req);
  } catch (error) {
    clearSessionCookie(res);
    return next(error);
  }

  clearSessionCookie(res);
  return res.status(204).end();
});

module.exports = router;
