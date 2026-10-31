'use strict';

const express = require('express');
const { requireAdmin, requireAdminCsrf } = require('../auth/adminSession');
const { writeAudit } = require('../auth/adminAudit');
const { getClientIp } = require('../auth/rateLimit');
const { asyncRoute, parseId } = require('../admin/routeUtils');
const { HttpError } = require('../admin/errors');
const {
  listInstruments,
  getInstrument,
  getItems,
  createInstrument,
  updateInstrument,
  replaceItems,
  importInstrument,
  activateInstrument,
  getWeights,
  updateWeights,
  getStats,
  getResultDetail,
  getExportRows,
  toCsv,
} = require('../interest/admin');

const router = express.Router();
router.use(requireAdmin, requireAdminCsrf);

function requireInstrumentId(req) {
  const id = parseId(req.params.id);
  if (!id) throw new HttpError(400, 'Mã bộ câu hỏi không hợp lệ.');
  return id;
}

async function audit(req, action, entityId, details = null) {
  await writeAudit({
    adminId: req.admin.id,
    adminUsername: req.admin.username,
    action,
    entity: 'interest_instrument',
    entityId: entityId === null || entityId === undefined ? null : String(entityId),
    details,
    ip: getClientIp(req),
  });
}

router.get(
  '/instruments',
  asyncRoute(async (req, res) => res.json({ data: listInstruments() }))
);

router.post(
  '/instruments',
  asyncRoute(async (req, res) => {
    const result = await createInstrument(req.body || {});
    await audit(req, 'admin.interest.instrument.create', result.instrument.id, {
      code: result.instrument.code,
      version: result.instrument.version,
      copiedItems: result.items.length,
    });
    return res.status(201).json({ data: result });
  })
);

router.post(
  '/instruments/import',
  asyncRoute(async (req, res) => {
    const result = await importInstrument(req.body || {});
    await audit(req, 'admin.interest.instrument.import', result.instrument.id, {
      code: result.instrument.code,
      version: result.instrument.version,
      counts: result.counts,
    });
    return res.status(201).json({ data: result });
  })
);

router.put(
  '/instruments/:id',
  asyncRoute(async (req, res) => {
    const id = requireInstrumentId(req);
    const instrument = await updateInstrument(id, req.body || {});
    await audit(req, 'admin.interest.instrument.update', id, {
      title: instrument.title,
      sourceNote: instrument.sourceNote,
    });
    return res.json({ data: instrument });
  })
);

router.get(
  '/instruments/:id/items',
  asyncRoute(async (req, res) => {
    const id = requireInstrumentId(req);
    return res.json({ data: { instrument: getInstrument(id), items: getItems(id) } });
  })
);

router.put(
  '/instruments/:id/items',
  asyncRoute(async (req, res) => {
    const id = requireInstrumentId(req);
    const items = await replaceItems(id, req.body?.items);
    await audit(req, 'admin.interest.instrument.update', id, { itemCount: items.length });
    return res.json({ data: { instrument: getInstrument(id), items } });
  })
);

router.post(
  '/instruments/:id/activate',
  asyncRoute(async (req, res) => {
    const id = requireInstrumentId(req);
    const instrument = await activateInstrument(id);
    await audit(req, 'admin.interest.instrument.activate', id, {
      code: instrument.code,
      version: instrument.version,
    });
    return res.json({ data: instrument });
  })
);

router.get(
  '/weights',
  asyncRoute(async (req, res) => res.json({ data: getWeights() }))
);

router.put(
  '/weights',
  asyncRoute(async (req, res) => {
    const weights = await updateWeights(req.body?.weights);
    await audit(req, 'admin.interest.weights.update', 'weights', {
      majorGroups: weights.map((row) => row.majorGroup),
    });
    return res.json({ data: weights });
  })
);

router.get(
  '/results/export',
  asyncRoute(async (req, res) => {
    const csv = toCsv(getExportRows());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="interest-results.csv"');
    return res.send(`\uFEFF${csv}`);
  })
);

router.get(
  '/results',
  asyncRoute(async (req, res) => res.json({ data: getStats() }))
);

router.get(
  '/results/:attemptId',
  asyncRoute(async (req, res) => {
    const attemptId = parseId(req.params.attemptId);
    if (!attemptId) throw new HttpError(400, 'Mã lượt làm không hợp lệ.');
    const detail = getResultDetail(attemptId);
    await audit(req, 'admin.interest.result.view', attemptId, {
      completeness: detail.completeness,
    });
    return res.json({ data: detail });
  })
);

module.exports = router;
