// src/pages/admin/AdminLogin.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminAuth } from "../../utils/adminApi";

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@local");
  const [password, setPassword] = useState("bulacan");
  const [err, setErr] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      await AdminAuth.login(email, password);
      nav("/admin", { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6 text-center">Admin Login</h1>
      <form onSubmit={onSubmit} className="rounded border p-4 space-y-3 bg-white">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input className="border rounded px-3 py-2 w-full" value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input type="password" className="border rounded px-3 py-2 w-full" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        <button className="w-full bg-primary-600 text-white rounded px-4 py-2 hover:bg-primary-700">Sign in</button>
      </form>
    </main>
  );
}
