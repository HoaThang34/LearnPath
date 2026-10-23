const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./src/routes/auth');
const diemChuanRoutes = require('./src/routes/diemChuan');
const deAnRoutes = require('./src/routes/deAn');
const khoiThiRoutes = require('./src/routes/khoiThi');
const diemThiRoutes = require('./src/routes/diemThi');
const { getDb } = require('./src/database/db');
const { getAuthDb } = require('./src/auth/authDb');
const { requireAuth } = require('./src/auth/session');
const { isOriginAllowed } = require('./src/auth/origin');

const app = express();
const PORT = process.env.PORT || 3001;

if (process.env.TRUST_PROXY === '1') {
  // Only enable this when the app is actually behind a trusted reverse proxy.
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Credentials are required for the HttpOnly session cookie. Never use "*" here.
app.use(
  cors({
    origin(origin, callback) {
      callback(null, !origin || isOriginAllowed(origin));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10kb' }));

// Public auth routes
app.use('/api/auth', authRoutes);

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// All admission data requires an authenticated session.
app.use('/api/diem-chuan', requireAuth, diemChuanRoutes);
app.use('/api/de-an', requireAuth, deAnRoutes);
app.use('/api/khoi-thi', requireAuth, khoiThiRoutes);
app.use('/api/diem-thi', requireAuth, diemThiRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Không tìm thấy API.' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
  }

  if (res.headersSent) {
    return next(err);
  }

  console.error('Error:', err.message);
  return res.status(500).json({ error: 'Đã xảy ra lỗi máy chủ.' });
});

// Start server
async function start() {
  try {
    await getDb();
    console.log('Database connected');

    await getAuthDb();
    console.log('Auth database ready');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
