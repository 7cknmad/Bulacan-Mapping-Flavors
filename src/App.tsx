// src/App.tsx
import React, { Suspense } from "react";
import { HashRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";

import Layout from "./components/layout/Layout";
import PageTransition from "./components/common/PageTransition";
import ErrorBoundary from "./components/common/ErrorBoundary"; // ← use your existing one

import HomePage from "./pages/HomePage";
import MapExplorer from "./pages/MapExplorer";
import DishesPage from "./pages/DishesPage";
import DishDetails from "./pages/DishDetails";
import RestaurantList from "./pages/RestaurantList";
import RestaurantDetails from "./pages/RestaurantDetails";
import Admin from "./pages/Admin";
import AdminDashboard from "./pages/AdminDashboard";

const queryClient = new QueryClient();

function Routed() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
        <Route path="/map" element={<PageTransition><MapExplorer /></PageTransition>} />
        <Route path="/dishes" element={<PageTransition><DishesPage /></PageTransition>} />
        <Route path="/dish/:slug" element={<PageTransition><DishDetails /></PageTransition>} />
        <Route path="/restaurants" element={<PageTransition><RestaurantList /></PageTransition>} />
        <Route path="/restaurant/:slug" element={<PageTransition><RestaurantDetails /></PageTransition>} />
        <Route path="/admin" element={<PageTransition><Admin /></PageTransition>} />
        <Route path="/admin/*" element={<PageTransition><AdminDashboard /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ErrorBoundary fallbackTitle="Something went wrong">
          <Suspense fallback={<div className="p-6 text-center text-neutral-500">Loading…</div>}>
            <Layout>
              <Routed />
            </Layout>
          </Suspense>
        </ErrorBoundary>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
