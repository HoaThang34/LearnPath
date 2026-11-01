const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const AUTH_DB_PATH = process.env.LEARNPATH_AUTH_DB_PATH
  ? path.resolve(process.env.LEARNPATH_AUTH_DB_PATH)
  : path.join(__dirname, '../../database/auth.db');

const MAIN_DB_PATH = process.env.LEARNPATH_DB_PATH
  ? path.resolve(process.env.LEARNPATH_DB_PATH)
  : path.join(__dirname, '../../database/learnpath.db');

const SCHEMA_VERSION = 7;

const INTEREST_WEIGHTS = [
  {
    majorGroup: 'Kỹ thuật - Công nghệ',
    weights: [0.35, 0.35, 0.05, 0.03, 0.07, 0.15],
    note: 'Nhóm kỹ thuật nghiêng R+I theo mô hình lục giác Holland; trọng số do nhóm đề xuất, chưa kiểm định.',
  },
  {
    majorGroup: 'Kinh tế - Quản trị',
    weights: [0.05, 0.15, 0.03, 0.12, 0.35, 0.30],
    note: 'Nhóm kinh tế nghiêng E+C; trọng số do nhóm đề xuất, chưa kiểm định.',
  },
  {
    majorGroup: 'Xã hội - Nhân văn',
    weights: [0.03, 0.14, 0.28, 0.32, 0.18, 0.05],
    note: 'Nhóm xã hội nghiêng S+A; trọng số do nhóm đề xuất, chưa kiểm định.',
  },
  {
    majorGroup: 'Y Dược',
    weights: [0.18, 0.32, 0.03, 0.30, 0.05, 0.12],
    note: 'Nhóm y dược nghiêng I+S; trọng số do nhóm đề xuất, chưa kiểm định.',
  },
  {
    majorGroup: 'Sư phạm',
    weights: [0.04, 0.18, 0.18, 0.38, 0.10, 0.12],
    note: 'Nhóm sư phạm nghiêng S+A; trọng số do nhóm đề xuất, chưa kiểm định.',
  },
  {
    majorGroup: 'Nghệ thuật',
    weights: [0.05, 0.10, 0.50, 0.18, 0.14, 0.03],
    note: 'Nhóm nghệ thuật có A cao nhất; trọng số do nhóm đề xuất, chưa kiểm định.',
  },
  {
    majorGroup: 'Luật - Hành chính',
    weights: [0.04, 0.17, 0.06, 0.18, 0.30, 0.25],
    note: 'Nhóm luật - hành chính nghiêng E+C; trọng số do nhóm đề xuất, chưa kiểm định.',
  },
  {
    majorGroup: 'Nông Lâm',
    weights: [0.38, 0.30, 0.04, 0.08, 0.06, 0.14],
    note: 'Nhóm nông lâm nghiêng R+I; trọng số do nhóm đề xuất, chưa kiểm định.',
  },
];

const CAREER_MATCH_CONFIG = [
  ['w_hoc_luc', 0.6, 'Trọng số của hocLucFit trong tongHopFit (lựa chọn của nhóm).'],
  ['w_tinh_cach', 0.4, 'Trọng số của tinhCachFit trong tongHopFit (lựa chọn của nhóm).'],
  ['matrix_hoc_luc_high', 70, 'Ngưỡng học lực tốt của ma trận 3x2.'],
  ['matrix_hoc_luc_low', 50, 'Ngưỡng học lực thấp của ma trận 3x2.'],
  ['matrix_tinh_cach', 65, 'Ngưỡng tính cách hợp của ma trận 3x2.'],
  ['do_phu_min', 80, 'Độ phủ tối thiểu (%) để tinhCachFit dùng trong tổng thể.'],
  ['hoc_luc_mode', 0, '0 = công thức phân vị; 1 = legacyFitPct (chỉ dùng để rollback).'],
];

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

function execScalar(database, sql, params = []) {
  const result = database.exec(sql, params);
  if (!result.length || !result[0].values.length) return null;
  return result[0].values[0][0];
}

