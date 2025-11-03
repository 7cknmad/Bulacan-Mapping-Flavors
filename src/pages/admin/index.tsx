import { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, UtensilsCrossed, Store, Star, Settings } from 'lucide-react';
import AnalyticsTab from './AnalyticsTab';
import DishesTab from './DishesTab';
import RestaurantsTab from './RestaurantsTab'; 
import CurationTab from './CurationTab';
import RecommendationsPage from './RecommendationsPage';

export default function AdminDashboard() {
  const location = useLocation();
  const currentPath = location.pathname.split('/').pop() || '';

  const getNavLinkClass = (path: string) => {
    const baseClasses = "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition";
    const activeClasses = "border-primary-600 text-primary-600";
    const inactiveClasses = "border-transparent text-neutral-600 hover:text-neutral-900";
    
    return `${baseClasses} ${currentPath === path ? activeClasses : inactiveClasses}`;
  };

  return (
    <div className="min-h-screen bg-neutral-50/50">
      {/* Navigation */}
      <nav className="sticky top-0 z-30 bg-white border-b">
        <div className="flex overflow-x-auto">
          <Link to="/admin" className={getNavLinkClass('admin')}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link to="/admin/dishes" className={getNavLinkClass('dishes')}>
            <UtensilsCrossed className="w-4 h-4" />
            Dishes
          </Link>
          <Link to="/admin/restaurants" className={getNavLinkClass('restaurants')}>
            <Store className="w-4 h-4" />
            Restaurants
          </Link>
          <Link to="/admin/curation" className={getNavLinkClass('curation')}>
            <Star className="w-4 h-4" />
            Curation
          </Link>
          <Link to="/admin/recommendations" className={getNavLinkClass('recommendations')}>
            <Settings className="w-4 h-4" />
            Recommendations
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route index element={<AnalyticsTab />} />
          <Route path="dishes" element={<DishesTab />} />
          <Route path="restaurants" element={<RestaurantsTab />} />
          <Route path="curation" element={<CurationTab />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="users" element={<div>Users page coming soon</div>} />
          <Route path="municipalities" element={<div>Municipalities page coming soon</div>} />
          <Route path="media" element={<div>Media Library coming soon</div>} />
          <Route path="settings" element={<div>Settings page coming soon</div>} />
        </Routes>
      </div>
    </div>
  );
}