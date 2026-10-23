'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_ALLOWED_ORIGINS,
  getAllowedOrigins,
  isOriginAllowed,
  requireTrustedOrigin,
} = require('../../src/auth/origin');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function runMiddleware({ method = 'POST', origin, headers = {} } = {}) {
  const req = {
    method,
    get(name) {
      const key = String(name).toLowerCase();
      if (key === 'origin') return origin;
      return headers[key];
    },
  };
  const res = createResponse();
  let nextCalled = false;

  requireTrustedOrigin(req, res, () => {
    nextCalled = true;
  });

  return { res, nextCalled };
}

test('default allowlist contains the local Vite origins', () => {
  assert.deepEqual(DEFAULT_ALLOWED_ORIGINS, [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  assert.equal(isOriginAllowed('http://localhost:5173'), true);
  assert.equal(isOriginAllowed('https://evil.example'), false);
  assert.equal(isOriginAllowed(null), false);
});

test('allowed POST origin reaches the next middleware', () => {
  const { res, nextCalled } = runMiddleware({ origin: 'http://localhost:5173' });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('disallowed POST origin is rejected with 403', () => {
  const { res, nextCalled } = runMiddleware({ origin: 'https://evil.example' });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /Nguồn yêu cầu/);
});

test('POST without Origin is allowed for non-browser clients', () => {
  const { res, nextCalled } = runMiddleware({ origin: undefined });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('non-POST requests bypass the origin check', () => {
  const { res, nextCalled } = runMiddleware({
    method: 'GET',
    origin: 'https://evil.example',
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('APP_ORIGIN overrides and normalizes the allowlist', (t) => {
  const previous = process.env.APP_ORIGIN;
  t.after(() => {
    if (previous === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previous;
  });

  process.env.APP_ORIGIN =
    ' https://learnpath.example.com , https://www.learnpath.example.com , ';

  assert.deepEqual(getAllowedOrigins(), [
    'https://learnpath.example.com',
    'https://www.learnpath.example.com',
  ]);
  assert.equal(isOriginAllowed('https://learnpath.example.com'), true);
  assert.equal(isOriginAllowed('http://localhost:5173'), false);
});
