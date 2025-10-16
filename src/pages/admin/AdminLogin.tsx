import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminAuth } from "../../utils/adminApi";

export default function AdminLogin() {
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => adminAuth.login(email, password),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin:me'] });
      const to = (loc.state as any)?.from?.pathname || "/admin";
      nav(to, { replace: true });
    }
  });

  return (
    <main className="container mx-auto max-w-md py-12">
      <h1 className="text-2xl font-semibold mb-6">Admin Login</h1>
      <div className="space-y-3 bg-white p-6 rounded shadow">
        <input className="input input-bordered w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input input-bordered w-full" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn btn-primary w-full" disabled={m.isPending} onClick={()=>m.mutate()}>
          {m.isPending ? 'Signing in…' : 'Sign in'}
        </button>
        {m.isError && <div className="text-red-600 text-sm">Login failed.</div>}
      </div>
    </main>
  );
}
