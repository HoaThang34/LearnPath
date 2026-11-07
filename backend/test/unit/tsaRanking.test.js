const test = require('node:test');
const assert = require('node:assert/strict');
const { getTsaExams, fetchTsaRanking, TSA_EXAMS } = require('../../src/tsa/tsaRanking');

test('getTsaExams returns list of TSA exams with valid structure', () => {
  const exams = getTsaExams();
  assert.ok(Array.isArray(exams));
  assert.ok(exams.length >= 8);
  for (const e of exams) {
    assert.ok(typeof e.id === 'number');
    assert.ok(typeof e.name === 'string' && e.name.length > 0);
    assert.ok(typeof e.year === 'number');
    assert.ok(typeof e.image === 'string' && e.image.startsWith('http'));
  }
  const defaultExam = exams.find(e => e.isDefault);
  assert.ok(defaultExam, 'must have a default exam');
  assert.equal(defaultExam.id, 24);
});

test('fetchTsaRanking validates missing and invalid score inputs (scale 0-100)', async () => {
  await assert.rejects(
    () => fetchTsaRanking(undefined),
    (err) => err.statusCode === 400 && err.message.includes('Vui lòng nhập điểm')
  );

  await assert.rejects(
    () => fetchTsaRanking(''),
    (err) => err.statusCode === 400 && err.message.includes('Vui lòng nhập điểm')
  );

  await assert.rejects(
    () => fetchTsaRanking('abc'),
    (err) => err.statusCode === 400 && err.message.includes('không hợp lệ')
  );

  await assert.rejects(
    () => fetchTsaRanking(-1),
    (err) => err.statusCode === 400 && err.message.includes('0 đến 100')
  );

  await assert.rejects(
    () => fetchTsaRanking(101),
    (err) => err.statusCode === 400 && err.message.includes('0 đến 100')
  );
});

test('fetchTsaRanking parses comma decimal and calculates rank metrics correctly', async () => {
  let requestedUrl = '';
  const mockFetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          from: 65,
          to: 70,
          same: 1200,
          larger: 3000,
          smaller: 25800,
          image: 'https://images.tuyensinh247.com/sample_tsa.png'
        },
        msg: ''
      })
    };
  };

  const result = await fetchTsaRanking('68,5', 24, { fetchImpl: mockFetch });
  assert.ok(requestedUrl.includes('your_score=68.5'));
  assert.ok(requestedUrl.includes('exam_id=24'));
  assert.equal(result.diem, 68.5);
  assert.equal(result.examId, 24);
  assert.equal(result.from, 65);
  assert.equal(result.to, 70);
  assert.equal(result.same, 1200);
  assert.equal(result.larger, 3000);
  assert.equal(result.smaller, 25800);
  assert.equal(result.tongThiSinh, 30000);
  assert.equal(result.thuHangTu, 3001);
  assert.equal(result.thuHangDen, 4200);
  // (3001 / 30000) * 100 = 10.003% -> 10%
  assert.equal(result.tyLePhanTram, 10);
  assert.ok(Array.isArray(result.phanBoDiem));
});

test('fetchTsaRanking handles upstream errors properly', async () => {
  const failingFetch = async () => {
    return {
      ok: false,
      status: 503,
      json: async () => ({})
    };
  };

  await assert.rejects(
    () => fetchTsaRanking(65, 24, { fetchImpl: failingFetch }),
    (err) => err.statusCode === 502 && err.message.includes('HTTP 503')
  );
});
