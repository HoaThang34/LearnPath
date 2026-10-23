const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.LEARNPATH_DB_PATH
  ? path.resolve(process.env.LEARNPATH_DB_PATH)
  : path.join(__dirname, '../../database/learnpath.db');

let db = null;

async function getDb({ createIfMissing = false } = {}) {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else if (createIfMissing) {
    // Only the importer should create an empty database. Schema creation
    // belongs to init.js so there is a single source of truth.
    db = new SQL.Database();
  } else {
    throw new Error(
      `Database not found at ${DB_PATH}. Run "npm run db:init" in backend/ to create and import it.`
    );
  }

  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper: run query and return all rows
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run query and return first row
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run statement (no auto-save)
function runSql(sql, params = []) {
  db.run(sql, params);
}

module.exports = { getDb, saveDb, queryAll, queryOne, runSql };
