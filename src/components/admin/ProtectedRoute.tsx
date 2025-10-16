// src/components/admin/ProtectedRoute.tsx
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminAuth } from "../../utils/adminApi";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const meQ = useQuery({ queryKey: ["admin:me"], queryFn: adminAuth.me, staleTime: 60_000 });

  if (meQ.isLoading) {
    return <div className="p-6 text-center text-neutral-500">Checking session…</div>;
  }
  // If not logged in, redirect to login and keep the "from" location
  if (!meQ.data?.user) {
    return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  }
  return <>{children}</>;
}
