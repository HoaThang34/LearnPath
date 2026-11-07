'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.LEARNPATH_AUTH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-agent-loop-auth-${process.pid}-${Date.now()}.db`
);
process.env.LEARNPATH_DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-agent-loop-main-${process.pid}-${Date.now()}.db`
);

const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');

const { getAuthDb } = require('../../src/auth/authDb');
const { getDb } = require('../../src/database/db');
const { runAgentTurn } = require('../../src/agent/loop');

const AUTH_DB = process.env.LEARNPATH_AUTH_DB_PATH;
const MAIN_DB = process.env.LEARNPATH_DB_PATH;

async function setupMainDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE khoi_thi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ma_khoi TEXT UNIQUE NOT NULL,
      mon_thi TEXT,
      so_truong INTEGER
    );
  `);
  db.run("INSERT INTO khoi_thi (ma_khoi, mon_thi, so_truong) VALUES ('A00', 'Toán, Vật lí, Hóa học', 232)");
  fs.writeFileSync(MAIN_DB, Buffer.from(db.export()));
  db.close();
}

test('runAgentTurn: direct answer with no tool calls', async () => {
  await getAuthDb();
  await setupMainDb();
  await getDb();

  const mockChat = async ({ messages }) => {
    return {
      message: {
        role: 'assistant',
        content: 'Chào bạn! Mình có thể giúp gì cho bạn?',
      },
      tokens: 42,
    };
  };

  const events = [];
  const result = await runAgentTurn({
    userId: 1,
    history: [],
    message: 'Xin chào',
    onEvent: (e) => events.push(e),
    chat: mockChat,
  });

  assert.equal(result.content, 'Chào bạn! Mình có thể giúp gì cho bạn?');
  assert.equal(result.artifacts.length, 0);
  assert.equal(result.trace.length, 0);
  assert.equal(result.tokens, 42);
  assert.ok(events.some((e) => e.type === 'status'));
});

test('runAgentTurn: executes tool call and uses result in next turn', async () => {
  let callCount = 0;
  const mockChat = async ({ messages, tools }) => {
    callCount += 1;
    if (callCount === 1) {
      assert.ok(tools && tools.length > 0);
      return {
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_1',
              function: {
                name: 'get_khoi_thi',
                arguments: JSON.stringify({ code: 'A00' }),
              },
            },
          ],
        },
        tokens: 35,
      };
    }
    // Second turn: should have tool message in messages array
    const toolMsg = messages.find((m) => m.role === 'tool');
    assert.ok(toolMsg);
    assert.ok(toolMsg.content.includes('Toán, Vật lí, Hóa học'));
    return {
      message: {
        role: 'assistant',
        content: 'Khối A00 gồm các môn Toán, Vật lí, Hóa học.',
      },
      tokens: 45,
    };
  };

  const events = [];
  const result = await runAgentTurn({
    userId: 1,
    history: [],
    message: 'Khối A00 gồm môn gì?',
    onEvent: (e) => events.push(e),
    chat: mockChat,
  });

  assert.equal(callCount, 2);
  assert.equal(result.content, 'Khối A00 gồm các môn Toán, Vật lí, Hóa học.');
  assert.equal(result.trace.length, 1);
  assert.equal(result.trace[0].tool, 'get_khoi_thi');
  assert.equal(result.trace[0].ok, true);
  assert.equal(result.tokens, 80);
});

test('runAgentTurn: stops when maxToolSteps is reached', async () => {
  let callCount = 0;
  const mockChat = async ({ messages, tools }) => {
    callCount += 1;
    if (tools && tools.length > 0) {
      return {
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: `call_${callCount}`,
              function: {
                name: 'get_khoi_thi',
                arguments: JSON.stringify({ code: 'A00' }),
              },
            },
          ],
        },
        tokens: 20,
      };
    }
    // When tools is empty, model must answer
    return {
      message: {
        role: 'assistant',
        content: 'Đã dừng gọi công cụ và trả lời.',
      },
      tokens: 25,
    };
  };

  const result = await runAgentTurn({
    userId: 1,
    history: [],
    message: 'Hỏi lặp',
    config: { maxToolSteps: 2 },
    chat: mockChat,
  });

  // Turn 0 (step 0: tool call), Turn 1 (step 1: tool call), Turn 2 (step 2: lastStep, tools empty -> final answer)
  assert.equal(callCount, 3);
  assert.equal(result.content, 'Đã dừng gọi công cụ và trả lời.');
  assert.equal(result.trace.length, 2);
});

after(() => {
  fs.rmSync(AUTH_DB, { force: true });
  fs.rmSync(MAIN_DB, { force: true });
});
