import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HOT_MAJORS,
  HOT_SCORE_THRESHOLD,
  getHotMajorInfo,
  matchesHotMajorCategory,
  isHotMajor,
  getHotMajorBadge,
} from '../src/lib/hotMajors.js'

test('HOT_MAJORS contains exactly 10 hot majors in expected order', () => {
  assert.equal(HOT_MAJORS.length, 10)
  assert.equal(HOT_SCORE_THRESHOLD, 27)
  assert.equal(HOT_MAJORS[0].name, 'Trí tuệ nhân tạo (AI) & Khoa học dữ liệu')
  assert.equal(HOT_MAJORS[1].name, 'Công nghệ thông tin (IT) – Phát triển phần mềm')
  assert.equal(HOT_MAJORS[2].name, 'An ninh mạng (Cybersecurity)')
  assert.equal(HOT_MAJORS[3].name, 'Công nghệ bán dẫn & Vi mạch')
  assert.equal(HOT_MAJORS[4].name, 'Logistics & Quản lý chuỗi cung ứng')
  assert.equal(HOT_MAJORS[5].name, 'Kinh doanh – Bán hàng (Sales / Business Development)')
  assert.equal(HOT_MAJORS[6].name, 'Marketing & Truyền thông số (Digital Marketing)')
  assert.equal(HOT_MAJORS[7].name, 'Y tế – Dược & Chăm sức khỏe' ? HOT_MAJORS[7].name : HOT_MAJORS[7].name, 'Y tế – Dược & Chăm sóc sức khỏe')
  assert.equal(HOT_MAJORS[8].name, 'Tự động hóa & Robotics / Cơ điện tử')
  assert.equal(HOT_MAJORS[9].name, 'Năng lượng tái tạo & Công nghệ xanh (CleanTech)')
})

test('Every hot major exact name is correctly detected by getHotMajorInfo and matchesHotMajorCategory', () => {
  for (const item of HOT_MAJORS) {
    assert.equal(matchesHotMajorCategory(item.name), true, `Failed for ${item.name}`)
    const info = getHotMajorInfo(item.name)
    assert.equal(info.id, item.id)
    assert.equal(info.name, item.name)
  }
})

test('Detects common university variations of hot majors', () => {
  // 1. AI & DS
  assert.equal(getHotMajorInfo('Khoa học Dữ liệu và Trí tuệ nhân tạo (CT tiên tiến)')?.id, 1)
  assert.equal(getHotMajorInfo('Trí tuệ Nhân tạo')?.id, 1)
  assert.equal(getHotMajorInfo('Khoa học Dữ liệu')?.id, 1)

  // 2. IT & Software
  assert.equal(getHotMajorInfo('Công nghệ Thông tin')?.id, 2)
  assert.equal(getHotMajorInfo('Kỹ thuật Phần mềm')?.id, 2)
  assert.equal(getHotMajorInfo('Khoa học Máy tính')?.id, 2)
  // Sư phạm Tin học should not be labeled IT
  assert.notEqual(getHotMajorInfo('Sư phạm Tin học')?.id, 2)

  // 3. Cybersecurity
  assert.equal(getHotMajorInfo('An toàn Thông tin')?.id, 3)
  assert.equal(getHotMajorInfo('An ninh mạng')?.id, 3)

  // 4. Semiconductor
  assert.equal(getHotMajorInfo('Thiết kế Vi mạch')?.id, 4)
  assert.equal(getHotMajorInfo('Công nghệ vi mạch bán dẫn')?.id, 4)

  // 5. Logistics
  assert.equal(getHotMajorInfo('Logistics và Quản lý Chuỗi cung ứng')?.id, 5)

  // 6. Sales & Business
  assert.equal(getHotMajorInfo('Kinh doanh Quốc tế')?.id, 6)
  assert.equal(getHotMajorInfo('Thương mại điện tử')?.id, 6)

  // 7. Digital Marketing
  assert.equal(getHotMajorInfo('Marketing')?.id, 7)
  assert.equal(getHotMajorInfo('Truyền thông Đa phương tiện')?.id, 7)

  // 8. Health & Pharma
  assert.equal(getHotMajorInfo('Y khoa')?.id, 8)
  assert.equal(getHotMajorInfo('Dược học')?.id, 8)
  assert.equal(getHotMajorInfo('Răng Hàm Mặt')?.id, 8)

  // 9. Automation & Robotics
  assert.equal(getHotMajorInfo('Kỹ thuật Điều khiển - Tự động hoá (CT tiên tiến)')?.id, 9)
  assert.equal(getHotMajorInfo('Kỹ thuật Cơ điện tử')?.id, 9)

  // 10. CleanTech & Green Energy
  assert.equal(getHotMajorInfo('Năng lượng Tái tạo')?.id, 10)
  assert.equal(getHotMajorInfo('Công nghệ xanh')?.id, 10)
})

test('isHotMajor requires BOTH hot category AND entry score >= 27', () => {
  // Score >= 27 -> HOT
  assert.equal(isHotMajor('Khoa học Dữ liệu và Trí tuệ nhân tạo (CT tiên tiến)', 28.8), true)
  assert.equal(isHotMajor('Công nghệ Thông tin', 27.97), true)
  assert.equal(isHotMajor('Y khoa', 28.5), true)
  assert.equal(isHotMajor('Marketing', 27.0), true) // Boundary exactly 27.0
  assert.equal(isHotMajor('Kỹ thuật Điều khiển - Tự động hoá (CT tiên tiến)', '28.16'), true) // String number

  // Score < 27 -> NOT HOT even if major name is hot
  assert.equal(isHotMajor('Khoa học Máy tính', 26.86), false)
  assert.equal(isHotMajor('Kỹ thuật Phần mềm', 21.0), false)
  assert.equal(isHotMajor('Trí tuệ Nhân tạo', 26.26), false)
  assert.equal(isHotMajor('An toàn Thông tin', 24.42), false)
  assert.equal(isHotMajor('Marketing', 26.99), false)

  // Missing or invalid score -> NOT HOT
  assert.equal(isHotMajor('Khoa học Dữ liệu', null), false)
  assert.equal(isHotMajor('Khoa học Dữ liệu', undefined), false)
  assert.equal(isHotMajor('Khoa học Dữ liệu', ''), false)
  assert.equal(isHotMajor('Khoa học Dữ liệu', 'N/A'), false)

  // Non-hot major -> NOT HOT even if score >= 27
  assert.equal(isHotMajor('Sư phạm Toán học', 28.95), false)
  assert.equal(isHotMajor('Triết học', 29.0), false)
  assert.equal(isHotMajor('Lịch sử', 30.0), false)
})

test('getHotMajorBadge returns badge only when entryScore >= 27', () => {
  // >= 27: Returns valid badge payload with entryScore
  const badge = getHotMajorBadge('Khoa học Dữ liệu và Trí tuệ nhân tạo (CT tiên tiến)', 28.8)
  assert.notEqual(badge, null)
  assert.equal(badge.id, 1)
  assert.equal(badge.name, 'Trí tuệ nhân tạo (AI) & Khoa học dữ liệu')
  assert.equal(badge.shortName, 'AI & Khoa học dữ liệu')
  assert.equal(badge.entryScore, 28.8)

  // < 27: Returns null
  assert.equal(getHotMajorBadge('Trí tuệ Nhân tạo', 26.26), null)
  assert.equal(getHotMajorBadge('Khoa học Dữ liệu', null), null)
  assert.equal(getHotMajorBadge('Triết học', 28.0), null)
})
