import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SearchIcon, MenuIcon, XIcon, SunIcon, MoonIcon } from 'lucide-react';
import SearchBar from '../common/SearchBar';
import { useAuth } from '../../hooks/useAuth';
// MapSidebarContent removed; FloatingPanels used on map route
import FloatingRail from './FloatingRail';
const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const location = useLocation();
  // control nav visibility: hidden on homepage until user reaches end of intro slides
  const [showNav, setShowNav] = useState(location.pathname !== '/');
  useEffect(() => {
    const onNavVisible = (e: Event) => {
      const detail = (e as CustomEvent<{ visible: boolean }>).detail;
      setShowNav(Boolean(detail?.visible));
    };
    window.addEventListener('nav:visible', onNavVisible as EventListener);
    return () => window.removeEventListener('nav:visible', onNavVisible as EventListener);
  }, []);
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const toggleHighContrast = () => {
    setHighContrast(!highContrast);
    // Apply high contrast styles to the body
    document.body.classList.toggle('high-contrast');
  };
  const { user, logout } = useAuth();
  const baseClass = isScrolled ? 'bg-white shadow-md py-2' : 'bg-transparent py-4';
  const isMapRoute = location.pathname.startsWith('/map');
  const isDishesRoute = location.pathname.startsWith('/dish') || location.pathname.startsWith('/dishes');
  function scrollToJoin() {
    const el = document.getElementById('join-us');
    if (el) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const firstControl = el.querySelector('input,button,textarea,select') as HTMLElement | null;
        if (firstControl && typeof firstControl.focus === 'function') {
          // focus after a small delay to allow smooth scroll to finish
          setTimeout(() => firstControl.focus(), 350);
        }
      } catch (e) {
        // fallback: set the hash
        window.location.hash = '#join-us';
      }
    } else {
      // if element not present, navigate to home with hash
      window.location.href = '/#join-us';
    }
  }
  useEffect(() => {
    if (isMapRoute) {
      // notify panels to reset/select default when arriving on /map
      window.dispatchEvent(new CustomEvent('map:sidebarClear'));
      window.dispatchEvent(new CustomEvent('map:sidebarOpen', { detail: { tab: 'recent' } }));
    }
  }, [isMapRoute]);

  useEffect(() => {
    const onOpenSearch = () => setIsSearchOpen(true);
    window.addEventListener('header:openSearch', onOpenSearch as EventListener);
    return () => window.removeEventListener('header:openSearch', onOpenSearch as EventListener);
  }, []);

  // If we're on the map route, render only the floating panels (no top header)
  if (isMapRoute) {
    return (
      <>
        <FloatingRail />

        {/* Global Search modal (kept available while on map route) */}
        {isSearchOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Search</h3>
                <button onClick={() => setIsSearchOpen(false)} className="p-1 rounded-full hover:bg-neutral-100 transition-colors" aria-label="Close search">
                  <XIcon size={20} />
                </button>
              </div>
              {/* SearchBar accepts an onClose callback; cast to any to avoid prop typing mismatch */}
              {(SearchBar as any)({ onClose: () => setIsSearchOpen(false) })}
            </div>
          </div>
        </div>}
      </>
    );
  }

  return <header className={`w-full fixed top-0 z-50 transition-all duration-300 ${baseClass} ${showNav ? '' : 'opacity-0 pointer-events-none'}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src="https://via.placeholder.com/40" alt="Mapping Filipino Flavors Logo" className="h-10 w-10 mr-2" />
            <span className="font-display font-bold text-lg md:text-xl text-primary-700">
              Mapping Filipino Flavors
            </span>
          </Link>
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/" className={`font-medium hover:text-primary-600 transition-colors ${location.pathname === '/' ? 'text-primary-600' : 'text-neutral-800'}`}>
              Home
            </Link>
            <Link to="/map" className={`font-medium hover:text-primary-600 transition-colors ${location.pathname === '/map' ? 'text-primary-600' : 'text-neutral-800'}`}>
              Explore Map
            </Link>
            <Link to="/dishes" className={`font-medium hover:text-primary-600 transition-colors ${isDishesRoute ? 'text-primary-600' : 'text-neutral-800'}`}>
              Dishes
            </Link>
            <Link to="/restaurants" className={`font-medium hover:text-primary-600 transition-colors ${location.pathname === '/restaurants' ? 'text-primary-600' : 'text-neutral-800'}`}>
              Restaurants
            </Link>
            <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded-full hover:bg-neutral-100 transition-colors" aria-label="Search">
              <SearchIcon size={20} />
            </button>
            <button onClick={toggleHighContrast} className="p-2 rounded-full hover:bg-neutral-100 transition-colors" aria-label={highContrast ? 'Disable high contrast' : 'Enable high contrast'}>
              {highContrast ? <SunIcon size={20} /> : <MoonIcon size={20} />}
            </button>
            {user ? (
              <>
                <span className="font-medium text-primary-700">{user.displayName || user.email}</span>
                <button
                  onClick={logout}
                  className="ml-2 px-3 py-1 rounded bg-neutral-100 hover:bg-red-100 text-red-600 font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  if (location.pathname === '/') scrollToJoin();
                  else window.location.href = '/#join-us';
                }}
                className="ml-2 px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 font-medium"
              >
                Login
              </button>
            )}
          </nav>
          {/* Mobile Navigation */}
          <div className="flex items-center md:hidden">
            <button onClick={() => setIsSearchOpen(true)} className="p-2 mr-2 rounded-full hover:bg-neutral-100 transition-colors" aria-label="Search">
              <SearchIcon size={20} />
            </button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-full hover:bg-neutral-100 transition-colors" aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}>
              {isMenuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
            </button>
          </div>
        </div>
      </div>
      {/* map-route floating panels handled elsewhere */}
      {/* Mobile Menu */}
  {isMenuOpen && <div className="md:hidden bg-white shadow-lg">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex flex-col space-y-4">
              <Link to="/" className={`font-medium hover:text-primary-600 transition-colors ${location.pathname === '/' ? 'text-primary-600' : 'text-neutral-800'}`} onClick={() => setIsMenuOpen(false)}>
                Home
              </Link>
              <Link to="/map" className={`font-medium hover:text-primary-600 transition-colors ${location.pathname === '/map' ? 'text-primary-600' : 'text-neutral-800'}`} onClick={() => setIsMenuOpen(false)}>
                Explore Map
              </Link>
              <Link to="/dishes" className={`font-medium hover:text-primary-600 transition-colors ${isDishesRoute ? 'text-primary-600' : 'text-neutral-800'}`} onClick={() => setIsMenuOpen(false)}>
                Dishes
              </Link>
              <Link to="/restaurants" className={`font-medium hover:text-primary-600 transition-colors ${location.pathname === '/restaurants' ? 'text-primary-600' : 'text-neutral-800'}`} onClick={() => setIsMenuOpen(false)}>
                Restaurants
              </Link>
              <button onClick={() => {
            toggleHighContrast();
            setIsMenuOpen(false);
          }} className="flex items-center font-medium text-neutral-800 hover:text-primary-600 transition-colors">
                {highContrast ? <SunIcon size={20} className="mr-2" /> : <MoonIcon size={20} className="mr-2" />}
                {highContrast ? 'Disable High Contrast' : 'Enable High Contrast'}
              </button>
              {user ? (
                <>
                  <span className="font-medium text-primary-700">{user.displayName || user.email}</span>
                  <button
                    onClick={() => { logout(); setIsMenuOpen(false); }}
                    className="mt-2 px-3 py-1 rounded bg-neutral-100 hover:bg-red-100 text-red-600 font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (location.pathname === '/') scrollToJoin();
                    else window.location.href = '/#join-us';
                  }}
                  className="mt-2 px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 font-medium"
                >
                  Login
                </button>
              )}
            </nav>
          </div>
        </div>}
      {/* Global Search */}
      {isSearchOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Search</h3>
                <button onClick={() => setIsSearchOpen(false)} className="p-1 rounded-full hover:bg-neutral-100 transition-colors" aria-label="Close search">
                  <XIcon size={20} />
                </button>
              </div>
              {/* SearchBar accepts an onClose callback; cast to any to avoid prop typing mismatch */}
              {(SearchBar as any)({ onClose: () => setIsSearchOpen(false) })}
            </div>
          </div>
        </div>}
    </header>;
};
export default Header;