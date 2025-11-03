import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { adminAuthRequired } from '../middleware/adminAuth.js';

const router = express.Router();
const {
  ADMIN_JWT_SECRET = 'admin-secret-key',
  ADMIN_EMAIL = 'adminbmf',
  ADMIN_PASSWORD_HASH = '',
  ADMIN_PASSWORD = 'password'
} = process.env;

// Admin login endpoint
router.post('/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'missing_credentials' });
    }

    // Check if using hard-coded admin credentials
    if (email === ADMIN_EMAIL) {
      let isValid = false;
      
      // Try password hash if available, otherwise fallback to plain password
      if (ADMIN_PASSWORD_HASH) {
        try {
          isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
        } catch (e) {
          console.error('bcrypt compare error:', e);
          isValid = false;
        }
      } else {
        isValid = password === ADMIN_PASSWORD;
      }

      if (!isValid) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }

      // Generate admin token
      const token = jwt.sign(
        { 
          uid: 0, // Special admin ID
          email: ADMIN_EMAIL,
          displayName: 'Administrator',
          role: 'admin'
        }, 
        ADMIN_JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({ 
        ok: true,
        token,
        user: { 
          id: 0,
          email: ADMIN_EMAIL,
          name: 'Administrator',
          role: 'admin'
        }
      });
    }

    // For non-admin email, check database for admin users
    const [[user]] = await pool.query(
      'SELECT id, email, password, password_hash, display_name, role FROM users WHERE LOWER(email) = LOWER(?) AND (role = "admin" OR role = "owner") LIMIT 1',
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    // Verify password
    let authenticated = false;
    if (user.password && user.password === password) {
      authenticated = true;
    } else if (user.password_hash) {
      try {
        authenticated = await bcrypt.compare(password, user.password_hash);
      } catch (e) {
        console.error('bcrypt compare error:', e);
        authenticated = false;
      }
    }

    if (!authenticated) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    // Generate admin token
    const token = jwt.sign(
      {
        uid: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      },
      ADMIN_JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ error: 'login_failed' });
  }
});

// Admin refresh token
router.post('/auth/admin/refresh', adminAuthRequired, (req, res) => {
  try {
    // User is already authenticated via adminAuthRequired
    const token = jwt.sign(
      {
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.displayName,
        role: req.user.role
      },
      ADMIN_JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      ok: true,
      token,
      user: {
        id: req.user.uid,
        email: req.user.email,
        name: req.user.displayName,
        role: req.user.role
      }
    });
  } catch (err) {
    console.error('Admin refresh error:', err);
    return res.status(500).json({ error: 'refresh_failed' });
  }
});

// Admin verify token/get current user
router.get('/auth/admin/me', adminAuthRequired, (req, res) => {
  res.json({
    user: {
      id: req.user.uid,
      email: req.user.email,
      name: req.user.displayName || 'Administrator',
      role: req.user.role
    }
  });
});

export default router;