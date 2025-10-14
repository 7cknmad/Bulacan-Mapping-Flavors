// src/pages/admin/AdminLogin.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminAPI } from "../../utils/adminApi";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await AdminAPI.login(email, password);
      navigate("/admin"); // HashRouter -> #/admin (no GH Pages 404)
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Admin Login</h1>
      {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="username"
        />
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
        />
        <button
          className="btn btn-primary w-full disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
