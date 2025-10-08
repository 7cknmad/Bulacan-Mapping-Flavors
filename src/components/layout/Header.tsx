import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SearchIcon, MenuIcon, XIcon, SunIcon, MoonIcon } from 'lucide-react';
import SearchBar from '../common/SearchBar';
const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const location = useLocation();
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
  return <header className={`w-full fixed top-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'}`}>
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
            <Link to="/restaurants" className={`font-medium hover:text-primary-600 transition-colors ${location.pathname === '/restaurants' ? 'text-primary-600' : 'text-neutral-800'}`}>
              Restaurants
            </Link>
            <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded-full hover:bg-neutral-100 transition-colors" aria-label="Search">
              <SearchIcon size={20} />
            </button>
            <button onClick={toggleHighContrast} className="p-2 rounded-full hover:bg-neutral-100 transition-colors" aria-label={highContrast ? 'Disable high contrast' : 'Enable high contrast'}>
              {highContrast ? <SunIcon size={20} /> : <MoonIcon size={20} />}
            </button>
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
              <SearchBar onClose={() => setIsSearchOpen(false)} />
            </div>
          </div>
        </div>}
    </header>;
};
export default Header;