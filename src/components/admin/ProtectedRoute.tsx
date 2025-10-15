// src/components/admin/ProtectedRoute.tsx
import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminAuth } from "../../utils/adminApi";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/me`, {
          headers: { Authorization: `Bearer ${AdminAuth.token}` }
        }).then((r) => {
          if (r.status === 401) throw new Error("401");
        });
        setOk(true);
      } catch {
        setOk(false);
        nav("/admin/login", { replace: true });
      }
    })();
  }, [nav]);

  if (ok === null) return <div className="p-6 text-center text-neutral-500">Checking session…</div>;
  if (!ok) return null;
  return <>{children}</>;
}
