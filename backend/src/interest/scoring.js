'use strict';

const { GROUP_ORDER, GROUP_LABELS, PAIR_ORDER, PAIR_LABELS } = require('./content');

const ALGORITHM_VERSION = 'holland-pairs/1.0.0';
const PART1_GROUP_SIZE = 10;
const PART2_PAIR_SIZE = 12;
const PART1_MIN_ANSWERED = 8;
const MIN_COMPLETE_GROUPS_FOR_RANKING = 3;

function itemKey(item) {
  return `${item.part}:${item.itemNo}`;
}

function normalizeItem(item) {
  const part =
    item.part ||
    (item.leftKey !== undefined || item.left_key !== undefined || item.pair ? 'pairs' : 'riasec');
  const itemNo = Number(item.itemNo ?? item.item_no);
  return {
    id: item.id ?? itemKey({ part, itemNo }),
    part,
    groupCode: String(
      item.groupCode ??
        item.group_code ??
        (part === 'pairs' ? item.pair : item.group) ??
        ''
    ).toUpperCase(),
    itemNo,
    orderIndex: Number(item.orderIndex ?? item.order_index ?? 0),
    leftKey: item.leftKey ?? item.left_key ?? null,
    rightKey: item.rightKey ?? item.right_key ?? null,
    promptText: item.promptText ?? item.prompt_text ?? item.text ?? null,
    leftText: item.leftText ?? item.left_text ?? item.left ?? null,
    rightText: item.rightText ?? item.right_text ?? item.right ?? null,
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map(normalizeItem)
    .filter((item) => Number.isInteger(item.itemNo) && item.itemNo > 0)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.itemNo - b.itemNo);
}

function normalizeResponses(responses) {
  const map = new Map();
  if (!responses) return map;
  if (responses instanceof Map) {
    for (const [key, value] of responses.entries()) {
      map.set(String(key), Number(value));
    }
    return map;
  }
  if (Array.isArray(responses)) {
    for (const row of responses) {
      if (!row || typeof row !== 'object') continue;
      const key = row.itemId ?? row.item_id ?? row.id ?? row.itemKey ?? row.item_key;
      if (key === undefined || key === null) continue;
      const value = Number(row.value);
      if (Number.isFinite(value)) map.set(String(key), value);
    }
    return map;
  }
  if (typeof responses === 'object') {
    for (const [key, value] of Object.entries(responses)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) map.set(String(key), numeric);
    }
  }
  return map;
}

