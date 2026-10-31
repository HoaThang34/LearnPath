'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const instrument = require('../../src/data/interest_instrument_v1.json');
const {
  scoreAttempt,
  normalizeItems,
  checkSubmissionPolicy,
} = require('../../src/interest/scoring');

const items = normalizeItems([...instrument.part1, ...instrument.part2]);

function part1Item(group, index) {
  return items.find((item) => item.part === 'riasec' && item.groupCode === group && item.itemNo === index);
}

function part2Items(pair) {
  return items.filter((item) => item.part === 'pairs' && item.groupCode === pair);
}

function responsesFrom(map) {
  return [...map.entries()].map(([itemId, value]) => ({ itemId, value }));
}

function fillAllPart1(value) {
  const map = new Map();
  for (const item of items.filter((entry) => entry.part === 'riasec')) map.set(item.id, value);
  return map;
}

function fillPair(map, pair, evenValue, oddValue) {
  for (const item of part2Items(pair)) {
    map.set(item.id, item.itemNo % 2 === 0 ? evenValue : oddValue);
  }
  return map;
}

test('T1: all Part 1 answers are 5', () => {
  const score = scoreAttempt({ instrument, items, responses: responsesFrom(fillAllPart1(5)) });
  assert.equal(score.part1.groups.length, 6);
  for (const group of score.part1.groups) {
    assert.equal(group.sum, 50);
    assert.equal(group.answered, 10);
    assert.equal(group.max, 50);
    assert.equal(group.status, 'complete');
  }
  assert.equal(score.part1.rankingAvailable, true);
});

test('T2: all Part 1 answers are 1', () => {
  const score = scoreAttempt({ instrument, items, responses: responsesFrom(fillAllPart1(1)) });
  for (const group of score.part1.groups) assert.equal(group.sum, 10);
});

test('T3: partial group R keeps its sum and is excluded from ranking', () => {
  const map = new Map();
  const rItems = items.filter((item) => item.part === 'riasec' && item.groupCode === 'R');
  for (const item of rItems.slice(0, 7)) map.set(item.id, 5);
  const score = scoreAttempt({ instrument, items, responses: responsesFrom(map) });
  const r = score.part1.groups.find((group) => group.code === 'R');
  assert.equal(r.sum, 35);
  assert.equal(r.answered, 7);
  assert.equal(r.max, 35);
  assert.equal(r.status, 'partial');
  assert.equal(score.part1.rankingAvailable, false);
  assert.deepEqual(score.part1.ranking, []);
});

test('T4: an empty group reports empty, not zero points', () => {
  const score = scoreAttempt({ instrument, items, responses: [] });
  const i = score.part1.groups.find((group) => group.code === 'I');
  assert.equal(i.status, 'empty');
  assert.equal(i.sum, 0);
  assert.equal(i.answered, 0);
  assert.equal(i.max, 0);
});

test('T5: even +2 and odd -2 gives D = +24 and the first letter', () => {
  const map = new Map();
  for (const pair of ['EI', 'SN', 'TF', 'JP']) fillPair(map, pair, 2, -2);
  const score = scoreAttempt({ instrument, items, responses: responsesFrom(map) });
  for (const pair of score.part2.pairs) {
    assert.equal(pair.d, 24);
    assert.equal(pair.lean, pair.first);
  }
});

test('T6: even -2 and odd +2 gives D = -24 and the second letter', () => {
  const map = new Map();
  for (const pair of ['EI', 'SN', 'TF', 'JP']) fillPair(map, pair, -2, 2);
  const score = scoreAttempt({ instrument, items, responses: responsesFrom(map) });
  for (const pair of score.part2.pairs) {
    assert.equal(pair.d, -24);
    assert.equal(pair.lean, pair.second);
  }
});

test('T7: answering the same side everywhere gives D = 0 (sign check)', () => {
  const map = new Map();
  for (const pair of ['EI', 'SN', 'TF', 'JP']) fillPair(map, pair, 2, 2);
  const score = scoreAttempt({ instrument, items, responses: responsesFrom(map) });
  for (const pair of score.part2.pairs) {
    assert.equal(pair.d, 0);
    assert.equal(pair.lean, null);
  }
  assert.equal(score.part2.referenceCode, '????');
});

test('T8: all Part 2 answers are 0', () => {
  const map = new Map();
  for (const pair of ['EI', 'SN', 'TF', 'JP']) fillPair(map, pair, 0, 0);
  const score = scoreAttempt({ instrument, items, responses: responsesFrom(map) });
  for (const pair of score.part2.pairs) assert.equal(pair.d, 0);
});

test('T9: weighted sums are subtracted, not only boundary values', () => {
  const map = new Map();
  fillPair(map, 'EI', 1, -2);
  const score = scoreAttempt({ instrument, items, responses: responsesFrom(map) });
  const ei = score.part2.pairs.find((pair) => pair.code === 'EI');
  assert.equal(ei.d, 18);
});

