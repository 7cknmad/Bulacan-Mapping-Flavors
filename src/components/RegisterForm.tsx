import React, { useState, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";

function passwordStrength(pw: string) {
  let score = 0;
  if (!pw) return { score: 0, label: 'Too short' };
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Very weak','Weak','Okay','Good','Strong'];
  return { score: Math.min(score,4), label: labels[Math.min(score,4)] };
}

export default function RegisterForm({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const { score, label } = useMemo(() => passwordStrength(password), [password]);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!emailValid) { setError('Please enter a valid email'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Registration failed");
      // If API returned token and user, auto-login
      if (data && data.token && data.user) {
        try { login(data.user, data.token); } catch (err) {}
      }
      setSuccess(true);
      setEmail("");
      setPassword("");
      setDisplayName("");
      if (onSuccess) onSuccess();
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleRegister}>
      <h2 className="text-lg font-semibold">Register</h2>
      <div>
        <label className="text-xs text-neutral-600">Email</label>
        <input
          type="email"
          className="w-full border rounded p-2"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          aria-invalid={!emailValid}
        />
        {!emailValid && email.length > 0 && <div className="text-xs text-red-600">Enter a valid email address</div>}
      </div>

      <div>
        <label className="text-xs text-neutral-600">Display name (optional)</label>
        <input
          type="text"
          className="w-full border rounded p-2"
          placeholder="Display Name (optional)"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-neutral-600">Password</label>
        <input
          type="password"
          className="w-full border rounded p-2"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          aria-describedby="pw-strength"
        />
        <div id="pw-strength" className="mt-2 flex items-center gap-3">
          <div className="w-24 h-2 bg-gray-200 rounded overflow-hidden">
            <div style={{ width: `${(score/4)*100}%` }} className={`h-full ${score >= 3 ? 'bg-green-500' : score === 2 ? 'bg-yellow-400' : 'bg-red-500'}`} />
          </div>
          <div className="text-xs text-neutral-600">{label}</div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-primary-600 text-white rounded py-2 hover:bg-primary-700 disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Registering..." : "Register"}
      </button>
      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-600">Registration successful! You are now logged in.</div>}
    </form>
  );
}
