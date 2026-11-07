'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-sim-integration-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const authRoutes = require('../../src/routes/auth');
const careerSimulationRoutes = require('../../src/routes/careerSimulation');
const { getAuthDb } = require('../../src/auth/authDb');
const { requireAuth } = require('../../src/auth/session');

const DB_PATH = process.env.LEARNPATH_AUTH_DB_PATH;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use('/api/auth', authRoutes);
app.use('/api/mo-phong-nghe-nghiep', careerSimulationRoutes);

let server;
let baseUrl;

function readCookie(response, name) {
  const headers =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
  for (const header of headers) {
    const pair = header.split(';')[0];
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    return pair.slice(separator + 1).trim();
  }
  return null;
}

async function request(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body;
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.json);
  }
  return fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body,
  });
}

test('career simulation API: list, detail, submit rounds and save log', async (t) => {
  await getAuthDb();

  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(DB_PATH, { force: true });
  });

  // 1. List simulations
  const listRes = await request('/api/mo-phong-nghe-nghiep');
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.equal(listBody.success, true);
  assert.ok(Array.isArray(listBody.data));
  assert.ok(listBody.data.length >= 1);
  const autoSim = listBody.data.find((s) => s.majorCode === 'EE-E1');
  assert.ok(autoSim, 'Expected seeded automation simulation EE-E1');
  assert.equal(autoSim.majorName, 'Kỹ thuật Điều khiển và Tự động hóa');

  // 2. Get detail
  const detailRes = await request('/api/mo-phong-nghe-nghiep/EE-E1');
  assert.equal(detailRes.status, 200);
  const detailBody = await detailRes.json();
  assert.equal(detailBody.success, true);
  assert.equal(detailBody.data.majorCode, 'EE-E1');
  assert.ok(Array.isArray(detailBody.data.dayInLife));
  assert.ok(Array.isArray(detailBody.data.gameRounds));
  assert.equal(detailBody.data.gameRounds.length, 3);

  // 3. Submit round 1 (Troubleshooting) - Incorrect then Correct
  const round1Wrong = await request('/api/mo-phong-nghe-nghiep/EE-E1/submit-round', {
    method: 'POST',
    json: {
      roundId: 1,
      submission: { selectedOptionId: 'opt1' },
    },
  });
  assert.equal(round1Wrong.status, 200);
  const r1WrongBody = await round1Wrong.json();
  assert.equal(r1WrongBody.isSuccess, false);

  const round1Right = await request('/api/mo-phong-nghe-nghiep/EE-E1/submit-round', {
    method: 'POST',
    json: {
      roundId: 1,
      submission: { selectedOptionId: 'opt3' },
    },
  });
  assert.equal(round1Right.status, 200);
  const r1RightBody = await round1Right.json();
  assert.equal(r1RightBody.isSuccess, true);
  assert.ok(r1RightBody.expEarned > 0);
  assert.equal(r1RightBody.badge?.id, 'badge_troubleshooter');
  assert.equal(r1RightBody.linkedCourse?.code, 'EE3110');

  // 4. Submit round 2 (Logic Sequencer)
  const round2Right = await request('/api/mo-phong-nghe-nghiep/EE-E1/submit-round', {
    method: 'POST',
    json: {
      roundId: 2,
      submission: { sequence: ['B1', 'B2', 'B3', 'B4', 'B5'] },
    },
  });
  assert.equal(round2Right.status, 200);
  const r2RightBody = await round2Right.json();
  assert.equal(r2RightBody.isSuccess, true);
  assert.equal(r2RightBody.badge?.id, 'badge_logic_master');

  // 5. Submit round 3 (PID Tuning)
  const round3Right = await request('/api/mo-phong-nghe-nghiep/EE-E1/submit-round', {
    method: 'POST',
    json: {
      roundId: 3,
      submission: { kp: 60, ki: 30, kd: 45 },
    },
  });
  assert.equal(round3Right.status, 200);
  const r3RightBody = await round3Right.json();
  assert.equal(r3RightBody.isSuccess, true);
  assert.equal(r3RightBody.badge?.id, 'badge_pid_guru');
});
