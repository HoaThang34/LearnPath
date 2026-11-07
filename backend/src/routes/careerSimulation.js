'use strict';

const express = require('express');
const router = express.Router();
const {
  listSimulations,
  getSimulationByCode,
  saveUserSimulationLog,
  getUserSimulationLog,
} = require('../careerSimulation/simulationStore');
const { requireAuth } = require('../auth/session');

// GET /api/mo-phong-nghe-nghiep - Danh sách các ngành có mô phỏng
router.get('/', (req, res) => {
  try {
    const list = listSimulations();
    res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    console.error('[careerSimulation] Error listing simulations:', error.message);
    res.status(500).json({ error: 'Không thể tải danh sách mô phỏng ngành nghề.' });
  }
});

// GET /api/mo-phong-nghe-nghiep/:majorCode - Lấy chi tiết kịch bản mô phỏng
router.get('/:majorCode', (req, res) => {
  try {
    const { majorCode } = req.params;
    const sim = getSimulationByCode(majorCode);
    if (!sim) {
      return res.status(404).json({ error: 'Không tìm thấy mô phỏng cho ngành này.' });
    }

    let userProgress = null;
    if (req.user && req.user.id) {
      userProgress = getUserSimulationLog(req.user.id, sim.id);
    }

    res.json({
      success: true,
      data: sim,
      userProgress,
    });
  } catch (error) {
    console.error('[careerSimulation] Error getting detail:', error.message);
    res.status(500).json({ error: 'Không thể tải chi tiết mô phỏng.' });
  }
});

// POST /api/mo-phong-nghe-nghiep/:majorCode/submit-round - Kiểm tra kết quả 1 vòng chơi
router.post('/:majorCode/submit-round', (req, res) => {
  try {
    const { majorCode } = req.params;
    const { roundId, submission } = req.body || {};

    const sim = getSimulationByCode(majorCode);
    if (!sim) {
      return res.status(404).json({ error: 'Không tìm thấy kịch bản ngành này.' });
    }

    const round = sim.gameRounds.find((r) => r.roundId === Number(roundId));
    if (!round) {
      return res.status(404).json({ error: 'Không tìm thấy vòng chơi tương ứng.' });
    }

    let isSuccess = false;
    let feedback = '';
    let expEarned = 0;
    let badge = null;

    if (round.type === 'troubleshooting') {
      const selectedOptionId = submission?.selectedOptionId;
      const sensorStep = round.interactiveSteps.find((s) => s.stepId === 'sensor_action');
      const option = sensorStep?.options?.find((o) => o.id === selectedOptionId);

      if (option && option.isCorrect) {
        isSuccess = true;
        feedback = option.feedback;
        expEarned = round.expReward;
        badge = round.badgeAwarded;
      } else {
        isSuccess = false;
        feedback = option ? option.feedback : 'Lựa chọn chưa chính xác!';
      }
    } else if (round.type === 'logic_sequencer') {
      const sequence = submission?.sequence || [];
      const correct = round.correctSequence || [];
      const isMatch =
        sequence.length === correct.length &&
        sequence.every((val, idx) => val === correct[idx]);

      if (isMatch) {
        isSuccess = true;
        feedback = 'Tuyệt vời! Chuỗi logic tuần tự hoàn toàn chính xác. Dây chuyền phân loại 100% không làm rơi vỡ!';
        expEarned = round.expReward;
        badge = round.badgeAwarded;
      } else {
        isSuccess = false;
        feedback = 'Thứ tự logic chưa chuẩn xác, sản phẩm có thể bị kẹt hoặc gạt hụt. Hãy rà soát lại thứ tự điều kiện & hành động!';
      }
    } else if (round.type === 'pid_tuning') {
      const { kp, ki, kd } = submission || {};
      const targetKp = round.optimalPID?.kp || 60;
      const targetKi = round.optimalPID?.ki || 30;
      const targetKd = round.optimalPID?.kd || 45;

      const diff =
        Math.abs(Number(kp) - targetKp) +
        Math.abs(Number(ki) - targetKi) +
        Math.abs(Number(kd) - targetKd);

      // Cho phép sai số dung sai tổng cộng 35 điểm
      if (diff <= 35) {
        isSuccess = true;
        feedback = 'Rất ấn tượng! Thuật toán PID đã dập tắt dao động và ổn định nhiệt độ lò ở 200°C chuẩn xác!';
        expEarned = round.expReward;
        badge = round.badgeAwarded;
      } else {
        isSuccess = false;
        feedback = 'Nhiệt độ vẫn còn dao động hoặc vọt lố quá mức cho phép. Hãy tăng D để hãm vọt lố hoặc chỉnh lại I!';
      }
    }

    res.json({
      success: true,
      isSuccess,
      feedback,
      expEarned: isSuccess ? expEarned : 0,
      badge: isSuccess ? badge : null,
      linkedCourse: round.linkedCourse,
    });
  } catch (error) {
    console.error('[careerSimulation] Error evaluating round:', error.message);
    res.status(500).json({ error: 'Lỗi kiểm tra vòng chơi mô phỏng.' });
  }
});

// POST /api/mo-phong-nghe-nghiep/:majorCode/save-log - Lưu tiến trình hoàn thành game của người dùng
router.post('/:majorCode/save-log', requireAuth, async (req, res) => {
  try {
    const { majorCode } = req.params;
    const { roundsCompleted, score, downtimeSaved, badges, radarStats, reflectionNotes } = req.body || {};

    const sim = getSimulationByCode(majorCode);
    if (!sim) {
      return res.status(404).json({ error: 'Không tìm thấy ngành.' });
    }

    const saved = await saveUserSimulationLog({
      userId: req.user.id,
      simulationId: sim.id,
      roundsCompleted,
      score,
      downtimeSaved,
      badges,
      radarStats,
      reflectionNotes,
    });

    res.json({
      success: true,
      data: saved,
      message: 'Lưu tiến trình mô phỏng thành công!',
    });
  } catch (error) {
    console.error('[careerSimulation] Error saving log:', error.message);
    res.status(500).json({ error: 'Không thể lưu kết quả mô phỏng.' });
  }
});

module.exports = router;
