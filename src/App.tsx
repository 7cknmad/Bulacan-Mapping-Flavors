// src/App.tsx (only public routes)
import { Suspense } from "react";
import { HashRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import Layout from "./components/layout/Layout";
import { useAuth } from "./hooks/useAuth";

// Admin route protection
function RequireAdminAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Not logged in, redirect to login page with return path
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (user.role !== 'admin' && user.role !== 'owner') {
    // Logged in but not admin, redirect to home
    return <Navigate to="/" replace />;
  }

  // Authorized, render children
  return <>{children}</>;
}
import PageTransition from "./components/common/PageTransition";
import ErrorBoundary from "./components/common/ErrorBoundary";
import ScrollToTop from "./components/common/ScrollToTop";
import NavigationProgress from './components/common/NavigationProgress';
import HomePage from "./pages/HomePage";
import MapExplorer from "./pages/MapExplorer";
import DishesPage from "./pages/DishesPage";
import TopDishes from "./pages/TopDishes";
import DishDetails from "./pages/DishDetails";
import RestaurantList from "./pages/RestaurantList";
import RestaurantDetails from "./pages/RestaurantDetails";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AuthGate from "./components/AuthGate";
import { AuthProvider } from "./hooks/useAuth";
import ToastProvider from './components/ToastProvider';
import AuthPage from "./pages/AuthPage";
import { useEffect } from 'react';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status && error.status >= 400 && error.status < 500) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      onError: (error: any) => {
        console.error('Query error:', {
          message: error?.message,
          status: error?.status,
          data: error?.data,
          url: error?.url
        });
      }
    },
    mutations: {
      retry: (failureCount, error: any) => {
        if (error?.status && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      onError: (error: any) => {
        console.error('Mutation error:', {
          message: error?.message,
          status: error?.status,
          data: error?.data,
          url: error?.url
        });
      }
    }
  }
});

function Routed() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Layout>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
          <Route path="/map" element={<PageTransition><MapExplorer /></PageTransition>} />
          <Route path="/dishes" element={<PageTransition><DishesPage /></PageTransition>} />
          <Route path="/dishes/top" element={<PageTransition><TopDishes /></PageTransition>} />
          <Route path="/dish/:slug" element={<PageTransition><DishDetails /></PageTransition>} />
          <Route path="/restaurants" element={<PageTransition><RestaurantList /></PageTransition>} />
          <Route path="/admin/*" element={
            <RequireAdminAuth>
              <AdminDashboard />
            </RequireAdminAuth>
          } />
          <Route path="/restaurant/:slug" element={<PageTransition><RestaurantDetails /></PageTransition>} />
          <Route path="/auth" element={<PageTransition><AuthPage /></PageTransition>} />
          {/* Admin temporarily removed while we rebuild it in a separate app */}
        </Routes>
      </Layout>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Router>
            {/* Navigation progress bar (shows during route changes) */}
            <NavigationProgress />
            <ErrorBoundary fallbackTitle="Something went wrong">
              <ScrollToTop />
              <Suspense fallback={<div className="p-6 text-center text-neutral-500">Loading…</div>}>
                <Routed />
              </Suspense>
            </ErrorBoundary>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
