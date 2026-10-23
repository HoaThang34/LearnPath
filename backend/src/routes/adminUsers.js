const express = require('express');
const { requireAdmin, requireAdminCsrf } = require('../auth/adminSession');
const { writeAudit } = require('../auth/adminAudit');
const { getClientIp } = require('../auth/rateLimit');
const {
  listUsers,
  getUserById,
  createUser,
  createUsersBulk,
  updateUsername,
  setUserStatus,
  resetUserPassword,
  softDeleteUser,
  restoreUser,
} = require('../admin/userAdmin');
const { HttpError } = require('../admin/errors');
const { asyncRoute, parseId } = require('../admin/routeUtils');

const router = express.Router();

router.use(requireAdmin);
router.use(requireAdminCsrf);

function requireUserId(req) {
  const id = parseId(req.params.id);
  if (!id) throw new HttpError(400, 'Mã tài khoản không hợp lệ.');
  return id;
}

async function audit(req, action, entityId, details = null) {
  await writeAudit({
    adminId: req.admin.id,
    adminUsername: req.admin.username,
    action,
    entity: 'user',
    entityId,
    details,
    ip: getClientIp(req),
  });
}

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const result = await listUsers({
      query: req.query.query,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json(result);
  })
);

router.post(
  '/',
  asyncRoute(async (req, res) => {
    const result = await createUser(req.body ? req.body.username : undefined);
    await audit(req, 'admin.user.create', result.user.id, {
      username: result.user.username,
    });
    res.status(201).json({
      data: {
        id: result.user.id,
        username: result.user.username,
        password: result.password,
      },
    });
  })
);

router.post(
  '/bulk',
  asyncRoute(async (req, res) => {
    const result = await createUsersBulk(req.body || {});
    await audit(req, 'admin.user.bulk_create', null, {
      created: result.data.length,
      skipped: result.skipped.length,
      usernames: result.data.map((item) => item.username),
    });
    res.status(201).json(result);
  })
);

router.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const id = requireUserId(req);
    const user = await getUserById(id);
    if (!user) throw new HttpError(404, 'Không tìm thấy tài khoản.');
    res.json({ data: user });
  })
);

router.patch(
  '/:id',
  asyncRoute(async (req, res) => {
    const id = requireUserId(req);
    const previous = await getUserById(id);
    if (!previous) throw new HttpError(404, 'Không tìm thấy tài khoản.');

    const user = await updateUsername(id, req.body ? req.body.username : undefined);
    await audit(req, 'admin.user.update', id, {
      previousUsername: previous.username,
      username: user.username,
    });
    res.json({ data: user });
  })
);

router.post(
  '/:id/lock',
  asyncRoute(async (req, res) => {
    const id = requireUserId(req);
    const user = await setUserStatus(id, 'locked');
    await audit(req, 'admin.user.lock', id, { username: user.username });
    res.json({ data: user });
  })
);

router.post(
  '/:id/unlock',
  asyncRoute(async (req, res) => {
    const id = requireUserId(req);
    const user = await setUserStatus(id, 'active');
    await audit(req, 'admin.user.unlock', id, { username: user.username });
    res.json({ data: user });
  })
);

router.post(
  '/:id/restore',
  asyncRoute(async (req, res) => {
    const id = requireUserId(req);
    const user = await restoreUser(id);
    await audit(req, 'admin.user.restore', id, { username: user.username });
    res.json({ data: user });
  })
);

router.post(
  '/:id/reset-password',
  asyncRoute(async (req, res) => {
    const id = requireUserId(req);
    const result = await resetUserPassword(id);
    await audit(req, 'admin.user.reset_password', id, {
      username: result.user.username,
    });
    res.json({
      data: {
        id: result.user.id,
        username: result.user.username,
        password: result.password,
        mustChangePassword: true,
      },
    });
  })
);

router.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const id = requireUserId(req);
    const confirmUsername = req.body ? req.body.confirmUsername : undefined;
    const user = await softDeleteUser(id, confirmUsername);
    await audit(req, 'admin.user.delete', id, {
      username: user.username,
      softDelete: true,
    });
    res.status(204).end();
  })
);

module.exports = router;
