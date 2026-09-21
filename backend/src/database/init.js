const fs = require('fs');
const path = require('path');
const { getDb, saveDb, queryAll } = require('./db');

const DATA_DIR = path.join(__dirname, '../../../data');

function parseCSV(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
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

// Build school name -> code mapping from theo_truong files
function buildSchoolMap() {
  const truongDir = path.join(DATA_DIR, 'khoi_thi/theo_truong');
  const files = fs.readdirSync(truongDir).filter(f => f.endsWith('.txt'));
  const map = {};

  for (const file of files) {
    const match = file.match(/^\[([A-Z0-9]+)\]\s*-\s*\[(.+?)\]\.txt$/);
    if (match) {
      const code = match[1];
      const name = match[2];
      // Normalize name for comparison
      map[name] = code;
      // Also add without accents variations
      map[name.toLowerCase()] = code;
    }
  }
  return map;
}

// Find school code from name using fuzzy matching
function findSchoolCode(name, schoolMap) {
  // Exact match
  if (schoolMap[name]) return schoolMap[name];

  // Try to find by partial match
  for (const [mapName, code] of Object.entries(schoolMap)) {
    if (typeof mapName !== 'string') continue;
    // Check if the name contains the map name or vice versa
    if (name.includes(mapName) || mapName.includes(name)) {
      return code;
    }
  }

  // Try to match by common abbreviations
  const abbreviations = {
    'ĐHBK Hà Nội': 'BKA',
    'ĐH Công nghệ - ĐHQGHN': 'QHI',
    'ĐH Khoa học Tự nhiên - ĐHQGHN': 'QHT',
    'ĐH Khoa học Xã hội và Nhân văn - ĐHQGHN': 'QHX',
    'ĐH Kinh tế Quốc dân': 'KHA',
    'ĐH Kinh tế TP.HCM': 'UEF',
    'ĐH Ngoại thương': 'NTH',
    'ĐH Thương mại': 'TMU',
    'ĐH Hà Nội': 'NHF',
    'ĐH Sư phạm Hà Nội': 'SPH',
    'ĐH Sư phạm TP.HCM': 'SPS',
    'ĐH Y Hà Nội': 'YHB',
    'ĐH Y Dược TP.HCM': 'YDS',
    'ĐH Dược Hà Nội': 'DKH',
    'ĐH Luật Hà Nội': 'LPH',
    'ĐH Công nghiệp Hà Nội': 'DCN',
    'ĐH Giao thông Vận tải': 'GHA',
    'ĐH Thủy lợi': 'TLA',
    'ĐH Mỏ - Địa chất': 'MDA',
    'ĐH Nông nghiệp Hà Nội': 'HVN',
    'ĐH Lâm nghiệp': 'LNH',
    'ĐH Kiến trúc Hà Nội': 'KTA',
    'ĐH Tài nguyên và Môi trường Hà Nội': 'DMT',
    'ĐH Nha Trang': 'TSN',
    'ĐH FPT': 'FPT',
    'Học viện Tài chính': 'HTC',
    'Học viện Hành chính Quốc gia': 'HCP',
    'Học viện Kỹ thuật Mật mã': 'KMA',
    'Học viện Hàng không Việt Nam': 'HHK',
    'ĐH Lao động - Xã hội': 'DLX',
    'ĐH Nội vụ Hà Nội': 'DNV',
    'ĐH TDTT Bắc Ninh': 'TDB',
    'ĐH Mỹ thuật Công nghiệp': 'MTU',
    'ĐH Mỹ thuật Việt Nam': 'MTV',
    'ĐH Sân khấu - Điện ảnh Hà Nội': 'SKH',
    'Nhạc viện Hà Nội': 'NHB',
  };

  if (abbreviations[name]) return abbreviations[name];

  return '';
}

function importKhoiThi(db) {
  console.log('Importing khoi thi from theo_khoi_thi...');
  const khoiDir = path.join(DATA_DIR, 'khoi_thi/theo_khoi_thi');
  const files = fs.readdirSync(khoiDir).filter(f => f.endsWith('.txt') && !f.includes('('));
  let count = 0;

  const stmt = db.prepare('INSERT OR IGNORE INTO khoi_thi (ma_khoi, mon_thi, so_truong) VALUES (?, ?, ?)');

  db.run('BEGIN TRANSACTION');
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(khoiDir, file), 'utf-8');
      const headerMatch = content.match(/^# Khối: (\S+)\s*\((.+?)\)/m);
      if (headerMatch) {
        const maKhoi = headerMatch[1];
        const monThi = headerMatch[2];
        const schoolCount = (content.match(/^\[[A-Z0-9]+\]/gm) || []).length;
        stmt.run([maKhoi, monThi, schoolCount]);
        count++;
      }
    } catch (e) {}
  }
  db.run('COMMIT');
  stmt.free();
  console.log(`  Imported ${count} blocks`);
}

