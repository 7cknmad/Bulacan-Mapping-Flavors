// src/App.tsx (only public routes)
import { Suspense } from "react";
import { HashRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import Layout from "./components/layout/Layout";
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
import AuthPage from "./components/AuthPage";
import { useEffect } from 'react';
const queryClient = new QueryClient();

function Routed() {
  const location = useLocation();

  function RedirectToJoin() {
    useEffect(() => {
      // If user navigates to /auth, send them to home and scroll to the join-us section.
      // Set the hash to the anchor and also trigger a scroll after a short delay.
      try {
        window.location.href = '/#join-us';
      } catch (e) {
        // fallback: set hash
        window.location.hash = '#join-us';
      }
    }, []);
    return null;
  }
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
        <Route path="/map" element={<PageTransition><MapExplorer /></PageTransition>} />
        <Route path="/dishes" element={<PageTransition><DishesPage /></PageTransition>} />
  <Route path="/dishes/top" element={<PageTransition><TopDishes /></PageTransition>} />
        <Route path="/dish/:slug" element={<PageTransition><DishDetails /></PageTransition>} />
        <Route path="/restaurants" element={<PageTransition><RestaurantList /></PageTransition>} />
        <Route path="/admin" element={<AuthGate><AdminDashboard /></AuthGate>} />
        <Route path="/restaurant/:slug" element={<PageTransition><RestaurantDetails /></PageTransition>} />
  <Route path="/auth" element={<PageTransition><RedirectToJoin /></PageTransition>} />
        {/* Admin temporarily removed while we rebuild it in a separate app */}
      </Routes>
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
                <Layout>
                  <Routed />
                </Layout>
              </Suspense>
            </ErrorBoundary>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
