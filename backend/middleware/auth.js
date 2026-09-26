const jwt = require('jsonwebtoken');
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'kuis_ai_secret_super_secure_key_2026_xyz';

/**
 * Middleware: authenticateUser
 * Verifies a JWT issued to a regular user and ensures single device active session.
 * Attaches the decoded payload to req.user.
 */
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Token tidak ditemukan.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify session token for single device enforcement
    if (decoded.sessionId) {
      const userRes = await db.query('SELECT session_token FROM users WHERE id = $1', [decoded.id]);
      if (userRes.rows.length === 0 || userRes.rows[0].session_token !== decoded.sessionId) {
        return res.status(401).json({
          success: false,
          code: 'SESSION_INVALID',
          message: 'Sesi login Anda telah berakhir atau akun sedang aktif di perangkat lain.',
        });
      }
      // Update last active
      await db.query('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1', [decoded.id]);
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kadaluarsa.' });
  }
};

/**
 * Middleware: authenticateAdmin
 * Verifies a JWT and checks that the payload contains role: 'admin'.
 */
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Token admin tidak ditemukan.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya admin yang diizinkan.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kadaluarsa.' });
  }
};

module.exports = { authenticateUser, authenticateAdmin };
