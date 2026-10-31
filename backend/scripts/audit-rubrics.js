'use strict';

const fs = require('node:fs');
const path = require('node:path');
const rubrics = require('../src/data/edumind_rubrics.json');
const { getBlockSubjects } = require('../src/career/subjects');
const { calculateCareerFit } = require('../src/auth/career');

const LEVELS = [6.0, 7.0, 8.0, 9.0];

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function fitForLevel(rubric, level) {
  const scores = rubric.subjects.map((subject) => ({
    subject: subject.subject,
    scoreType: 'average',
    score: level,
  }));
  const rows = rubric.subjects.map((subject) => ({
    subject_name: subject.subject,
    weight: subject.weight,
    threshold: subject.threshold,
  }));
  return calculateCareerFit(scores, rows).fitPct;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : round((sorted[middle - 1] + sorted[middle]) / 2, 2);
}

function audit() {
  const report = {
    generatedAt: new Date().toISOString(),
    total: rubrics.length,
    l1: { levels: {} },
    l2: [],
    l3: [],
    l4: [],
    l5: [],
  };

  for (const level of LEVELS) {
    const fits = rubrics.map((rubric) => fitForLevel(rubric, level)).filter((value) => value !== null);
    report.l1.levels[level] = {
      count: fits.length,
      median: median(fits),
      q1: [...fits].sort((a, b) => a - b)[Math.floor(fits.length * 0.25)] ?? null,
      q3: [...fits].sort((a, b) => a - b)[Math.floor(fits.length * 0.75)] ?? null,
      atLeast95: fits.filter((value) => value >= 95).length,
    };
  }

  for (const rubric of rubrics) {
    const key = `${rubric.schoolCode}|${rubric.majorName}|${rubric.admissionBlock}`;
    const subjects = rubric.subjects.map((row) => row.subject);
    const blockSubjects = getBlockSubjects(rubric.admissionBlock);
    const entryScore = Number(rubric.entryScore);
    const thresholdSum = round(
      rubric.subjects.reduce((sum, row) => sum + Number(row.threshold), 0),
      2
    );

    if (!blockSubjects || subjects.some((subject) => !blockSubjects.includes(subject))) {
      report.l2.push({ key, block: rubric.admissionBlock, blockSubjects, subjects });
    }
    if (!Number.isFinite(entryScore) || Math.abs(thresholdSum - entryScore) > 0.01) {
      report.l3.push({ key, entryScore, thresholdSum, delta: round(thresholdSum - entryScore, 2) });
    }
    if (!Number.isFinite(entryScore) || entryScore <= 0 || entryScore > 30) {
      report.l4.push({ key, entryScore });
    }
    if (subjects.length !== 3 || !blockSubjects) {
      report.l5.push({
        key,
        block: rubric.admissionBlock,
        subjectCount: subjects.length,
        unknownBlock: !blockSubjects,
      });
    }
  }

  return report;
}

const report = audit();

if (process.argv.includes('--json')) {
  const outIndex = process.argv.indexOf('--json');
  const outPath = process.argv[outIndex + 1];
  if (outPath && !outPath.startsWith('--')) {
    fs.writeFileSync(path.resolve(outPath), JSON.stringify(report, null, 2), 'utf8');
    console.log(`Wrote ${outPath}`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
} else {
  console.log(`Rubric audit — ${report.total} rubrics`);
  console.log('\nL1 — saturation (fitPct when every subject equals the level):');
  for (const level of LEVELS) {
    const row = report.l1.levels[level];
    console.log(
      `  ${level.toFixed(1)}: median ${row.median}, Q1 ${row.q1}, Q3 ${row.q3}, ` +
        `>=95% ${row.atLeast95}/${row.count}`
    );
  }
  console.log(`\nL2 — subject not in admission block: ${report.l2.length}`);
  console.log(`L3 — |sum(threshold) - entryScore| > 0.01: ${report.l3.length}`);
  console.log(`L4 — entryScore outside (0, 30]: ${report.l4.length}`);
  console.log(`L5 — subject count != 3 or unknown block: ${report.l5.length}`);
  for (const row of report.l4) console.log(`  L4 ${row.key}: entryScore=${row.entryScore}`);
  for (const row of report.l5) {
    console.log(`  L5 ${row.key}: subjects=${row.subjectCount} unknownBlock=${row.unknownBlock}`);
  }
}

module.exports = { audit };