test('T10: a missing SN item makes only that pair null', () => {
  const map = new Map();
  for (const pair of ['EI', 'SN', 'TF', 'JP']) fillPair(map, pair, 1, -1);
  const snItems = part2Items('SN');
  map.delete(snItems[0].id);
  const score = scoreAttempt({ instrument, items, responses: responsesFrom(map) });
  const sn = score.part2.pairs.find((pair) => pair.code === 'SN');
  assert.equal(sn.d, null);
  assert.equal(sn.status, 'thieu_du_lieu');
  for (const code of ['EI', 'TF', 'JP']) {
    const pair = score.part2.pairs.find((entry) => entry.code === code);
    assert.equal(pair.status, 'complete');
  }
});

test('T11: the instrument matches the content contract', () => {
  assert.equal(instrument.part1.length, 60);
  assert.equal(instrument.part2.length, 48);
  for (const group of ['R', 'I', 'A', 'S', 'E', 'C']) {
    assert.equal(instrument.part1.filter((item) => item.group === group).length, 10);
  }
  const expected = {
    EI: { first: 'E', second: 'I', even: [2, 4, 6, 8, 10, 12], odd: [1, 3, 5, 7, 9, 11] },
    SN: { first: 'S', second: 'N', even: [14, 16, 18, 20, 22, 24], odd: [13, 15, 17, 19, 21, 23] },
    TF: { first: 'T', second: 'F', even: [26, 28, 30, 32, 34, 36], odd: [25, 27, 29, 31, 33, 35] },
    JP: { first: 'J', second: 'P', even: [38, 40, 42, 44, 46, 48], odd: [37, 39, 41, 43, 45, 47] },
  };
  for (const [pair, contract] of Object.entries(expected)) {
    const pairItems = instrument.part2.filter((item) => item.pair === pair);
    assert.equal(pairItems.length, 12);
    const even = pairItems.filter((item) => item.itemNo % 2 === 0).map((item) => item.itemNo);
    const odd = pairItems.filter((item) => item.itemNo % 2 === 1).map((item) => item.itemNo);
    assert.deepEqual(even, contract.even);
    assert.deepEqual(odd, contract.odd);
    for (const item of pairItems) {
      const isOdd = item.itemNo % 2 === 1;
      assert.equal(item.leftKey, isOdd ? contract.first : contract.second);
      assert.equal(item.rightKey, isOdd ? contract.second : contract.first);
      assert.notEqual(item.leftKey, item.rightKey);
    }
  }
});

test('T12: ties are kept in the ranking and reported', () => {
  const map = new Map();
  const setGroup = (group, values) => {
    const groupItems = items.filter((item) => item.part === 'riasec' && item.groupCode === group);
    groupItems.forEach((item, index) => map.set(item.id, values[index]));
  };
  setGroup('R', [4, 4, 4, 4, 4, 4, 4, 4, 5, 5]);
  setGroup('I', [4, 4, 4, 4, 4, 4, 4, 4, 5, 5]);
  setGroup('A', [4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
  setGroup('S', [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
  setGroup('E', [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
  setGroup('C', [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
  const score = scoreAttempt({ instrument, items, responses: responsesFrom(map) });
  assert.equal(score.part1.groups.find((group) => group.code === 'R').sum, 42);
  assert.equal(score.part1.groups.find((group) => group.code === 'I').sum, 42);
  assert.deepEqual(score.part1.ranking, ['R', 'I', 'A']);
  assert.deepEqual(score.part1.ties, [{ rank: 1, codes: ['R', 'I'] }]);
  assert.equal(score.part1.code, 'R-I-A');
});

test('T13: D = 0 at TF is shown as a question mark', () => {
  const map = new Map();
  fillPair(map, 'EI', 2, -2);
  fillPair(map, 'SN', 2, -2);
  fillPair(map, 'TF', 0, 0);
  fillPair(map, 'JP', 2, -2);
  const score = scoreAttempt({ instrument, items, responses: responsesFrom(map) });
  assert.equal(score.part2.referenceCode, 'ES?J');
});

test('T14: submission policy requires 8/10 per group and 12/12 per pair', () => {
  const map = new Map();
  for (const item of items.filter((entry) => entry.part === 'riasec')) map.set(item.id, 3);
  for (const pair of ['EI', 'SN', 'TF', 'JP']) fillPair(map, pair, 0, 0);
  const complete = scoreAttempt({ instrument, items, responses: responsesFrom(map) });
  assert.equal(checkSubmissionPolicy(complete).ok, true);

  const rItems = items.filter((item) => item.part === 'riasec' && item.groupCode === 'R');
  for (const item of rItems.slice(0, 3)) map.delete(item.id);
  const partial = scoreAttempt({ instrument, items, responses: responsesFrom(map) });
  const policy = checkSubmissionPolicy(partial);
  assert.equal(policy.ok, false);
  assert.equal(policy.missingGroups.length, 1);
  assert.equal(policy.missingGroups[0].code, 'R');
});

test('part 1 helper returns the expected item', () => {
  const item = part1Item('R', 1);
  assert.ok(item);
  assert.equal(item.groupCode, 'R');
});
