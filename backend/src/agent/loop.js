'use strict';

const { getAgentConfig } = require('./config');
const { ollamaChat } = require('./ollama');
const { getToolDefinitions, executeTool } = require('./tools');
const { buildSystemPrompt } = require('./prompt');

const TOOL_STATUS_LABELS = {
  get_user_overview: 'Đang đọc hồ sơ của bạn…',
  get_academic_scores: 'Đang đọc điểm học bạ…',
  get_interest_result: 'Đang đọc kết quả sở thích nghề nghiệp…',
  get_career_recommendations: 'Đang chạy Phân tích năng lực…',
  get_benchmark: 'Đang so sánh với phân bố điểm thi…',
  search_diem_chuan: 'Đang tra cứu điểm chuẩn…',
  get_khoi_thi: 'Đang tra cứu khối thi…',
  get_de_an_excerpt: 'Đang đọc đề án tuyển sinh…',
  rank_thpt_score: 'Đang tính thứ hạng…',
  get_career_selections: 'Đang đọc nguyện vọng đã lưu…',
};

const MAX_TOOL_RESULT_CHARS = 12000;

function serializeToolResult(data) {
  let text = JSON.stringify(data);
  if (text.length > MAX_TOOL_RESULT_CHARS) {
    text = `${text.slice(0, MAX_TOOL_RESULT_CHARS)}…(đã cắt bớt)`;
  }
  return text;
}

/**
 * Run one agent turn: model ↔ tools until the model answers or the step limit
 * is reached. `onEvent` receives `{ type: 'status' | 'artifact', ... }`.
 *
 * @returns {Promise<{ content: string, artifacts: object[], trace: object[], tokens: number }>}
 */
async function runAgentTurn({ userId, history = [], message, onEvent = () => {}, signal, chat = ollamaChat, config }) {
  const cfg = config || getAgentConfig();
  const toolDefs = getToolDefinitions();
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history.map((item) => ({ role: item.role, content: item.content })),
    { role: 'user', content: message },
  ];
  const artifacts = [];
  const trace = [];
  let tokens = 0;

  for (let step = 0; step <= cfg.maxToolSteps; step += 1) {
    const lastStep = step === cfg.maxToolSteps;
    if (lastStep) {
      messages.push({
        role: 'system',
        content: 'Đã đạt giới hạn số lần gọi công cụ. Hãy trả lời ngay dựa trên dữ liệu đã có, nêu rõ phần còn thiếu.',
      });
    }
    onEvent({ type: 'status', text: step === 0 ? 'Đang suy nghĩ…' : 'Đang tổng hợp kết quả…' });
    const response = await chat({ messages, tools: lastStep ? [] : toolDefs, signal, config: cfg });
    tokens += response.tokens || 0;
    const reply = response.message;
    const calls = lastStep ? [] : reply.tool_calls || [];

    if (!calls.length) {
      const content = (reply.content || '').trim();
      return {
        content: content || 'Xin lỗi, mình chưa tạo được câu trả lời. Bạn thử hỏi lại theo cách khác nhé.',
        artifacts,
        trace,
        tokens,
      };
    }

    messages.push({ role: 'assistant', content: reply.content || '', tool_calls: calls });
    for (const call of calls) {
      const name = call?.function?.name || '';
      onEvent({ type: 'status', text: TOOL_STATUS_LABELS[name] || 'Đang truy xuất dữ liệu…', tool: name });
      const result = await executeTool(name, call?.function?.arguments, { userId });
      trace.push({ tool: name, args: result.args ?? null, ok: result.ok });
      for (const artifact of result.artifacts) {
        artifacts.push(artifact);
        onEvent({ type: 'artifact', artifact });
      }
      messages.push({
        role: 'tool',
        content: serializeToolResult(result.data),
        tool_name: name,
        ...(call.id ? { tool_call_id: call.id } : {}),
      });
    }
  }

  // Unreachable: the last step disables tools so the model must answer.
  throw new Error('Agent loop exited without an answer.');
}

module.exports = { runAgentTurn, TOOL_STATUS_LABELS };
