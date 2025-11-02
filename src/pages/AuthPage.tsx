import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AuthPanel from '../components/AuthPanel';
import { useAuth } from '../hooks/useAuth';

export default function AuthPage() {
  const { user } = useAuth();
  const location = useLocation();

  // If user is already logged in and has admin role, redirect to admin
  if (user) {
    if (user.role === 'admin' || user.role === 'owner') {
      // Get the return path from location state, fallback to /admin
      const from = (location.state as any)?.from?.pathname || '/admin';
      return <Navigate to={from} replace />;
    }
    // Non-admin users get redirected home
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="max-w-md w-full p-8 bg-white/95 rounded-2xl shadow-2xl">
        <h2 className="text-3xl font-bold mb-3 text-center bg-gradient-to-br from-primary-600 to-primary-800 bg-clip-text text-transparent">
          Login or Register
        </h2>
        <AuthPanel />
      </div>
    </div>
  );
}
