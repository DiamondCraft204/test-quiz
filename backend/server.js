require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize DB (runs schema check on first import)
require('./db');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const quizRoutes = require('./routes/quiz');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quiz', quizRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'RuangKuis API is running on Vercel Serverless',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'RuangKuis API Server',
    status: 'online',
    frontend: 'https://ruangkuis-frontend.vercel.app',
  });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ─── Start Server (when run locally) ─────────────────────────────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ RuangKuis backend running locally on http://localhost:${PORT}`);
  });
}

module.exports = app;
