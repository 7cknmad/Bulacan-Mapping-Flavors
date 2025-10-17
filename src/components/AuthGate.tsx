import React from "react";
import { login, me, isLoggedIn, logout } from "../utils/adminApi";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  React.useEffect(() => {
    if (!isLoggedIn()) return setReady(true);
    me().then(() => setReady(true)).catch(() => { logout(); setReady(true); });
  }, []);

  if (!ready) return <div className="p-6">Loading…</div>;
  if (isLoggedIn()) return <>{children}</>;

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-50">
      <div className="w-full max-w-sm bg-white border rounded-2xl p-5 shadow-sm">
        <h1 className="text-lg font-semibold mb-3">Admin sign in</h1>
        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}
        <div className="space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="w-full border rounded px-3 py-2" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          <button className="w-full rounded bg-black text-white py-2" onClick={async () => {
            try { await login(email, password); location.reload(); }
            catch (e:any) { setErr(e?.message || "Login failed"); }
          }}>Sign in</button>
        </div>
      </div>
    </div>
  );
}
