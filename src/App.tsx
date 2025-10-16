
import React, { Suspense } from "react";
import { HashRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";

import Layout from "./components/layout/Layout";
import PageTransition from "./components/common/PageTransition";
import ErrorBoundary from "./components/common/ErrorBoundary";
import ScrollToTop from "./components/common/ScrollToTop";

import HomePage from "./pages/HomePage";
import MapExplorer from "./pages/MapExplorer";
import DishesPage from "./pages/DishesPage";
import DishDetails from "./pages/DishDetails";
import RestaurantList from "./pages/RestaurantList";
import RestaurantDetails from "./pages/RestaurantDetails";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ProtectedRoute from "./components/admin/ProtectedRoute";

const queryClient = new QueryClient();

function PublicRoutes() {
  const location = useLocation();
  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
          <Route path="/map" element={<PageTransition><MapExplorer /></PageTransition>} />
          <Route path="/dishes" element={<PageTransition><DishesPage /></PageTransition>} />
          <Route path="/dish/:slug" element={<PageTransition><DishDetails /></PageTransition>} />
          <Route path="/restaurants" element={<PageTransition><RestaurantList /></PageTransition>} />
          <Route path="/restaurant/:slug" element={<PageTransition><RestaurantDetails /></PageTransition>} />

          {/* Redirect stray /admin to /admin/login to avoid white pages if someone lands there */}
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
          {/* 404 for anything else not matched */}
          <Route path="*" element={<PageTransition><div className="p-8 text-center">Page not found.</div></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}

function AdminRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/admin/login" element={<PageTransition><AdminLogin /></PageTransition>} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <PageTransition><AdminDashboard /></PageTransition>
            </ProtectedRoute>
          }
        />
        {/* Optional: if someone types a weird admin sub-path */}
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith("/admin");
  return isAdminPath ? <AdminRoutes /> : <PublicRoutes />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ErrorBoundary fallbackTitle="Something went wrong">
          <ScrollToTop />
          <Suspense fallback={<div className="p-6 text-center text-neutral-500">Loading…</div>}>
            <AppRoutes />
          </Suspense>
        </ErrorBoundary>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
