'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  validateUsername,
  validatePassword,
  validateRegistration,
  validateLogin,
} = require('../../src/auth/validation');

test('username accepts letters, digits, dot, underscore and hyphen', () => {
  const result = validateUsername('  Hoc_Sinh.2026-01  ');

  assert.equal(result.ok, true);
  assert.equal(result.username, 'Hoc_Sinh.2026-01');
  assert.equal(result.usernameLower, 'hoc_sinh.2026-01');
});

test('username enforces length and start/end characters', () => {
  assert.equal(validateUsername('ab').ok, false);
  assert.equal(validateUsername('a'.repeat(USERNAME_MAX_LENGTH + 1)).ok, false);
  assert.equal(validateUsername('_user').ok, false);
  assert.equal(validateUsername('user_').ok, false);
  assert.equal(validateUsername('user name').ok, false);
  assert.equal(validateUsername('user@example.com').ok, false);
  assert.equal(validateUsername(null).ok, false);
});

test('username accepts the documented boundary lengths', () => {
  assert.equal(validateUsername('a'.repeat(USERNAME_MIN_LENGTH)).ok, true);
  assert.equal(validateUsername('a'.repeat(USERNAME_MAX_LENGTH)).ok, true);
});

test('password enforces the current minimum and maximum length', () => {
  assert.equal(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH - 2) + '1').ok, false);
  assert.equal(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH - 2) + '1').error.includes('8'), true);
  assert.equal(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH - 1) + '1').ok, true);
  assert.equal(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH) + '1').ok, false);
  assert.equal(validatePassword(null).ok, false);
});

test('password currently requires at least one letter and one digit', () => {
  assert.equal(validatePassword('abcdefgh').ok, false);
  assert.equal(validatePassword('12345678').ok, false);
  assert.equal(validatePassword('mat khau 1').ok, true);
  assert.equal(validatePassword('MậtKhẩu1').ok, true);
  assert.equal(validatePassword('MậtKhẩu١').ok, true);
});

test('registration requires a matching password confirmation', () => {
  const valid = validateRegistration({
    username: 'hocsinh01',
    password: 'MatKhau123',
    passwordConfirm: 'MatKhau123',
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.usernameLower, 'hocsinh01');

  const mismatch = validateRegistration({
    username: 'hocsinh01',
    password: 'MatKhau123',
    passwordConfirm: 'MatKhau124',
  });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.error, /xác nhận/i);

  assert.equal(validateRegistration(null).ok, false);
});

test('login trims the username and compares it case-insensitively', () => {
  const result = validateLogin({
    username: '  HocSinh01  ',
    password: 'MatKhau123',
  });

  assert.equal(result.ok, true);
  assert.equal(result.usernameLower, 'hocsinh01');
  assert.equal(result.password, 'MatKhau123');
});

test('login rejects empty or oversized credentials', () => {
  assert.equal(validateLogin({ username: '', password: 'MatKhau123' }).ok, false);
  assert.equal(validateLogin({ username: 'hocsinh01', password: '' }).ok, false);
  assert.equal(
    validateLogin({ username: 'a'.repeat(USERNAME_MAX_LENGTH + 1), password: 'MatKhau123' }).ok,
    false
  );
  assert.equal(
    validateLogin({ username: 'hocsinh01', password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1) }).ok,
    false
  );
});
