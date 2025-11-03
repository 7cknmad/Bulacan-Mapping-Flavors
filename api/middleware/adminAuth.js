import jwt from 'jsonwebtoken';

const { ADMIN_JWT_SECRET = 'dev-secret-change-me' } = process.env;

function readBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

export function adminAuthRequired(req, res, next) {
  const token = readBearer(req);
  
  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: 'Admin token required' });
  }
  
  try {
    const user = jwt.verify(token, ADMIN_JWT_SECRET);
    
    // Check if user has admin role
    if (user.role !== 'admin' && user.role !== 'owner') {
      return res.status(403).json({ error: 'forbidden', message: 'Admin access required' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin token verification failed:', error);
    return res.status(401).json({ error: 'invalid_token', message: 'Invalid admin token' });
  }
}