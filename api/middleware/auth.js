import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'bulacan_secret_key';

function readBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

export function authRequired(req, res, next) {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}