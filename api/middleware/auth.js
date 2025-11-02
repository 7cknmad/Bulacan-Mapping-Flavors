import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'bulacan_secret_key';

function readBearer(req) {
  const h = req.headers.authorization || '';
  console.log('[auth] Authorization header:', h);
  const m = /^Bearer\s+(.+)$/i.exec(h);
  console.log('[auth] Token match:', m ? 'found' : 'not found');
  return m ? m[1] : null;
}

export function authRequired(req, res, next) {
  try {
    console.log('[auth] Request path:', req.path);
    console.log('[auth] Request method:', req.method);
    
    const token = readBearer(req);
    console.log('[auth] Token received:', token ? `${token.substring(0, 10)}...` : 'none');
    
    if (!token) {
      console.log('[auth] No token found in request');
      return res.status(401).json({ error: 'unauthorized' });
    }
    
    try {
      const user = jwt.verify(token, JWT_SECRET);
      console.log('[auth] Token verified successfully for user:', user.email || user.uid);
      req.user = user;
      next();
    } catch (e) {
      console.log('[auth] Token verification failed:', e.message);
      return res.status(401).json({ error: 'invalid_token', details: e.message });
    }
  } catch (e) {
    console.log('[auth] Unexpected error:', e.message);
    return res.status(500).json({ error: 'auth_error', details: e.message });
  }
}