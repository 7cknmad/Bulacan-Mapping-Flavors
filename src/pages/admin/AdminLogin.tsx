import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminAuth } from "../../utils/adminApi";

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await adminAuth.login(email.trim(), password);
      nav("/admin", { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white border rounded-xl shadow p-6 space-y-4"
      >
        <div>
          <h1 className="text-xl font-semibold">Admin Login</h1>
          <p className="text-sm text-neutral-500">Sign in to manage content.</p>
        </div>

        {err && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {err}
          </div>
        )}

        <label className="block">
          <span className="text-sm text-neutral-700">Email</span>
          <input
            type="email"
            required
            className="mt-1 w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="text-sm text-neutral-700">Password</span>
          <input
            type="password"
            required
            className="mt-1 w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded px-3 py-2 transition disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
