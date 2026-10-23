'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const test = require('node:test');
const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');

const CLI_PATH = path.resolve(__dirname, '../../scripts/admin-create.js');
const DB_PATH = path.join(
  os.tmpdir(),
  `learnpath-admin-cli-${process.pid}-${Date.now()}.db`
);

function runCli(args, password) {
  const env = { ...process.env, LEARNPATH_AUTH_DB_PATH: DB_PATH };
  if (password) env.ADMIN_PASSWORD = password;
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    env,
  });
}

test('admin CLI creates, lists, disables and resets admins', async (t) => {
  t.after(() => {
    fs.rmSync(DB_PATH, { force: true });
    const directory = path.dirname(DB_PATH);
    const prefix = path.basename(DB_PATH);
    for (const name of fs.readdirSync(directory)) {
      if (name.startsWith(prefix)) {
        fs.rmSync(path.join(directory, name), { force: true });
      }
    }
  });

  const created = runCli(
    ['--username', 'cli_admin'],
    'MatKhauAdmin123'
  );
  assert.equal(created.status, 0, created.stderr);
  assert.match(created.stdout, /Đã tạo quản trị viên cli_admin/);
  assert.equal(created.stdout.includes('MatKhauAdmin123'), false);

  const SQL = await initSqlJs();
  let db = new SQL.Database(fs.readFileSync(DB_PATH));
  try {
    const rows = db.exec(
      'SELECT username, password_hash, status FROM admins WHERE username_lower = ?',
      ['cli_admin']
    );
    assert.equal(rows.length, 1);
    const [username, passwordHash, status] = rows[0].values[0];
    assert.equal(username, 'cli_admin');
    assert.match(passwordHash, /^scrypt\$/);
    assert.equal(passwordHash.includes('MatKhauAdmin123'), false);
    assert.equal(status, 'active');
  } finally {
    db.close();
  }

  const duplicate = runCli(['--username', 'cli_admin'], 'MatKhauAdmin123');
  assert.equal(duplicate.status, 1);
  assert.match(duplicate.stderr, /đã tồn tại/i);

  const weak = runCli(['--username', 'weak_admin'], '12345678901');
  assert.equal(weak.status, 1);
  assert.match(weak.stderr, /ít nhất 12 ký tự/i);

  const list = runCli(['--list']);
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, /cli_admin/);
  assert.match(list.stdout, /active/);

  const disabled = runCli(['--username', 'cli_admin', '--disable']);
  assert.equal(disabled.status, 0, disabled.stderr);
  assert.match(disabled.stdout, /vô hiệu hóa/);

  db = new SQL.Database(fs.readFileSync(DB_PATH));
  try {
    const status = db.exec('SELECT status FROM admins WHERE username_lower = ?', [
      'cli_admin',
    ])[0].values[0][0];
    assert.equal(status, 'disabled');
  } finally {
    db.close();
  }

  const enabled = runCli(['--username', 'cli_admin', '--enable']);
  assert.equal(enabled.status, 0, enabled.stderr);

  const reset = runCli(
    ['--username', 'cli_admin', '--reset-password'],
    'MatKhauAdmin456'
  );
  assert.equal(reset.status, 0, reset.stderr);
  assert.match(reset.stdout, /đặt lại mật khẩu/i);

  db = new SQL.Database(fs.readFileSync(DB_PATH));
  try {
    const hash = db.exec('SELECT password_hash FROM admins WHERE username_lower = ?', [
      'cli_admin',
    ])[0].values[0][0];
    assert.match(hash, /^scrypt\$/);
    assert.equal(hash.includes('MatKhauAdmin456'), false);
  } finally {
    db.close();
  }
});
