// src/components/admin/ProtectedRoute.tsx
import { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminAuth } from "../../utils/adminApi";

export default function ProtectedRoute({ children }: PropsWithChildren) {
  const loc = useLocation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin:me"],
    queryFn: adminAuth.me,
    // we want to refetch when focusing back (session might expire)
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return <div className="p-6 text-center text-neutral-500">Checking session…</div>;
  }
  // If /me fails (401), redirect to login
  if (!data || (error && (error as any)?.message?.includes("401"))) {
    return <Navigate to="/admin/login" replace state={{ from: loc }} />;
  }
  return <>{children}</>;
}
