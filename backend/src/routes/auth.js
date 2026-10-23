const express = require('express');
const { getAuthDb, queryOne, runSql, lastInsertId, saveAuthDb } = require('../auth/authDb');
const { hashPassword, verifyPassword, verifyDummyPassword } = require('../auth/password');
const { validateRegistration, validateLogin } = require('../auth/validation');
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

    runSql('BEGIN');
    try {
      runSql(
        'INSERT INTO users (username, username_lower, password_hash, created_at) VALUES (?, ?, ?, ?)',
        [validation.username, validation.usernameLower, passwordHash, now]
      );
      userId = lastInsertId();
      runSql('COMMIT');
    } catch (transactionError) {
      try {
        runSql('ROLLBACK');
      } catch (rollbackError) {
        // The original error is more useful; the transaction may already be closed.
      }
      throw transactionError;
    }

    saveAuthDb();

    const session = await createSession(userId);
    setSessionCookie(res, session.token);

    return res.status(201).json({
      data: {
        user: {
          id: userId,
          username: validation.username,
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
      'SELECT id, username, password_hash, created_at FROM users WHERE username_lower = ?',
      [validation.usernameLower]
    );

    const passwordMatches = row
      ? await verifyPassword(validation.password, row.password_hash)
      : await verifyDummyPassword(validation.password);

    if (!passwordMatches) {
      recordLoginFailure(ip, validation.usernameLower);
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    clearLoginFailures(ip, validation.usernameLower);

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
