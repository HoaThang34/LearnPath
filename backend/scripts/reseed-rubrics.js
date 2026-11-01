'use strict';

const fs = require('node:fs');
const path = require('node:path');
const rubrics = require('../src/data/edumind_rubrics.json');
const {
  AUTH_DB_PATH,
  getAuthDb,
  queryAll,
  queryOne,
  runSql,
  saveAuthDb,
} = require('../src/auth/authDb');

const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY;

function naturalKey(row) {
  return [
    row.schoolCode || row.school_code || '',
    row.schoolName || row.school_name || '',
    row.majorName || row.major_name || '',
    row.method || '',
    row.admissionBlock || row.admission_block || '',
    row.year,
  ].join('|');
}

function backupAuthDb() {
  if (!fs.existsSync(AUTH_DB_PATH)) return null;
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const target = `${AUTH_DB_PATH}.pre-m0-${stamp}`;
  fs.copyFileSync(AUTH_DB_PATH, target);
  return target;
}

async function main() {
  let existing;
  if (DRY_RUN) {
    if (!fs.existsSync(AUTH_DB_PATH)) {
      throw new Error(`Auth DB not found at ${AUTH_DB_PATH}.`);
    }
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(AUTH_DB_PATH));
    existing = [];
    const stmt = db.prepare(
      `SELECT id, school_code AS schoolCode, school_name AS schoolName,
              major_name AS majorName, method, admission_block AS admissionBlock, year
         FROM career_rubrics`
    );
    while (stmt.step()) existing.push(stmt.getAsObject());
    stmt.free();
    db.close();
  } else {
    await getAuthDb();
    existing = queryAll(
      `SELECT id, school_code AS schoolCode, school_name AS schoolName,
              major_name AS majorName, method, admission_block AS admissionBlock, year
         FROM career_rubrics`
    );
  }
  const byKey = new Map(existing.map((row) => [naturalKey(row), row]));
  const sourceKeys = new Set(rubrics.map((row) => naturalKey(row)));
  const orphans = existing.filter((row) => !sourceKeys.has(naturalKey(row)));

  let matched = 0;
  let inserted = 0;
  const changedExamples = [];

  for (const rubric of rubrics) {
    const key = naturalKey(rubric);
    const found = byKey.get(key);
    if (found) matched += 1;
    else inserted += 1;
    if (changedExamples.length < 5) {
      changedExamples.push(
        `${rubric.schoolName} | ${rubric.majorName} | ${rubric.admissionBlock} | entryScore=${rubric.entryScore} | ${rubric.subjects.map((row) => `${row.subject}:${row.weight}:${row.threshold}`).join(', ')}`
      );
    }
  }

  console.log(`Auth DB: ${AUTH_DB_PATH}`);
  console.log(`Source rubrics: ${rubrics.length}`);
  console.log(`Matched in DB: ${matched}`);
  console.log(`Will insert: ${inserted}`);
  console.log(`DB rubrics not in source (left untouched): ${orphans.length}`);
  console.log(`Invalid (isValid=false): ${rubrics.filter((row) => row.isValid === false).length}`);
  console.log('\nFirst rows to write:');
  for (const line of changedExamples) console.log(`  ${line}`);

  if (DRY_RUN) {
    console.log('\nDry run only. Re-run with --apply to write (a backup is created first).');
    return;
  }

  const backup = backupAuthDb();
  if (!backup) {
    throw new Error(`Auth DB not found at ${AUTH_DB_PATH}; refusing to create it from this script.`);
  }
  console.log(`\nBackup: ${backup}`);

  const now = Date.now();
  runSql('BEGIN');
  try {
    for (const rubric of rubrics) {
      const key = naturalKey(rubric);
      const found = queryOne(
        `SELECT id FROM career_rubrics
          WHERE COALESCE(school_code, '') = COALESCE(?, '')
            AND school_name = ? AND major_name = ? AND method = ?
            AND COALESCE(admission_block, '') = COALESCE(?, '') AND year = ?`,
        [
          rubric.schoolCode || null,
          rubric.schoolName,
          rubric.majorName,
          rubric.method,
          rubric.admissionBlock || null,
          rubric.year,
        ]
      );
      let rubricId;
      const isValid = rubric.isValid !== false ? 1 : 0;
      if (found) {
        rubricId = Number(found.id);
        runSql(
          'UPDATE career_rubrics SET major_group = ?, entry_score = ?, is_valid = ?, updated_at = ? WHERE id = ?',
          [rubric.majorGroup || null, rubric.entryScore ?? null, isValid, now, rubricId]
        );
        runSql('DELETE FROM career_rubric_subjects WHERE rubric_id = ?', [rubricId]);
      } else {
        runSql(
          `INSERT INTO career_rubrics
             (school_code, school_name, major_name, method, admission_block, major_group,
              entry_score, is_valid, year, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rubric.schoolCode || null,
            rubric.schoolName,
            rubric.majorName,
            rubric.method,
            rubric.admissionBlock || null,
            rubric.majorGroup || null,
            rubric.entryScore ?? null,
            isValid,
            rubric.year,
            now,
            now,
          ]
        );
        rubricId = Number(queryOne('SELECT last_insert_rowid() AS id').id);
      }
      for (const subject of rubric.subjects) {
        runSql(
          'INSERT INTO career_rubric_subjects (rubric_id, subject_name, weight, threshold) VALUES (?, ?, ?, ?)',
          [rubricId, subject.subject, subject.weight, subject.threshold]
        );
      }
      byKey.set(key, { id: rubricId });
    }

    runSql(
      `INSERT INTO admin_audit (admin_id, admin_username, action, entity, entity_id, details, ip_hash, created_at)
       VALUES (NULL, 'system:m0', 'admin.career.rubric.reseed', 'career_rubric', NULL, ?, NULL, ?)`,
      [
        JSON.stringify({
          source: path.basename('edumind_rubrics.json'),
          total: rubrics.length,
          matched,
          inserted,
          orphans: orphans.length,
        }),
        now,
      ]
    );
    runSql('COMMIT');
  } catch (error) {
    try {
      runSql('ROLLBACK');
    } catch (rollbackError) {
      // The original error is more useful.
    }
    throw error;
  }

  saveAuthDb();
  console.log('Re-seed committed and saved.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
