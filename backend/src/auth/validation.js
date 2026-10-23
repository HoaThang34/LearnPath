const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

// 3–32 characters: must start and end with a letter or digit.
const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{1,30})[A-Za-z0-9]$/;

function validateUsername(rawUsername) {
  if (typeof rawUsername !== 'string') {
    return { ok: false, error: 'Tên đăng nhập không hợp lệ.' };
  }

  const username = rawUsername.trim();

  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      error: 'Tên đăng nhập phải có từ 3 đến 32 ký tự.',
    };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error:
        'Tên đăng nhập chỉ được chứa chữ cái, chữ số, dấu chấm, gạch dưới hoặc gạch ngang; ' +
        'phải bắt đầu và kết thúc bằng chữ cái hoặc chữ số.',
    };
  }

  return {
    ok: true,
    username,
    usernameLower: username.toLowerCase(),
  };
}

function validatePassword(password) {
  if (typeof password !== 'string') {
    return { ok: false, error: 'Mật khẩu không hợp lệ.' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`,
    };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      error: `Mật khẩu không được dài quá ${PASSWORD_MAX_LENGTH} ký tự.`,
    };
  }

  const hasLetter = /\p{L}/u.test(password);
  const hasDigit = /\p{Nd}/u.test(password);

  if (!hasLetter || !hasDigit) {
    return {
      ok: false,
      error: 'Mật khẩu phải có ít nhất một chữ cái và một chữ số.',
    };
  }

  return { ok: true };
}

function validateRegistration(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Dữ liệu đăng ký không hợp lệ.' };
  }

  const usernameResult = validateUsername(body.username);
  if (!usernameResult.ok) return usernameResult;

  const passwordResult = validatePassword(body.password);
  if (!passwordResult.ok) return passwordResult;

  if (typeof body.passwordConfirm !== 'string' || body.passwordConfirm !== body.password) {
    return { ok: false, error: 'Mật khẩu xác nhận không khớp.' };
  }

  return {
    ok: true,
    username: usernameResult.username,
    usernameLower: usernameResult.usernameLower,
    password: body.password,
  };
}

function validateLogin(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' };
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = body.password;

  if (!username || typeof password !== 'string' || password.length === 0) {
    return { ok: false, error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' };
  }

  if (username.length > USERNAME_MAX_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  return {
    ok: true,
    usernameLower: username.toLowerCase(),
    password,
  };
}

module.exports = {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  validateUsername,
  validatePassword,
  validateRegistration,
  validateLogin,
};
