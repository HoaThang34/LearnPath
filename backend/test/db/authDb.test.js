'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.env.NODE_ENV = 'test';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-auth-db-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');

const {
  AUTH_DB_PATH,
  SCHEMA_VERSION,
  getAuthDb,
  queryOne,
  queryAll,
  runSql,
  lastInsertId,
  saveAuthDb,
} = require('../../src/auth/authDb');

const MODULE_PATH = path.resolve(__dirname, '../../src/auth/authDb.js');
const EXTRA_FILES = [];

function cleanupPath(filePath) {
  fs.rmSync(filePath, { force: true });
}

test('initializes schema v8 in a new auth database', async () => {
  await getAuthDb();

  assert.equal(fs.existsSync(AUTH_DB_PATH), true);
  assert.equal(SCHEMA_VERSION, 8);
  assert.equal(queryOne('PRAGMA user_version').user_version, SCHEMA_VERSION);

  const tables = queryOne(
    "SELECT group_concat(name, ',') AS names FROM sqlite_master WHERE type = 'table'"
  ).names.split(',');
  for (const table of ['users', 'sessions', 'admins', 'admin_sessions', 'admin_audit', 'user_profiles', 'survey_questions', 'academic_scores', 'career_selections', 'career_rubrics', 'career_rubric_subjects', 'interest_instruments', 'interest_items', 'interest_attempts', 'interest_responses', 'interest_results', 'interest_group_weights', 'interest_group_pairs', 'career_match_config', 'user_exam_scores', 'chat_conversations', 'chat_messages', 'agent_usage', 'agent_consents']) {
    assert.ok(tables.includes(table), `expected table ${table}`);
  }

  const userColumns = queryAll('PRAGMA table_info(users)').map((row) => row.name);
  for (const column of [
    'status',
    'updated_at',
    'last_login_at',
    'must_change_password',
    'survey_completed',
    'interest_completed',
    'deleted_at',
  ]) {
    assert.ok(userColumns.includes(column), `expected users.${column}`);
  }

  const instrument = queryOne(
    "SELECT id, code, version, status FROM interest_instruments WHERE status = 'active'"
  );
  assert.equal(instrument.code, 'holland-pairs-v1');
  assert.equal(Number(instrument.version), 1);
  assert.equal(
    Number(queryOne("SELECT COUNT(*) AS total FROM interest_items WHERE part = 'riasec'").total),
    60
  );
  assert.equal(
    Number(queryOne("SELECT COUNT(*) AS total FROM interest_items WHERE part = 'pairs'").total),
    48
  );
  assert.equal(Number(queryOne('SELECT COUNT(*) AS total FROM interest_group_weights').total), 8);
  assert.equal(Number(queryOne('SELECT COUNT(*) AS total FROM career_match_config').total), 7);

  const adminSessionColumns = queryAll('PRAGMA table_info(admin_sessions)').map(
    (row) => row.name
  );
  for (const column of ['token_hash', 'admin_id', 'csrf_hash', 'last_seen_at']) {
    assert.ok(adminSessionColumns.includes(column), `expected admin_sessions.${column}`);
  }

  const indexes = queryOne(
    "SELECT group_concat(name, ',') AS names FROM sqlite_master WHERE type = 'index'"
  ).names.split(',');
  assert.ok(indexes.includes('idx_sessions_user_id'));
  assert.ok(indexes.includes('idx_sessions_expires_at'));
  assert.ok(indexes.includes('idx_admin_sessions_admin_id'));
  assert.ok(indexes.includes('idx_admin_audit_created_at'));
});

test('writes users to disk and reads them back', async () => {
  const now = Date.now();
  runSql(
    `INSERT INTO users
       (username, username_lower, password_hash, created_at, status, updated_at,
        must_change_password)
     VALUES (?, ?, ?, ?, 'active', ?, 0)`,
    ['DbTestUser', 'dbtestuser', 'scrypt$test$hash', now, now]
  );
  const userId = lastInsertId();
  assert.equal(typeof userId, 'number');
  assert.ok(userId > 0);

  saveAuthDb();

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(AUTH_DB_PATH));
  try {
    const result = db.exec(
      `SELECT id, username, username_lower, password_hash, created_at, status,
              must_change_password, deleted_at
         FROM users
        WHERE id = ?`,
      [userId]
    );
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].values[0], [
      userId,
      'DbTestUser',
      'dbtestuser',
      'scrypt$test$hash',
      now,
      'active',
      0,
      null,
    ]);
  } finally {
    db.close();
  }
});

