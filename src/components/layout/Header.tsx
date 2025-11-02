import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  SearchIcon, MenuIcon, XIcon, SunIcon, MoonIcon,
  UserIcon, LogOutIcon, BellIcon, SettingsIcon,
  ChevronDownIcon
} from 'lucide-react';
import SearchBar from '../common/SearchBar';
import { useAuth } from '../../hooks/useAuth';
import FloatingRail from './FloatingRail';

// Animation variants for menu items
const menuItemVariants = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 }
};
const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement>(null);
  // control nav visibility: visible by default
  const [showNav, setShowNav] = useState(true);
  useEffect(() => {
    const onNavVisible = (e: Event) => {
      const detail = (e as CustomEvent<{ visible: boolean }>).detail;
      setShowNav(detail?.visible !== false); // Default to true if detail.visible is undefined
    };
    window.addEventListener('nav:visible', onNavVisible as EventListener);
    return () => window.removeEventListener('nav:visible', onNavVisible as EventListener);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close menus on escape
      if (e.key === 'Escape') {
        setIsProfileOpen(false);
        setIsMenuOpen(false);
        setIsSearchOpen(false);
      }

      // Toggle search on Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }

      // Focus search bar when search is open
      if (isSearchOpen) {
        const searchInput = document.querySelector('input[type="search"]');
        if (searchInput instanceof HTMLElement) {
          searchInput.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);
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

  // Handle click outside of profile dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
              <SearchBar onClose={() => setIsSearchOpen(false)} />
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
          <Link 
            to="/" 
            className="group flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <div className="relative">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xl transform transition-transform group-hover:scale-105 shadow-sm">
                MF
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold transform transition-transform group-hover:scale-110 shadow-sm">
                B
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg text-primary-700 leading-tight">
                Mapping Filipino
              </span>
              <span className="font-display font-bold text-sm text-accent leading-tight">
                Bulacan Edition
              </span>
            </div>
          </Link>
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {[
              { to: '/', label: 'Home', active: location.pathname === '/' },
              { to: '/map', label: 'Explore Map', active: location.pathname === '/map' },
              { to: '/dishes', label: 'Dishes', active: isDishesRoute },
              { to: '/restaurants', label: 'Restaurants', active: location.pathname === '/restaurants' }
            ].map((item, index) => (
              <Link
                key={item.to}
                to={item.to}
                className={`relative font-medium transition-all duration-300 group ${
                  item.active ? 'text-primary-600' : 'text-neutral-800 hover:text-primary-600'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {item.label}
                <span className={`absolute inset-x-0 bottom-0 h-0.5 transform transition-transform duration-300 ${
                  item.active ? 'bg-primary-600 scale-x-100' : 'bg-primary-400 scale-x-0 group-hover:scale-x-100'
                }`} />
              </Link>
            ))}
            <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded-full hover:bg-neutral-100 transition-colors" aria-label="Search">
              <SearchIcon size={20} />
            </button>
            <button onClick={toggleHighContrast} className="p-2 rounded-full hover:bg-neutral-100 transition-colors" aria-label={highContrast ? 'Disable high contrast' : 'Enable high contrast'}>
              {highContrast ? <SunIcon size={20} /> : <MoonIcon size={20} />}
            </button>
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700">
                    {user.displayName ? user.displayName[0].toUpperCase() : <UserIcon size={16} />}
                  </div>
                  <span className="font-medium text-neutral-700">{user.displayName || user.email}</span>
                  <ChevronDownIcon size={16} className={`transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile Dropdown */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg py-2 z-50 border border-neutral-200">
                    <div className="px-4 py-2 border-b border-neutral-100">
                      <p className="text-sm font-medium text-neutral-900">{user.displayName}</p>
                      <p className="text-xs text-neutral-500">{user.email}</p>
                    </div>
                    
                      {/* Show admin dashboard link for admin/owner users */}
                      {(user.role === 'admin' || user.role === 'owner') && (
                        <Link to="/admin" className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 flex items-center gap-2 text-neutral-700">
                          <SettingsIcon size={16} />
                          Admin Dashboard
                        </Link>
                      )}                    <div className="border-t border-neutral-100 mt-2 pt-2">
                      <button
                        onClick={logout}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                      >
                        <LogOutIcon size={16} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  if (location.pathname === '/') scrollToJoin();
                  else window.location.href = '/#join-us';
                }}
                className="ml-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-medium transition-colors flex items-center gap-2"
              >
                <UserIcon size={16} />
                Sign In
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
      <div 
        className={`md:hidden fixed inset-x-0 top-[calc(100%+1px)] bg-white shadow-lg transform transition-all duration-300 ease-in-out ${
          isMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'
        }`}
      >
        <div className="container mx-auto px-4 py-4">
          <nav className="flex flex-col space-y-4">
            {[
              { to: '/', label: 'Home' },
              { to: '/map', label: 'Explore Map' },
              { to: '/dishes', label: 'Dishes' },
              { to: '/restaurants', label: 'Restaurants' }
            ].map((item, index) => (
              <Link
                key={item.to}
                to={item.to}
                className={`font-medium transition-all duration-300 transform ${
                  location.pathname === item.to ? 'text-primary-600 translate-x-2' : 'text-neutral-800 hover:text-primary-600 hover:translate-x-2'
                }`}
                onClick={() => setIsMenuOpen(false)}
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                {item.label}
              </Link>
            ))}
            
            <button 
              onClick={() => {
                toggleHighContrast();
                setIsMenuOpen(false);
              }} 
              className="flex items-center font-medium text-neutral-800 hover:text-primary-600 transition-all duration-300 hover:translate-x-2"
            >
              {highContrast ? <SunIcon size={20} className="mr-2" /> : <MoonIcon size={20} className="mr-2" />}
              {highContrast ? 'Disable High Contrast' : 'Enable High Contrast'}
            </button>

            {user ? (
              <div className="space-y-2 pt-4 border-t border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700">
                    {user.displayName ? user.displayName[0].toUpperCase() : <UserIcon size={20} />}
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">{user.displayName || 'User'}</p>
                    <p className="text-sm text-neutral-500">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => { logout(); setIsMenuOpen(false); }}
                  className="w-full px-4 py-2 rounded-lg bg-neutral-100 hover:bg-red-50 text-red-600 font-medium flex items-center gap-2 transition-colors"
                >
                  <LogOutIcon size={16} />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  if (location.pathname === '/') scrollToJoin();
                  else window.location.href = '/#join-us';
                }}
                className="w-full mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 font-medium flex items-center gap-2 justify-center transition-colors"
              >
                <UserIcon size={16} />
                Sign In
              </button>
            )}
          </nav>
        </div>
      </div>
      {/* Global Search */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isSearchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsSearchOpen(false);
        }}
      >
        <div 
          className={`fixed inset-x-0 top-0 bg-white shadow-lg transform transition-all duration-300 ease-out ${
            isSearchOpen ? 'translate-y-0' : '-translate-y-full'
          }`}
        >
          <div className="container mx-auto px-4 py-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-neutral-800">
                  <SearchIcon size={20} className="text-primary-500" />
                  Search Everything
                </h3>
                <button 
                  onClick={() => setIsSearchOpen(false)} 
                  className="p-2 rounded-full hover:bg-neutral-100 transition-colors text-neutral-600 hover:text-neutral-900" 
                  aria-label="Close search"
                >
                  <XIcon size={20} />
                </button>
              </div>
              
              <div className="relative">
                <SearchBar onClose={() => setIsSearchOpen(false)} />
                {/* Quick Links */}
                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <h4 className="text-sm font-medium text-neutral-500 mb-2">Quick Links</h4>
                  <div className="flex flex-wrap gap-2">
                    {['Popular Dishes', 'New Restaurants', 'Top Rated', 'Near Me'].map(tag => (
                      <button
                        key={tag}
                        className="px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 text-sm hover:bg-primary-50 hover:text-primary-600 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>;
};
export default Header;