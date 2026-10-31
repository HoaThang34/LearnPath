'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getBlockSubjects } = require('../src/career/subjects');

const SOURCE = path.resolve(__dirname, '../src/data/edumind_rubrics.json');

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeRubric(rubric) {
  const entryScore = Number(rubric.entryScore);
  const blockSubjects = getBlockSubjects(rubric.admissionBlock);
  const invalid = !Number.isFinite(entryScore) || entryScore <= 0 || entryScore > 30 || !blockSubjects;
  const before = JSON.stringify(rubric.subjects);
  let subjects = rubric.subjects.map((row) => ({
    subject: row.subject,
    weight: Number(row.weight),
    threshold: Number(row.threshold),
  }));

  if (!invalid) {
    const needsSubjectFix = subjects.some((row) => !blockSubjects.includes(row.subject));
    if (needsSubjectFix) {
      const weights = subjects.map((row) => row.weight).sort((a, b) => b - a);
      const thresholds = subjects.map((row) => row.threshold).sort((a, b) => b - a);
      subjects = blockSubjects.map((subject, index) => ({
        subject,
        weight: weights[index] ?? round(1 / blockSubjects.length, 3),
        threshold: thresholds[index] ?? 7,
      }));
      const weightSum = subjects.reduce((sum, row) => sum + row.weight, 0);
      subjects = subjects.map((row) => ({ ...row, weight: round(row.weight / weightSum, 3) }));
      const weightFix = round(1 - subjects.reduce((sum, row) => sum + row.weight, 0), 3);
      subjects[subjects.length - 1].weight = round(subjects[subjects.length - 1].weight + weightFix, 3);
    }

    const thresholdSum = subjects.reduce((sum, row) => sum + row.threshold, 0);
    if (thresholdSum > 0) {
      const factor = entryScore / thresholdSum;
      subjects = subjects.map((row) => ({ ...row, threshold: round(row.threshold * factor, 2) }));

      // Thresholds are per-subject on the 0–10 scale. Keep the sum equal to
      // entryScore while capping each threshold at 10; redistribute the excess
      // to the subjects that still have room.
      for (let iteration = 0; iteration < 20; iteration += 1) {
        const over = subjects
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => row.threshold > 10);
        if (over.length === 0) break;
        let excess = 0;
        for (const { index } of over) {
          excess += subjects[index].threshold - 10;
          subjects[index].threshold = 10;
        }
        const room = subjects
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => row.threshold < 10);
        const capacity = room.reduce((sum, { row }) => sum + (10 - row.threshold), 0);
        if (capacity <= 0) break;
        for (const { index } of room) {
          subjects[index].threshold = round(
            subjects[index].threshold + (excess * (10 - subjects[index].threshold)) / capacity,
            2
          );
        }
      }

      // Remove the rounding drift without breaking the cap.
      let delta = round(entryScore - subjects.reduce((sum, row) => sum + row.threshold, 0), 2);
      let guard = 0;
      while (Math.abs(delta) > 0.004 && guard < 100) {
        const index = subjects.findIndex((row) =>
          delta > 0 ? row.threshold < 10 : row.threshold > 0
        );
        if (index === -1) break;
        const step = delta > 0 ? Math.min(delta, 10 - subjects[index].threshold) : Math.max(delta, -subjects[index].threshold);
        subjects[index].threshold = round(subjects[index].threshold + step, 2);
        delta = round(delta - step, 2);
        guard += 1;
      }
    }
  }

  return {
    rubric: { ...rubric, isValid: !invalid, subjects },
    changed: before !== JSON.stringify(subjects) || rubric.isValid === undefined,
    invalid,
  };
}

function main() {
  const write = process.argv.includes('--write');
  const rubrics = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const result = rubrics.map(normalizeRubric);
  const output = result.map((row) => row.rubric);
  const changed = result.filter((row) => row.changed);
  const invalid = result.filter((row) => row.invalid);

  console.log(`Rubrics: ${rubrics.length}`);
  console.log(`Changed: ${changed.length}`);
  console.log(`Invalid (isValid=false): ${invalid.length}`);
  for (const row of invalid) {
    console.log(`  invalid: ${row.rubric.schoolName} — ${row.rubric.majorName} (${row.rubric.admissionBlock}) entryScore=${row.rubric.entryScore}`);
  }

  if (write) {
    const backup = `${SOURCE}.before-m0-${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;
    fs.copyFileSync(SOURCE, backup);
    fs.writeFileSync(SOURCE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    console.log(`Backup: ${backup}`);
    console.log(`Wrote: ${SOURCE}`);
  } else {
    console.log('Dry run. Re-run with --write to apply.');
  }
}

main();