test('does not leave temporary files after saving', () => {
  saveAuthDb();

  const directory = path.dirname(AUTH_DB_PATH);
  const prefix = path.basename(AUTH_DB_PATH);
  const leftovers = fs
    .readdirSync(directory)
    .filter(
      (name) =>
        name.startsWith(prefix) &&
        (name.endsWith('.tmp') || name.endsWith('.previous'))
    );

  assert.deepEqual(leftovers, []);
});

test('refuses to use the admission database as the auth database', () => {
  const sharedPath = path.join(
    os.tmpdir(),
    `learnpath-auth-shared-${process.pid}-${Date.now()}.db`
  );
  const script = `
    process.env.LEARNPATH_AUTH_DB_PATH = ${JSON.stringify(sharedPath)};
    process.env.LEARNPATH_DB_PATH = ${JSON.stringify(sharedPath)};
    require(${JSON.stringify(MODULE_PATH)});
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be different/i);
  assert.equal(fs.existsSync(sharedPath), false);
});

test('refuses a newer schema version', async () => {
  const newerPath = path.join(
    os.tmpdir(),
    `learnpath-auth-newer-${process.pid}-${Date.now()}.db`
  );
  EXTRA_FILES.push(newerPath);

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE users (id INTEGER PRIMARY KEY);');
  db.run('CREATE TABLE sessions (token_hash TEXT PRIMARY KEY);');
  db.run('PRAGMA user_version = 9;');
  fs.writeFileSync(newerPath, Buffer.from(db.export()));
  db.close();

  const script = `
    process.env.LEARNPATH_AUTH_DB_PATH = ${JSON.stringify(newerPath)};
    require(${JSON.stringify(MODULE_PATH)}).getAuthDb()
      .then(() => { console.log('unexpected-success'); process.exit(0); })
      .catch((error) => { console.error(error.message); process.exit(3); });
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 3);
  assert.match(result.stderr, /newer/i);
});

test('refuses an incomplete schema at the current version', async () => {
  const incompletePath = path.join(
    os.tmpdir(),
    `learnpath-auth-incomplete-${process.pid}-${Date.now()}.db`
  );
  EXTRA_FILES.push(incompletePath);

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE users (id INTEGER PRIMARY KEY);');
  db.run('CREATE TABLE sessions (token_hash TEXT PRIMARY KEY);');
  db.run('PRAGMA user_version = 8;');
  fs.writeFileSync(incompletePath, Buffer.from(db.export()));
  db.close();

  const script = `
    process.env.LEARNPATH_AUTH_DB_PATH = ${JSON.stringify(incompletePath)};
    require(${JSON.stringify(MODULE_PATH)}).getAuthDb()
      .then(() => { console.log('unexpected-success'); process.exit(0); })
      .catch((error) => { console.error(error.message); process.exit(3); });
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 3);
  assert.match(result.stderr, /incomplete/i);
});

test('migrates a v1 auth database without losing users or sessions', async () => {
  const migrationPath = path.join(
    os.tmpdir(),
    `learnpath-auth-migration-${process.pid}-${Date.now()}.db`
  );
  EXTRA_FILES.push(migrationPath);

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      username_lower TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  db.run('CREATE INDEX idx_sessions_user_id ON sessions(user_id);');
  db.run('CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);');

  const createdAt = Date.now() - 60000;
  db.run(
    `INSERT INTO users (username, username_lower, password_hash, created_at)
     VALUES (?, ?, ?, ?)`,
    ['LegacyUser', 'legacyuser', 'scrypt$legacy$hash', createdAt]
  );
  const userId = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  db.run(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
    ['legacy-token-hash', userId, createdAt, createdAt + 3600000]
  );
  db.run('PRAGMA user_version = 1;');
  fs.writeFileSync(migrationPath, Buffer.from(db.export()));
  db.close();

  const script = `
    process.env.LEARNPATH_AUTH_DB_PATH = ${JSON.stringify(migrationPath)};
    require(${JSON.stringify(MODULE_PATH)}).getAuthDb()
      .then(() => process.exit(0))
      .catch((error) => { console.error(error.message); process.exit(3); });
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /backup created/i);

  const migrated = new SQL.Database(fs.readFileSync(migrationPath));
  try {
    assert.equal(
      migrated.exec('PRAGMA user_version')[0].values[0][0],
      SCHEMA_VERSION
    );

    const user = migrated.exec(
      `SELECT username, status, updated_at, must_change_password, deleted_at, last_login_at
         FROM users WHERE id = ?`,
      [userId]
    )[0].values[0];

    assert.deepEqual(user, [
      'LegacyUser',
      'active',
      createdAt,
      0,
      null,
      null,
    ]);

    const sessions = migrated.exec(
      'SELECT token_hash, user_id FROM sessions WHERE token_hash = ?',
      ['legacy-token-hash']
    );
    assert.equal(sessions.length, 1);
    assert.deepEqual(sessions[0].values[0], ['legacy-token-hash', userId]);

    const tables = migrated
      .exec("SELECT name FROM sqlite_master WHERE type = 'table'")
      .flatMap((result) => result.values.map((row) => row[0]));
    for (const table of ['admins', 'admin_sessions', 'admin_audit', 'user_profiles']) {
      assert.ok(tables.includes(table), `expected migrated table ${table}`);
    }
  } finally {
    migrated.close();
  }

  const directory = path.dirname(migrationPath);
  const prefix = path.basename(migrationPath);
  const backups = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(`${prefix}.v1-backup-`));

  assert.equal(backups.length, 1);
  EXTRA_FILES.push(path.join(directory, backups[0]));
});

