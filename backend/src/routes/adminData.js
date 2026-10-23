const express = require('express');
const { getDb, queryOne, queryAll, runSql } = require('../database/db');
const { requireAdmin, requireAdminCsrf } = require('../auth/adminSession');
const { writeAudit } = require('../auth/adminAudit');
const { getClientIp } = require('../auth/rateLimit');
const { writeAdmission } = require('../admin/admissionWrite');
const { validateRow } = require('../admin/dataValidation');
const {
  DATA_TABLES,
  getTableMeta,
  getColumnMeta,
  getPublicTableMeta,
} = require('../admin/dataSchema');
const { HttpError, isUniqueConstraintError } = require('../admin/errors');
const { asyncRoute, parseId } = require('../admin/routeUtils');

const router = express.Router();

router.use(requireAdmin);
router.use(requireAdminCsrf);
router.use(async (req, res, next) => {
  try {
    await getDb();
    next();
  } catch (error) {
    next(error);
  }
});

function requireTable(req) {
  const meta = getTableMeta(req.params.table);
  if (!meta) throw new HttpError(404, 'Không tìm thấy bảng dữ liệu.');
  return meta;
}

function requireRowId(req) {
  const id = parseId(req.params.id);
  if (!id) throw new HttpError(400, 'Mã dòng dữ liệu không hợp lệ.');
  return id;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function parsePage(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) return fallback;
  return parsed;
}

function getListColumns(tableMeta) {
  const direct = tableMeta.columns
    .filter((column) => !column.listOmit)
    .map((column) => column.name);
  const previews = tableMeta.columns
    .filter((column) => column.listOmit)
    .map((column) => `substr(${column.name}, 1, 200) AS ${column.name}_preview`);
  return [...direct, ...previews].join(', ');
}

function buildSearch(tableMeta, search) {
  if (!search) return { where: '', params: [] };
  const escaped = `%${escapeLike(search)}%`;
  const clause = tableMeta.searchColumns
    .map((column) => `COALESCE(${column}, '') LIKE ? ESCAPE '\\'`)
    .join(' OR ');
  return {
    where: `WHERE (${clause})`,
    params: tableMeta.searchColumns.map(() => escaped),
  };
}

function fetchRow(tableMeta, id) {
  return queryOne(
    `SELECT * FROM ${tableMeta.table} WHERE ${tableMeta.primaryKey} = ?`,
    [id]
  );
}

// Control flags travel with the body but are not table columns.
function getDataInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const { force, confirm, ...input } = body;
  return input;
}

function uniqueColumns(tableMeta) {
  return tableMeta.columns.filter((column) => column.unique && !column.readOnly);
}

function checkUnique(tableMeta, values, excludeId = null) {
  for (const column of uniqueColumns(tableMeta)) {
    const value = values[column.name];
    if (value === undefined || value === null) continue;

    const params = [value];
    let sql = `SELECT ${tableMeta.primaryKey} AS id FROM ${tableMeta.table} WHERE ${column.name} = ?`;
    if (excludeId !== null) {
      sql += ` AND ${tableMeta.primaryKey} <> ?`;
      params.push(excludeId);
    }

    const conflict = queryOne(sql, params);
    if (conflict) {
      throw new HttpError(409, `${column.name} đã tồn tại trong bảng ${tableMeta.label}.`);
    }
  }
}

function countSchoolDependencies(maTruong) {
  if (typeof maTruong !== 'string' || !maTruong) {
    return { diem_chuan: 0, de_an_tuyen_sinh: 0, total: 0 };
  }

  const scores = queryOne(
    'SELECT COUNT(*) AS total FROM diem_chuan WHERE ma_truong = ?',
    [maTruong]
  );
  const proposals = queryOne(
    'SELECT COUNT(*) AS total FROM de_an_tuyen_sinh WHERE ma_truong = ?',
    [maTruong]
  );

  const diemChuan = Number(scores ? scores.total : 0);
  const deAn = Number(proposals ? proposals.total : 0);

  return {
    diem_chuan: diemChuan,
    de_an_tuyen_sinh: deAn,
    total: diemChuan + deAn,
  };
}

function schoolWarning(tableMeta, row) {
  if (!row || !row.ma_truong) return null;
  if (tableMeta.table !== 'diem_chuan' && tableMeta.table !== 'de_an_tuyen_sinh') {
    return null;
  }

  const school = queryOne('SELECT id FROM truong WHERE ma_truong = ?', [row.ma_truong]);
  if (school) return null;
  return `Mã trường ${row.ma_truong} chưa có trong bảng Trường.`;
}

async function audit(req, action, tableMeta, entityId, details) {
  await writeAudit({
    adminId: req.admin.id,
    adminUsername: req.admin.username,
    action,
    entity: tableMeta.table,
    entityId,
    details,
    ip: getClientIp(req),
  });
}

router.get(
  '/tables',
  asyncRoute(async (req, res) => {
    res.json({ data: DATA_TABLES.map(getPublicTableMeta) });
  })
);

