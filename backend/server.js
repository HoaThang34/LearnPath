const express = require('express');
const cors = require('cors');

// Import routes
const diemChuanRoutes = require('./src/routes/diemChuan');
const deAnRoutes = require('./src/routes/deAn');
const khoiThiRoutes = require('./src/routes/khoiThi');
const diemThiRoutes = require('./src/routes/diemThi');
const { getDb } = require('./src/database/db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/diem-chuan', diemChuanRoutes);
app.use('/api/de-an', deAnRoutes);
app.use('/api/khoi-thi', khoiThiRoutes);
app.use('/api/diem-thi', diemThiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    await getDb();
    console.log('Database connected');

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
