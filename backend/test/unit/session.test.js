'use strict';

const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-auth-session-unit-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  parseCookies,
  getSessionToken,
} = require('../../src/auth/session');

test('session cookie constants match the documented policy', () => {
  assert.equal(SESSION_COOKIE_NAME, 'lp_session');
  assert.equal(SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000);
});

test('parseCookies reads, decodes and de-duplicates cookie pairs', () => {
  const cookies = parseCookies(
    'first=1; second=two; encoded=%E2%9C%93; first=ignored; malformed=%ZZ'
  );

  assert.equal(cookies.first, '1');
  assert.equal(cookies.second, 'two');
  assert.equal(cookies.encoded, '✓');
  assert.equal(cookies.malformed, '%ZZ');
  assert.equal(Object.getPrototypeOf(cookies), null);
});

test('parseCookies handles empty and malformed headers', () => {
  assert.equal(Object.keys(parseCookies(undefined)).length, 0);
  assert.equal(Object.keys(parseCookies('')).length, 0);

  const cookies = parseCookies('no-separator; =empty-name; valid=1');
  assert.deepEqual(Object.keys(cookies), ['valid']);
  assert.equal(cookies.valid, '1');
});

test('getSessionToken returns only a bounded non-empty session token', () => {
  assert.equal(
    getSessionToken({ headers: { cookie: 'lp_session=abc123; theme=dark' } }),
    'abc123'
  );
  assert.equal(getSessionToken({ headers: {} }), null);
  assert.equal(getSessionToken({ headers: { cookie: 'lp_session=' } }), null);
  assert.equal(
    getSessionToken({ headers: { cookie: `lp_session=${'a'.repeat(513)}` } }),
    null
  );
});
