const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_PAIR_LIMIT = 5;
const LOGIN_IP_LIMIT = 30;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_LIMIT = 10;
const MAX_BUCKETS = 10000;

const buckets = new Map();
let lastCleanupAt = 0;

function cleanup(now) {
  if (now - lastCleanupAt < 60 * 1000) return;
  lastCleanupAt = now;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  if (buckets.size > MAX_BUCKETS) {
    for (const key of buckets.keys()) {
      if (buckets.size <= MAX_BUCKETS) break;
      buckets.delete(key);
    }
  }
}

function getBucket(key, now, windowMs) {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  return bucket;
}

function checkRate(key, limit, windowMs, now) {
  cleanup(now);
  const bucket = getBucket(key, now, windowMs);
  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

function increment(key, windowMs, now) {
  const bucket = getBucket(key, now, windowMs);
  bucket.count += 1;
  return bucket;
}

function loginPairKey(ip, usernameLower) {
  return `login:pair:${ip}|${usernameLower}`;
}

function loginIpKey(ip) {
  return `login:ip:${ip}`;
}

function registerIpKey(ip) {
  return `register:ip:${ip}`;
}

function checkLoginRateLimit(ip, usernameLower) {
  const now = Date.now();
  const pair = checkRate(loginPairKey(ip, usernameLower), LOGIN_PAIR_LIMIT, LOGIN_WINDOW_MS, now);
  if (!pair.allowed) return pair;

  const byIp = checkRate(loginIpKey(ip), LOGIN_IP_LIMIT, LOGIN_WINDOW_MS, now);
  if (!byIp.allowed) return byIp;

  return { allowed: true, retryAfter: 0 };
}

function recordLoginFailure(ip, usernameLower) {
  const now = Date.now();
  increment(loginPairKey(ip, usernameLower), LOGIN_WINDOW_MS, now);
  increment(loginIpKey(ip), LOGIN_WINDOW_MS, now);
}

function clearLoginFailures(ip, usernameLower) {
  buckets.delete(loginPairKey(ip, usernameLower));
}

function checkRegisterRateLimit(ip) {
  return checkRate(registerIpKey(ip), REGISTER_LIMIT, REGISTER_WINDOW_MS, Date.now());
}

function recordRegisterAttempt(ip) {
  increment(registerIpKey(ip), REGISTER_WINDOW_MS, Date.now());
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

module.exports = {
  LOGIN_WINDOW_MS,
  LOGIN_PAIR_LIMIT,
  LOGIN_IP_LIMIT,
  REGISTER_WINDOW_MS,
  REGISTER_LIMIT,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  checkRegisterRateLimit,
  recordRegisterAttempt,
  getClientIp,
};
