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

/**
 * One non-streaming call to Ollama's /api/chat endpoint.
 * `fetchImpl` can be injected by tests; production uses global fetch (Node ≥ 18).
 */
async function ollamaChat({ messages, tools, signal, fetchImpl, config } = {}) {
  const cfg = config || getAgentConfig();
  if (!cfg.configured) {
    throw new AgentUpstreamError('Trợ lý AI chưa được cấu hình trên máy chủ.');
  }
  const doFetch = fetchImpl || globalThis.fetch;
  let response;
  try {
    response = await doFetch(`${cfg.baseUrl}/chat`, {
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
        options: { temperature: 0.3 },
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
    console.error(`[agent] Ollama HTTP ${response.status}: ${detail}`);
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
  const message = payload && payload.message;
  if (!message || typeof message !== 'object') {
    throw new AgentUpstreamError('Dịch vụ AI trả về dữ liệu không hợp lệ.');
  }
  return {
    message: {
      role: 'assistant',
      content: typeof message.content === 'string' ? message.content : '',
      tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
    },
    tokens: Number(payload.prompt_eval_count || 0) + Number(payload.eval_count || 0),
  };
}

module.exports = { ollamaChat, AgentUpstreamError };
