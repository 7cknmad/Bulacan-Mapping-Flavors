// src/components/AuthGate.tsx
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { me, login, logout } from "../utils/authApi";

function Field({ label, children, error }: any) {
  return (
    <label className="block">
      <div className="text-xs text-neutral-600 mb-1">{label}</div>
      {children}
      {error ? <div className="text-xs text-red-600 mt-1">{error}</div> : null}
    </label>
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ["auth:me"], queryFn: me, retry: false });

  const logoutM = useMutation({
    mutationFn: logout,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth:me"] }),
  });

  if (meQ.isLoading) {
    return <div className="p-6 text-sm text-neutral-500">Checking session…</div>;
  }

  if (meQ.isError) {
    return <LoginCard />;
  }

  // Optional top-right logout strip (non-invasive)
  return (
    <div>
      <div className="flex justify-end p-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-600">
            {meQ.data?.user?.name || meQ.data?.user?.email || "Admin"}
          </span>
          <button
            onClick={() => logoutM.mutate()}
            className="px-3 py-1.5 border rounded-xl hover:bg-neutral-50"
          >
            Logout
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function LoginCard() {
  const qc = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const loginM = useMutation({
    mutationFn: login,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth:me"] }),
    onError: (e: any) => setError(e?.message || "Login failed"),
  });

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border rounded-2xl shadow-sm p-5">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Admin Login</h1>
          <p className="text-xs text-neutral-500">Bulacan – Mapping Flavors</p>
        </div>
        <div className="space-y-3">
          <Field label="Email">
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field label="Password" error={error || undefined}>
            <input
              className="w-full rounded-xl border px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <button
            className="w-full rounded-xl bg-neutral-900 text-white py-2 disabled:opacity-60"
            onClick={() => loginM.mutate({ email, password })}
            disabled={loginM.isPending || !email || !password}
          >
            {loginM.isPending ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <div className="text-[11px] text-neutral-500 mt-3">
          You must be authorized to access the Admin Dashboard.
        </div>
      </div>
    </div>
  );
}
