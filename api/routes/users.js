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
  // Include role in JWT and response
  const token = jwt.sign({ id: user.id, email: user.email, displayName: user.display_name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role } });
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

  return router;
}
