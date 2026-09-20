const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { getDb, saveDb } = require('./db');

const DATA_DIR = path.join(__dirname, '../../../data');

function parseCSV(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  return parse(content, { columns: true, skip_empty_lines: true, trim: true });
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

// Extract method from filename like "Xem thêm điểm chuẩn theo phương thức Điểm học bạ năm 2024"
function extractMethod(filename) {
  const m = filename.match(/Điểm\s+(.+?)\s+năm/);
  if (!m) return null; // no method found → skip
  let method = m[1].trim();
  if (method.includes('thi THPT') || method.includes('xét tốt nghiệp THPT')) return 'Điểm thi THPT';
  if (method.includes('học bạ')) return 'Điểm học bạ';
  if (method.includes('xét tuyển kết hợp')) return 'Điểm xét tuyển kết hợp';
  if (method.includes('thi riêng')) return 'Điểm thi riêng';
  if (method.includes('ĐGNL HSA')) return 'Điểm ĐGNL HSA';
  if (method.includes('ĐGNL V-ACT')) return 'Điểm ĐGNL V-ACT';
  if (method.includes('ĐGNL SPT')) return 'Điểm ĐGNL SPT';
  if (method.includes('ĐGNL QDA')) return 'Điểm ĐGNL QDA';
  if (method.includes('ĐGNL H-SCA')) return 'Điểm ĐGNL H-SCA';
  if (method.includes('ĐGNL SP2E')) return 'Điểm ĐGNL SP2E';
  if (method.includes('ĐGTD TSA')) return 'Điểm ĐGTD TSA';
  if (method.includes('V-SAT')) return 'Đánh giá đầu vào V-SAT';
  return 'Điểm ' + method;
}

function extractYear(filename) {
  const match = filename.match(/nam (\d{4})/);
  return match ? parseInt(match[1]) : 2024;
}

function importDiemChuan(db) {
  console.log('Importing diem chuan...');
  const files = fs.readdirSync(path.join(DATA_DIR, 'diem_chuan')).filter(f => f.endsWith('.csv'));
  let count = 0;
  let skippedEmpty = 0;

  const stmt = db.prepare(
    'INSERT OR IGNORE INTO diem_chuan (truong, nganh, to_hop_mon, diem_chuan, ghi_chu, nam, phuong_thuc) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  for (const file of files) {
    // Skip files with empty method (end with " - .csv")
    if (file.endsWith(' - .csv')) {
      skippedEmpty++;
      continue;
    }

    const method = extractMethod(file);
    // Skip files where we can't extract a method
    if (!method) {
      skippedEmpty++;
      continue;
    }

    try {
      const records = parseCSV(path.join(DATA_DIR, 'diem_chuan', file));

      // Extract school name: "[Major] - [School] - [Method]..." → parts[1]
      // Or "[School] - [Method]..." → parts[0]
      const baseName = file.replace('.csv', '');
      const parts = baseName.split(' - ');
      let schoolName;
      if (parts.length >= 3) {
        // "Du Lịch - Đại Học Huế - Xem thêm..."
        schoolName = parts[1].trim();
      } else {
        // "Học Viện Chính Sách và Phát Triển - Xem thêm..."
        schoolName = parts[0].trim();
      }

      const year = extractYear(file);

      db.run('BEGIN TRANSACTION');
      for (const record of records) {
        const diemChuan = parseFloat(record['Điểm chuẩn']) || null;
        stmt.run([
          schoolName,
          record['Tên ngành'] || '',
          record['Tổ hợp môn'] || '',
          diemChuan,
          record['Ghi chú'] || '',
          year,
          method
        ]);
        count++;
      }
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
    }
  }
  stmt.free();
  console.log(`  Imported ${count} records (skipped ${skippedEmpty} files without method)`);
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
  } catch (e) { db.run('ROLLBACK'); }
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
  } catch (e) { db.run('ROLLBACK'); }
  console.log(`  Imported ${count} records`);
}

function importDeAn(db) {
  console.log('Importing de an tuyen sinh...');
  const files = fs.readdirSync(path.join(DATA_DIR, 'de_an_tuyen_sinh')).filter(f => f.endsWith('.md'));
  let count = 0;
  const stmt = db.prepare('INSERT OR IGNORE INTO de_an_tuyen_sinh (ma_truong, ten_truong, noi_dung, nguon) VALUES (?, ?, ?, ?)');
  db.run('BEGIN TRANSACTION');
  for (const file of files) {
    try {
      const data = parseMD(path.join(DATA_DIR, 'de_an_tuyen_sinh', file));
      stmt.run([data.ma_truong, data.ten_truong, data.noi_dung, '']);
      count++;
    } catch (e) {}
  }
  db.run('COMMIT');
  stmt.free();
  console.log(`  Imported ${count} records`);
}

async function main() {
  console.log('Initializing database...');
  const db = await getDb();
  db.run('DROP TABLE IF EXISTS diem_chuan');
  db.run('DROP TABLE IF EXISTS khoi_thi');
  db.run('DROP TABLE IF EXISTS diem_thi_thptqg');
  db.run('DROP TABLE IF EXISTS de_an_tuyen_sinh');

  db.run(`CREATE TABLE diem_chuan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    truong TEXT NOT NULL, nganh TEXT NOT NULL,
    to_hop_mon TEXT, diem_chuan REAL, ghi_chu TEXT,
    nam INTEGER DEFAULT 2024, phuong_thuc TEXT
  )`);
  db.run(`CREATE TABLE khoi_thi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ma_khoi TEXT NOT NULL, mon_xet_tuyen TEXT,
    ma_truong TEXT, ten_truong TEXT, so_nganh TEXT
  )`);
  db.run(`CREATE TABLE diem_thi_thptqg (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sbd TEXT UNIQUE, tinh TEXT,
    toan REAL, van REAL, ly REAL, hoa REAL, sinh REAL,
    su REAL, dia REAL, gd_kt_pl TEXT,
    tin_hoc REAL, cong_nghe REAL, ngoai_ngu REAL
  )`);
  db.run(`CREATE TABLE de_an_tuyen_sinh (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ma_truong TEXT UNIQUE, ten_truong TEXT, noi_dung TEXT, nguon TEXT
  )`);

  importDiemChuan(db);
  importKhoiThi(db);
  importDiemThi(db);
  importDeAn(db);

  saveDb();
  console.log('Database initialization complete!');
}

main().catch(console.error);
