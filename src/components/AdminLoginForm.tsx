import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { setAdminToken, clearAllTokens } from "../utils/authStorage";

export default function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      if (!data.user || (data.user.role !== 'admin' && data.user.role !== 'owner')) {
        throw new Error('This account does not have administrative privileges');
      }
      
      // Clear any existing tokens and store admin token
      clearAllTokens();
      setAdminToken(data.token);
      
      // Use useAuth's login function to set the user context
      login(data.user, data.token);
      
      // Redirect to admin dashboard or return URL
      const from = (location.state as any)?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleLogin}>
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Admin Login</h2>
        <div className="text-sm text-blue-700">
          This login is for administrators only. Regular users should use the standard login page.
        </div>
      </div>
      <input
        type="email"
        className="w-full border rounded p-2"
        placeholder="Admin Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        autoComplete="username"
        disabled={loading}
      />
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          className="w-full border rounded p-2 pr-10"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={loading}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-500 hover:text-neutral-700"
          onClick={() => setShowPassword(v => !v)}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      <button
        type="submit"
        className="w-full bg-primary-600 text-white rounded py-2 hover:bg-primary-700 disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Logging in..." : "Admin Login"}
      </button>
      {error && <div className="text-red-600">{error}</div>}
    </form>
  );
}