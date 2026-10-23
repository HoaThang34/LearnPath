const express = require('express');
const { verifyAdminCredentials, updateAdminLastLogin } = require('../auth/adminAuth');
const {
  createAdminSession,
  destroyAdminSession,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  requireAdmin,
  requireAdminCsrf,
  ADMIN_SESSION_TTL_MS,
  ADMIN_SESSION_IDLE_MS,
} = require('../auth/adminSession');
const { writeAudit, cleanupAudit } = require('../auth/adminAudit');
const {
  checkAdminLoginRateLimit,
  recordAdminLoginFailure,
  clearAdminLoginFailures,
  getClientIp,
} = require('../auth/rateLimit');
const { validateAdminLogin } = require('../auth/validation');
const { requireTrustedOrigin } = require('../auth/origin');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
});

router.use(requireTrustedOrigin);

function sendRateLimit(res, retryAfter) {
  res.set('Retry-After', String(retryAfter));
  return res.status(429).json({
    error: 'Quá nhiều lần đăng nhập quản trị. Vui lòng thử lại sau.',
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function auditSafely(payload) {
  try {
    await writeAudit(payload);
  } catch (error) {
    console.error('[admin-audit] Failed to write audit entry:', error.message);
  }
}

router.post('/login', async (req, res, next) => {
  const validation = validateAdminLogin(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const ip = getClientIp(req);
  const rate = checkAdminLoginRateLimit(ip, validation.usernameLower);
  if (!rate.allowed) {
    return sendRateLimit(res, rate.retryAfter);
  }

  try {
    const { admin, passwordMatches } = await verifyAdminCredentials(
      validation.usernameLower,
      validation.password
    );

    if (!passwordMatches) {
      const failures = recordAdminLoginFailure(ip, validation.usernameLower);
      await auditSafely({
        adminUsername: admin ? admin.username : validation.username,
        action: 'admin.login.failure',
        entity: 'admin',
        entityId: admin ? admin.id : null,
        details: { reason: 'invalid_credentials' },
        ip,
      });
      await delay(Math.min(1000, 250 * failures));
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    if (admin.status !== 'active') {
      await auditSafely({
        adminId: admin.id,
        adminUsername: admin.username,
        action: 'admin.login.disabled',
        entity: 'admin',
        entityId: admin.id,
        details: { reason: 'disabled' },
        ip,
      });
      await delay(250);
      return res.status(403).json({ error: 'Tài khoản quản trị không khả dụng.' });
    }

    clearAdminLoginFailures(ip, validation.usernameLower);
    await updateAdminLastLogin(admin.id);

    const session = await createAdminSession(admin.id, {
      ip,
      userAgent: req.get('User-Agent'),
    });
    setAdminSessionCookie(res, session.token);

    await auditSafely({
      adminId: admin.id,
      adminUsername: admin.username,
      action: 'admin.login.success',
      entity: 'admin',
      entityId: admin.id,
      details: { sessionExpiresAt: new Date(session.expiresAt).toISOString() },
      ip,
    });

    await cleanupAudit().catch((error) => {
      console.error('[admin-audit] Failed to clean old entries:', error.message);
    });

    return res.json({
      data: {
        admin: {
          id: Number(admin.id),
          username: admin.username,
          createdAt: new Date(Number(admin.created_at)).toISOString(),
          lastLoginAt: new Date(Number(admin.last_login_at)).toISOString(),
        },
        csrfToken: session.csrfToken,
        session: {
          expiresAt: new Date(session.expiresAt).toISOString(),
          idleTimeoutMs: ADMIN_SESSION_IDLE_MS,
          absoluteTimeoutMs: ADMIN_SESSION_TTL_MS,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({
    data: {
      admin: req.admin,
      csrfToken: req.adminCsrfToken,
      session: {
        createdAt: new Date(req.adminSession.createdAt).toISOString(),
        expiresAt: new Date(req.adminSession.expiresAt).toISOString(),
        lastSeenAt: new Date(req.adminSession.lastSeenAt).toISOString(),
        idleTimeoutMs: ADMIN_SESSION_IDLE_MS,
        absoluteTimeoutMs: ADMIN_SESSION_TTL_MS,
      },
    },
  });
});

router.post('/logout', requireAdmin, requireAdminCsrf, async (req, res, next) => {
  try {
    await destroyAdminSession(req);
    clearAdminSessionCookie(res);
    await auditSafely({
      adminId: req.admin.id,
      adminUsername: req.admin.username,
      action: 'admin.logout',
      entity: 'admin',
      entityId: req.admin.id,
      ip: getClientIp(req),
    });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
