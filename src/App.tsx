import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HashRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from './pages/HomePage';
import MapExplorer from './pages/MapExplorer';
import DishesPage from "./pages/DishesPage";
import DishDetails from './pages/DishDetails';
import RestaurantDetails from './pages/RestaurantDetails';
import RestaurantList from './pages/RestaurantList';
import AdminDashboard from './pages/AdminDashboard';
import { AnimatePresence } from "framer-motion";
import Layout from "./components/layout/Layout";
import PageTransition from "./components/common/PageTransition";
import Admin from './pages/Admin';

const queryClient = new QueryClient();

function Routed() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={<PageTransition><HomePage /></PageTransition>}
        />
        <Route path="/admin" element={<Admin />} 
        />
        <Route
          path="/map"
          element={<PageTransition><MapExplorer /></PageTransition>}
        />
        <Route
          path="/dishes"
          element={<PageTransition><DishesPage /></PageTransition>}
        />
        <Route
          path="/dish/:id"
          element={<PageTransition><DishDetails /></PageTransition>}
        />
        <Route
          path="/restaurants"
          element={<PageTransition><RestaurantList /></PageTransition>}
        />
        <Route
          path="/restaurant/:id"
          element={<PageTransition><RestaurantDetails /></PageTransition>}
        />
        <Route
          path="/admin/*"
          element={<PageTransition><AdminDashboard /></PageTransition>}
        />
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
