const crypto = require('crypto');
const {
  getAuthDb,
  queryAll,
  queryOne,
  runSql,
  getRowsModified,
  saveAuthDb,
} = require('./authDb');

const AUDIT_RETENTION_DAYS = 180;
const MAX_DETAILS_LENGTH = 4000;
const IP_HASH_SECRET =
  process.env.ADMIN_IP_HASH_SECRET || 'learnpath-admin-ip-hash-v1';

const FORBIDDEN_DETAIL_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'newpassword',
  'new_password',
  'currentpassword',
  'current_password',
  'token',
  'tokenhash',
  'token_hash',
  'csrf',
  'csrftoken',
  'csrf_token',
  'cookie',
  'authorization',
  'secret',
]);

function hashIp(ip) {
  return crypto.createHmac('sha256', IP_HASH_SECRET).update(String(ip)).digest('hex');
}

function sanitizeDetails(value) {
  if (value === undefined || value === null) return null;

  const seen = new WeakSet();

  function walk(input, depth) {
    if (input === null || typeof input !== 'object') return input;
    if (seen.has(input) || depth > 4) return '[omitted]';
    seen.add(input);

    if (Array.isArray(input)) {
      return input.slice(0, 50).map((item) => walk(item, depth + 1));
    }

    const output = {};
    for (const [key, item] of Object.entries(input)) {
      if (FORBIDDEN_DETAIL_KEYS.has(key.toLowerCase())) continue;
      output[key] = walk(item, depth + 1);
    }
    return output;
  }

  let serialized;
  try {
    serialized = JSON.stringify(walk(value, 0));
  } catch (error) {
    serialized = JSON.stringify({ note: 'details unavailable' });
  }

  if (typeof serialized !== 'string') return null;
  return serialized.length > MAX_DETAILS_LENGTH
    ? `${serialized.slice(0, MAX_DETAILS_LENGTH)}...`
    : serialized;
}

async function writeAudit({
  adminId = null,
  adminUsername,
  action,
  entity = null,
  entityId = null,
  details = null,
  ip = null,
}) {
  await getAuthDb();

  runSql(
    `INSERT INTO admin_audit
       (admin_id, admin_username, action, entity, entity_id, details, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      adminId,
      String(adminUsername || 'unknown').slice(0, 64),
      String(action || 'unknown').slice(0, 64),
      entity === null ? null : String(entity).slice(0, 64),
      entityId === null ? null : String(entityId).slice(0, 128),
      sanitizeDetails(details),
      ip ? hashIp(ip) : null,
      Date.now(),
    ]
  );

  saveAuthDb();
}

async function cleanupAudit(retentionDays = AUDIT_RETENTION_DAYS) {
  await getAuthDb();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  runSql('DELETE FROM admin_audit WHERE created_at < ?', [cutoff]);
  const removed = getRowsModified();
  if (removed > 0) saveAuthDb();
  return removed;
}

function parsePositiveInteger(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) return fallback;
  return parsed;
}

async function listAudit({
  action,
  adminUsername,
  from,
  to,
  page = 1,
  limit = 50,
} = {}) {
  await getAuthDb();

  const safeLimit = parsePositiveInteger(limit, 50, 100);
  const safePage = parsePositiveInteger(page, 1, 100000);
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const params = [];

  if (typeof action === 'string' && action.trim()) {
    conditions.push('action = ?');
    params.push(action.trim().slice(0, 64));
  }

  if (typeof adminUsername === 'string' && adminUsername.trim()) {
    conditions.push('admin_username = ?');
    params.push(adminUsername.trim().slice(0, 64));
  }

  const fromValue = Number(from);
  if (Number.isFinite(fromValue) && fromValue > 0) {
    conditions.push('created_at >= ?');
    params.push(Math.floor(fromValue));
  }

  const toValue = Number(to);
  if (Number.isFinite(toValue) && toValue > 0) {
    conditions.push('created_at <= ?');
    params.push(Math.floor(toValue));
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const totalRow = queryOne(`SELECT COUNT(*) AS total FROM admin_audit ${where}`, params);
  const rows = queryAll(
    `SELECT id, admin_id, admin_username, action, entity, entity_id, details, created_at
       FROM admin_audit
       ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  return {
    data: rows.map((row) => ({
      id: Number(row.id),
      adminId: row.admin_id === null ? null : Number(row.admin_id),
      adminUsername: row.admin_username,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      details: row.details,
      createdAt: new Date(Number(row.created_at)).toISOString(),
    })),
    total: Number(totalRow ? totalRow.total : 0),
    page: safePage,
    limit: safeLimit,
  };
}

module.exports = {
  AUDIT_RETENTION_DAYS,
  hashIp,
  sanitizeDetails,
  writeAudit,
  cleanupAudit,
  listAudit,
};
