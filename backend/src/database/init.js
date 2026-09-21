const fs = require('fs');
const path = require('path');
const { getDb, saveDb } = require('./db');

const DATA_DIR = path.join(__dirname, '../../../data');

// Map JSON filenames to admission methods
const METHOD_MAP = {
  'scraped_tuyensinh.json': 'Điểm thi THPT',
  'scraped_tuyensinh_hsa.json': 'Điểm ĐGNL HSA',
  'scraped_tuyensinh_tsa.json': 'Điểm ĐGTD TSA',
  'scraped_tuyensinh_vact.json': 'Điểm ĐGNL V-ACT',
  'scraped_tuyensinh_sat.json': 'Chứng chỉ SAT'
};

function parseCSV(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  // Manual CSV parsing for simple format
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    return obj;
  });
}

function importDiemChuan(db) {
  console.log('Importing diem chuan from JSON...');

  const diemChuanDir = path.join(DATA_DIR, 'diem_chuan');
  let totalCount = 0;

  const stmt = db.prepare(
    'INSERT OR IGNORE INTO diem_chuan (truong, nganh, to_hop_mon, diem_chuan, ghi_chu, nam, phuong_thuc) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  for (const [filename, method] of Object.entries(METHOD_MAP)) {
    const filePath = path.join(diemChuanDir, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`  Skip ${filename} (not found)`);
      continue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      let count = 0;

      db.run('BEGIN TRANSACTION');

      for (const [schoolName, majors] of Object.entries(data)) {
        for (const [majorName, info] of Object.entries(majors)) {
          const mark = parseFloat(info.mark) || null;
          const block = info.block || '';
          const code = info.code || '';

          if (mark === null) continue;

          stmt.run([
            schoolName,
            majorName,
            block,
            mark,
            code, // use code as ghi_chu for THPTQG
            2025, // default year
            method
          ]);
          count++;
        }
      }

      db.run('COMMIT');
      console.log(`  ${method}: ${count} records`);
      totalCount += count;
    } catch (e) {
      db.run('ROLLBACK');
      console.error(`  Error importing ${filename}:`, e.message);
    }
  }

  stmt.free();
  console.log(`Total imported: ${totalCount} records`);
}

function importKhoiThi(db) {
  console.log('Importing khoi thi...');
  const filePath = path.join(DATA_DIR, 'khoi_thi', 'tong_hop_tat_ca.csv');
  let count = 0;

  try {
    const records = parseCSV(filePath);
    const stmt = db.prepare('INSERT OR IGNORE INTO khoi_thi (ma_khoi, mon_xet_tuyen, ma_truong, ten_truong, so_nganh) VALUES (?, ?, ?, ?, ?)');
    db.run('BEGIN TRANSACTION');
    for (const record of records) {
      stmt.run([record['Mã khối'] || '', record['Môn xét tuyển'] || '', record['Mã trường'] || '', record['Tên trường'] || '', record['Số ngành'] || '']);
      count++;
    }
    db.run('COMMIT');
    stmt.free();
  } catch (e) {
    db.run('ROLLBACK');
    console.error('Error importing khoi thi:', e.message);
  }
  console.log(`  Imported ${count} records`);
}

