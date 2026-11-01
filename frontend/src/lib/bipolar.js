// Shared geometry for the four bipolar (MBTI-style) pairs.
//
// Backend contract: D = Σ(even items) − Σ(odd items), range −24…+24.
//   D > 0  → leans to the FIRST letter (E, S, T, J)
//   D < 0  → leans to the SECOND letter (I, N, F, P)
//   D = 0  → balanced, keep the conclusion open
//
// Both charts draw the first letter on the LEFT, so the marker position is
//   x% = 100 · (24 − D) / 48      →  +24 → 0 % (left),  −24 → 100 % (right)
//
// Do NOT flip the backend formula to match a mirrored bar: the sign is part of
// the scoring contract (see backend/src/interest/scoring.js).
export const D_MIN = -24
export const D_MAX = 24
export const D_RANGE = 48

export function isMissingD(value) {
  return value === null || value === undefined || value === ''
}

/** Signed D → marker position in percent, or null when the pair is incomplete. */
export function axisPercent(d) {
  if (isMissingD(d)) return null
  const numeric = Number(d)
  if (!Number.isFinite(numeric)) return null
  const clamped = Math.min(Math.max(numeric, D_MIN), D_MAX)
  return ((D_MAX - clamped) / D_RANGE) * 100
}

/** Pretty formatter: integers as-is, decimals with one digit, U+2212 minus. */
export function formatD(d) {
  if (isMissingD(d)) return null
  const numeric = Number(d)
  if (!Number.isFinite(numeric)) return null
  const text = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1)
  return text.replace('-', '\u2212')
}

/** Vietnamese one-line reading of a pair, mirroring the result page copy. */
export function describePair(pair) {
  if (!pair) return { text: 'Chưa đủ dữ liệu', tone: 'balanced' }
  if (isMissingD(pair.d)) return { text: 'Chưa đủ dữ liệu', tone: 'balanced' }
  const d = Number(pair.d)
  if (d === 0) return { text: 'D = 0 · cân bằng, giữ kết luận mở', tone: 'balanced' }
  const letter = pair.lean || (d > 0 ? pair.first : pair.second)
  return {
    text: `D = ${d > 0 ? '+' : ''}${formatD(d)} · nghiêng ${letter}`,
    tone: d > 0 ? 'first' : 'second',
  }
}
