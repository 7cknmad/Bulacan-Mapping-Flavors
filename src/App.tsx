// src/App.tsx
import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';

import HomePage from './pages/HomePage';
import MapExplorer from './pages/MapExplorer';
import DishesPage from './pages/DishesPage';
import DishDetails from './pages/DishDetails';
import RestaurantDetails from './pages/RestaurantDetails';
import RestaurantList from './pages/RestaurantList';
import Admin from './pages/Admin';
// If you actually need AdminDashboard, give it a distinct path like /admin/dashboard
// import AdminDashboard from './pages/AdminDashboard';

import Layout from './components/layout/Layout';
import PageTransition from './components/common/PageTransition';

const queryClient = new QueryClient();

function Routed() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />

        {/* Admin quick-entry page */}
        <Route path="/admin" element={<PageTransition><Admin /></PageTransition>} />
        {/* If needed: <Route path="/admin/dashboard" element={<PageTransition><AdminDashboard /></PageTransition>} /> */}

        <Route path="/map" element={<PageTransition><MapExplorer /></PageTransition>} />
        <Route path="/dishes" element={<PageTransition><DishesPage /></PageTransition>} />
        
        {/* Use :slug to match your links like /dish/${dish.slug} */}
        <Route path="/dish/:slug" element={<PageTransition><DishDetails /></PageTransition>} />

        <Route path="/restaurants" element={<PageTransition><RestaurantList /></PageTransition>} />
        {/* Same: use :slug if you link by slug */}
        <Route path="/restaurant/:slug" element={<PageTransition><RestaurantDetails /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routed />
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}
