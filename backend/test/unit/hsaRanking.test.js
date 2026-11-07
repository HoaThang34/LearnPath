const test = require('node:test');
const assert = require('node:assert/strict');
const { getHsaExams, fetchHsaRanking, HSA_EXAMS } = require('../../src/hsa/hsaRanking');

test('getHsaExams returns list of HSA exams with valid structure', () => {
  const exams = getHsaExams();
  assert.ok(Array.isArray(exams));
  assert.ok(exams.length >= 5);
  for (const e of exams) {
    assert.ok(typeof e.id === 'number');
    assert.ok(typeof e.name === 'string' && e.name.length > 0);
    assert.ok(typeof e.year === 'number');
    assert.ok(typeof e.image === 'string' && e.image.startsWith('http'));
  }
  const defaultExam = exams.find(e => e.isDefault);
  assert.ok(defaultExam, 'must have a default exam');
  assert.equal(defaultExam.id, 25);
});

test('fetchHsaRanking validates missing and invalid score inputs', async () => {
  await assert.rejects(
    () => fetchHsaRanking(undefined),
    (err) => err.statusCode === 400 && err.message.includes('Vui lòng nhập điểm')
  );

  await assert.rejects(
    () => fetchHsaRanking(''),
    (err) => err.statusCode === 400 && err.message.includes('Vui lòng nhập điểm')
  );

  await assert.rejects(
    () => fetchHsaRanking('abc'),
    (err) => err.statusCode === 400 && err.message.includes('không hợp lệ')
  );

  await assert.rejects(
    () => fetchHsaRanking(-1),
    (err) => err.statusCode === 400 && err.message.includes('0 đến 150')
  );

  await assert.rejects(
    () => fetchHsaRanking(151),
    (err) => err.statusCode === 400 && err.message.includes('0 đến 150')
  );
});

test('fetchHsaRanking parses comma decimal and calculates rank metrics correctly', async () => {
  let requestedUrl = '';
  const mockFetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          from: 90,
          to: 95,
          same: 1000,
          larger: 5000,
          smaller: 44000,
          image: 'https://images.tuyensinh247.com/sample.png'
        },
        msg: ''
      })
    };
  };

  const result = await fetchHsaRanking('92,5', 25, { fetchImpl: mockFetch });
  assert.ok(requestedUrl.includes('your_score=92.5'));
  assert.ok(requestedUrl.includes('exam_id=25'));
  assert.equal(result.diem, 92.5);
  assert.equal(result.examId, 25);
  assert.equal(result.from, 90);
  assert.equal(result.to, 95);
  assert.equal(result.same, 1000);
  assert.equal(result.larger, 5000);
  assert.equal(result.smaller, 44000);
  assert.equal(result.tongThiSinh, 50000);
  assert.equal(result.thuHangTu, 5001);
  assert.equal(result.thuHangDen, 6000);
  // (5001 / 50000) * 100 = 10.002 -> 10.00%
  assert.equal(result.tyLePhanTram, 10);
  assert.equal(result.image, 'https://images.tuyensinh247.com/sample.png');
});

test('fetchHsaRanking handles upstream errors properly', async () => {
  const failingFetch = async () => {
    return {
      ok: false,
      status: 503,
      json: async () => ({})
    };
  };

  await assert.rejects(
    () => fetchHsaRanking(90, 25, { fetchImpl: failingFetch }),
    (err) => err.statusCode === 502 && err.message.includes('HTTP 503')
  );

  const errorPayloadFetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: false, msg: 'Đợt thi chưa mở' })
    };
  };

  await assert.rejects(
    () => fetchHsaRanking(90, 25, { fetchImpl: errorPayloadFetch }),
    (err) => err.statusCode === 502 && err.message.includes('Đợt thi chưa mở')
  );
});
