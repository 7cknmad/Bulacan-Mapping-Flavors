import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { API } from '../utils/api';

interface User {
  id: number;
  email?: string;
  displayName?: string;
  guest?: boolean;
  role?: 'user' | 'admin' | 'owner' | 'moderator';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token?: string) => void;
  logout: () => void;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => { throw new Error('AuthContext not initialized') },
  logout: () => { throw new Error('AuthContext not initialized') },
  checkSession: async () => { throw new Error('AuthContext not initialized') }
});

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      // First try to restore from localStorage for immediate UI
      try {
        const rawUser = localStorage.getItem("auth_user");
        const storedToken = localStorage.getItem("auth_token");
        
        if (rawUser && storedToken) {
          const parsedUser = JSON.parse(rawUser);
          setUser(parsedUser);
          setToken(storedToken);
        }
      } catch (e) {
        console.error('Error restoring auth from localStorage:', e);
      }

      // Then validate with server
      try {
        await checkSession();
      } catch (e) {
        console.error('Error checking session:', e);
      }
    };

    initializeAuth();
  }, []);

  async function checkSession(existingToken?: string) {
    // Don't attempt to restore session if we're in the process of logging out
    if (document.cookie.includes('logging_out=1')) {
      return;
    }

    const currentToken = existingToken || token || localStorage.getItem("auth_token");
    const adminToken = localStorage.getItem("bmf_admin_token");
    
    // Detect if we're on an admin route
    let isAdminRoute = false;
    try {
      isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
    } catch {}

    // If NOT on admin route, try regular user token first
    if (!isAdminRoute && currentToken) {
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${currentToken}` },
          credentials: 'include' // Important: include credentials for session handling
        });
        if (res.ok) {
          const data = await res.json();
          const u = data.user || data;
          // Only accept non-admin users on regular routes
          if (u && u.role !== 'admin' && u.role !== 'owner') {
            setUser(u as any);
            setToken(currentToken);
            try {
              localStorage.setItem("auth_token", currentToken);
              localStorage.setItem("auth_user", JSON.stringify(u));
            } catch {}
            return; // Successfully restored user session
          }
        } else if (res.status === 401) {
          // Token is invalid, clear it
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
        }
      } catch (e) {
        console.error('Error checking regular token:', e);
      }
    }

    // If on admin route and admin token exists, use admin token
    if (isAdminRoute && adminToken) {
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const u = data.user || data;
          if (u && (u.role === 'admin' || u.role === 'owner')) {
            setUser(u as any);
            setToken(adminToken);
            try {
              localStorage.setItem("auth_token", adminToken);
              localStorage.setItem("auth_user", JSON.stringify(u));
            } catch {}
            return;
          }
        }
      } catch (e) {
        // continue to regular token
      }
    }

    // If we're not on an admin route, clear admin token and data
    if (!isAdminRoute) {
      try {
        localStorage.removeItem("bmf_admin_token");
      } catch {}
    }
    
    // If no regular token and ON admin route, try admin token
    if (!currentToken && isAdminRoute && adminToken) {
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const u = data.user || data;
          if (u && (u.role === 'admin' || u.role === 'owner')) {
            setUser(u as any);
            setToken(adminToken);
            try {
              localStorage.setItem("auth_token", adminToken);
              localStorage.setItem("auth_user", JSON.stringify(u));
            } catch {}
            return;
          }
        }
      } catch (e) {
        // continue to refresh attempt
      }
    }

    // Try refresh token
    try {
      const r = await fetch(`${API}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (r.ok) {
        const payload = await r.json();
        const newToken = payload.token || null;
        const newUser = payload.user || payload;
        if (newUser) setUser(newUser as any);
        if (newToken) {
          setToken(newToken);
          try { localStorage.setItem('auth_token', newToken); } catch {}
        }
        try { if (newUser) localStorage.setItem('auth_user', JSON.stringify(newUser)); } catch {}
        return;
      }
    } catch (e) {
      // ignore and fallthrough to clearing state
    }

    // All checks failed — clear local auth
    setUser(null);
    setToken(null);
    try { localStorage.removeItem("auth_token"); localStorage.removeItem("auth_user"); } catch {}
  }

  function login(user: User, token?: string) {
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    
    setUser(user);
    
    if (user.guest) {
      setToken(null);
      localStorage.removeItem("auth_token");
      localStorage.removeItem("bmf_admin_token");
      localStorage.removeItem("auth_user");
    } else if (token) {
      setToken(token);
      // Store admin token in a different key than user token
      if (isAdmin) {
        localStorage.setItem("bmf_admin_token", token);
        // Remove any existing user token when logging in as admin
        localStorage.removeItem("auth_token");
      } else {
        localStorage.setItem("auth_token", token);
        // Remove any existing admin token when logging in as user
        localStorage.removeItem("bmf_admin_token");
      }
      localStorage.setItem("auth_user", JSON.stringify(user));
    }
  }

  async function logout() {
    const isAdmin = user?.role === 'admin' || user?.role === 'owner';
    setUser(null);
    setToken(null);

    // Clear all auth-related storage
    try {
      // Clear tokens
      localStorage.removeItem("auth_token");
      localStorage.removeItem("bmf_admin_token");
      
      // Clear user data
      localStorage.removeItem("auth_user");
      
      // Clear any cookies with different paths to ensure complete cleanup
      document.cookie = "refresh_token=; Path=/api; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      document.cookie = "refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      
      // Call appropriate server-side logout endpoint
      if (isAdmin) {
        try {
          await fetch(`${API}/api/auth/admin/logout`, { 
            method: 'POST',
            credentials: 'include' // Important: include credentials to clear cookies
          });
        } catch (e) {
          console.error('Admin logout error:', e);
        }
      } else {
        try {
          await fetch(`${API}/api/auth/logout`, { 
            method: 'POST',
            credentials: 'include' // Important: include credentials to clear cookies
          });
        } catch (e) {
          console.error('User logout error:', e);
        }
      }

      // Ensure admin API also clears its state
      try {
        const adminApi = await import('../utils/adminApi');
        adminApi.logout();
      } catch (e) {
        console.error('Admin API logout error:', e);
      }

      // Force reload the page to ensure clean state
      window.location.href = '/';
    } catch (e) {
      console.error('Logout error:', e);
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
