import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function LoginForm({ onLogin }: { onLogin?: (user: any, token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
  const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setSuccess(true);
      // Use central auth handler to persist and notify the app
      try {
        login(data.user, data.token);
      } catch {}
      if (onLogin) onLogin(data.user, data.token);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleLogin}>
      <h2 className="text-lg font-semibold">Login</h2>
      <input
        type="email"
        className="w-full border rounded p-2"
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
        {loading ? "Logging in..." : "Login"}
      </button>
      {success && <div className="text-green-600">Login successful! Redirecting...</div>}
      {error && <div className="text-red-600">{error}</div>}
    </form>
  );
}
