import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeEffectiveFits,
  compareMajorsByFit,
} from '../src/lib/fitCalculations.js'

test('computeEffectiveFits computes Phù hợp tổng thể when personality fit is available', () => {
  const fit = { rubricId: '1', fitPct: 100, allFitPct: 100 }
  const recommendation = { hocLucFit: 100, tinhCachFit: 79.2 }
  const config = { w_hoc_luc: 0.6, w_tinh_cach: 0.4 }

  const result = computeEffectiveFits({
    fit,
    recommendation,
    recommendationConfig: config,
    radarMode: 'all',
    hasActiveSim: false,
  })

  // 0.6 * 100 + 0.4 * 79.2 = 60 + 31.68 = 91.68 -> rounded to 91.7
  assert.equal(result.effectiveTongHopFit, 91.7)
  assert.equal(result.hasTongHop, true)
  assert.equal(result.displayFitPct, 91.7)
  assert.equal(result.displayFitLabel, 'Phù hợp tổng thể')
})

test('computeEffectiveFits falls back to academic fit when personality fit is absent', () => {
  const fit = { rubricId: '2', fitPct: 85.5, allFitPct: 90.0 }
  const recommendation = null

  const result = computeEffectiveFits({
    fit,
    recommendation,
    radarMode: 'all',
    hasActiveSim: false,
  })

  assert.equal(result.effectiveTongHopFit, null)
  assert.equal(result.hasTongHop, false)
  assert.equal(result.displayFitPct, 90.0)
  assert.equal(result.displayFitLabel, 'Phù hợp học lực (toàn diện)')
})

test('compareMajorsByFit sorts by Phù hợp tổng thể descending (user screenshot case)', () => {
  // Quan hệ Quốc tế: 88.7%, entry score 23.0
  const quanHeQuocTe = {
    rubricId: 'qhqt',
    majorName: 'Quan hệ Quốc tế',
    entryScore: 23.0,
    fitPct: 100,
    allFitPct: 100,
  }
  // Quản lý Nhà nước: 91.7%, entry score 22.95
  const quanLyNhaNuoc = {
    rubricId: 'qlnn',
    majorName: 'Quản lý Nhà nước',
    entryScore: 22.95,
    fitPct: 100,
    allFitPct: 100,
  }
  // Du lịch: 88.7%, entry score 22.5
  const duLich = {
    rubricId: 'dl',
    majorName: 'Du lịch',
    entryScore: 22.5,
    fitPct: 100,
    allFitPct: 100,
  }
  // Nghiên cứu Phát triển: 87.7%, entry score 22.5
  const ncpt = {
    rubricId: 'ncpt',
    majorName: 'Nghiên cứu Phát triển',
    entryScore: 22.5,
    fitPct: 100,
    allFitPct: 100,
  }
  // Điện tử Viễn thông: 85.3%, entry score 27.5
  const dtvt = {
    rubricId: 'dtvt',
    majorName: 'Điện tử Viễn thông',
    entryScore: 27.5,
    fitPct: 100,
    allFitPct: 100,
  }

  const recommendations = new Map([
    ['qhqt', { hocLucFit: 100, tinhCachFit: 71.8 }], // 88.7%
    ['qlnn', { hocLucFit: 100, tinhCachFit: 79.2 }], // 91.7%
    ['dl', { hocLucFit: 100, tinhCachFit: 71.8 }],   // 88.7%
    ['ncpt', { hocLucFit: 100, tinhCachFit: 69.2 }], // 87.7%
    ['dtvt', { hocLucFit: 100, tinhCachFit: 63.2 }], // 85.3%
  ])

  const context = {
    recommendations,
    recommendationConfig: { w_hoc_luc: 0.6, w_tinh_cach: 0.4 },
    radarMode: 'all',
    hasActiveSim: false,
  }

  const list = [quanHeQuocTe, dtvt, duLich, quanLyNhaNuoc, ncpt]
  list.sort((a, b) => compareMajorsByFit(a, b, context))

  // Order must be:
  // 1. Quản lý Nhà nước (91.7%)
  // 2. Quan hệ Quốc tế (88.7%, entryScore 23.0)
  // 3. Du lịch (88.7%, entryScore 22.5)
  // 4. Nghiên cứu Phát triển (87.7%, entryScore 22.5)
  // 5. Điện tử Viễn thông (85.3%, entryScore 27.5)
  assert.equal(list[0].majorName, 'Quản lý Nhà nước')
  assert.equal(list[1].majorName, 'Quan hệ Quốc tế')
  assert.equal(list[2].majorName, 'Du lịch')
  assert.equal(list[3].majorName, 'Nghiên cứu Phát triển')
  assert.equal(list[4].majorName, 'Điện tử Viễn thông')
})

test('compareMajorsByFit tie-breaks equal fit and score by name alphabetically', () => {
  const majorA = { rubricId: 'a', majorName: 'Bảo mật thông tin', entryScore: 25.0, fitPct: 80, allFitPct: 80 }
  const majorB = { rubricId: 'b', majorName: 'An toàn thông tin', entryScore: 25.0, fitPct: 80, allFitPct: 80 }

  const list = [majorA, majorB]
  list.sort((a, b) => compareMajorsByFit(a, b, {}))

  assert.equal(list[0].majorName, 'An toàn thông tin')
  assert.equal(list[1].majorName, 'Bảo mật thông tin')
})
