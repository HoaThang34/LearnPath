#!/usr/bin/env node
/**
 * inspect-db.js — read-only LearnPath database audit.
 *
 * READ-ONLY: opens the .db file in memory with sql.js and never calls
 * export()/saveDb(), writes a file, or changes data.
 *
 * Run from the repository root:
 *   node .agents/scripts/inspect-db.js
 *   node .agents/scripts/inspect-db.js --db backend/database/learnpath.db
 *
 * Purpose: print known data anomalies (see .agents/KNOWN_ISSUES.md) so an
 * agent can check an import or a schema change quickly.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_DB = path.join(ROOT, 'backend/database/learnpath.db');
const DATA_DIR = path.join(ROOT, 'data');

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const DB_PATH = path.resolve(argValue('--db', DEFAULT_DB));
const SQLJS_PATH = path.join(ROOT, 'backend/node_modules/sql.js');

function line(char = '-') {
  console.log(char.repeat(72));
}

function section(title) {
  console.log('');
  line('=');
  console.log(title);
  line('=');
}

function fmt(n) {
  if (n === null || n === undefined) return 'null';
  return Number(n).toLocaleString('en-US');
}

function pct(part, total) {
  if (!total) return '0%';
  return ((part / total) * 100).toFixed(1) + '%';
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const NAME_STOPWORDS = new Set(['dai', 'hoc', 'dh', 'truong', 'vien', 'va', 'cac']);

function nameTokens(value) {
  return new Set(
    normalizeName(value)
      .split(' ')
      .filter((t) => t && !NAME_STOPWORDS.has(t))
  );
}

function jaccard(a, b) {
  const setA = nameTokens(a);
  const setB = nameTokens(b);
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return inter / (setA.size + setB.size - inter);
}

function loadSqlJs() {
  if (!fs.existsSync(SQLJS_PATH)) {
    console.error(
      'sql.js was not found at:\n  ' +
        SQLJS_PATH +
        '\nRun "npm install" in the backend directory first.'
    );
    process.exit(2);
  }
  return require(SQLJS_PATH);
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('Database not found:\n  ' + DB_PATH);
    console.error('The script does not create a DB. Check the path or run backend/init.');
    process.exit(2);
  }

  const stat = fs.statSync(DB_PATH);
  const initSqlJs = loadSqlJs();
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer); // memory only

  function all(sql) {
    const res = db.exec(sql);
    if (!res.length) return [];
    const { columns, values } = res[0];
    return values.map((row) => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }

  function one(sql) {
    return all(sql)[0] || {};
  }

  section('DATABASE INFORMATION (READ-ONLY)');
  console.log('Path      : ' + DB_PATH);
  console.log('Size      : ' + fmt(stat.size) + ' bytes (' + (stat.size / 1024 / 1024).toFixed(1) + ' MiB)');
  const integrity = one('PRAGMA integrity_check');
  console.log('Integrity : ' + (integrity.integrity_check || 'unknown'));

  // ---------------------------------------------------------------------------
  section('1. TABLES & ROW COUNTS');
  const expectedCounts = {
    de_an_tuyen_sinh: 307,
    diem_chuan: 2617,
    diem_thi_thptqg: 1131975,
    // Current live DB baseline. The fixed importer parses 281 source codes;
    // section 3 shows the source-vs-live difference explicitly.
    khoi_thi: 245,
    truong: 260,
  };
  const tables = all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  for (const t of tables) {
    const count = one('SELECT COUNT(*) AS n FROM "' + t.name + '"').n;
    const expected = expectedCounts[t.name];
    const note =
      expected === undefined
        ? ''
        : expected === count
          ? ' (matches live baseline)'
          : ' (baseline ' + fmt(expected) + ' — DIFFERS)';
    console.log('  ' + t.name.padEnd(24) + fmt(count).padStart(12) + note);
  }
  console.log('');
  console.log('Schema:');
  for (const row of all("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")) {
    console.log('  ' + row.sql.replace(/\s+/g, ' ').trim());
  }

  // ---------------------------------------------------------------------------
  section('2. DIEM_CHUAN — QUALITY & SCHOOL MAPPING');
  const dcTotal = one('SELECT COUNT(*) AS n FROM diem_chuan').n;
  const dcMissingCode = one(
    "SELECT COUNT(*) AS n FROM diem_chuan WHERE ma_truong IS NULL OR TRIM(ma_truong) = ''"
  ).n;
  const dcMissingBlock = one(
    "SELECT COUNT(*) AS n FROM diem_chuan WHERE to_hop_mon IS NULL OR TRIM(to_hop_mon) = ''"
  ).n;
  const dcMissingScore = one('SELECT COUNT(*) AS n FROM diem_chuan WHERE diem_chuan IS NULL').n;
  console.log('Total rows             : ' + fmt(dcTotal));
  console.log('Missing ma_truong      : ' + fmt(dcMissingCode) + ' (' + pct(dcMissingCode, dcTotal) + ')');
  console.log('Missing to_hop_mon     : ' + fmt(dcMissingBlock) + ' (' + pct(dcMissingBlock, dcTotal) + ')');
  console.log('Missing diem_chuan     : ' + fmt(dcMissingScore) + ' (' + pct(dcMissingScore, dcTotal) + ')');

  console.log('');
  console.log('Distribution by nam:');
  for (const r of all('SELECT nam, COUNT(*) AS n FROM diem_chuan GROUP BY nam ORDER BY nam')) {
    console.log('  nam=' + String(r.nam).padEnd(6) + fmt(r.n) + ' rows');
  }
  console.log('Distribution by phuong_thuc:');
  for (const r of all(
    "SELECT COALESCE(phuong_thuc, '(null)') AS pt, COUNT(*) AS n FROM diem_chuan GROUP BY pt ORDER BY n DESC"
  )) {
    console.log('  ' + String(r.pt).padEnd(26) + fmt(r.n));
  }

  const dcCodes = all(
    "SELECT ma_truong, COUNT(*) AS n FROM diem_chuan WHERE ma_truong IS NOT NULL AND TRIM(ma_truong) <> '' GROUP BY ma_truong"
  );
  const truongRows = all('SELECT ma_truong, ten_truong FROM truong');
  const truongByCode = new Map(truongRows.map((r) => [r.ma_truong, r.ten_truong]));
  const codeSet = new Set(dcCodes.map((r) => r.ma_truong));

  const orphanCodes = dcCodes.filter((r) => !truongByCode.has(r.ma_truong));
  const noScoreSchools = truongRows.filter((r) => !codeSet.has(r.ma_truong));
  console.log('');
  console.log('Score codes in diem_chuan : ' + fmt(dcCodes.length));
  console.log('Rows in truong            : ' + fmt(truongRows.length));
  console.log('Score codes missing from truong: ' + fmt(orphanCodes.length));
  for (const r of orphanCodes) {
    const names = all(
      "SELECT DISTINCT truong FROM diem_chuan WHERE ma_truong = '" +
        r.ma_truong.replace(/'/g, "''") +
        "' LIMIT 3"
    );
    console.log('  - ' + r.ma_truong + ' (' + fmt(r.n) + ' rows): ' + names.map((x) => x.truong).join(' | '));
  }
  console.log('Schools without score rows: ' + fmt(noScoreSchools.length) + '/' + fmt(truongRows.length));
  if (noScoreSchools.length) {
    console.log('  ' + noScoreSchools.slice(0, 15).map((r) => r.ma_truong).join(', ') + (noScoreSchools.length > 15 ? ' ...' : ''));
  }

  // Compare display names stored in diem_chuan with the registered truong name.
  console.log('');
  console.log('School-name mismatches between diem_chuan and truong:');
  const nameRows = all(
    "SELECT ma_truong, truong, COUNT(*) AS n FROM diem_chuan WHERE ma_truong IS NOT NULL AND TRIM(ma_truong) <> '' GROUP BY ma_truong, truong ORDER BY ma_truong"
  );
  const grouped = new Map();
  for (const r of nameRows) {
    if (!grouped.has(r.ma_truong)) grouped.set(r.ma_truong, []);
    grouped.get(r.ma_truong).push(r);
  }
  let suspicious = 0;
  for (const [code, rows] of grouped) {
    const registered = truongByCode.get(code);
    if (!registered) continue;
    for (const row of rows) {
      const a = normalizeName(row.truong);
      const b = normalizeName(registered);
      if (!a || !b) continue;
      const contained = a.includes(b) || b.includes(a);
      const sim = jaccard(row.truong, registered);
      if (!contained && sim < 0.5) {
        suspicious++;
        console.log(
          '  ! ' +
            code.padEnd(5) +
            ' diem_chuan="' +
            row.truong +
            '" (' +
            fmt(row.n) +
            ' rows) <> truong="' +
            registered +
            '" (jaccard=' +
            sim.toFixed(2) +
            ')'
        );
      }
    }
  }
  console.log('  Name pairs to review: ' + fmt(suspicious) + ' (some are spelling variants, not wrong mappings).');
  if (!suspicious) console.log('  No suspicious name mismatch found.');

  // ---------------------------------------------------------------------------
  section('3. KHOI_THI — SOURCE FILES, SKIPPED FILES & SCHOOL COUNTS');
  const khoiDir = path.join(DATA_DIR, 'khoi_thi/theo_khoi_thi');
  const khoiRows = all('SELECT ma_khoi, mon_thi, so_truong FROM khoi_thi ORDER BY ma_khoi');
  const dbBlocks = new Map(khoiRows.map((r) => [r.ma_khoi, r]));
  console.log('Blocks in DB            : ' + fmt(khoiRows.length));

  if (fs.existsSync(khoiDir)) {
    const files = fs.readdirSync(khoiDir).filter((f) => f.endsWith('.txt'));
    const fileBlocks = new Map(); // code -> { file, mon }
    const skipped = [];
    let codeOccurrences = 0;
    let headerFiles = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(khoiDir, file), 'utf-8');
        const header = content.match(/^# Khối:\s*(.+?)\s*\((.+)\)\s*$/m);
        if (!header) {
          skipped.push({ file, reason: 'no block header' });
          continue;
        }
        const codes = header[1]
          .split(/[,;]/)
          .map((code) => code.trim())
          .filter((code) => /^[A-Z][0-9A-Z]{1,4}$/.test(code));
        if (!codes.length) {
          skipped.push({ file, reason: 'no valid block code' });
          continue;
        }
        headerFiles++;
        codeOccurrences += codes.length;
        for (const code of codes) {
          if (!fileBlocks.has(code)) {
            fileBlocks.set(code, { file, mon: header[2].trim() });
          }
        }
      } catch (error) {
        skipped.push({ file, reason: error.message });
      }
    }

    const missingInDb = [...fileBlocks.keys()].filter((code) => !dbBlocks.has(code));
    const extraInDb = [...dbBlocks.keys()].filter((code) => !fileBlocks.has(code));
    console.log('.txt files on disk      : ' + fmt(files.length));
    console.log('Files with valid header : ' + fmt(headerFiles));
    console.log('Unique codes in source  : ' + fmt(fileBlocks.size));
    console.log('Code occurrences        : ' + fmt(codeOccurrences));
    console.log('Duplicate code headers  : ' + fmt(codeOccurrences - fileBlocks.size));
    console.log('Skipped files           : ' + fmt(skipped.length));
    for (const item of skipped) console.log('  - ' + item.file + ' (' + item.reason + ')');
    console.log('Source codes missing in DB: ' + fmt(missingInDb.length));
    if (missingInDb.length) console.log('  ' + missingInDb.sort().join(', '));
    console.log('DB codes not in source  : ' + fmt(extraInDb.length));
    if (extraInDb.length) console.log('  ' + extraInDb.sort().join(', '));

    // so_truong stored in DB vs distinct school codes in the source file / in truong.
    const mismatches = [];
    for (const [code, info] of fileBlocks) {
      const row = dbBlocks.get(code);
      if (!row) continue;
      const content = fs.readFileSync(path.join(khoiDir, info.file), 'utf-8');
      const codesInFile = [...content.matchAll(/^\[([A-Z0-9]+)\]/gm)].map((m) => m[1]);
      const distinctInFile = new Set(codesInFile);
      const joined = [...distinctInFile].filter((c) => truongByCode.has(c));
      if (row.so_truong !== distinctInFile.size || joined.length !== distinctInFile.size) {
        mismatches.push({
          code,
          stored: row.so_truong,
          inFile: distinctInFile.size,
          joined: joined.length,
          missing: [...distinctInFile].filter((c) => !truongByCode.has(c)),
        });
      }
    }
    console.log('Blocks whose stored so_truong differs from source/join: ' + fmt(mismatches.length));
    for (const m of mismatches.slice(0, 20)) {
      console.log(
        '  - ' +
          m.code.padEnd(5) +
          ' DB=' +
          String(m.stored).padStart(4) +
          ' file=' +
          String(m.inFile).padStart(4) +
          ' join=' +
          String(m.joined).padStart(4) +
          (m.missing.length
            ? ' | missing from truong: ' + m.missing.slice(0, 8).join(',') + (m.missing.length > 8 ? '...' : '')
            : '')
      );
    }
    if (mismatches.length > 20) console.log('  ... ' + (mismatches.length - 20) + ' more blocks');

    // This is what /api/khoi-thi/:maKhoi returns: a join of truong + diem_chuan.
    const effective = all(
      "SELECT k.ma_khoi, k.so_truong, " +
        "(SELECT COUNT(DISTINCT t.ma_truong) FROM truong t " +
        " INNER JOIN diem_chuan d ON t.ma_truong = d.ma_truong " +
        " WHERE d.to_hop_mon LIKE '%' || k.ma_khoi || '%') AS joined " +
        'FROM khoi_thi k ORDER BY k.ma_khoi'
    );
    const coverageGaps = effective
      .filter((r) => r.so_truong > 0 && r.joined !== r.so_truong)
      .sort((a, b) => Math.abs(b.so_truong - b.joined) - Math.abs(a.so_truong - a.joined));
    console.log('');
    console.log('Blocks whose source so_truong differs from joined score schools: ' + fmt(coverageGaps.length));
    for (const r of coverageGaps.slice(0, 20)) {
      console.log(
        '  - ' + r.ma_khoi.padEnd(5) + ' DB=' + String(r.so_truong).padStart(4) + ' join=' + String(r.joined).padStart(4)
      );
    }
    if (coverageGaps.length > 20) console.log('  ... ' + (coverageGaps.length - 20) + ' more blocks');
  } else {
    console.log('Data directory not found: ' + khoiDir);
  }

  const emptyBlocks = khoiRows.filter((r) => !r.so_truong);
  console.log('Blocks with so_truong = 0: ' + fmt(emptyBlocks.length));
  if (emptyBlocks.length) console.log('  ' + emptyBlocks.map((r) => r.ma_khoi).join(', '));

  // ---------------------------------------------------------------------------
  section('4. DIEM_THI — SCORE DISTRIBUTION & RANKING GAP');
  const dtTotal = one('SELECT COUNT(*) AS n FROM diem_thi_thptqg').n;
  const sumExpr =
    'COALESCE(toan,0)+COALESCE(van,0)+COALESCE(ly,0)+COALESCE(hoa,0)+COALESCE(sinh,0)+COALESCE(su,0)+COALESCE(dia,0)+COALESCE(tin_hoc,0)+COALESCE(ngoai_ngu,0)';
  const over30 = one('SELECT COUNT(*) AS n FROM diem_thi_thptqg WHERE ' + sumExpr + ' >= 30').n;
  const maxTotal = one('SELECT MAX(' + sumExpr + ') AS v FROM diem_thi_thptqg').v || 0;
  console.log('Candidates              : ' + fmt(dtTotal));
  console.log('All-subject total >= 30 : ' + fmt(over30) + ' (' + pct(over30, dtTotal) + ')');
  console.log('Maximum all-subject total: ' + Number(maxTotal).toFixed(2));
  console.log('');
  console.log('Distribution as the current API calculates it (0–30; >=30 is omitted):');
  for (const [min, max] of [
    [27, 30],
    [24, 27],
    [21, 24],
    [18, 21],
    [15, 18],
    [12, 15],
    [0, 12],
  ]) {
    const n = one(
      'SELECT COUNT(*) AS n FROM diem_thi_thptqg WHERE ' + sumExpr + ' >= ' + min + ' AND ' + sumExpr + ' < ' + max
    ).n;
    console.log(
      '  [' + String(min).padStart(2) + '-' + String(max).padStart(2) + ')  ' + fmt(n).padStart(12) + '  (' + pct(n, dtTotal) + ')'
    );
  }
  console.log('  >= 30    ' + fmt(over30).padStart(12) + '  (' + pct(over30, dtTotal) + ')  <-- omitted by the API');
  console.log('');
  console.log('Note: /api/diem-thi/ranking compares the user total (for example 3 subjects)');
  console.log('with the sum of all subjects for every candidate, so rank and distribution are wrong.');

  // ---------------------------------------------------------------------------
  section('5. TRUONG & DE_AN');
  const daTotal = one('SELECT COUNT(*) AS n FROM de_an_tuyen_sinh').n;
  const daEmptyCode = one(
    "SELECT COUNT(*) AS n FROM de_an_tuyen_sinh WHERE ma_truong IS NULL OR TRIM(ma_truong) = ''"
  ).n;
  const daDupCodes = all(
    "SELECT ma_truong, COUNT(*) AS n FROM de_an_tuyen_sinh WHERE ma_truong IS NOT NULL AND TRIM(ma_truong) <> '' GROUP BY ma_truong HAVING COUNT(*) > 1 ORDER BY n DESC"
  );
  const daCodes = new Set(
    all(
      "SELECT DISTINCT ma_truong FROM de_an_tuyen_sinh WHERE ma_truong IS NOT NULL AND TRIM(ma_truong) <> ''"
    ).map((r) => r.ma_truong)
  );
  const daMissingSchool = [...daCodes].filter((c) => !truongByCode.has(c));
  console.log('Proposals               : ' + fmt(daTotal) + ' rows');
  console.log('Proposals missing ma_truong: ' + fmt(daEmptyCode));
  console.log('Duplicate proposal codes: ' + fmt(daDupCodes.length));
  for (const r of daDupCodes.slice(0, 10)) console.log('  - ' + r.ma_truong + ' (' + r.n + ')');
  console.log('Proposal codes missing from truong: ' + fmt(daMissingSchool.length));
  if (daMissingSchool.length) console.log('  ' + daMissingSchool.slice(0, 20).join(', '));

  // ---------------------------------------------------------------------------
  section('6. SUMMARY');
  console.log('These are snapshots taken at runtime, not automatic failures.');
  console.log('Detailed issues and remediation: .agents/KNOWN_ISSUES.md');
  console.log('This script is read-only. No database changes were written.');

  db.close();
}

main().catch((err) => {
  console.error('Database inspection failed:', err.message);
  process.exit(1);
});
