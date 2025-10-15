// src/components/admin/ProtectedRoute.tsx
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminAuth } from "../../utils/adminApi";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const q = useQuery({
    queryKey: ["admin:me"],
    queryFn: adminAuth.me,
    retry: false,
  });

  if (q.isLoading) {
    return (
      <div className="p-6 text-center text-neutral-500">
        Checking admin session…
      </div>
    );
  }

  // not authenticated
  if (q.isError) {
    return <Navigate to="/admin/login" state={{ from: loc }} replace />;
  }

  return <>{children}</>;
}
