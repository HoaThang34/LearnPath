'use strict';

const {
  DISCLAIMER,
  GROUP_THEMES,
  PAIR_THEMES,
  SOURCES,
} = require('./content');

function pickThemes(score) {
  const groups = score.part1.groups;
  let codes = score.part1.ranking;
  if (!codes.length) {
    codes = [...groups]
      .filter((group) => group.status === 'complete')
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 3)
      .map((group) => group.code);
  }
  return codes
    .map((code) => {
      const theme = GROUP_THEMES[code];
      if (!theme) return null;
      const group = groups.find((entry) => entry.code === code);
      return {
        groupCode: code,
        title: theme.title,
        prompts: theme.prompts,
        sum: group ? group.sum : null,
      };
    })
    .filter(Boolean);
}

function pickPairThemes(score) {
  return score.part2.pairs
    .filter((pair) => pair.status === 'complete')
    .map((pair) => {
      const theme = PAIR_THEMES[pair.code];
      return {
        code: pair.code,
        title: theme ? theme.title : pair.title,
        prompts: theme ? theme.prompts : [],
        lean: pair.lean,
        d: pair.d,
      };
    });
}

function buildInterpretation(score) {
  const themes = pickThemes(score);
  const pairThemes = pickPairThemes(score);
  return {
    themes,
    pairThemes,
    disclaimer: DISCLAIMER,
    sources: SOURCES,
    guidance: [
      'Mã tham khảo chỉ để trao đổi, không phải chẩn đoán và không phải nhãn cố định.',
      'D là chênh lệch xu hướng trả lời, không phải điểm mạnh hay mức độ của một phẩm chất.',
      'Kết quả không thay thế tư vấn hướng nghiệp của giáo viên hoặc chuyên gia.',
    ],
  };
}

function formatGroupLine(group) {
  if (group.status === 'complete') return `${group.code}: ${group.sum}/${group.max}`;
  if (group.status === 'empty') return `${group.code}: chưa có dữ liệu`;
  return `${group.code}: ${group.sum}/${group.max} (còn thiếu ${group.expected - group.answered} câu)`;
}

function formatPairLine(pair) {
  if (pair.status !== 'complete') return `${pair.code}: chưa đủ dữ liệu`;
  if (pair.d === 0) return `${pair.code}: D = 0 (cân bằng)`;
  return `${pair.code}: D = ${pair.d > 0 ? '+' : ''}${pair.d} (nghiêng ${pair.lean})`;
}

function buildSummaryText(score, interpretation) {
  const lines = [];
  lines.push('KẾT QUẢ KHÁM PHÁ SỞ THÍCH NGHỀ NGHIỆP');
  lines.push(`Đã trả lời ${score.answeredCount} câu; còn ${score.unansweredCount} câu chưa trả lời.`);
  lines.push('');
  lines.push('Phần 1 — Sở thích nghề nghiệp (Holland/RIASEC)');
  for (const group of score.part1.groups) lines.push(`- ${formatGroupLine(group)}`);
  lines.push(
    score.part1.rankingAvailable
      ? `Nhóm sở thích nổi bật: ${score.part1.ranking.join(', ')} (mã tham khảo ${score.part1.code}).`
      : 'Chưa đủ dữ liệu để xếp hạng nhóm sở thích.'
  );
  lines.push('');
  lines.push('Phần 2 — Bốn cặp xu hướng');
  for (const pair of score.part2.pairs) lines.push(`- ${formatPairLine(pair)}`);
  lines.push(`Mã tham khảo Phần 2: ${score.part2.referenceCode}`);
  lines.push('');
  lines.push('Chủ đề phản tư');
  for (const theme of interpretation.themes) {
    lines.push(`- ${theme.title}`);
    for (const prompt of theme.prompts) lines.push(`  + ${prompt}`);
  }
  lines.push('');
  lines.push(interpretation.disclaimer);
  return lines.join('\n');
}

module.exports = {
  buildInterpretation,
  buildSummaryText,
};
