#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { getAuthDb } = require('../src/auth/authDb');
const {
  createAdmin,
  resetAdminPassword,
  setAdminStatus,
  listAdmins,
} = require('../src/auth/adminAuth');
const { validateAdminPassword } = require('../src/auth/validation');

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;

    const key = value.slice(2);
    const next = argv[index + 1];

    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    let muted = false;
    const originalWrite = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (text) => {
      if (!muted) originalWrite(text);
    };

    rl.question(question, (answer) => {
      muted = true;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });

    muted = true;
  });
}

async function readPassword() {
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }

  const password = await promptHidden('Mật khẩu quản trị: ');
  const confirmation = await promptHidden('Nhập lại mật khẩu quản trị: ');

  if (password !== confirmation) {
    throw new Error('Mật khẩu xác nhận không khớp.');
  }

  return password;
}

function printUsage() {
  console.log(`Cách dùng:
  npm run admin:create -- --username <tên>                 Tạo quản trị viên mới
  npm run admin:create -- --username <tên> --reset-password Đặt lại mật khẩu
  npm run admin:create -- --username <tên> --disable        Vô hiệu hóa
  npm run admin:create -- --username <tên> --enable         Kích hoạt lại
  npm run admin:create -- --list                            Liệt kê quản trị viên

Mật khẩu có thể truyền qua biến môi trường ADMIN_PASSWORD cho CI có kiểm soát.
Không truyền mật khẩu trực tiếp trên dòng lệnh.`);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toISOString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  await getAuthDb();

  if (args.list) {
    const admins = await listAdmins();
    if (admins.length === 0) {
      console.log('Chưa có tài khoản quản trị nào.');
      return;
    }

    console.log('ID\tTên đăng nhập\tTrạng thái\tNgày tạo\tĐăng nhập cuối');
    for (const admin of admins) {
      console.log(
        [
          admin.id,
          admin.username,
          admin.status,
          formatDate(admin.createdAt),
          formatDate(admin.lastLoginAt),
        ].join('\t')
      );
    }
    return;
  }

  const username = typeof args.username === 'string' ? args.username : '';
  if (!username) {
    throw new Error('Thiếu --username. Chạy với --help để xem hướng dẫn.');
  }

  if (args.disable || args.enable) {
    const status = args.disable ? 'disabled' : 'active';
    const admin = await setAdminStatus(username, status);
    console.log(
      `Đã ${status === 'disabled' ? 'vô hiệu hóa' : 'kích hoạt'} quản trị viên ${admin.username}.`
    );
    return;
  }

  const password = await readPassword();
  const passwordCheck = validateAdminPassword(password);
  if (!passwordCheck.ok) {
    throw new Error(passwordCheck.error);
  }

  if (args['reset-password']) {
    const admin = await resetAdminPassword(username, password);
    console.log(`Đã đặt lại mật khẩu cho quản trị viên ${admin.username}.`);
    return;
  }

  const admin = await createAdmin({ username, password });
  console.log(`Đã tạo quản trị viên ${admin.username} (ID ${admin.id}).`);
}

main().catch((error) => {
  console.error(`Lỗi: ${error.message}`);
  process.exitCode = 1;
});
