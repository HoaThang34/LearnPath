'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const instrument = require('../../src/data/interest_instrument_v1.json');

test('instrument metadata is complete and versioned', () => {
  assert.equal(instrument.code, 'holland-pairs-v1');
  assert.equal(instrument.version, 1);
  assert.equal(instrument.status, 'active');
  assert.match(instrument.sourceNote, /tự biên soạn/i);
  assert.match(instrument.disclaimer, /tự biên soạn/i);
  assert.ok(instrument.title.length > 0);
});

test('part 1 has 60 non-empty items in six contiguous blocks of ten', () => {
  assert.equal(instrument.part1.length, 60);
  const expectedGroups = [
    ['R', 1, 10],
    ['I', 11, 20],
    ['A', 21, 30],
    ['S', 31, 40],
    ['E', 41, 50],
    ['C', 51, 60],
  ];
  for (const [group, start, end] of expectedGroups) {
    const block = instrument.part1.filter((item) => item.itemNo >= start && item.itemNo <= end);
    assert.equal(block.length, 10);
    assert.ok(block.every((item) => item.group === group), `block ${group}`);
    assert.ok(block.every((item) => typeof item.text === 'string' && item.text.trim().length > 0));
    assert.deepEqual(
      block.map((item) => item.itemNo),
      Array.from({ length: 10 }, (_, index) => start + index)
    );
  }
});

test('part 2 has 48 items, 12 per pair, 6 even and 6 odd', () => {
  assert.equal(instrument.part2.length, 48);
  const pairs = {
    EI: [1, 12, 'E', 'I'],
    SN: [13, 24, 'S', 'N'],
    TF: [25, 36, 'T', 'F'],
    JP: [37, 48, 'J', 'P'],
  };
  for (const [pair, [start, end, first, second]] of Object.entries(pairs)) {
    const block = instrument.part2.filter((item) => item.itemNo >= start && item.itemNo <= end);
    assert.equal(block.length, 12);
    assert.ok(block.every((item) => item.pair === pair));
    assert.equal(block.filter((item) => item.itemNo % 2 === 0).length, 6);
    assert.equal(block.filter((item) => item.itemNo % 2 === 1).length, 6);
    for (const item of block) {
      const odd = item.itemNo % 2 === 1;
      assert.equal(item.leftKey, odd ? first : second, `leftKey ${item.itemNo}`);
      assert.equal(item.rightKey, odd ? second : first, `rightKey ${item.itemNo}`);
      assert.notEqual(item.leftKey, item.rightKey);
      assert.ok(item.left.trim().length > 0);
      assert.ok(item.right.trim().length > 0);
    }
  }
});

test('order indexes are continuous 1..108 and unique', () => {
  const all = [...instrument.part1, ...instrument.part2];
  assert.deepEqual(
    all.map((item) => item.orderIndex).sort((a, b) => a - b),
    Array.from({ length: 108 }, (_, index) => index + 1)
  );
});
