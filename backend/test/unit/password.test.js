'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
} = require('../../src/auth/password');

test('hashPassword returns a self-describing scrypt hash', async () => {
  const hash = await hashPassword('MatKhau123');
  const parts = hash.split('$');

  assert.equal(parts.length, 6);
  assert.equal(parts[0], 'scrypt');
  assert.equal(Number(parts[1]), 32768);
  assert.equal(Number(parts[2]), 8);
  assert.equal(Number(parts[3]), 1);
  assert.equal(Buffer.from(parts[4], 'base64url').length, 16);
  assert.equal(Buffer.from(parts[5], 'base64url').length, 64);
  assert.ok(!hash.includes('MatKhau123'));
});

test('the same password hashes differently because of the random salt', async () => {
  const first = await hashPassword('MatKhau123');
  const second = await hashPassword('MatKhau123');

  assert.notEqual(first, second);
  assert.equal(await verifyPassword('MatKhau123', first), true);
  assert.equal(await verifyPassword('MatKhau123', second), true);
});

test('verifyPassword accepts only the matching password', async () => {
  const hash = await hashPassword('MatKhau123');

  assert.equal(await verifyPassword('MatKhau123', hash), true);
  assert.equal(await verifyPassword('MatKhau124', hash), false);
  assert.equal(await verifyPassword('', hash), false);
});

test('verifyPassword rejects malformed or unsupported hashes', async () => {
  const malformed = [
    null,
    undefined,
    '',
    'plain-text',
    'scrypt$32768$8$1$only-five-parts',
    'scrypt$0$8$1$c2FsdA$aGFzaA',
    'scrypt$16384$0$1$c2FsdA$aGFzaA',
    'scrypt$32768$8$1$c2FsdA$aGFzaA$extra',
    'bcrypt$32768$8$1$c2FsdA$aGFzaA',
  ];

  for (const stored of malformed) {
    assert.equal(await verifyPassword('MatKhau123', stored), false);
  }
});

test('verifyPassword rejects a non-string password', async () => {
  const hash = await hashPassword('MatKhau123');
  assert.equal(await verifyPassword(null, hash), false);
  assert.equal(await verifyPassword(12345678, hash), false);
});

test('verifyDummyPassword always fails without throwing', async () => {
  assert.equal(await verifyDummyPassword('MatKhau123'), false);
  assert.equal(await verifyDummyPassword(null), false);
  assert.equal(await verifyDummyPassword(''), false);
});
