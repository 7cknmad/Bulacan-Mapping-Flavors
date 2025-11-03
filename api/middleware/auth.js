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

    // Check if this is an admin route
    const isAdminRoute = req.path.startsWith('/admin/');
    console.log('[auth] Is admin route:', isAdminRoute);
    
    try {
      if (isAdminRoute) {
        // For admin routes, only accept admin tokens
        try {
          const user = jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'admin-secret-key');
          if (user.role !== 'admin' && user.role !== 'owner') {
            console.log('[auth] User not admin:', user.role);
            throw new Error('not_admin');
          }
          console.log('[auth] Admin token verified for:', user.email);
          req.user = user;
          return next();
        } catch (e) {
          console.log('[auth] Admin token verification failed:', e.message);
          return res.status(401).json({ error: 'invalid_admin_token' });
        }
      }

      // For non-admin routes, try regular user token
      const user = jwt.verify(token, JWT_SECRET);
      console.log('[auth] User token verified for:', user.email);
      req.user = user;
      return next();
    } catch (e) {
      console.log('[auth] Token verification failed:', e.message);
      return res.status(401).json({ error: 'invalid_token', details: e.message });
    }
  } catch (e) {
    console.log('[auth] Unexpected error:', e.message);
    return res.status(500).json({ error: 'auth_error', details: e.message });
  }
}