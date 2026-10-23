const express = require('express');
const { requireTrustedOrigin } = require('../auth/origin');
const adminAuthRoutes = require('./adminAuth');
const adminOverviewRoutes = require('./adminOverview');
const adminUserRoutes = require('./adminUsers');
const adminDataRoutes = require('./adminData');
const adminAuditRoutes = require('./adminAudit');

const router = express.Router();

function normalizeIp(value) {
  if (typeof value !== 'string') return '';
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

function getAllowedAdminIps() {
  const configured = process.env.ADMIN_ALLOWED_IPS;
  if (!configured) return null;

  const values = configured
    .split(',')
    .map((value) => normalizeIp(value.trim()))
    .filter(Boolean);

  return values.length > 0 ? values : null;
}

router.use((req, res, next) => {
  const allowed = getAllowedAdminIps();
  if (!allowed) return next();

  const clientIp = normalizeIp(req.ip || req.socket?.remoteAddress || '');
  if (allowed.includes(clientIp)) return next();

  console.warn(`[admin] Rejected admin request from a non-allowlisted IP: ${clientIp}`);
  return res.status(403).json({ error: 'Không có quyền truy cập khu vực quản trị.' });
});

router.use(requireTrustedOrigin);
router.use(express.json({ limit: '2mb' }));

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
});

router.use('/auth', adminAuthRoutes);
router.use('/overview', adminOverviewRoutes);
router.use('/users', adminUserRoutes);
router.use('/data', adminDataRoutes);
router.use('/audit', adminAuditRoutes);

router.use((req, res) => {
  res.status(404).json({ error: 'Không tìm thấy API quản trị.' });
});

router.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
  }

  if (res.headersSent) return next(err);

  if (err && Number.isInteger(err.status) && err.status >= 400 && err.status < 600) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
  }

  console.error('[admin] Unhandled error:', err);
  return res.status(500).json({ error: 'Đã xảy ra lỗi máy chủ.' });
});

module.exports = router;
