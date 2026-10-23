const crypto = require('crypto');
const {
  getAuthDb,
  queryOne,
  runSql,
  getRowsModified,
  saveAuthDb,
} = require('./authDb');

const SESSION_COOKIE_NAME = 'lp_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

function parseCookies(header) {
  const cookies = Object.create(null);
  if (typeof header !== 'string' || header.length === 0) return cookies;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;

    const name = part.slice(0, separator).trim();
    if (!name || name in cookies) continue;

    let value = part.slice(separator + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch (error) {
      // Keep the raw value; an invalid escape sequence cannot match a real token.
    }
    cookies[name] = value;
  }

  return cookies;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

function getSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (typeof token !== 'string' || token.length === 0 || token.length > 512) {
    return null;
  }
  return token;
}

function deleteExpiredSessions() {
  runSql('DELETE FROM sessions WHERE expires_at <= ?', [Date.now()]);
  return getRowsModified();
}

async function createSession(userId) {
  await getAuthDb();

  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  deleteExpiredSessions();
  runSql(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    [hashToken(token), userId, now, expiresAt]
  );

  try {
    saveAuthDb();
  } catch (error) {
    runSql('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
    throw error;
  }

  return { token, expiresAt };
}

async function getSessionUser(req) {
  const token = getSessionToken(req);
  if (!token) return null;

  await getAuthDb();

  const row = queryOne(
    `SELECT u.id, u.username, u.created_at, u.status, u.must_change_password, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'`,
    [hashToken(token), Date.now()]
  );

  if (!row) return null;

  return {
    id: Number(row.id),
    username: row.username,
    status: row.status,
    mustChangePassword: Boolean(Number(row.must_change_password || 0)),
    createdAt: new Date(Number(row.created_at)).toISOString(),
  };
}

async function destroySession(req) {
  const token = getSessionToken(req);
  if (!token) return;

  await getAuthDb();

  runSql('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
  if (getRowsModified() > 0) {
    saveAuthDb();
  }
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_TTL_MS,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
}

async function requireAuth(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requirePasswordChanged(req, res, next) {
  if (req.user && req.user.mustChangePassword) {
    return res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      error: 'Bạn phải đổi mật khẩu trước khi tiếp tục sử dụng tính năng này.',
    });
  }
  return next();
}

function hashSessionToken(token) {
  return hashToken(token);
}

async function revokeOtherSessions(userId, currentTokenHash) {
  await getAuthDb();
  runSql('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [
    userId,
    currentTokenHash,
  ]);
  return getRowsModified();
}

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  parseCookies,
  getSessionToken,
  hashSessionToken,
  createSession,
  getSessionUser,
  destroySession,
  revokeOtherSessions,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  requirePasswordChanged,
};
