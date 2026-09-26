const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'kuis_ai_secret_super_secure_key_2026_xyz';

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nama, email, dan password wajib diisi.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
    }

    // Check if email already registered
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now();

    const result = await db.query(
      'INSERT INTO users (name, email, password, session_token, last_active) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id, name, email',
      [name, email, hashedPassword, sessionId]
    );

    const newUser = result.rows[0];

    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email, sessionId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil.',
      data: { token, user: newUser },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    // Single device check: check if already logged in and active in another device
    if (user.session_token && user.last_active) {
      const lastActive = new Date(user.last_active).getTime();
      const now = Date.now();
      const diffMinutes = (now - lastActive) / (1000 * 60);

      if (diffMinutes < 15) {
        return res.status(403).json({
          success: false,
          code: 'CONCURRENT_LOGIN_BLOCKED',
          message: 'Akun ini sedang aktif di perangkat lain. Anda tidak dapat login di lebih dari 1 perangkat. Silakan logout terlebih dahulu dari perangkat sebelumnya.',
        });
      }
    }

    const sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now();

    await db.query(
      'UPDATE users SET session_token = $1, last_active = CURRENT_TIMESTAMP WHERE id = $2',
      [sessionId, user.id]
    );

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, sessionId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login berhasil.',
      data: { token, user: { id: user.id, name: user.name, email: user.email } },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticateUser, async (req, res, next) => {
  try {
    const userRes = await db.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }
    return res.json({ success: true, data: { user: userRes.rows[0] } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', authenticateUser, async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      await db.query('UPDATE users SET session_token = NULL WHERE id = $1', [req.user.id]);
    }
    return res.json({ success: true, message: 'Logout berhasil.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/admin/login ───────────────────────────────────────────────
router.post('/admin/login', (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password wajib diisi.' });
    }

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (password !== adminPassword) {
      return res.status(401).json({ success: false, message: 'Password admin salah.' });
    }

    const token = jwt.sign(
      { role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      success: true,
      message: 'Login admin berhasil.',
      data: { token },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
