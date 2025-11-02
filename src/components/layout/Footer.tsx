import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FacebookIcon, InstagramIcon, TwitterIcon, MapPinIcon, PhoneIcon, MailIcon } from 'lucide-react';

const Footer = () => {
  const [showFooter, setShowFooter] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Hide footer only on the map page
    const isMapPage = location.pathname === '/map' || location.pathname.startsWith('/map/');
    setShowFooter(!isMapPage);
  }, [location]);

  useEffect(() => {
    const onNavVisible = (e: Event) => {
      const detail = (e as CustomEvent<{ visible: boolean }>).detail;
      // Only hide footer if explicitly set to false and not on map page
      if (!(location.pathname === '/map' || location.pathname.startsWith('/map/'))) {
        setShowFooter(detail?.visible !== false);
      }
    };
    window.addEventListener('nav:visible', onNavVisible as EventListener);
    return () => window.removeEventListener('nav:visible', onNavVisible as EventListener);
  }, [location]);

  return (
    <footer 
      className={`
        bg-neutral-800 text-neutral-200 pt-12 pb-6 
        transition-all duration-300 ease-in-out
        fixed bottom-0 left-0 right-0
        transform ${showFooter ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}
        relative z-10
      `}>
      <div className="container mx-auto px-4">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* About */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center mb-4">
              <div className="relative inline-block">
                <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  MF
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
                  B
                </div>
              </div>
              <div className="ml-3">
                <span className="font-display font-bold text-xl text-white block leading-tight">
                  Mapping Filipino
                </span>
                <span className="font-display font-bold text-sm text-primary-400 block leading-tight">
                  Bulacan Edition
                </span>
              </div>
            </div>
            <p className="mb-6 text-neutral-300 leading-relaxed">
              Discover the rich culinary heritage of Bulacan Province through
              our interactive map and comprehensive guide to local dishes and
              restaurants. Join us in preserving and celebrating the authentic
              flavors of Filipino cuisine.
            </p>
            <div className="flex space-x-4">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/10 hover:bg-primary-500 text-white transition-colors" aria-label="Facebook">
                <FacebookIcon size={20} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/10 hover:bg-primary-500 text-white transition-colors" aria-label="Instagram">
                <InstagramIcon size={20} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/10 hover:bg-primary-500 text-white transition-colors" aria-label="Twitter">
                <TwitterIcon size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links & Featured */}
          <div className="col-span-1">
            <h4 className="text-white font-semibold mb-4">Navigation</h4>
            <div className="grid grid-cols-1 gap-2">
              <Link to="/map" className="text-neutral-300 hover:text-primary-400 transition-colors text-sm">
                Interactive Map
              </Link>
              <Link to="/dishes" className="text-neutral-300 hover:text-primary-400 transition-colors text-sm">
                Browse Dishes
              </Link>
              <Link to="/restaurants" className="text-neutral-300 hover:text-primary-400 transition-colors text-sm">
                Find Restaurants
              </Link>
              <Link to="/events" className="text-neutral-300 hover:text-primary-400 transition-colors text-sm">
                Food Events
              </Link>
              <Link to="/blog" className="text-neutral-300 hover:text-primary-400 transition-colors text-sm">
                Latest Stories
              </Link>
            </div>
          </div>

          {/* Contact & Support */}
          <div className="col-span-1">
            <h4 className="text-white font-semibold mb-4">Contact & Support</h4>
            <div className="space-y-3 text-sm">
              <a href="mailto:support@filipinoflavors.com" 
                className="flex items-center text-neutral-300 hover:text-primary-400 transition-colors">
                <MailIcon size={16} className="mr-2" />
                support@filipinoflavors.com
              </a>
              <a href="tel:+639123456789" 
                className="flex items-center text-neutral-300 hover:text-primary-400 transition-colors">
                <PhoneIcon size={16} className="mr-2" />
                +63 912 345 6789
              </a>
              <div className="flex items-start text-neutral-300">
                <MapPinIcon size={16} className="mr-2 mt-1 flex-shrink-0" />
                <span>Capitol Building<br/>Malolos City, Bulacan</span>
              </div>
              <Link to="/help" className="text-neutral-300 hover:text-primary-400 transition-colors">
                Help & Support
              </Link>
              <Link to="/contribute" className="text-neutral-300 hover:text-primary-400 transition-colors">
                How to Contribute
              </Link>
            </div>
          </div>

          {/* Newsletter */}
          <div className="col-span-1">
            <h4 className="text-white font-semibold mb-4">Stay Updated</h4>
            <form className="space-y-3">
              <input 
                type="email" 
                placeholder="Your email address" 
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white placeholder-neutral-400 text-sm border border-white/10 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-colors"
              />
              <button 
                type="submit" 
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-2.5 rounded-lg transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-800"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="border-t border-neutral-700 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2 text-xs text-neutral-400">
              <Link to="/privacy" className="hover:text-primary-400 transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-primary-400 transition-colors">Terms of Service</Link>
              <Link to="/cookies" className="hover:text-primary-400 transition-colors">Cookie Policy</Link>
              <Link to="/accessibility" className="hover:text-primary-400 transition-colors">Accessibility</Link>
              <Link to="/sitemap" className="hover:text-primary-400 transition-colors">Sitemap</Link>
            </div>
            
            <p className="text-xs text-neutral-500">
              © {new Date().getFullYear()} Mapping Filipino Flavors. Built with ♥ in Bulacan.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;