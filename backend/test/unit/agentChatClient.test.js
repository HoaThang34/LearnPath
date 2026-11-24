'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { ollamaChat, AgentUpstreamError } = require('../../src/agent/ollama');

const config = {
  configured: true,
  baseUrl: 'https://provider.example/v1',
  apiKey: 'unit-test-key',
  model: 'test-model',
};

function fakeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

test('AI C1: sends an OpenAI-compatible request and parses the answer', async () => {
  let call;
  const fetchImpl = async (url, options) => {
    call = { url, options };
    return fakeResponse({
      model: 'test-model',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Xin chào' } }],
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
    });
  };

  const result = await ollamaChat({
    messages: [{ role: 'user', content: 'Chào' }],
    fetchImpl,
    config,
  });

  assert.equal(call.url, 'https://provider.example/v1/chat/completions');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers.Authorization, 'Bearer unit-test-key');
  const body = JSON.parse(call.options.body);
  assert.equal(body.model, 'test-model');
  assert.deepEqual(body.messages, [{ role: 'user', content: 'Chào' }]);
  assert.equal(body.stream, false);
  assert.equal(body.temperature, 0.3);
  assert.equal('tools' in body, false);
  assert.equal(result.message.content, 'Xin chào');
  assert.deepEqual(result.message.tool_calls, []);
  assert.equal(result.tokens, 70);
});

test('AI C2: normalizes tool calls returned by the provider', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'call_abc',
            type: 'function',
            function: { name: 'get_khoi_thi', arguments: '{"code":"A00"}' },
          }],
        },
      }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
  });

  const result = await ollamaChat({ messages: [], fetchImpl, config });

  assert.deepEqual(result.message.tool_calls, [{
    id: 'call_abc',
    type: 'function',
    function: { name: 'get_khoi_thi', arguments: '{"code":"A00"}' },
  }]);
  assert.equal(result.tokens, 15);
});

test('AI C3: rejects a missing configuration without calling the provider', async () => {
  let called = false;
  await assert.rejects(
    () => ollamaChat({
      messages: [],
      config: { ...config, configured: false },
      fetchImpl: async () => { called = true; },
    }),
    (error) => error instanceof AgentUpstreamError && /chưa được cấu hình/.test(error.message)
  );
  assert.equal(called, false);
});

test('AI C4: maps an invalid API key response to a Vietnamese error', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      () => ollamaChat({
        messages: [],
        config,
        fetchImpl: async () => fakeResponse({ error: 'invalid key' }, 401),
      }),
      (error) => error instanceof AgentUpstreamError && error.status === 401 && /không hợp lệ/.test(error.message)
    );
  } finally {
    console.error = originalError;
  }
});

test('AI C5: rejects a payload without a choice message', async () => {
  await assert.rejects(
    () => ollamaChat({
      messages: [],
      config,
      fetchImpl: async () => fakeResponse({ choices: [] }),
    }),
    (error) => error instanceof AgentUpstreamError && /không hợp lệ/.test(error.message)
  );
});
