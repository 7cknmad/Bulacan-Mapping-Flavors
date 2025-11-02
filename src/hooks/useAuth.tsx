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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // On mount, check localStorage for token
    // Restore user immediately from localStorage (fast UI) then validate token with server
    try {
      const rawUser = localStorage.getItem("auth_user");
      if (rawUser) {
        setUser(JSON.parse(rawUser));
      }
    } catch {}

    const t = localStorage.getItem("auth_token");
    if (t) {
      setToken(t);
      checkSession(t);
    }
    // eslint-disable-next-line
  }, []);

  async function checkSession(existingToken?: string) {
    const t = existingToken || token;

    // Try 1: if we have a bearer token, validate it against the server's bearer endpoint
    // The API server exposes a bearer-check at /auth/me and uses /api/auth/refresh for refresh tokens.
    if (t) {
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (res.ok) {
          const data = await res.json();
          // server may return { user } or the user object directly
          const u = data.user || data;
          setUser(u as any);
          setToken(t);
          try {
            localStorage.setItem("auth_token", t);
            localStorage.setItem("auth_user", JSON.stringify(u));
          } catch {}
          return;
        }
        // if 401, fall through to refresh attempt
      } catch (e) {
        // continue to refresh attempt
      }
    }

    // Try 2: refresh endpoint (exchanges httpOnly refresh cookie for a new access token)
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
    setUser(user);
    if (user.guest) {
      setToken(null);
      localStorage.removeItem("auth_token");
      try { localStorage.removeItem("auth_user"); } catch {}
    } else if (token) {
      setToken(token);
      localStorage.setItem("auth_token", token);
      try { localStorage.setItem("auth_user", JSON.stringify(user)); } catch {}
    }
  }

  function logout() {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    } catch {}
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
