// src/components/layout/Layout.tsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const isMapPage = pathname === '/map' || pathname.startsWith('/map/');

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* Show header everywhere except admin routes */}
      {!isAdmin && <Header />}
      <main className={isAdmin ? '' : 'flex-1'}>
        {children}
      </main>
      {/* Show footer everywhere except admin and map routes */}
      {!isAdmin && !isMapPage && <Footer />}
    </div>
  );
}
