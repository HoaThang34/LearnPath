const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function isTunnelOrigin(origin) {
  if (typeof origin !== 'string') return false;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    // Support ngrok, localtunnel, and common dev tunnel providers
    return (
      host.endsWith('.ngrok-free.app') ||
      host.endsWith('.ngrok.app') ||
      host.endsWith('.ngrok.io') ||
      host.endsWith('.ngrok-free.dev') ||
      host.endsWith('.loca.lt') ||
      host === 'ngrok-free.app'
    );
  } catch {
    return false;
  }
}

function matchesPattern(origin, pattern) {
  if (pattern === '*' || pattern === origin) return true;
  if (pattern.includes('*')) {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i').test(origin);
  }
  return false;
}

function getAllowedOrigins() {
  const configured = process.env.APP_ORIGIN;
  const values = configured ? configured.split(',') : DEFAULT_ALLOWED_ORIGINS;
  return values.map((value) => value.trim()).filter(Boolean);
}

function isOriginAllowed(origin) {
  if (typeof origin !== 'string') return false;
  const origins = getAllowedOrigins();

  for (const allowed of origins) {
    if (matchesPattern(origin, allowed)) return true;
  }

  // If in strict production mode with APP_ORIGIN explicitly configured, do not automatically allow tunnels
  if (process.env.NODE_ENV === 'production' && process.env.APP_ORIGIN) {
    return false;
  }

  // Automatically allow ngrok and dev tunnels in dev/test/staging
  if (isTunnelOrigin(origin)) {
    return true;
  }

  return false;
}

function requireTrustedOrigin(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const origin = req.get('Origin');

  // If browser sent an Origin, verify it against allowed origins
  if (origin) {
    if (!isOriginAllowed(origin)) {
      return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
    }
    return next();
  }

  // Non-browser clients do not send Origin. Reject if cross-site Sec-Fetch-Site is present without Origin
  const fetchSite = req.get('Sec-Fetch-Site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
  }

  return next();
}

module.exports = {
  DEFAULT_ALLOWED_ORIGINS,
  getAllowedOrigins,
  isOriginAllowed,
  requireTrustedOrigin,
};