test('migrates a v2 auth database and adds user_profiles table', async () => {
  const migrationPath = path.join(
    os.tmpdir(),
    `learnpath-auth-migration-v2-${process.pid}-${Date.now()}.db`
  );
  EXTRA_FILES.push(migrationPath);

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      username_lower TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      updated_at INTEGER,
      last_login_at INTEGER,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER
    );
  `);
  db.run(`
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      username_lower TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    );
  `);
  db.run(`
    CREATE TABLE admin_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      csrf_hash TEXT NOT NULL,
      user_agent TEXT,
      ip_hash TEXT
    );
  `);
  db.run(`
    CREATE TABLE admin_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      admin_username TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      details TEXT,
      ip_hash TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  db.run('PRAGMA user_version = 2;');
  fs.writeFileSync(migrationPath, Buffer.from(db.export()));
  db.close();

  const script = `
    process.env.LEARNPATH_AUTH_DB_PATH = ${JSON.stringify(migrationPath)};
    require(${JSON.stringify(MODULE_PATH)}).getAuthDb()
      .then(() => process.exit(0))
      .catch((error) => { console.error(error.message); process.exit(3); });
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /backup created/i);

  const migrated = new SQL.Database(fs.readFileSync(migrationPath));
  try {
    assert.equal(migrated.exec('PRAGMA user_version')[0].values[0][0], SCHEMA_VERSION);
    const tables = migrated
      .exec("SELECT name FROM sqlite_master WHERE type = 'table'")
      .flatMap((r) => r.values.map((row) => row[0]));
    assert.ok(tables.includes('user_profiles'), 'expected user_profiles table in v4');
    assert.ok(tables.includes('survey_questions'), 'expected survey_questions table in v4');
    assert.ok(tables.includes('academic_scores'), 'expected academic_scores table in v5');
    assert.ok(tables.includes('career_selections'), 'expected career_selections table in v5');
    assert.ok(tables.includes('career_rubrics'), 'expected career_rubrics table in v5');
  } finally {
    migrated.close();
  }

  const directory = path.dirname(migrationPath);
  const prefix = path.basename(migrationPath);
  const backups = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(`${prefix}.v2-backup-`));

  assert.equal(backups.length, 1);
  EXTRA_FILES.push(path.join(directory, backups[0]));
});

test('migrates a v3 auth database and adds survey_questions and survey_completed', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const migrationPath = path.join(
    os.tmpdir(),
    `learnpath-auth-migrate-v3-${process.pid}-${Date.now()}.db`
  );
  EXTRA_FILES.push(migrationPath);

  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      username_lower TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      updated_at INTEGER,
      last_login_at INTEGER,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER
    );
  `);
  db.run(`
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      username_lower TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    );
  `);
  db.run(`
    CREATE TABLE admin_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      csrf_hash TEXT NOT NULL,
      user_agent TEXT,
      ip_hash TEXT
    );
  `);
  db.run(`
    CREATE TABLE admin_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      admin_username TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      details TEXT,
      ip_hash TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE user_profiles (
      user_id INTEGER PRIMARY KEY,
      ho_va_ten TEXT,
      lop TEXT,
      truong TEXT,
      diem_lop TEXT,
      chung_chi TEXT,
      truong_muc_tieu TEXT,
      nganh_muc_tieu TEXT,
      to_hop_mong_muon TEXT,
      khac TEXT,
      updated_at INTEGER NOT NULL
    );
  `);
  db.run('PRAGMA user_version = 3;');
  fs.writeFileSync(migrationPath, Buffer.from(db.export()));
  db.close();

  const script = `
    process.env.LEARNPATH_AUTH_DB_PATH = ${JSON.stringify(migrationPath)};
    require(${JSON.stringify(MODULE_PATH)}).getAuthDb()
      .then(() => process.exit(0))
      .catch((error) => { console.error(error.message); process.exit(3); });
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /backup created/i);

  const migrated = new SQL.Database(fs.readFileSync(migrationPath));
  try {
    assert.equal(migrated.exec('PRAGMA user_version')[0].values[0][0], SCHEMA_VERSION);
    const tables = migrated
      .exec("SELECT name FROM sqlite_master WHERE type = 'table'")
      .flatMap((r) => r.values.map((row) => row[0]));
    assert.ok(tables.includes('survey_questions'), 'expected survey_questions table in v4');
    assert.ok(tables.includes('academic_scores'), 'expected academic_scores table in v5');

    const userCols = migrated
      .exec("PRAGMA table_info(users)")[0]
      .values.map((r) => r[1]);
    assert.ok(userCols.includes('survey_completed'), 'expected survey_completed column in users');
  } finally {
    migrated.close();
  }

  const directory = path.dirname(migrationPath);
  const prefix = path.basename(migrationPath);
  const backups = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(`${prefix}.v3-backup-`));

  assert.equal(backups.length, 1);
  EXTRA_FILES.push(path.join(directory, backups[0]));
});

test('migrates a v6 auth database to v7 with interest tables and seed data', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const migrationPath = path.join(
    os.tmpdir(),
    `learnpath-auth-migrate-v6-${process.pid}-${Date.now()}.db`
  );
  EXTRA_FILES.push(migrationPath);

  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      username_lower TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      updated_at INTEGER,
      last_login_at INTEGER,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      survey_completed INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      username_lower TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    );
    CREATE TABLE admin_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      csrf_hash TEXT NOT NULL,
      user_agent TEXT,
      ip_hash TEXT
    );
    CREATE TABLE admin_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      admin_username TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      details TEXT,
      ip_hash TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE user_profiles (
      user_id INTEGER PRIMARY KEY,
      ho_va_ten TEXT,
      lop TEXT,
      truong TEXT,
      diem_lop TEXT,
      chung_chi TEXT,
      truong_muc_tieu TEXT,
      nganh_muc_tieu TEXT,
      to_hop_mong_muon TEXT,
      khac TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE survey_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      question_type TEXT NOT NULL DEFAULT 'text',
      placeholder TEXT,
      is_required INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE academic_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject_name TEXT NOT NULL,
      term TEXT NOT NULL,
      class_level TEXT NOT NULL DEFAULT '10',
      score_type TEXT NOT NULL DEFAULT 'average',
      score REAL NOT NULL,
      source TEXT,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, subject_name, term, class_level, score_type)
    );
    CREATE TABLE career_selections (
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
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE career_rubrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_code TEXT,
      school_name TEXT NOT NULL,
      major_name TEXT NOT NULL,
      method TEXT NOT NULL,
      admission_block TEXT,
      year INTEGER NOT NULL,
      major_group TEXT,
      entry_score REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(school_code, school_name, major_name, method, admission_block, year)
    );
    CREATE TABLE career_rubric_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rubric_id INTEGER NOT NULL,
      subject_name TEXT NOT NULL,
      weight REAL NOT NULL,
      threshold REAL NOT NULL,
      UNIQUE(rubric_id, subject_name)
    );
    PRAGMA user_version = 6;
  `);
  db.run(
    `INSERT INTO users (username, username_lower, password_hash, created_at, status, updated_at)
     VALUES ('KeepMe', 'keepme', 'scrypt$test$hash', ?, 'active', ?)`,
    [Date.now(), Date.now()]
  );
  fs.writeFileSync(migrationPath, Buffer.from(db.export()));
  db.close();

  const script = `
    process.env.LEARNPATH_AUTH_DB_PATH = ${JSON.stringify(migrationPath)};
    require(${JSON.stringify(MODULE_PATH)}).getAuthDb()
      .then(() => process.exit(0))
      .catch((error) => { console.error(error.message); process.exit(3); });
  `;
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /backup created/i);

  const migrated = new SQL.Database(fs.readFileSync(migrationPath));
  try {
    assert.equal(migrated.exec('PRAGMA user_version')[0].values[0][0], SCHEMA_VERSION);
    const tables = migrated
      .exec("SELECT name FROM sqlite_master WHERE type = 'table'")
      .flatMap((r) => r.values.map((row) => row[0]));
    for (const table of [
      'interest_instruments',
      'interest_items',
      'interest_attempts',
      'interest_responses',
      'interest_results',
      'interest_group_weights',
      'interest_group_pairs',
      'career_match_config',
      'user_exam_scores',
    ]) {
      assert.ok(tables.includes(table), `expected migrated table ${table}`);
    }
    const userCols = migrated
      .exec('PRAGMA table_info(users)')[0]
      .values.map((row) => row[1]);
    assert.ok(userCols.includes('interest_completed'));
    const user = migrated.exec("SELECT username FROM users WHERE username = 'KeepMe'");
    assert.equal(user.length, 1);
    assert.equal(
      Number(
        migrated.exec("SELECT COUNT(*) FROM interest_items WHERE part = 'riasec'")[0].values[0][0]
      ),
      60
    );
    assert.equal(
      Number(
        migrated.exec("SELECT COUNT(*) FROM interest_items WHERE part = 'pairs'")[0].values[0][0]
      ),
      48
    );
    assert.equal(
      Number(migrated.exec('SELECT COUNT(*) FROM interest_group_weights')[0].values[0][0]),
      8
    );
  } finally {
    migrated.close();
  }

  const directory = path.dirname(migrationPath);
  const prefix = path.basename(migrationPath);
  const backups = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(`${prefix}.v6-backup-`));
  assert.equal(backups.length, 1);
  EXTRA_FILES.push(path.join(directory, backups[0]));
});