function importDiemThi(db) {
  console.log('Importing diem thi THPTQG 2026...');
  const filePath = path.join(DATA_DIR, 'diem_thptqg_2026', 'diem_thi_THPTQG_2026.csv');
  let count = 0;

  try {
    const records = parseCSV(filePath);
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO diem_thi_thptqg (sbd, tinh, toan, van, ly, hoa, sinh, su, dia, gd_kt_pl, tin_hoc, cong_nghe, ngoai_ngu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const BATCH_SIZE = 50000;
    let batch = 0;
    db.run('BEGIN TRANSACTION');
    for (const record of records) {
      stmt.run([
        record['SBD'] || '', record['Tỉnh'] || '',
        parseFloat(record['Toán']) || null, parseFloat(record['Văn']) || null,
        parseFloat(record['Lý']) || null, parseFloat(record['Hóa']) || null,
        parseFloat(record['Sinh']) || null, parseFloat(record['Sử']) || null,
        parseFloat(record['Địa']) || null, record['GD Kinh tế - Pháp luật'] || '',
        parseFloat(record['Tin học']) || null, parseFloat(record['Công nghệ']) || null,
        parseFloat(record['Ngoại ngữ']) || null
      ]);
      count++;
      batch++;
      if (batch >= BATCH_SIZE) {
        db.run('COMMIT'); db.run('BEGIN TRANSACTION');
        console.log(`  ... ${count} records`); batch = 0;
      }
    }
    db.run('COMMIT');
    stmt.free();
  } catch (e) {
    db.run('ROLLBACK');
    console.error('Error importing diem thi:', e.message);
  }
  console.log(`  Imported ${count} records`);
}

function parseMD(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath, '.md');
  const match = filename.match(/\[(\w+)\]\s*-\s*\[(.+?)\]/);
  return {
    ma_truong: match ? match[1] : '',
    ten_truong: match ? match[2] : filename,
    noi_dung: content,
  };
}

function importDeAn(db) {
  console.log('Importing de an tuyen sinh...');
  const dir = path.join(DATA_DIR, 'de_an_tuyen_sinh');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  let count = 0;

  try {
    const stmt = db.prepare('INSERT OR IGNORE INTO de_an_tuyen_sinh (ma_truong, ten_truong, noi_dung, nguon) VALUES (?, ?, ?, ?)');
    db.run('BEGIN TRANSACTION');
    for (const file of files) {
      try {
        const data = parseMD(path.join(dir, file));
        stmt.run([data.ma_truong, data.ten_truong, data.noi_dung, '']);
        count++;
      } catch (e) {}
    }
    db.run('COMMIT');
    stmt.free();
  } catch (e) {
    db.run('ROLLBACK');
    console.error('Error importing de an:', e.message);
  }
  console.log(`  Imported ${count} records`);
}

async function main() {
  console.log('Initializing database...');
  const db = await getDb();

  // Drop old tables
  db.run('DROP TABLE IF EXISTS diem_chuan');
  db.run('DROP TABLE IF EXISTS khoi_thi');
  db.run('DROP TABLE IF EXISTS diem_thi_thptqg');
  db.run('DROP TABLE IF EXISTS de_an_tuyen_sinh');

  // Create tables
  db.run(`CREATE TABLE diem_chuan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    truong TEXT NOT NULL,
    nganh TEXT NOT NULL,
    to_hop_mon TEXT,
    diem_chuan REAL,
    ghi_chu TEXT,
    nam INTEGER DEFAULT 2025,
    phuong_thuc TEXT
  )`);

  db.run(`CREATE TABLE khoi_thi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ma_khoi TEXT NOT NULL,
    mon_xet_tuyen TEXT,
    ma_truong TEXT,
    ten_truong TEXT,
    so_nganh TEXT
  )`);

  db.run(`CREATE TABLE diem_thi_thptqg (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sbd TEXT UNIQUE,
    tinh TEXT,
    toan REAL, van REAL, ly REAL, hoa REAL, sinh REAL,
    su REAL, dia REAL, gd_kt_pl TEXT,
    tin_hoc REAL, cong_nghe REAL, ngoai_ngu REAL
  )`);

  db.run(`CREATE TABLE de_an_tuyen_sinh (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ma_truong TEXT UNIQUE,
    ten_truong TEXT,
    noi_dung TEXT,
    nguon TEXT
  )`);

  // Import data
  importDiemChuan(db);
  importKhoiThi(db);
  importDiemThi(db);
  importDeAn(db);

  // Create indexes for better query performance
  db.run('CREATE INDEX IF NOT EXISTS idx_diem_chuan_phuong_thuc ON diem_chuan(phuong_thuc)');
  db.run('CREATE INDEX IF NOT EXISTS idx_diem_chuan_truong ON diem_chuan(truong)');
  db.run('CREATE INDEX IF NOT EXISTS idx_diem_chuan_diem ON diem_chuan(diem_chuan)');

  saveDb();
  console.log('Database initialization complete!');
}

main().catch(console.error);
