'use strict';

const { getAgentConfig } = require('./config');

class AgentUpstreamError extends Error {
  constructor(message, { status = null, cause } = {}) {
    super(message);
    this.name = 'AgentUpstreamError';
    this.status = status;
    if (cause) this.cause = cause;
  }
}

function normalizeToolCall(call) {
  if (!call || typeof call !== 'object') return null;
  const fn = call.function;
  if (!fn || typeof fn.name !== 'string' || !fn.name) return null;
  const args = fn.arguments;
  return {
    id: typeof call.id === 'string' && call.id ? call.id : `call_${fn.name}_${Date.now()}`,
    type: 'function',
    function: {
      name: fn.name,
      arguments: typeof args === 'string' ? args : JSON.stringify(args || {}),
    },
  };
}

function tokensFromUsage(usage) {
  if (!usage || typeof usage !== 'object') return 0;
  const total = Number(usage.total_tokens);
  if (Number.isFinite(total) && total > 0) return Math.trunc(total);
  const prompt = Number(usage.prompt_tokens || 0);
  const completion = Number(usage.completion_tokens || 0);
  return Number.isFinite(prompt + completion) ? Math.trunc(prompt + completion) : 0;
}

/**
 * One non-streaming call to the configured OpenAI-compatible chat API.
 * The legacy module/function names are kept for existing imports; the wire
 * format is POST {baseUrl}/chat/completions, not Ollama's /api/chat.
 * `fetchImpl` can be injected by tests; production uses global fetch (Node >= 18).
 */
async function ollamaChat({ messages, tools, signal, fetchImpl, config } = {}) {
  const cfg = config || getAgentConfig();
  if (!cfg.configured) {
    throw new AgentUpstreamError('Trợ lý AI chưa được cấu hình trên máy chủ.');
  }
  const doFetch = fetchImpl || globalThis.fetch;
  let response;
  try {
    response = await doFetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        ...(tools && tools.length ? { tools } : {}),
        stream: false,
        temperature: 0.3,
      }),
      signal,
    });
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    throw new AgentUpstreamError('Không kết nối được tới dịch vụ AI.', { cause: error });
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 300);
    } catch (readError) {
      detail = `(không đọc được nội dung lỗi: ${readError.message})`;
    }
    // Log status/detail for operators; never log the API key.
    console.error(`[agent] AI HTTP ${response.status}: ${detail}`);
    const message =
      response.status === 401 || response.status === 403
        ? 'Khóa truy cập dịch vụ AI không hợp lệ.'
        : response.status === 429
          ? 'Dịch vụ AI đang quá tải, vui lòng thử lại sau.'
          : 'Dịch vụ AI trả về lỗi.';
    throw new AgentUpstreamError(message, { status: response.status });
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new AgentUpstreamError('Dịch vụ AI trả về dữ liệu không hợp lệ.', { cause: error });
  }
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const rawMessage = choice && choice.message;
  if (!rawMessage || typeof rawMessage !== 'object') {
    throw new AgentUpstreamError('Dịch vụ AI trả về dữ liệu không hợp lệ.');
  }
  return {
    message: {
      role: 'assistant',
      content: typeof rawMessage.content === 'string' ? rawMessage.content : '',
      tool_calls: (Array.isArray(rawMessage.tool_calls) ? rawMessage.tool_calls : [])
        .map(normalizeToolCall)
        .filter(Boolean),
    },
    tokens: tokensFromUsage(payload.usage),
  };
}

module.exports = { ollamaChat, AgentUpstreamError };
