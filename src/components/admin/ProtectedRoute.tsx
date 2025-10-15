// src/components/admin/ProtectedRoute.tsx
import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { AdminAuth } from "../../utils/adminApi"; // ← exact casing

type Props = { children: ReactNode };

export default function ProtectedRoute({ children }: Props) {
  const location = useLocation();

  const meQ = useQuery({
    queryKey: ["admin:me"],
    queryFn: AdminAuth.me,        // should return { ok:true, user:{...} } OR { user:{...} }
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (meQ.isLoading) {
    return (
      <div className="p-6 text-sm text-neutral-500">
        Checking admin session…
      </div>
    );
  }

  const data = meQ.data as any;
  const authed = !!(data?.ok || data?.user);

  if (!authed) {
    // send them to login, and remember where they came from
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
