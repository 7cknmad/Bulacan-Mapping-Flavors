import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LoginSuccessModal from "./welcome/LoginSuccessModal";
import { setUserToken, clearAllTokens } from "../utils/authStorage";

export default function LoginForm({ onLogin }: { onLogin?: (user: any, token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalUser, setModalUser] = useState<{ displayName?: string; isNewUser?: boolean } | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      // Regular user login only
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      // Don't allow admin login through regular login form
      if (data.user.role === 'admin' || data.user.role === 'owner') {
        throw new Error('Please use the admin login page');
      }

      setSuccess(true);
      // Clear any existing tokens before login
      clearAllTokens();

      // Set user token and login
      setUserToken(data.token);
      login(data.user, data.token);

      // Detect new vs returning user
      const isNewUser = !localStorage.getItem('bmf_has_logged_in');
      localStorage.setItem('bmf_has_logged_in', 'true');
      sessionStorage.setItem('hasShownWelcome', 'false'); // Reset welcome toast for this session

      if (onLogin) onLogin(data.user, data.token);

      // Show modal popup with greeting/loading before redirect
      setModalUser({ displayName: data.user.displayName || data.user.email, isNewUser });
      setShowModal(true);
      setTimeout(() => {
        setShowModal(false);
        navigate('/map');
      }, 1600); // Show modal for 1.6 seconds before redirect
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {showModal && modalUser && (
        <LoginSuccessModal displayName={modalUser.displayName} isNewUser={modalUser.isNewUser} />
      )}
      <form className="space-y-4" onSubmit={handleLogin}>
        <h2 className="text-lg font-semibold">Login</h2>
        <input
          type="email"
          className="w-full border rounded p-2 text-neutral-800 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-neutral-400"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="username"
          disabled={loading}
        />
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            className="w-full border rounded p-2 pr-10 text-neutral-800 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-neutral-400"
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
          {loading ? "Logging in..." : "Login"}
        </button>
        {success && <div className="text-green-600">Login successful! Redirecting...</div>}
        {error && <div className="text-red-600">{error}</div>}
      </form>
    </>
  );
}