function createInterestSchema(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS interest_instruments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT NOT NULL,
      title         TEXT NOT NULL,
      description   TEXT,
      version       INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','active','archived')),
      source_note   TEXT,
      disclaimer    TEXT,
      part1_item_count INTEGER NOT NULL DEFAULT 60,
      part2_item_count INTEGER NOT NULL DEFAULT 48,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      UNIQUE (code, version)
    );
    CREATE TABLE IF NOT EXISTS interest_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      instrument_id INTEGER NOT NULL,
      part          TEXT NOT NULL CHECK (part IN ('riasec','pairs')),
      group_code    TEXT NOT NULL,
      item_no       INTEGER NOT NULL,
      order_index   INTEGER NOT NULL,
      prompt_text   TEXT,
      left_text     TEXT,
      right_text    TEXT,
      left_key      TEXT,
      right_key     TEXT,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      FOREIGN KEY (instrument_id) REFERENCES interest_instruments(id) ON DELETE CASCADE,
      UNIQUE (instrument_id, part, item_no)
    );
    CREATE INDEX IF NOT EXISTS idx_interest_items_order
      ON interest_items(instrument_id, part, order_index);
    CREATE TABLE IF NOT EXISTS interest_attempts (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id              INTEGER NOT NULL,
      instrument_id        INTEGER NOT NULL,
      status               TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','submitted','abandoned')),
      giai_doan_hoc_tap    TEXT,
      cau_hoi_nghe_nghiep  TEXT,
      notes                TEXT,
      summary_text         TEXT,
      started_at           INTEGER NOT NULL,
      last_saved_at        INTEGER,
      submitted_at         INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (instrument_id) REFERENCES interest_instruments(id)
    );
    CREATE INDEX IF NOT EXISTS idx_interest_attempts_user
      ON interest_attempts(user_id, status);
    CREATE TABLE IF NOT EXISTS interest_responses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id  INTEGER NOT NULL,
      item_id     INTEGER NOT NULL,
      value       INTEGER NOT NULL,
      answered_at INTEGER NOT NULL,
      FOREIGN KEY (attempt_id) REFERENCES interest_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES interest_items(id),
      UNIQUE (attempt_id, item_id)
    );
    CREATE TABLE IF NOT EXISTS interest_results (
      attempt_id        INTEGER PRIMARY KEY,
      user_id           INTEGER NOT NULL,
      instrument_id     INTEGER NOT NULL,
      algorithm_version TEXT NOT NULL,
      r REAL, i REAL, a REAL, s REAL, e REAL, c REAL,
      r_answered INTEGER, i_answered INTEGER, a_answered INTEGER,
      s_answered INTEGER, e_answered INTEGER, c_answered INTEGER,
      d_ei REAL, d_sn REAL, d_tf REAL, d_jp REAL,
      code TEXT,
      top_groups TEXT,
      ties TEXT,
      completeness TEXT NOT NULL,
      unanswered_count INTEGER NOT NULL DEFAULT 0,
      computed_at INTEGER NOT NULL,
      FOREIGN KEY (attempt_id) REFERENCES interest_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_interest_results_user
      ON interest_results(user_id);
    CREATE TABLE IF NOT EXISTS interest_group_weights (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      major_group  TEXT NOT NULL UNIQUE,
      w_r REAL NOT NULL, w_i REAL NOT NULL, w_a REAL NOT NULL,
      w_s REAL NOT NULL, w_e REAL NOT NULL, w_c REAL NOT NULL,
      note         TEXT,
      is_active    INTEGER NOT NULL DEFAULT 1,
      updated_at   INTEGER NOT NULL,
      CHECK (w_r >= 0 AND w_i >= 0 AND w_a >= 0 AND w_s >= 0 AND w_e >= 0 AND w_c >= 0),
      CHECK (ABS(w_r + w_i + w_a + w_s + w_e + w_c - 1) <= 0.001)
    );
    CREATE TABLE IF NOT EXISTS interest_group_pairs (
      major_group  TEXT PRIMARY KEY,
      w_e REAL NOT NULL, w_s REAL NOT NULL, w_t REAL NOT NULL, w_j REAL NOT NULL,
      note         TEXT,
      updated_at   INTEGER NOT NULL,
      CHECK (ABS(w_e + w_s + w_t + w_j - 1) <= 0.001)
    );
    CREATE TABLE IF NOT EXISTS career_match_config (
      key        TEXT PRIMARY KEY,
      value      REAL NOT NULL,
      note       TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_exam_scores (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      block      TEXT NOT NULL,
      score      REAL NOT NULL CHECK (score >= 0 AND score <= 30),
      source     TEXT NOT NULL DEFAULT 'tự khai',
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (user_id, block)
    );
    CREATE INDEX IF NOT EXISTS idx_user_exam_scores_user
      ON user_exam_scores(user_id);
  `);

  ensureColumn(database, 'users', 'interest_completed', 'INTEGER NOT NULL DEFAULT 0');
}

function seedInterestInstrument(database) {
  const instrument = require('../data/interest_instrument_v1.json');
  const existingId = execScalar(
    database,
    'SELECT id FROM interest_instruments WHERE code = ? AND version = ?',
    [instrument.code, instrument.version]
  );
  if (existingId) return Number(existingId);

  const now = Date.now();
  database.run(
    `INSERT INTO interest_instruments
       (code, title, description, version, status, source_note, disclaimer,
        part1_item_count, part2_item_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 60, 48, ?, ?)`,
    [
      instrument.code,
      instrument.title,
      instrument.description || null,
      instrument.version,
      instrument.status || 'active',
      instrument.sourceNote || null,
      instrument.disclaimer || null,
      now,
      now,
    ]
  );
  const instrumentId = Number(
    execScalar(database, 'SELECT last_insert_rowid() AS id')
  );

  for (const item of instrument.part1) {
    database.run(
      `INSERT INTO interest_items
         (instrument_id, part, group_code, item_no, order_index, prompt_text,
          is_active, created_at, updated_at)
       VALUES (?, 'riasec', ?, ?, ?, ?, 1, ?, ?)`,
      [instrumentId, item.group, item.itemNo, item.orderIndex, item.text, now, now]
    );
  }
  for (const item of instrument.part2) {
    database.run(
      `INSERT INTO interest_items
         (instrument_id, part, group_code, item_no, order_index, left_text, right_text,
          left_key, right_key, is_active, created_at, updated_at)
       VALUES (?, 'pairs', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        instrumentId,
        item.pair,
        item.itemNo,
        item.orderIndex,
        item.left,
        item.right,
        item.leftKey,
        item.rightKey,
        now,
        now,
      ]
    );
  }
  return instrumentId;
}

