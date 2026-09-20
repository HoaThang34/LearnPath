const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../database/learnpath.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
    createTables();
    saveDb();
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

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS diem_chuan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      truong TEXT NOT NULL,
      nganh TEXT NOT NULL,
      to_hop_mon TEXT,
      diem_chuan REAL,
      ghi_chu TEXT,
      nam INTEGER DEFAULT 2024
    );

    CREATE TABLE IF NOT EXISTS khoi_thi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ma_khoi TEXT NOT NULL,
      mon_xet_tuyen TEXT,
      ma_truong TEXT,
      ten_truong TEXT,
      so_nganh TEXT
    );

    CREATE TABLE IF NOT EXISTS diem_thi_thptqg (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sbd TEXT UNIQUE,
      tinh TEXT,
      toan REAL,
      van REAL,
      ly REAL,
      hoa REAL,
      sinh REAL,
      su REAL,
      dia REAL,
      gd_kt_pl TEXT,
      tin_hoc REAL,
      cong_nghe REAL,
      ngoai_ngu REAL
    );

    CREATE TABLE IF NOT EXISTS de_an_tuyen_sinh (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ma_truong TEXT UNIQUE,
      ten_truong TEXT,
      noi_dung TEXT,
      nguon TEXT
    );
  `);
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
