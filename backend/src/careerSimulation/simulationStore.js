'use strict';

const path = require('path');
const fs = require('fs');
const { queryAll, queryOne, runSql, lastInsertId, runAuthMutation } = require('../auth/authDb');

function safeJsonParse(str, fallback = null) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function normalizeSimulationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    majorCode: row.major_code,
    majorName: row.major_name,
    industryCluster: row.industry_cluster,
    badgeTitle: row.badge_title || '',
    overview: safeJsonParse(row.overview_json, {}),
    dayInLife: safeJsonParse(row.day_in_life_json, []),
    gameRounds: safeJsonParse(row.game_rounds_json, []),
    realityCheck: safeJsonParse(row.reality_json, {}),
    riasecMapping: safeJsonParse(row.riasec_json, {}),
    admissionReference: safeJsonParse(row.admission_json, {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const UPCOMING_SIMULATIONS = [
  {
    id: 101,
    majorCode: 'IT-SE',
    majorName: 'Công nghệ thông tin (Kỹ thuật Phần mềm)',
    industryCluster: 'Công nghệ Thông tin',
    badgeTitle: 'Lập trình viên Siêu cấp',
    rolesCount: 4,
    description: 'Mô phỏng 1 ngày lập trình viên: Nhận task, viết code fix bug khẩn cấp, review code và bấm nút deploy phiên bản mới.',
    salaryStart: '12 - 18 triệu/tháng',
    status: 'coming_soon',
    estimatedMinutes: 5,
    tag: 'Sắp ra mắt',
  },
  {
    id: 102,
    majorCode: 'ME-ROBOT',
    majorName: 'Kỹ thuật Cơ điện tử & Robot',
    industryCluster: 'Kỹ thuật & Công nghệ',
    badgeTitle: 'Bậc thầy Lắp ráp Robot',
    rolesCount: 4,
    description: 'Mô phỏng kết hợp cơ khí chính xác, mạch điện vi điều khiển và nạp phần mềm điều khiển tay máy 6 bậc tự do.',
    salaryStart: '11 - 16 triệu/tháng',
    status: 'coming_soon',
    estimatedMinutes: 7,
    tag: 'Sắp ra mắt',
  },
  {
    id: 103,
    majorCode: 'LOG-01',
    majorName: 'Logistics & Quản lý Chuỗi cung ứng',
    industryCluster: 'Kinh tế & Quản lý',
    badgeTitle: 'Thuyền trưởng Điều phối Kho',
    rolesCount: 3,
    description: 'Mô phỏng điều phối hàng nghìn kiện hàng tự động qua trạm AGV, tối ưu hóa tuyến đường giao hàng thông minh.',
    salaryStart: '10 - 15 triệu/tháng',
    status: 'coming_soon',
    estimatedMinutes: 5,
    tag: 'Sắp ra mắt',
  },
  {
    id: 104,
    majorCode: 'BME-01',
    majorName: 'Kỹ thuật Y sinh & Thiết bị Y tế',
    industryCluster: 'Y Dược & Kỹ thuật',
    badgeTitle: 'Kỹ sư Thiết bị Cứu sinh',
    rolesCount: 3,
    description: 'Mô phỏng căn chỉnh các đầu dò cảm biến của máy thở, máy chụp cộng hưởng từ MRI và kiểm tra an toàn sinh học.',
    salaryStart: '11 - 16 triệu/tháng',
    status: 'coming_soon',
    estimatedMinutes: 6,
    tag: 'Sắp ra mắt',
  },
];

function listSimulations() {
  const rows = queryAll(
    `SELECT id, major_code, major_name, industry_cluster, badge_title, overview_json, status, created_at, updated_at
       FROM career_simulations
      WHERE status = 'published'
      ORDER BY id ASC`
  );

  const published = rows.map((r) => {
    const overview = safeJsonParse(r.overview_json, {});
    return {
      id: r.id,
      majorCode: r.major_code,
      majorName: r.major_name,
      industryCluster: r.industry_cluster,
      badgeTitle: r.badge_title,
      rolesCount: Array.isArray(overview.roles) ? overview.roles.length : 0,
      description: overview.description || '',
      salaryStart: overview.salaryLadder && overview.salaryLadder[0] ? overview.salaryLadder[0].range : '',
      status: 'published',
      isPlayable: true,
      estimatedMinutes: 5,
      tag: 'Chơi ngay (5-7 phút)',
    };
  });

  return [...published, ...UPCOMING_SIMULATIONS];
}

function getSimulationByCode(majorCode) {
  if (!majorCode) return null;
  const row = queryOne(
    `SELECT * FROM career_simulations
      WHERE LOWER(major_code) = LOWER(?) OR LOWER(major_name) = LOWER(?)
      LIMIT 1`,
    [majorCode.trim(), majorCode.trim()]
  );

  return normalizeSimulationRow(row);
}

function getSimulationById(id) {
  if (!id) return null;
  const row = queryOne(
    'SELECT * FROM career_simulations WHERE id = ? LIMIT 1',
    [Number(id)]
  );
  return normalizeSimulationRow(row);
}

async function saveUserSimulationLog({
  userId,
  simulationId,
  roundsCompleted = [],
  score = 0,
  downtimeSaved = 0,
  badges = [],
  radarStats = null,
  reflectionNotes = '',
}) {
  if (!userId || !simulationId) {
    throw new Error('Thiếu userId hoặc simulationId');
  }

  const now = Date.now();
  await runAuthMutation(() => {
    runSql(
      `INSERT INTO user_simulation_logs
         (user_id, simulation_id, rounds_completed_json, score, downtime_saved, badges_json, radar_stats_json, reflection_notes, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(userId),
        Number(simulationId),
        JSON.stringify(roundsCompleted),
        Number(score) || 0,
        Number(downtimeSaved) || 0,
        JSON.stringify(badges),
        radarStats ? JSON.stringify(radarStats) : null,
        String(reflectionNotes || ''),
        now,
      ]
    );
  });

  return { id: lastInsertId(), completedAt: now };
}

function getUserSimulationLog(userId, simulationId) {
  if (!userId || !simulationId) return null;
  const row = queryOne(
    `SELECT * FROM user_simulation_logs
      WHERE user_id = ? AND simulation_id = ?
      ORDER BY completed_at DESC
      LIMIT 1`,
    [Number(userId), Number(simulationId)]
  );

  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    simulationId: row.simulation_id,
    roundsCompleted: safeJsonParse(row.rounds_completed_json, []),
    score: row.score,
    downtimeSaved: row.downtime_saved,
    badges: safeJsonParse(row.badges_json, []),
    radarStats: safeJsonParse(row.radar_stats_json, null),
    reflectionNotes: row.reflection_notes,
    completedAt: row.completed_at,
  };
}

module.exports = {
  listSimulations,
  getSimulationByCode,
  getSimulationById,
  saveUserSimulationLog,
  getUserSimulationLog,
};
