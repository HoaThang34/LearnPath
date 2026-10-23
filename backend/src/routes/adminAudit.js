const express = require('express');
const { requireAdmin } = require('../auth/adminSession');
const { listAudit } = require('../auth/adminAudit');
const { asyncRoute } = require('../admin/routeUtils');

const router = express.Router();

router.use(requireAdmin);

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const result = await listAudit({
      action: req.query.action,
      adminUsername: req.query.admin,
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json(result);
  })
);

module.exports = router;