function seedInterestWeights(database) {
  const now = Date.now();
  for (const row of INTEREST_WEIGHTS) {
    database.run(
      `INSERT OR IGNORE INTO interest_group_weights
         (major_group, w_r, w_i, w_a, w_s, w_e, w_c, note, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        row.majorGroup,
        row.weights[0],
        row.weights[1],
        row.weights[2],
        row.weights[3],
        row.weights[4],
        row.weights[5],
        row.note,
        now,
      ]
    );
  }
}

function seedCareerMatchConfig(database) {
  const now = Date.now();
  for (const [key, value, note] of CAREER_MATCH_CONFIG) {
    database.run(
      'INSERT OR IGNORE INTO career_match_config (key, value, note, updated_at) VALUES (?, ?, ?, ?)',
      [key, value, note, now]
    );
  }
}

function seedInterestDefaults(database) {
  seedInterestInstrument(database);
  seedInterestWeights(database);
  seedCareerMatchConfig(database);
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
      interest_completed   INTEGER NOT NULL DEFAULT 0,
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
      class_level TEXT NOT NULL,
      score_type TEXT NOT NULL DEFAULT 'average',
      score REAL NOT NULL,
      source TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, subject_name, term, class_level, score_type)
    );
    CREATE INDEX IF NOT EXISTS idx_academic_scores_user ON academic_scores(user_id, class_level, term);
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
      major_group TEXT,
      entry_score REAL,
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

  ensureColumn(database, 'career_rubrics', 'major_group', 'TEXT');
  ensureColumn(database, 'career_rubrics', 'entry_score', 'REAL');
  ensureColumn(database, 'career_rubrics', 'is_valid', 'INTEGER DEFAULT 1');

  createAdminSchema(database);
  createInterestSchema(database);
  seedInterestDefaults(database);
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
    'interest_instruments',
    'interest_items',
    'interest_attempts',
    'interest_responses',
    'interest_results',
    'interest_group_weights',
    'interest_group_pairs',
    'career_match_config',
    'user_exam_scores',
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
    'interest_completed',
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

  const activeInstrumentId = execScalar(
    database,
    "SELECT id FROM interest_instruments WHERE status = 'active' ORDER BY version DESC LIMIT 1"
  );
  if (!activeInstrumentId) {
    throw new Error(
      'Auth database has no active interest instrument. Restore it from backup or seed interest_instrument_v1.'
    );
  }
  const riasecCount = Number(
    execScalar(
      database,
      "SELECT COUNT(*) FROM interest_items WHERE instrument_id = ? AND part = 'riasec' AND is_active = 1",
      [activeInstrumentId]
    ) || 0
  );
  const pairsCount = Number(
    execScalar(
      database,
      "SELECT COUNT(*) FROM interest_items WHERE instrument_id = ? AND part = 'pairs' AND is_active = 1",
      [activeInstrumentId]
    ) || 0
  );
  if (riasecCount !== 60 || pairsCount !== 48) {
    throw new Error(
      `Active interest instrument ${activeInstrumentId} is incomplete ` +
        `(${riasecCount} riasec items, ${pairsCount} pairs items; expected 60/48).`
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
  if (version >= 1 && version <= 6) {
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
            subject_name TEXT NOT NULL, term TEXT NOT NULL,
            class_level TEXT NOT NULL DEFAULT '10',
            score_type TEXT NOT NULL DEFAULT 'average', score REAL NOT NULL, source TEXT,
            updated_at INTEGER NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, subject_name, term, class_level, score_type)
          );
          CREATE INDEX IF NOT EXISTS idx_academic_scores_user ON academic_scores(user_id, class_level, term);
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

      if (version === 5) {
        database.run(`
          DROP TABLE IF EXISTS academic_scores;
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
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, subject_name, term, class_level, score_type)
          );
          CREATE INDEX idx_academic_scores_user ON academic_scores(user_id, class_level, term);
        `);
        database.run('UPDATE user_profiles SET diem_lop = ?;', ['[]']);
      }

      // Nâng cấp lên v4:
      ensureColumn(database, 'users', 'survey_completed', 'INTEGER NOT NULL DEFAULT 0');

      // Đánh dấu các user đã có hồ sơ cá nhân là đã hoàn thành khảo sát.
      // Chỉ chạy khi nâng cấp từ v3 trở xuống; v4+ đã có cờ này và v6→v7
      // không được thay đổi trạng thái khảo sát của người dùng hiện có.
      if (version <= 3) {
        database.run(`
          UPDATE users
             SET survey_completed = 1
           WHERE id IN (
             SELECT user_id FROM user_profiles
              WHERE (ho_va_ten IS NOT NULL AND TRIM(ho_va_ten) != '')
                 OR (truong_muc_tieu IS NOT NULL AND TRIM(truong_muc_tieu) != '')
           );
        `);
      }

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

      if (version <= 6) {
        createInterestSchema(database);
        seedInterestDefaults(database);
      }

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
    const tables = getTableNames(database);
    if (tables.includes('career_rubrics')) {
      const rubricsCols = getColumnNames(database, 'career_rubrics');
      let changed = false;
      if (!rubricsCols.includes('major_group')) {
        ensureColumn(database, 'career_rubrics', 'major_group', 'TEXT');
        changed = true;
      }
      if (!rubricsCols.includes('entry_score')) {
        ensureColumn(database, 'career_rubrics', 'entry_score', 'REAL');
        changed = true;
      }
      if (!rubricsCols.includes('is_valid')) {
        ensureColumn(database, 'career_rubrics', 'is_valid', 'INTEGER DEFAULT 1');
        changed = true;
      }
      if (changed) {
        writeDatabaseToDisk(database);
      }
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