function importTruong(db) {
  console.log('Importing truong from theo_truong...');
  const truongDir = path.join(DATA_DIR, 'khoi_thi/theo_truong');
  const files = fs.readdirSync(truongDir).filter(f => f.endsWith('.txt'));
  let count = 0;

  const stmt = db.prepare('INSERT OR IGNORE INTO truong (ma_truong, ten_truong) VALUES (?, ?)');

  db.run('BEGIN TRANSACTION');
  for (const file of files) {
    try {
      const match = file.match(/^\[([A-Z0-9]+)\]\s*-\s*\[(.+?)\]\.txt$/);
      if (match) {
        stmt.run([match[1], match[2]]);
        count++;
      }
    } catch (e) {}
  }
  db.run('COMMIT');
  stmt.free();
  console.log(`  Imported ${count} schools`);
}

function importDiemChuan(db) {
  console.log('Importing diem chuan from JSON...');
  const diemChuanDir = path.join(DATA_DIR, 'diem_chuan');
  const METHOD_MAP = {
    'scraped_tuyensinh.json': 'Điểm thi THPT',
    'scraped_tuyensinh_hsa.json': 'Điểm ĐGNL HSA',
    'scraped_tuyensinh_tsa.json': 'Điểm ĐGTD TSA',
    'scraped_tuyensinh_vact.json': 'Điểm ĐGNL V-ACT',
    'scraped_tuyensinh_sat.json': 'Chứng chỉ SAT'
  };

  const schoolMap = buildSchoolMap();
  let totalCount = 0;

  const stmt = db.prepare(
    'INSERT OR IGNORE INTO diem_chuan (ma_truong, truong, nganh, to_hop_mon, diem_chuan, ghi_chu, nam, phuong_thuc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const [filename, method] of Object.entries(METHOD_MAP)) {
    const filePath = path.join(diemChuanDir, filename);
    if (!fs.existsSync(filePath)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      let count = 0;
      db.run('BEGIN TRANSACTION');

      for (const [schoolName, majors] of Object.entries(data)) {
        const maTruong = findSchoolCode(schoolName, schoolMap);

        for (const [majorName, info] of Object.entries(majors)) {
          const mark = parseFloat(info.mark) || null;
          const block = info.block || '';
          const code = info.code || '';

          if (mark === null) continue;

          stmt.run([
            maTruong,
            schoolName,
            majorName,
            block,
            mark,
            code,
            2025,
            method
          ]);
          count++;
        }
      }

      db.run('COMMIT');
      console.log(`  ${method}: ${count} records (mapped: ${count})`);
      totalCount += count;
    } catch (e) {
      db.run('ROLLBACK');
      console.error(`  Error importing ${filename}:`, e.message);
    }
  }

  stmt.free();
  console.log(`Total imported: ${totalCount} records`);
}

function importDiemThi(db) {
  console.log('Importing diem thi THPTQG 2026...');
  const filePath = path.join(DATA_DIR, 'diem_thptqg_2026/diem_thi_THPTQG_2026.csv');
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

  db.run('DROP TABLE IF EXISTS diem_chuan');
  db.run('DROP TABLE IF EXISTS khoi_thi');
  db.run('DROP TABLE IF EXISTS truong');
  db.run('DROP TABLE IF EXISTS diem_thi_thptqg');
  db.run('DROP TABLE IF EXISTS de_an_tuyen_sinh');

  db.run(`CREATE TABLE khoi_thi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ma_khoi TEXT UNIQUE NOT NULL,
    mon_thi TEXT,
    so_truong INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE truong (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ma_truong TEXT UNIQUE NOT NULL,
    ten_truong TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE diem_chuan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ma_truong TEXT,
    truong TEXT NOT NULL,
    nganh TEXT NOT NULL,
    to_hop_mon TEXT,
    diem_chuan REAL,
    ghi_chu TEXT,
    nam INTEGER DEFAULT 2025,
    phuong_thuc TEXT
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
    ma_truong TEXT,
    ten_truong TEXT,
    noi_dung TEXT,
    nguon TEXT
  )`);

  importKhoiThi(db);
  importTruong(db);
  importDiemChuan(db);
  importDiemThi(db);
  importDeAn(db);

  db.run('CREATE INDEX IF NOT EXISTS idx_diem_chuan_ma_truong ON diem_chuan(ma_truong)');
  db.run('CREATE INDEX IF NOT EXISTS idx_diem_chuan_phuong_thuc ON diem_chuan(phuong_thuc)');
  db.run('CREATE INDEX IF NOT EXISTS idx_diem_chuan_to_hop_mon ON diem_chuan(to_hop_mon)');

  saveDb();
  console.log('Database initialization complete!');
}

main().catch(console.error);
