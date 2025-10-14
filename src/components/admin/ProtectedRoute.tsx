import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { adminAuth } from "../../utils/adminApi";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const meQ = useQuery({
    queryKey: ["admin:me"],
    queryFn: adminAuth.me,
    retry: false,
    staleTime: 30_000,
  });

  if (meQ.isLoading) {
    return (
      <div className="p-6 text-center text-neutral-500">Checking session…</div>
    );
  }

  const ok = meQ.data?.ok;
  if (!ok) {
    return <Navigate to="/admin/login" replace state={{ from: loc }} />;
  }

  return <>{children}</>;
}
