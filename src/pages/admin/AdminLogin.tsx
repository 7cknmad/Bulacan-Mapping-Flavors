import { useState } from "react";
import { useNavigate } from "react-router-dom";
// 👇 exact casing matters on GitHub Actions (Linux)
import { AdminAuth } from "../../utils/adminApi";

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await AdminAuth.login(email, passwordTrim(pw));
      nav("/admin", { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Admin Login</h1>
      <form onSubmit={submit} className="border rounded p-4 space-y-3 bg-white">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Email</label>
          <input
            className="border rounded px-3 py-2"
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Password</label>
          <input
            className="border rounded px-3 py-2"
            type="password"
            value={pw}
            onChange={(e)=>setPw(e.target.value)}
            required
          />
        </div>
        {err && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {err}
          </div>
        )}
        <button
          disabled={busy}
          className="w-full rounded bg-primary-600 text-white py-2 hover:bg-primary-700"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-xs text-neutral-500 mt-2">
          Uses <code>ADMIN_EMAIL</code> / <code>ADMIN_PASSWORD</code> from your API env.
        </p>
      </form>
    </main>
  );
}

function passwordTrim(p: string) {
  // tiny helper so trailing spaces copied from clipboard don't cause “invalid credentials”
  return p.replace(/\s+$/,'');
}
