const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const AUTH_DB_PATH = process.env.LEARNPATH_AUTH_DB_PATH
  ? path.resolve(process.env.LEARNPATH_AUTH_DB_PATH)
  : path.join(__dirname, '../../database/auth.db');

const MAIN_DB_PATH = process.env.LEARNPATH_DB_PATH
  ? path.resolve(process.env.LEARNPATH_DB_PATH)
  : path.join(__dirname, '../../database/learnpath.db');

const SCHEMA_VERSION = 1;

let db = null;
let initPromise = null;

function ensureParentDir() {
  const dbDir = path.dirname(AUTH_DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function normalizePathForComparison(value) {
  const resolved = path.resolve(value);
  // Windows paths are case-insensitive; compare normalized paths so a
  // differently-cased auth path cannot point at the admission DB.
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

if (normalizePathForComparison(AUTH_DB_PATH) === normalizePathForComparison(MAIN_DB_PATH)) {
  throw new Error(
    'Auth database path must be different from the main LearnPath database path. ' +
      'Set LEARNPATH_AUTH_DB_PATH to a separate file.'
  );
}

function getUserVersion(database) {
  const result = database.exec('PRAGMA user_version');
  if (!result.length || !result[0].values.length) return 0;
  return Number(result[0].values[0][0]) || 0;
}

function createSchema(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT NOT NULL,
      username_lower TEXT NOT NULL UNIQUE,
      password_hash  TEXT NOT NULL,
      created_at     INTEGER NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  database.run('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);');
  database.run('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);');
  database.run(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

function openDatabase(SQL) {
  ensureParentDir();

  if (!fs.existsSync(AUTH_DB_PATH)) {
    return new SQL.Database();
  }

  const buffer = fs.readFileSync(AUTH_DB_PATH);
  if (buffer.length === 0) {
    return new SQL.Database();
  }
  return new SQL.Database(buffer);
}

async function initialize() {
  const SQL = await initSqlJs();
  const database = openDatabase(SQL);

  database.run('PRAGMA foreign_keys = ON;');

  const version = getUserVersion(database);
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `Auth database schema version ${version} is newer than this application supports (${SCHEMA_VERSION}).`
    );
  }

  if (version === 0) {
    createSchema(database);
    writeDatabaseToDisk(database);
  } else {
    const schema = database.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'sessions')"
    );
    const tableNames = schema.length ? schema[0].values.map((row) => row[0]) : [];
    if (!tableNames.includes('users') || !tableNames.includes('sessions')) {
      throw new Error('Auth database schema is incomplete. Restore the auth database or remove it to recreate it.');
    }
  }

  db = database;
  return db;
}

async function getAuthDb() {
  if (db) return db;
  if (!initPromise) {
    initPromise = initialize().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

function requireDb() {
  if (!db) {
    throw new Error('Auth database not initialized. Call getAuthDb() first.');
  }
  return db;
}

function writeDatabaseToDisk(database) {
  const buffer = Buffer.from(database.export());
  ensureParentDir();

  const tempPath = `${AUTH_DB_PATH}.${process.pid}.${Date.now()}.tmp`;

  try {
    fs.writeFileSync(tempPath, buffer);

    try {
      fs.renameSync(tempPath, AUTH_DB_PATH);
    } catch (renameError) {
      // On some Windows setups an existing target cannot be replaced by rename.
      fs.copyFileSync(tempPath, AUTH_DB_PATH);
      fs.rmSync(tempPath, { force: true });
    }

    // Best effort on POSIX; ignored on platforms that do not support chmod.
    try {
      fs.chmodSync(AUTH_DB_PATH, 0o600);
    } catch (chmodError) {
      // Not fatal: Windows ACLs are used instead.
    }
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }
  }
}

function saveAuthDb() {
  writeDatabaseToDisk(requireDb());
}

function queryAll(sql, params = []) {
  const database = requireDb();
  const stmt = database.prepare(sql);
  try {
    if (params.length > 0) {
      stmt.bind(params);
    }
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function runSql(sql, params = []) {
  requireDb().run(sql, params);
}

function getRowsModified() {
  return requireDb().getRowsModified();
}

function lastInsertId() {
  const row = queryOne('SELECT last_insert_rowid() AS id');
  return row ? Number(row.id) : null;
}

module.exports = {
  AUTH_DB_PATH,
  SCHEMA_VERSION,
  getAuthDb,
  saveAuthDb,
  queryAll,
  queryOne,
  runSql,
  getRowsModified,
  lastInsertId,
};
