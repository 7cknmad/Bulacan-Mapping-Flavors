import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'bulacan_secret_key';

export default function createUserRouter(pool) {
  const router = express.Router();

  // Registration (MySQL)
  router.post('/register', async (req, res) => {
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
    try {
      // Check if user exists
      const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
      if (rows.length > 0) return res.status(409).json({ error: 'Email already registered.' });
      // Hash password and insert
      const hash = await bcrypt.hash(password, 10);
  // Default role is 'user'. You can manually set admin in DB for now.
  await pool.query('INSERT INTO users (email, password, display_name, role) VALUES (?, ?, ?, ?)', [email, hash, displayName || email, 'user']);
  res.json({ success: true });
    } catch (e) {
      console.error('Registration error:', e);
      res.status(500).json({ error: 'Registration failed.' });
    }
  });

  // Login (MySQL)
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const [rows] = await pool.query('SELECT id, email, password, display_name, role FROM users WHERE email = ?', [email]);
      if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials.' });
      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });
      
      // Generate access token (short-lived)
      const token = jwt.sign(
        { id: user.id, email: user.email, displayName: user.display_name, role: user.role },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Generate refresh token (long-lived)
      const refreshToken = jwt.sign(
        { id: user.id, tokenVersion: 1 },
        JWT_SECRET + '_refresh',
        { expiresIn: '7d' }
      );

      // Set refresh token in HTTP-only cookie
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role
        }
      });
    } catch (e) {
      console.error('Login error:', e);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  // Session validation
  router.get('/me', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'No token.' });
    try {
      const token = auth.replace('Bearer ', '');
      const user = jwt.verify(token, JWT_SECRET);
      res.json({ user });
    } catch {
      res.status(401).json({ error: 'Invalid token.' });
    }
  });

  // Token refresh endpoint
  router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token.' });
    }

    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, JWT_SECRET + '_refresh');
      
      // Get user data
      const [rows] = await pool.query(
        'SELECT id, email, display_name, role FROM users WHERE id = ?',
        [payload.id]
      );
      
      if (!rows.length) {
        return res.status(401).json({ error: 'User not found.' });
      }

      const user = rows[0];

      // Generate new access token
      const newToken = jwt.sign(
        { id: user.id, email: user.email, displayName: user.display_name, role: user.role },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Send new access token and user data
      res.json({
        token: newToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role
        }
      });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }
  });

  // Logout endpoint
  router.post('/logout', (req, res) => {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.json({ success: true });
  });

  return router;
}
