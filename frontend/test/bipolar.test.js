import test from 'node:test'
import assert from 'node:assert/strict'

import { axisPercent, describePair, formatD, D_MAX, D_MIN } from '../src/lib/bipolar.js'

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)
}

test('B1: +24 is the far left, −24 the far right, 0 the centre', () => {
  close(axisPercent(D_MAX), 0)
  close(axisPercent(D_MIN), 100)
  close(axisPercent(0), 50)
})

test('B2: the values from the result screenshot land on the correct side', () => {
  // E–I: D = −9 leans I, so the marker sits right of centre.
  close(axisPercent(-9), ((24 + 9) / 48) * 100)
  assert.ok(axisPercent(-9) > 50)

  // S–N and T–F: D = 0 stays at the centre.
  close(axisPercent(0), 50)

  // J–P: D = +2 leans J, so the marker sits left of centre.
  close(axisPercent(2), ((24 - 2) / 48) * 100)
  assert.ok(axisPercent(2) < 50)
})

test('B3: an incomplete pair has no position', () => {
  assert.equal(axisPercent(null), null)
  assert.equal(axisPercent(undefined), null)
  assert.equal(axisPercent(''), null)
})

test('B4: out-of-range values are clamped instead of escaping the track', () => {
  close(axisPercent(99), 0)
  close(axisPercent(-99), 100)
})

test('B5: formatD uses the true minus sign', () => {
  assert.equal(formatD(-9), '\u22129')
  assert.equal(formatD(0), '0')
  assert.equal(formatD(2.5), '2.5')
  assert.equal(formatD(null), null)
})

test('B6: describePair matches the wording on the result page', () => {
  assert.equal(describePair({ first: 'E', second: 'I', d: -9, lean: 'I' }).text, 'D = \u22129 · nghiêng I')
  assert.equal(describePair({ first: 'S', second: 'N', d: 0 }).text, 'D = 0 · cân bằng, giữ kết luận mở')
  assert.equal(describePair({ first: 'J', second: 'P', d: 2, lean: 'J' }).text, 'D = +2 · nghiêng J')
  assert.equal(describePair({ first: 'T', second: 'F', d: null }).text, 'Chưa đủ dữ liệu')
  assert.equal(describePair(null).text, 'Chưa đủ dữ liệu')
})

test('B7: a positive D never lands on the right half and vice versa', () => {
  for (let d = 1; d <= 24; d += 1) {
    assert.ok(axisPercent(d) < 50, `D=${d} should sit left of centre`)
  }
  for (let d = -1; d >= -24; d -= 1) {
    assert.ok(axisPercent(d) > 50, `D=${d} should sit right of centre`)
  }
})
