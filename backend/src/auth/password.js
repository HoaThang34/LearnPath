const { scrypt, randomBytes, timingSafeEqual } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_MAX_MEM = 64 * 1024 * 1024;
const MAX_SUPPORTED_N = 262144;
const MAX_SUPPORTED_R = 32;
const MAX_SUPPORTED_P = 16;
const MAX_SUPPORTED_MAX_MEM = 256 * 1024 * 1024;

const DUMMY_SALT = Buffer.alloc(SCRYPT_SALT_BYTES, 0x5a);

function deriveKey(password, salt, keyLength, options) {
  return scryptAsync(password, salt, keyLength, {
    N: options.N,
    r: options.r,
    p: options.p,
    maxmem: options.maxmem,
  });
}

async function hashPassword(password) {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const hash = await deriveKey(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEM,
  });

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    Buffer.from(hash).toString('base64url'),
  ].join('$');
}

function parsePasswordHash(stored) {
  if (typeof stored !== 'string') return null;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], 'base64url');
  const hash = Buffer.from(parts[5], 'base64url');

  if (!Number.isSafeInteger(N) || N < 16384 || N > MAX_SUPPORTED_N || (N & (N - 1)) !== 0) {
    return null;
  }
  if (!Number.isSafeInteger(r) || r < 1 || r > MAX_SUPPORTED_R) return null;
  if (!Number.isSafeInteger(p) || p < 1 || p > MAX_SUPPORTED_P) return null;
  if (salt.length < 8 || salt.length > 64) return null;
  if (hash.length < 32 || hash.length > 128) return null;

  const maxmem = Math.max(SCRYPT_MAX_MEM, 128 * N * r + 1024 * 1024);
  if (maxmem > MAX_SUPPORTED_MAX_MEM) return null;

  return { N, r, p, salt, hash, maxmem };
}

async function verifyPassword(password, stored) {
  if (typeof password !== 'string') return false;

  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;

  const derived = Buffer.from(
    await deriveKey(password, parsed.salt, parsed.hash.length, parsed)
  );

  if (derived.length !== parsed.hash.length) return false;
  return timingSafeEqual(derived, parsed.hash);
}

// Used when the username does not exist so that login timing does not reveal it.
async function verifyDummyPassword(password) {
  const input = typeof password === 'string' ? password : '';
  await deriveKey(input, DUMMY_SALT, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEM,
  });
  return false;
}

module.exports = {
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
};