test('migrates a v7 auth database to v8 with agent tables and keeps users', async () => {
  const migrationPath = path.join(
    os.tmpdir(),
    `learnpath-auth-v7-${process.pid}-${Date.now()}.db`
  );
  EXTRA_FILES.push(migrationPath);

  // Build a real current-schema DB in a child process, then downgrade it to v7.
  const createScript = `
    process.env.LEARNPATH_AUTH_DB_PATH = ${JSON.stringify(migrationPath)};
    require(${JSON.stringify(MODULE_PATH)}).getAuthDb()
      .then(() => process.exit(0))
      .catch((error) => { console.error(error.message); process.exit(3); });
  `;
  const created = spawnSync(process.execPath, ['-e', createScript], { encoding: 'utf8' });
  assert.equal(created.status, 0, created.stderr);

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(migrationPath));
  db.run(`
    DROP TABLE agent_consents;
    DROP TABLE agent_usage;
    DROP TABLE chat_messages;
    DROP TABLE chat_conversations;
    PRAGMA user_version = 7;
  `);
  db.run(
    `INSERT INTO users (username, username_lower, password_hash, created_at, status, updated_at)
     VALUES ('KeepV7', 'keepv7', 'scrypt$test$hash', ?, 'active', ?)`,
    [Date.now(), Date.now()]
  );
  fs.writeFileSync(migrationPath, Buffer.from(db.export()));
  db.close();

  const result = spawnSync(process.execPath, ['-e', createScript], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /backup created/i);

  const migrated = new SQL.Database(fs.readFileSync(migrationPath));
  try {
    assert.equal(migrated.exec('PRAGMA user_version')[0].values[0][0], 8);
    const tables = migrated
      .exec("SELECT name FROM sqlite_master WHERE type = 'table'")
      .flatMap((r) => r.values.map((row) => row[0]));
    for (const table of ['chat_conversations', 'chat_messages', 'agent_usage', 'agent_consents']) {
      assert.ok(tables.includes(table), `expected migrated table ${table}`);
    }
    assert.equal(migrated.exec("SELECT username FROM users WHERE username = 'KeepV7'").length, 1);
  } finally {
    migrated.close();
  }

  const directory = path.dirname(migrationPath);
  const prefix = path.basename(migrationPath);
  for (const name of fs.readdirSync(directory)) {
    if (name.startsWith(`${prefix}.v7-backup-`)) EXTRA_FILES.push(path.join(directory, name));
  }
  assert.ok(EXTRA_FILES.some((file) => path.basename(file).startsWith(`${prefix}.v7-backup-`)));
});

after(() => {
  cleanupPath(AUTH_DB_PATH);
  for (const filePath of EXTRA_FILES) cleanupPath(filePath);

  const directory = path.dirname(AUTH_DB_PATH);
  const prefix = path.basename(AUTH_DB_PATH);
  for (const name of fs.readdirSync(directory)) {
    if (name.startsWith(prefix) && (name.endsWith('.tmp') || name.endsWith('.previous'))) {
      cleanupPath(path.join(directory, name));
    }
  }
});
