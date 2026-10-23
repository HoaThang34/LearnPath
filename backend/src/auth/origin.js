const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function getAllowedOrigins() {
  const configured = process.env.APP_ORIGIN;
  const values = configured ? configured.split(',') : DEFAULT_ALLOWED_ORIGINS;
  return values.map((value) => value.trim()).filter(Boolean);
}

function isOriginAllowed(origin) {
  return typeof origin === 'string' && getAllowedOrigins().includes(origin);
}

function requireTrustedOrigin(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const fetchSite = req.get('Sec-Fetch-Site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
  }

  const origin = req.get('Origin');
  // Non-browser clients do not send Origin. Browsers do for state-changing requests.
  if (!origin) return next();

  if (!isOriginAllowed(origin)) {
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
