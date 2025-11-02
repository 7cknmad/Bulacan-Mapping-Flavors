// Entry point for Admin Dashboard
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Re-export the new admin dashboard
export { default } from '../pages/admin/AdminDashboard';

// Protect the route
function AdminRoutes() {
  const { user } = useAuth();
  const location = useLocation();

  // Check for authentication and admin role
  if (!user) {
    // User not logged in - redirect to auth with return path
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (user.role !== 'admin' && user.role !== 'owner') {
    // User logged in but not admin - redirect home
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="*" element={<AdminDashboard />} />
      </Routes>
    </Layout>
  );
}

export default function AdminApp() {
  return <AdminRoutes />;
}
