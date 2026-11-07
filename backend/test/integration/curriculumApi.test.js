'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-curriculum-integration-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const adminRoutes = require('../../src/routes/admin');
const curriculumRoutes = require('../../src/routes/curriculum');
const { createAdmin } = require('../../src/auth/adminAuth');
const { getAuthDb, queryOne, queryAll } = require('../../src/auth/authDb');

const DB_PATH = process.env.LEARNPATH_AUTH_DB_PATH;

const app = express();
app.disable('x-powered-by');
app.use('/api/admin', adminRoutes);
app.use(express.json({ limit: '50kb' }));
app.use('/api/chuong-trinh-hoc', curriculumRoutes);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  return res.status(status).json({ error: err.message || 'Đã xảy ra lỗi máy chủ.' });
});

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

test('curriculum API: user and admin workflows', async (t) => {
  await getAuthDb();

  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(() => {
    server.close();
    fs.rmSync(DB_PATH, { force: true });
  });

  // 1. Initial user state: completely empty
  const emptyRes = await request('/api/chuong-trinh-hoc');
  assert.equal(emptyRes.status, 200);
  const emptyData = await emptyRes.json();
  assert.equal(emptyData.total, 0);
  assert.deepEqual(emptyData.data, []);

  const schoolsRes = await request('/api/chuong-trinh-hoc/schools');
  assert.equal(schoolsRes.status, 200);
  const schoolsData = await schoolsRes.json();
  assert.deepEqual(schoolsData.data, []);

  // 2. Setup Admin login
  await createAdmin({
    username: 'curriculumadmin',
    password: 'AdminPassword123',
    createdBy: 'test-seed',
  });

  const loginRes = await request('/api/admin/auth/login', {
    method: 'POST',
    headers: { origin: 'http://localhost:5173' },
    json: { username: 'curriculumadmin', password: 'AdminPassword123' },
  });
  assert.equal(loginRes.status, 200);
  const adminCookie = readCookie(loginRes, 'lp_admin_session');
  assert.ok(adminCookie);
  const loginBody = await loginRes.json();
  const csrfToken = loginBody.data.csrfToken;
  assert.ok(csrfToken);

  const adminHeaders = {
    origin: 'http://localhost:5173',
    cookie: `lp_admin_session=${adminCookie}`,
    'x-admin-csrf': csrfToken,
  };

  // 3. Admin: options endpoint
  const optionsRes = await request('/api/admin/curriculum/options', {
    headers: adminHeaders,
  });
  assert.equal(optionsRes.status, 200);
  const optionsData = await optionsRes.json();
  assert.ok(Array.isArray(optionsData.data.schools));
  assert.ok(Array.isArray(optionsData.data.majors));

  // 4. Admin creates a curriculum: reject invalid input
  const invalidRes = await request('/api/admin/curriculum', {
    method: 'POST',
    headers: adminHeaders,
    json: { schoolName: '', majorName: 'Khoa học máy tính' },
  });
  assert.equal(invalidRes.status, 400);

  // 5. Admin creates curriculum: trường -> ngành -> chương trình học
  const createPayload = {
    schoolCode: 'BKA',
    schoolName: 'Đại học Bách khoa Hà Nội',
    majorCode: 'IT1',
    majorName: 'Khoa học máy tính',
    degreeLevel: 'Kỹ sư',
    durationYears: 5,
    totalCredits: 160,
    description: 'Chương trình đào tạo Kỹ sư Khoa học máy tính chất lượng cao.',
    content: '## Mục tiêu đào tạo\nĐào tạo kỹ sư chuyên sâu về thuật toán và AI.',
    semesters: [
      {
        semester: 'Học kỳ 1',
        courses: [
          { code: 'MI1111', name: 'Giải tích 1', credits: 4, type: 'Bắt buộc' },
          { code: 'IT1110', name: 'Tin học đại cương', credits: 4, type: 'Bắt buộc' },
        ],
      },
    ],
  };

  const createRes = await request('/api/admin/curriculum', {
    method: 'POST',
    headers: adminHeaders,
    json: createPayload,
  });
  assert.equal(createRes.status, 201);
  const createdBody = await createRes.json();
  assert.ok(createdBody.data.id > 0);
  assert.equal(createdBody.data.schoolName, 'Đại học Bách khoa Hà Nội');
  assert.equal(createdBody.data.majorName, 'Khoa học máy tính');
  assert.equal(createdBody.data.semesters.length, 1);
  assert.equal(createdBody.data.semesters[0].courses.length, 2);

  const curriculumId = createdBody.data.id;

  // 6. Duplicate rejection
  const dupRes = await request('/api/admin/curriculum', {
    method: 'POST',
    headers: adminHeaders,
    json: createPayload,
  });
  assert.equal(dupRes.status, 409);

  // 7. User API now sees the new curriculum
  const userListRes = await request('/api/chuong-trinh-hoc');
  assert.equal(userListRes.status, 200);
  const userListData = await userListRes.json();
  assert.equal(userListData.total, 1);
  assert.equal(userListData.data[0].schoolName, 'Đại học Bách khoa Hà Nội');

  const userSchoolsRes = await request('/api/chuong-trinh-hoc/schools');
  const userSchoolsData = await userSchoolsRes.json();
  assert.equal(userSchoolsData.data.length, 1);
  assert.equal(userSchoolsData.data[0].schoolName, 'Đại học Bách khoa Hà Nội');
  assert.equal(userSchoolsData.data[0].majorCount, 1);

  const userMajorsRes = await request('/api/chuong-trinh-hoc/majors?school=Đại học Bách khoa Hà Nội');
  const userMajorsData = await userMajorsRes.json();
  assert.equal(userMajorsData.data.length, 1);
  assert.equal(userMajorsData.data[0].majorName, 'Khoa học máy tính');

  const detailRes = await request(
    '/api/chuong-trinh-hoc/detail?school=Đại học Bách khoa Hà Nội&major=Khoa học máy tính'
  );
  assert.equal(detailRes.status, 200);
  const detailData = await detailRes.json();
  assert.equal(detailData.data.degreeLevel, 'Kỹ sư');
  assert.equal(detailData.data.durationYears, 5);
  assert.equal(detailData.data.totalCredits, 160);

  // 8. Admin updates curriculum
  const updateRes = await request(`/api/admin/curriculum/${curriculumId}`, {
    method: 'PUT',
    headers: adminHeaders,
    json: {
      ...createPayload,
      durationYears: 4.5,
      totalCredits: 155,
      description: 'Mô tả đã cập nhật.',
    },
  });
  assert.equal(updateRes.status, 200);
  const updatedData = await updateRes.json();
  assert.equal(updatedData.data.durationYears, 4.5);
  assert.equal(updatedData.data.description, 'Mô tả đã cập nhật.');

  // 9. Admin deletes curriculum
  const deleteRes = await request(`/api/admin/curriculum/${curriculumId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.equal(deleteRes.status, 204);

  // Verify it's gone
  const afterDeleteRes = await request(`/api/chuong-trinh-hoc/${curriculumId}`);
  assert.equal(afterDeleteRes.status, 404);

  // 10. Audit check
  const auditRes = await request('/api/admin/audit', {
    headers: adminHeaders,
  });
  assert.equal(auditRes.status, 200);
  const auditData = await auditRes.json();
  const curriculumActions = auditData.data.filter((a) => a.entity === 'curriculum');
  assert.ok(curriculumActions.length >= 3);
  const actions = curriculumActions.map((a) => a.action);
  assert.ok(actions.includes('admin.curriculum.create'));
  assert.ok(actions.includes('admin.curriculum.update'));
  assert.ok(actions.includes('admin.curriculum.delete'));
});
