// src/pages/admin/AdminLogin.tsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { adminAuth } from "../../utils/adminApi";

export default function AdminLogin() {
  const nav = useNavigate();
  const loc = useLocation() as any;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await adminAuth.login(email.trim(), password);
      const to = loc?.state?.from?.pathname ?? "/admin";
      nav(to, { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Admin Dashboard — Login</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        {err && <div className="p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded">{err}</div>}
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@bulacan.local"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <button className="btn btn-primary px-4 py-2" disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
