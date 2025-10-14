// src/pages/admin/AdminLogin.tsx
import { useState } from 'react';

export default function AdminLogin() {
  const [email, setEmail] = useState('admin@example.com'); // ← match seeded admin
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const res = await fetch(`${API}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) { setErr((await res.json()).error || 'Login failed'); return; }
    window.location.href = '/#/admin';
  };

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Admin Login</h1>
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <form onSubmit={submit} className="space-y-3">
        <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" />
        <button className="btn btn-primary w-full">Sign in</button>
      </form>
    </div>
  );
}
