// src/components/admin/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const q = useQuery({
    queryKey: ["admin:me"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/me`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("unauth");
      return res.json();
    },
    retry: false,
  });

  if (q.isLoading) return <div className="p-6 text-center">Checking session…</div>;
  if (q.error) return <Navigate to="/admin/login" replace />;
  return children;
}
