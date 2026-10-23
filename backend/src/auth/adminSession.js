const crypto = require('crypto');
const {
  getAuthDb,
  queryOne,
  queryAll,
  runSql,
  getRowsModified,
  saveAuthDb,
} = require('./authDb');
const { parseCookies } = require('./session');
const { hashIp } = require('./adminAudit');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_SESSION_COOKIE_NAME = IS_PRODUCTION
  ? '__Host-lp_admin_session'
  : 'lp_admin_session';
const LEGACY_ADMIN_SESSION_COOKIE_NAME = 'lp_admin_session';

const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const ADMIN_SESSION_IDLE_MS = 30 * 60 * 1000;
const ADMIN_SESSION_MAX_PER_ADMIN = 3;
const ADMIN_LAST_SEEN_UPDATE_MS = 5 * 60 * 1000;

const CSRF_SECRET =
  process.env.ADMIN_CSRF_SECRET || 'learnpath-admin-csrf-v1';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: IS_PRODUCTION,
  path: '/',
};

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

function csrfTokenForSession(sessionToken) {
  return crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(`admin-csrf:${sessionToken}`)
    .digest('base64url');
}

function hashCsrfToken(token) {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

function getAdminSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[ADMIN_SESSION_COOKIE_NAME];
  if (typeof token !== 'string' || token.length === 0 || token.length > 512) {
    return null;
  }
  return token;
}

function deleteExpiredAdminSessions() {
  runSql('DELETE FROM admin_sessions WHERE expires_at <= ?', [Date.now()]);
  return getRowsModified();
}

function trimAdminSessions(adminId) {
  const surplus = queryAll(
    `SELECT token_hash
       FROM admin_sessions
      WHERE admin_id = ?
      ORDER BY created_at DESC, token_hash DESC
      LIMIT -1 OFFSET ?`,
    [adminId, ADMIN_SESSION_MAX_PER_ADMIN]
  );

  for (const row of surplus) {
    runSql('DELETE FROM admin_sessions WHERE token_hash = ?', [row.token_hash]);
  }
}

async function createAdminSession(adminId, { ip = null, userAgent = null } = {}) {
  await getAuthDb();

  const token = crypto.randomBytes(32).toString('base64url');
  const csrfToken = csrfTokenForSession(token);
  const now = Date.now();
  const expiresAt = now + ADMIN_SESSION_TTL_MS;

  runSql('BEGIN');
  try {
    deleteExpiredAdminSessions();
    runSql(
      `INSERT INTO admin_sessions
         (token_hash, admin_id, created_at, expires_at, last_seen_at, csrf_hash, user_agent, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hashToken(token),
        adminId,
        now,
        expiresAt,
        now,
        hashCsrfToken(csrfToken),
        typeof userAgent === 'string' ? userAgent.slice(0, 255) : null,
        ip ? hashIp(ip) : null,
      ]
    );
    trimAdminSessions(adminId);
    runSql('COMMIT');
  } catch (error) {
    try {
      runSql('ROLLBACK');
    } catch (rollbackError) {
      // The original error is more useful; the transaction may already be closed.
    }
    throw error;
  }

  try {
    saveAuthDb();
  } catch (error) {
    runSql('DELETE FROM admin_sessions WHERE token_hash = ?', [hashToken(token)]);
    throw error;
  }

  return { token, csrfToken, expiresAt };
}

async function getAdminSession(req) {
  const token = getAdminSessionToken(req);
  if (!token) return null;

  await getAuthDb();

  const now = Date.now();
  const row = queryOne(
    `SELECT s.token_hash, s.csrf_hash, s.created_at, s.expires_at, s.last_seen_at,
            a.id, a.username, a.created_at AS admin_created_at, a.last_login_at
       FROM admin_sessions s
       JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = ? AND a.status = 'active'`,
    [hashToken(token)]
  );

  if (!row) return null;

  const expiresAt = Number(row.expires_at);
  const lastSeenAt = Number(row.last_seen_at);

  if (expiresAt <= now || lastSeenAt + ADMIN_SESSION_IDLE_MS <= now) {
    runSql('DELETE FROM admin_sessions WHERE token_hash = ?', [row.token_hash]);
    try {
      saveAuthDb();
    } catch (error) {
      console.error('[admin-session] Failed to remove an expired session:', error.message);
    }
    return null;
  }

  if (now - lastSeenAt >= ADMIN_LAST_SEEN_UPDATE_MS) {
    runSql('UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?', [
      now,
      row.token_hash,
    ]);
    try {
      saveAuthDb();
    } catch (error) {
      console.error('[admin-session] Failed to update session activity:', error.message);
    }
  }

  return {
    admin: {
      id: Number(row.id),
      username: row.username,
      createdAt: new Date(Number(row.admin_created_at)).toISOString(),
      lastLoginAt: row.last_login_at
        ? new Date(Number(row.last_login_at)).toISOString()
        : null,
    },
    session: {
      tokenHash: row.token_hash,
      csrfHash: row.csrf_hash,
      createdAt: Number(row.created_at),
      expiresAt,
      lastSeenAt,
    },
    csrfToken: csrfTokenForSession(token),
  };
}

async function destroyAdminSession(req) {
  const token = getAdminSessionToken(req);
  if (!token) return false;

  await getAuthDb();
  runSql('DELETE FROM admin_sessions WHERE token_hash = ?', [hashToken(token)]);
  if (getRowsModified() > 0) {
    saveAuthDb();
    return true;
  }
  return false;
}

async function revokeAdminSessions(adminId) {
  await getAuthDb();
  runSql('DELETE FROM admin_sessions WHERE admin_id = ?', [adminId]);
  const removed = getRowsModified();
  if (removed > 0) saveAuthDb();
  return removed;
}

function setAdminSessionCookie(res, token) {
  res.cookie(ADMIN_SESSION_COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: ADMIN_SESSION_TTL_MS,
  });
}

function clearAdminSessionCookie(res) {
  res.clearCookie(ADMIN_SESSION_COOKIE_NAME, COOKIE_OPTIONS);
  if (ADMIN_SESSION_COOKIE_NAME !== LEGACY_ADMIN_SESSION_COOKIE_NAME) {
    res.clearCookie(LEGACY_ADMIN_SESSION_COOKIE_NAME, COOKIE_OPTIONS);
  }
}

async function requireAdmin(req, res, next) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      clearAdminSessionCookie(res);
      return res.status(401).json({ error: 'Vui lòng đăng nhập quản trị để tiếp tục.' });
    }

    req.admin = session.admin;
    req.adminSession = session.session;
    req.adminCsrfToken = session.csrfToken;
    return next();
  } catch (error) {
    return next(error);
  }
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function requireAdminCsrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const provided = req.get('X-Admin-CSRF');
  if (
    typeof provided !== 'string' ||
    provided.length === 0 ||
    !req.adminSession ||
    !safeEqual(hashCsrfToken(provided), req.adminSession.csrfHash)
  ) {
    return res.status(403).json({ error: 'Mã bảo vệ CSRF không hợp lệ. Vui lòng tải lại trang.' });
  }

  return next();
}

module.exports = {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_TTL_MS,
  ADMIN_SESSION_IDLE_MS,
  ADMIN_SESSION_MAX_PER_ADMIN,
  ADMIN_LAST_SEEN_UPDATE_MS,
  getAdminSessionToken,
  csrfTokenForSession,
  createAdminSession,
  getAdminSession,
  destroyAdminSession,
  revokeAdminSessions,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  requireAdmin,
  requireAdminCsrf,
};
