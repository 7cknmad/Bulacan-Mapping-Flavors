import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { adminAuth } from "../../utils/adminApi";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const meQ = useQuery({ queryKey: ['admin:me'], queryFn: adminAuth.me, retry: false });
  if (meQ.isLoading) return <div className="p-6">Checking session…</div>;
  if (meQ.isError || !meQ.data) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  return children;
}