router.get(
  '/:table',
  asyncRoute(async (req, res) => {
    const tableMeta = requireTable(req);
    const limit = parsePage(req.query.limit, 25, 100);
    const page = parsePage(req.query.page, 1, 100000);
    const offset = (page - 1) * limit;
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

    const { where, params } = buildSearch(tableMeta, search);

    const sortColumn = getColumnMeta(tableMeta, req.query.sort);
    const sort =
      sortColumn && sortColumn.sortable ? sortColumn.name : tableMeta.defaultSort;
    const order = String(req.query.order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const totalRow = queryOne(
      `SELECT COUNT(*) AS total FROM ${tableMeta.table} ${where}`,
      params
    );

    const rows = queryAll(
      `SELECT ${getListColumns(tableMeta)}
         FROM ${tableMeta.table}
         ${where}
         ORDER BY ${sort} ${order}
         LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      total: Number(totalRow ? totalRow.total : 0),
      page,
      limit,
      table: getPublicTableMeta(tableMeta),
    });
  })
);

router.get(
  '/:table/:id',
  asyncRoute(async (req, res) => {
    const tableMeta = requireTable(req);
    const id = requireRowId(req);
    const row = fetchRow(tableMeta, id);
    if (!row) throw new HttpError(404, 'Không tìm thấy dòng dữ liệu.');
    res.json({ data: row, table: getPublicTableMeta(tableMeta) });
  })
);

router.post(
  '/:table',
  asyncRoute(async (req, res) => {
    const tableMeta = requireTable(req);
    const validated = validateRow(tableMeta, getDataInput(req.body), { partial: false });
    if (!validated.ok) throw new HttpError(400, validated.error);

    checkUnique(tableMeta, validated.values);

    const columns = Object.keys(validated.values);
    const placeholders = columns.map(() => '?').join(', ');
    const params = columns.map((column) => validated.values[column]);

    let insertedId;

    try {
      insertedId = await writeAdmission(
        () => {
          runSql(
            `INSERT INTO ${tableMeta.table} (${columns.join(', ')}) VALUES (${placeholders})`,
            params
          );
          const row = queryOne('SELECT last_insert_rowid() AS id');
          return row ? Number(row.id) : null;
        },
        { reason: 'create' }
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new HttpError(409, 'Giá trị duy nhất đã tồn tại trong bảng này.');
      }
      throw error;
    }

    const row = fetchRow(tableMeta, Number(insertedId));
    await audit(req, 'admin.data.create', tableMeta, insertedId, {
      values: validated.values,
    });

    const warning = schoolWarning(tableMeta, row);
    res.status(201).json({ data: row, ...(warning ? { warning } : {}) });
  })
);

router.patch(
  '/:table/:id',
  asyncRoute(async (req, res) => {
    const tableMeta = requireTable(req);
    const id = requireRowId(req);

    const existing = fetchRow(tableMeta, id);
    if (!existing) throw new HttpError(404, 'Không tìm thấy dòng dữ liệu.');

    const validated = validateRow(tableMeta, getDataInput(req.body), { partial: true });
    if (!validated.ok) throw new HttpError(400, validated.error);

    checkUnique(tableMeta, validated.values, id);

    const dependencyKey =
      tableMeta.table === 'truong' && Object.prototype.hasOwnProperty.call(validated.values, 'ma_truong')
        ? validated.values.ma_truong
        : null;

    let force = false;
    if (
      dependencyKey !== null &&
      dependencyKey !== existing.ma_truong
    ) {
      const dependencies = countSchoolDependencies(existing.ma_truong);
      if (dependencies.total > 0) {
        if (req.body?.force !== true) {
          throw new HttpError(
            409,
            `Trường ${existing.ma_truong} đang được ${dependencies.total} dòng dữ liệu tham chiếu. ` +
              'Hãy xác nhận ghi đè nếu bạn chắc chắn muốn đổi mã trường.',
            'DEPENDENCIES_EXIST'
          );
        }
        force = true;
      }
    }

    const columns = Object.keys(validated.values);
    const assignments = columns.map((column) => `${column} = ?`).join(', ');
    const params = [...columns.map((column) => validated.values[column]), id];

    try {
      await writeAdmission(
        () => {
          runSql(
            `UPDATE ${tableMeta.table} SET ${assignments} WHERE ${tableMeta.primaryKey} = ?`,
            params
          );
        },
        { reason: force ? 'force-update' : 'update', backup: force }
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new HttpError(409, 'Giá trị duy nhất đã tồn tại trong bảng này.');
      }
      throw error;
    }

    const row = fetchRow(tableMeta, id);
    await audit(
      req,
      force ? 'admin.data.force_update' : 'admin.data.update',
      tableMeta,
      id,
      {
        changes: validated.values,
        force,
      }
    );

    const warning = schoolWarning(tableMeta, row);
    res.json({ data: row, ...(warning ? { warning } : {}) });
  })
);

router.delete(
  '/:table/:id',
  asyncRoute(async (req, res) => {
    const tableMeta = requireTable(req);
    const id = requireRowId(req);

    if (req.body?.confirm !== true) {
      throw new HttpError(400, 'Vui lòng xác nhận xóa dữ liệu.');
    }

    const existing = fetchRow(tableMeta, id);
    if (!existing) throw new HttpError(404, 'Không tìm thấy dòng dữ liệu.');

    let dependencies = null;
    let force = false;

    if (tableMeta.table === 'truong') {
      dependencies = countSchoolDependencies(existing.ma_truong);
      if (dependencies.total > 0) {
        if (req.body?.force !== true) {
          throw new HttpError(
            409,
            `Không thể xóa trường ${existing.ma_truong} vì đang có ${dependencies.total} dòng dữ liệu tham chiếu.`,
            'DEPENDENCIES_EXIST'
          );
        }
        force = true;
      }
    }

    await writeAdmission(
      () => {
        runSql(
          `DELETE FROM ${tableMeta.table} WHERE ${tableMeta.primaryKey} = ?`,
          [id]
        );
      },
      { reason: force ? 'force-delete' : 'delete', backup: true }
    );

    await audit(
      req,
      force ? 'admin.data.force_delete' : 'admin.data.delete',
      tableMeta,
      id,
      {
        snapshot: existing,
        dependencies,
        force,
      }
    );

    res.status(204).end();
  })
);

module.exports = router;
