const express = require('express');
const fs = require('fs');
const { getDb, DB_PATH, queryOne } = require('../database/db');
const { getAuthDb, AUTH_DB_PATH, queryOne: queryAuthOne } = require('../auth/authDb');
const { requireAdmin } = require('../auth/adminSession');
const { countUsersByStatus } = require('../admin/userAdmin');
const { DATA_TABLES } = require('../admin/dataSchema');
const { getWriteState } = require('../admin/admissionWrite');
const { asyncRoute } = require('../admin/routeUtils');

const router = express.Router();

router.get(
  '/',
  requireAdmin,
  asyncRoute(async (req, res) => {
    const db = await getDb();
    await getAuthDb();

    const tableCounts = DATA_TABLES.map((table) => {
      const row = queryOne(`SELECT COUNT(*) AS total FROM ${table.table}`);
      return {
        table: table.table,
        label: table.label,
        total: Number(row ? row.total : 0),
      };
    });

    const userStats = await countUsersByStatus();
    const adminCount = queryAuthOne('SELECT COUNT(*) AS total FROM admins');
    const writeState = getWriteState();
    const admissionSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
    const authSize = fs.existsSync(AUTH_DB_PATH) ? fs.statSync(AUTH_DB_PATH).size : 0;

    const integrity = db.exec('PRAGMA quick_check');
    const integrityValue =
      integrity.length && integrity[0].values.length
        ? String(integrity[0].values[0][0])
        : 'failed';

    res.json({
      data: {
        tables: tableCounts,
        users: userStats,
        admins: Number(adminCount ? adminCount.total : 0),
        database: {
          path: DB_PATH,
          size: admissionSize,
          integrity: integrityValue,
          writeBlocked: writeState.blocked,
          lastWriteAt: writeState.lastWriteAt,
          lastBackup: writeState.backups[0] || null,
          backups: writeState.backups,
        },
        authDatabase: {
          path: AUTH_DB_PATH,
          size: authSize,
        },
        session: {
          createdAt: new Date(req.adminSession.createdAt).toISOString(),
          expiresAt: new Date(req.adminSession.expiresAt).toISOString(),
          lastSeenAt: new Date(req.adminSession.lastSeenAt).toISOString(),
        },
        serverTime: new Date().toISOString(),
      },
    });
  })
);

module.exports = router;
