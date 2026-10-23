'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LOGIN_PAIR_LIMIT,
  LOGIN_IP_LIMIT,
  REGISTER_LIMIT,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  checkRegisterRateLimit,
  recordRegisterAttempt,
  getClientIp,
} = require('../../src/auth/rateLimit');

test('login pair limit blocks after the configured number of failures', () => {
  const ip = 'test-pair-ip';
  const username = 'test-pair-user';

  assert.equal(checkLoginRateLimit(ip, username).allowed, true);

  for (let attempt = 0; attempt < LOGIN_PAIR_LIMIT; attempt += 1) {
    recordLoginFailure(ip, username);
  }

  const blocked = checkLoginRateLimit(ip, username);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);
});

test('clearing pair failures does not reset the IP bucket', () => {
  const ip = 'test-clear-ip';
  const username = 'test-clear-user';

  for (let attempt = 0; attempt < LOGIN_PAIR_LIMIT; attempt += 1) {
    recordLoginFailure(ip, username);
  }
  clearLoginFailures(ip, username);

  assert.equal(checkLoginRateLimit(ip, username).allowed, true);
});

test('login IP limit blocks distributed usernames', () => {
  const ip = 'test-ip-limit';

  for (let attempt = 0; attempt < LOGIN_IP_LIMIT; attempt += 1) {
    recordLoginFailure(ip, `test-ip-user-${attempt}`);
  }

  const blocked = checkLoginRateLimit(ip, 'test-ip-user-new');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);
});

test('register limit blocks after the configured number of attempts', () => {
  const ip = 'test-register-ip';

  for (let attempt = 0; attempt < REGISTER_LIMIT; attempt += 1) {
    assert.equal(checkRegisterRateLimit(ip).allowed, true);
    recordRegisterAttempt(ip);
  }

  const blocked = checkRegisterRateLimit(ip);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);
});

test('getClientIp prefers req.ip and falls back safely', () => {
  assert.equal(getClientIp({ ip: '203.0.113.10' }), '203.0.113.10');
  assert.equal(
    getClientIp({ ip: undefined, socket: { remoteAddress: '::1' } }),
    '::1'
  );
  assert.equal(getClientIp({}), 'unknown');
});
