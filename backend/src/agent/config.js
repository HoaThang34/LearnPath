'use strict';

const fs = require('fs');
const path = require('path');

function tryLoadEnv() {
  if (typeof process.loadEnvFile === 'function') {
    const candidates = [
      path.resolve(__dirname, '../../.env'),
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'backend/.env'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          process.loadEnvFile(p);
          break;
        } catch {}
      }
    }
  }
}
tryLoadEnv();

// Agent configuration is read from the environment on every call so tests can
// override it. The API key is never returned to the client or logged.

function intFromEnv(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function getAgentConfig() {
  const apiKey = (process.env.OLLAMA_API_KEY || '').trim();
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'https://ollama.com/api').trim().replace(/\/+$/, '');
  const model = (process.env.OLLAMA_MODEL || 'beam:cloud').trim();
  return {
    enabled: process.env.AGENT_ENABLED !== '0',
    configured: Boolean(apiKey && baseUrl && model),
    apiKey,
    baseUrl,
    model,
    maxToolSteps: intFromEnv('AGENT_MAX_TOOL_STEPS', 6, { min: 1, max: 12 }),
    timeoutMs: intFromEnv('AGENT_TIMEOUT_MS', 90000, { min: 5000, max: 300000 }),
    dailyRequestLimit: intFromEnv('AGENT_DAILY_REQUEST_LIMIT', 100, { min: 1, max: 10000 }),
    burstLimit: intFromEnv('AGENT_BURST_LIMIT', 20, { min: 1, max: 1000 }),
    burstWindowMs: intFromEnv('AGENT_BURST_WINDOW_MS', 10 * 60 * 1000, { min: 1000 }),
    historyTurns: intFromEnv('AGENT_HISTORY_TURNS', 10, { min: 0, max: 50 }),
    maxMessageLength: 2000,
  };
}

module.exports = { getAgentConfig };
