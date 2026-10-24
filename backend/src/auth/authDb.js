const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const AUTH_DB_PATH = process.env.LEARNPATH_AUTH_DB_PATH
  ? path.resolve(process.env.LEARNPATH_AUTH_DB_PATH)
  : path.join(__dirname, '../../database/auth.db');

const MAIN_DB_PATH = process.env.LEARNPATH_DB_PATH
  ? path.resolve(process.env.LEARNPATH_DB_PATH)
  : path.join(__dirname, '../../database/learnpath.db');

const SCHEMA_VERSION = 5;

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

function getTableNames(database) {
  const result = database.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
  );
  return result.length ? result[0].values.map((row) => row[0]) : [];
}

function getColumnNames(database, table) {
  const result = database.exec(`PRAGMA table_info(${table})`);
  return result.length ? result[0].values.map((row) => row[1]) : [];
}

function ensureColumn(database, table, column, definition) {
  if (!getColumnNames(database, table).includes(column)) {
    database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

function createAdminSchema(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT NOT NULL,
      username_lower TEXT NOT NULL UNIQUE,
      password_hash  TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'disabled')),
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL,
      last_login_at  INTEGER
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash   TEXT PRIMARY KEY,
      admin_id     INTEGER NOT NULL,
      created_at   INTEGER NOT NULL,
      expires_at   INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      csrf_hash    TEXT NOT NULL,
      user_agent   TEXT,
      ip_hash      TEXT,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS admin_audit (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id       INTEGER,
      admin_username TEXT NOT NULL,
      action         TEXT NOT NULL,
      entity         TEXT,
      entity_id      TEXT,
      details        TEXT,
      ip_hash        TEXT,
      created_at     INTEGER NOT NULL
    );
  `);

  database.run(
    'CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);'
  );
  database.run(
    'CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);'
  );
  database.run(
    'CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit(created_at);'
  );
  database.run(
    'CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON admin_audit(admin_id);'
  );
}

function createSchema(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      username             TEXT NOT NULL,
      username_lower       TEXT NOT NULL UNIQUE,
      password_hash        TEXT NOT NULL,
      created_at           INTEGER NOT NULL,
      status               TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'locked', 'deleted')),
      updated_at           INTEGER,
      last_login_at        INTEGER,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      survey_completed     INTEGER NOT NULL DEFAULT 0,
      deleted_at           INTEGER
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

  database.run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id          INTEGER PRIMARY KEY,
      ho_va_ten        TEXT,
      lop              TEXT,
      truong           TEXT,
      diem_lop         TEXT,
      chung_chi        TEXT,
      truong_muc_tieu  TEXT,
      nganh_muc_tieu   TEXT,
      to_hop_mong_muon TEXT,
      khac             TEXT,
      updated_at       INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS survey_questions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      question      TEXT NOT NULL,
      question_type TEXT NOT NULL DEFAULT 'text'
                    CHECK (question_type IN ('text', 'textarea')),
      placeholder   TEXT,
      is_required   INTEGER NOT NULL DEFAULT 0,
      order_index   INTEGER NOT NULL DEFAULT 0,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );
  `);

  database.run(
    'CREATE INDEX IF NOT EXISTS idx_survey_questions_order ON survey_questions(order_index, is_active);'
  );

  database.run(`
    CREATE TABLE IF NOT EXISTS academic_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject_name TEXT NOT NULL,
      term TEXT NOT NULL,
      school_year TEXT NOT NULL,
      score_type TEXT NOT NULL DEFAULT 'average',
      score REAL NOT NULL,
      source TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, subject_name, term, school_year, score_type)
    );
    CREATE INDEX IF NOT EXISTS idx_academic_scores_user ON academic_scores(user_id, school_year, term);
    CREATE TABLE IF NOT EXISTS career_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      school_code TEXT,
      school_name TEXT NOT NULL,
      major_name TEXT NOT NULL,
      method TEXT NOT NULL,
      admission_block TEXT,
      year INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('target', 'pinned')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_career_selections_user ON career_selections(user_id, kind);
    CREATE TABLE IF NOT EXISTS career_rubrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_code TEXT,
      school_name TEXT NOT NULL,
      major_name TEXT NOT NULL,
      method TEXT NOT NULL,
      admission_block TEXT,
      year INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(school_code, school_name, major_name, method, admission_block, year)
    );
    CREATE TABLE IF NOT EXISTS career_rubric_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rubric_id INTEGER NOT NULL,
      subject_name TEXT NOT NULL,
      weight REAL NOT NULL,
      threshold REAL NOT NULL,
      FOREIGN KEY (rubric_id) REFERENCES career_rubrics(id) ON DELETE CASCADE,
      UNIQUE(rubric_id, subject_name)
    );
  `);

  createAdminSchema(database);
  database.run(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

function verifySchema(database) {
  const tables = getTableNames(database);
  const requiredTables = [
    'users',
    'sessions',
    'admins',
    'admin_sessions',
    'admin_audit',
    'user_profiles',
    'survey_questions',
    'academic_scores',
    'career_selections',
    'career_rubrics',
    'career_rubric_subjects',
  ];
  const missingTables = requiredTables.filter((table) => !tables.includes(table));

  const requiredUserColumns = [
    'id',
    'username',
    'username_lower',
    'password_hash',
    'created_at',
    'status',
    'updated_at',
    'last_login_at',
    'must_change_password',
    'survey_completed',
    'deleted_at',
  ];
  const userColumns = tables.includes('users') ? getColumnNames(database, 'users') : [];
  const missingUserColumns = requiredUserColumns.filter(
    (column) => !userColumns.includes(column)
  );

  const requiredAdminSessionColumns = [
    'token_hash',
    'admin_id',
    'created_at',
    'expires_at',
    'last_seen_at',
    'csrf_hash',
    'user_agent',
    'ip_hash',
  ];
  const adminSessionColumns = tables.includes('admin_sessions')
    ? getColumnNames(database, 'admin_sessions')
    : [];
  const missingAdminSessionColumns = requiredAdminSessionColumns.filter(
    (column) => !adminSessionColumns.includes(column)
  );

  const requiredSurveyQuestionColumns = [
    'id',
    'question',
    'question_type',
    'placeholder',
    'is_required',
    'order_index',
    'is_active',
    'created_at',
    'updated_at',
  ];
  const surveyQuestionColumns = tables.includes('survey_questions')
    ? getColumnNames(database, 'survey_questions')
    : [];
  const missingSurveyQuestionColumns = requiredSurveyQuestionColumns.filter(
    (column) => !surveyQuestionColumns.includes(column)
  );

  if (
    missingTables.length ||
    missingUserColumns.length ||
    missingAdminSessionColumns.length ||
    missingSurveyQuestionColumns.length
  ) {
    throw new Error(
      'Auth database schema is incomplete. Restore the auth database from backup ' +
        'or remove it to recreate it only when account loss is acceptable.'
    );
  }

  const requiredCareerTables = ['academic_scores', 'career_selections', 'career_rubrics', 'career_rubric_subjects'];
  const missingCareerTables = requiredCareerTables.filter((table) => !tables.includes(table));
  if (missingCareerTables.length) {
    throw new Error(
      'Auth database schema is incomplete. Restore the auth database from backup ' +
        'or remove it to recreate it only when account loss is acceptable.'
    );
  }
}

function backupBeforeMigration(version) {
  if (!fs.existsSync(AUTH_DB_PATH)) return null;

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const backupPath = `${AUTH_DB_PATH}.v${version}-backup-${stamp}`;
  fs.copyFileSync(AUTH_DB_PATH, backupPath);
  console.log(`Auth database backup created before migration: ${backupPath}`);
  return backupPath;
}

function migrateSchema(database, version) {
  if (version === 1 || version === 2 || version === 3 || version === 4) {
    backupBeforeMigration(version);

    database.run('BEGIN');
    try {
      if (version === 1) {
        ensureColumn(database, 'users', 'status', "TEXT NOT NULL DEFAULT 'active'");
        ensureColumn(database, 'users', 'updated_at', 'INTEGER');
        ensureColumn(database, 'users', 'last_login_at', 'INTEGER');
        ensureColumn(
          database,
          'users',
          'must_change_password',
          'INTEGER NOT NULL DEFAULT 0'
        );
        ensureColumn(database, 'users', 'deleted_at', 'INTEGER');

        database.run('UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;');
        createAdminSchema(database);
      }

      if (version === 1 || version === 2) {
        database.run(`
          CREATE TABLE IF NOT EXISTS user_profiles (
            user_id          INTEGER PRIMARY KEY,
            ho_va_ten        TEXT,
            lop              TEXT,
            truong           TEXT,
            diem_lop         TEXT,
            chung_chi        TEXT,
            truong_muc_tieu  TEXT,
            nganh_muc_tieu   TEXT,
            to_hop_mong_muon TEXT,
            khac             TEXT,
            updated_at       INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);
      }

      if (version <= 4) {
        database.run(`
          CREATE TABLE IF NOT EXISTS academic_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
            subject_name TEXT NOT NULL, term TEXT NOT NULL, school_year TEXT NOT NULL,
            score_type TEXT NOT NULL DEFAULT 'average', score REAL NOT NULL, source TEXT,
            updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, subject_name, term, school_year, score_type)
          );
          CREATE INDEX IF NOT EXISTS idx_academic_scores_user ON academic_scores(user_id, school_year, term);
          CREATE TABLE IF NOT EXISTS career_selections (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
            school_code TEXT, school_name TEXT NOT NULL, major_name TEXT NOT NULL,
            method TEXT NOT NULL, admission_block TEXT, year INTEGER NOT NULL,
            kind TEXT NOT NULL CHECK (kind IN ('target', 'pinned')), created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_career_selections_user ON career_selections(user_id, kind);
          CREATE TABLE IF NOT EXISTS career_rubrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT, school_code TEXT, school_name TEXT NOT NULL,
            major_name TEXT NOT NULL, method TEXT NOT NULL, admission_block TEXT, year INTEGER NOT NULL,
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
            UNIQUE(school_code, school_name, major_name, method, admission_block, year)
          );
          CREATE TABLE IF NOT EXISTS career_rubric_subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT, rubric_id INTEGER NOT NULL,
            subject_name TEXT NOT NULL, weight REAL NOT NULL, threshold REAL NOT NULL,
            FOREIGN KEY (rubric_id) REFERENCES career_rubrics(id) ON DELETE CASCADE,
            UNIQUE(rubric_id, subject_name)
          );
        `);
      }

      // Nâng cấp lên v4:
      ensureColumn(database, 'users', 'survey_completed', 'INTEGER NOT NULL DEFAULT 0');

      // Đánh dấu các user đã có hồ sơ cá nhân là đã hoàn thành khảo sát
      database.run(`
        UPDATE users
           SET survey_completed = 1
         WHERE id IN (
           SELECT user_id FROM user_profiles
            WHERE (ho_va_ten IS NOT NULL AND TRIM(ho_va_ten) != '')
               OR (truong_muc_tieu IS NOT NULL AND TRIM(truong_muc_tieu) != '')
         );
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS survey_questions (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          question      TEXT NOT NULL,
          question_type TEXT NOT NULL DEFAULT 'text'
                        CHECK (question_type IN ('text', 'textarea')),
          placeholder   TEXT,
          is_required   INTEGER NOT NULL DEFAULT 0,
          order_index   INTEGER NOT NULL DEFAULT 0,
          is_active     INTEGER NOT NULL DEFAULT 1,
          created_at    INTEGER NOT NULL,
          updated_at    INTEGER NOT NULL
        );
      `);

      database.run(
        'CREATE INDEX IF NOT EXISTS idx_survey_questions_order ON survey_questions(order_index, is_active);'
      );

      database.run(`PRAGMA user_version = ${SCHEMA_VERSION};`);
      database.run('COMMIT');
    } catch (error) {
      try {
        database.run('ROLLBACK');
      } catch (rollbackError) {
        // The original error is more useful; the transaction may already be closed.
      }
      throw error;
    }
    return;
  }

  throw new Error(
    `No auth database migration path from schema version ${version} to ${SCHEMA_VERSION}.`
  );
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
    verifySchema(database);
    writeDatabaseToDisk(database);
  } else {
    if (version < SCHEMA_VERSION) {
      migrateSchema(database, version);
    }
    verifySchema(database);
    if (version < SCHEMA_VERSION) {
      writeDatabaseToDisk(database);
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
  const previousPath = `${AUTH_DB_PATH}.${process.pid}.${Date.now()}.previous`;

  try {
    fs.writeFileSync(tempPath, buffer);

    try {
      const descriptor = fs.openSync(tempPath, 'r+');
      try {
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
    } catch (syncError) {
      // Best effort; the rename below still prevents a partial target file.
    }

    try {
      fs.renameSync(tempPath, AUTH_DB_PATH);
    } catch (renameError) {
      // On some Windows setups an existing target cannot be replaced by rename.
      // Move the previous file aside first so the replacement stays close to atomic.
      fs.renameSync(AUTH_DB_PATH, previousPath);
      try {
        fs.renameSync(tempPath, AUTH_DB_PATH);
      } catch (secondRenameError) {
        fs.renameSync(previousPath, AUTH_DB_PATH);
        throw secondRenameError;
      }
      fs.rmSync(previousPath, { force: true });
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
    if (fs.existsSync(previousPath)) {
      fs.rmSync(previousPath, { force: true });
    }
  }
}

function saveAuthDb() {
  writeDatabaseToDisk(requireDb());
}

/**
 * Run a synchronous mutation inside one transaction and persist the result.
 * The mutator must not await; hash passwords before calling this helper.
 * A failed disk save reloads the database from disk so memory matches the file.
 */
async function runAuthMutation(mutator) {
  await getAuthDb();

  runSql('BEGIN');
  let result;
  try {
    result = mutator();
    runSql('COMMIT');
  } catch (error) {
    try {
      runSql('ROLLBACK');
    } catch (rollbackError) {
      // The original error is more useful; the transaction may already be closed.
    }
    throw error;
  }

  try {
    saveAuthDb();
  } catch (error) {
    try {
      await reloadAuthDb();
    } catch (reloadError) {
      console.error('[auth-db] Failed to reload after a save error:', reloadError.message);
    }
    throw error;
  }

  return result;
}

async function reloadAuthDb() {
  if (db) {
    try {
      db.close();
    } catch (closeError) {
      // The in-memory copy is being discarded; continue with a fresh open.
    }
  }
  db = null;
  initPromise = null;
  return getAuthDb();
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
  MAIN_DB_PATH,
  SCHEMA_VERSION,
  getAuthDb,
  saveAuthDb,
  runAuthMutation,
  reloadAuthDb,
  queryAll,
  queryOne,
  runSql,
  getRowsModified,
  lastInsertId,
};