function responseValue(responses, item) {
  const idKey = String(item.id);
  if (responses.has(idKey)) return responses.get(idKey);
  const composite = itemKey(item);
  if (responses.has(composite)) return responses.get(composite);
  return undefined;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function scorePart1(items, responses) {
  const groups = GROUP_ORDER.map((code) => {
    const groupItems = items.filter((item) => item.part === 'riasec' && item.groupCode === code);
    let answered = 0;
    let sum = 0;
    for (const item of groupItems) {
      const value = responseValue(responses, item);
      if (value === undefined) continue;
      answered += 1;
      sum += value;
    }
    const status = answered === PART1_GROUP_SIZE ? 'complete' : answered === 0 ? 'empty' : 'partial';
    return {
      code,
      label: GROUP_LABELS[code] || code,
      sum: round(sum, 2),
      answered,
      max: answered * 5,
      status,
      mean: answered > 0 ? round(sum / answered, 2) : null,
      expected: PART1_GROUP_SIZE,
    };
  });

  const complete = groups.filter((group) => group.status === 'complete');
  let ranking = [];
  let ties = [];
  let rankingAvailable = false;

  if (complete.length >= MIN_COMPLETE_GROUPS_FOR_RANKING) {
    const sorted = [...complete].sort(
      (a, b) => b.sum - a.sum || GROUP_ORDER.indexOf(a.code) - GROUP_ORDER.indexOf(b.code)
    );
    const boundary = sorted[MIN_COMPLETE_GROUPS_FOR_RANKING - 1].sum;
    ranking = sorted.filter((group) => group.sum >= boundary).map((group) => group.code);
    rankingAvailable = true;

    const byScore = new Map();
    for (let index = 0; index < ranking.length; index += 1) {
      const group = groups.find((entry) => entry.code === ranking[index]);
      if (!byScore.has(group.sum)) byScore.set(group.sum, { rank: index + 1, codes: [] });
      byScore.get(group.sum).codes.push(group.code);
    }
    ties = [...byScore.values()].filter((entry) => entry.codes.length > 1);
  }

  return {
    groups,
    ranking,
    ties,
    rankingAvailable,
    code: ranking.length ? ranking.join('-') : null,
  };
}

function scorePart2(items, responses) {
  const pairs = PAIR_ORDER.map((code) => {
    const meta = PAIR_LABELS[code];
    const pairItems = items.filter((item) => item.part === 'pairs' && item.groupCode === code);
    let evenSum = 0;
    let oddSum = 0;
    let missing = 0;
    let answered = 0;

    for (const item of pairItems) {
      const value = responseValue(responses, item);
      if (value === undefined) {
        missing += 1;
        continue;
      }
      answered += 1;
      if (item.itemNo % 2 === 0) evenSum += value;
      else oddSum += value;
    }

    const complete = pairItems.length === PART2_PAIR_SIZE && missing === 0;
    const d = complete ? evenSum - oddSum : null;
    let lean = null;
    if (d !== null) {
      if (d > 0) lean = meta.first;
      else if (d < 0) lean = meta.second;
    }

    return {
      code,
      first: meta.first,
      second: meta.second,
      title: meta.title,
      d: d === null ? null : round(d, 2),
      status: complete ? 'complete' : 'thieu_du_lieu',
      lean,
      answered,
      expected: PART2_PAIR_SIZE,
      missing,
    };
  });

  const referenceCode = pairs.map((pair) => pair.lean || '?').join('');
  return { pairs, referenceCode };
}

function checkSubmissionPolicy(score) {
  const missingGroups = score.part1.groups
    .filter((group) => group.answered < PART1_MIN_ANSWERED)
    .map((group) => ({ code: group.code, answered: group.answered, required: PART1_MIN_ANSWERED }));
  const missingPairs = score.part2.pairs
    .filter((pair) => pair.status !== 'complete')
    .map((pair) => ({ code: pair.code, answered: pair.answered, required: PART2_PAIR_SIZE }));
  return {
    ok: missingGroups.length === 0 && missingPairs.length === 0,
    missingGroups,
    missingPairs,
  };
}

function scoreAttempt({ instrument, items, responses }) {
  const normalizedItems = normalizeItems(items);
  const normalizedResponses = normalizeResponses(responses);
  const part1 = scorePart1(normalizedItems, normalizedResponses);
  const part2 = scorePart2(normalizedItems, normalizedResponses);
  const totalItems = normalizedItems.length;
  let answeredCount = 0;
  for (const item of normalizedItems) {
    if (responseValue(normalizedResponses, item) !== undefined) answeredCount += 1;
  }
  const unansweredCount = Math.max(totalItems - answeredCount, 0);

  return {
    algorithmVersion: ALGORITHM_VERSION,
    instrumentCode: instrument?.code ?? null,
    instrumentVersion: instrument?.version ?? null,
    part1,
    part2,
    answeredCount,
    unansweredCount,
    completeness: unansweredCount === 0 ? 'full' : 'partial',
  };
}

module.exports = {
  ALGORITHM_VERSION,
  PART1_GROUP_SIZE,
  PART2_PAIR_SIZE,
  PART1_MIN_ANSWERED,
  normalizeItem,
  normalizeItems,
  normalizeResponses,
  scoreAttempt,
  checkSubmissionPolicy,
};
