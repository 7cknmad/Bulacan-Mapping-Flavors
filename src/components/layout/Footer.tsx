import React from 'react';
import { Link } from 'react-router-dom';
import { FacebookIcon, InstagramIcon, TwitterIcon, MapPinIcon, PhoneIcon, MailIcon } from 'lucide-react';
const Footer: React.FC = () => {
  return <footer className="bg-neutral-800 text-neutral-200 pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {/* About */}
          <div className="col-span-1 md:col-span-1 lg:col-span-1">
            <div className="flex items-center mb-4">
              <img src="https://via.placeholder.com/40" alt="Mapping Filipino Flavors Logo" className="h-10 w-10 mr-2" />
              <span className="font-display font-bold text-lg text-white">
                Mapping Filipino Flavors
              </span>
            </div>
            <p className="mb-4 text-sm">
              Discover the rich culinary heritage of Bulacan Province through
              our interactive map and comprehensive guide to local dishes and
              restaurants.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-primary-400 transition-colors" aria-label="Facebook">
                <FacebookIcon size={20} />
              </a>
              <a href="#" className="hover:text-primary-400 transition-colors" aria-label="Instagram">
                <InstagramIcon size={20} />
              </a>
              <a href="#" className="hover:text-primary-400 transition-colors" aria-label="Twitter">
                <TwitterIcon size={20} />
              </a>
            </div>
          </div>
          {/* Quick Links */}
          <div className="col-span-1">
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="hover:text-primary-400 transition-colors text-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/map" className="hover:text-primary-400 transition-colors text-sm">
                  Explore Map
                </Link>
              </li>
              <li>
                <Link to="/restaurants" className="hover:text-primary-400 transition-colors text-sm">
                  Restaurants
                </Link>
              </li>
              <li>
                <Link to="#" className="hover:text-primary-400 transition-colors text-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="#" className="hover:text-primary-400 transition-colors text-sm">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          {/* Contact Info */}
          <div className="col-span-1">
            <h4 className="text-white font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-start">
                <MapPinIcon size={18} className="mr-2 mt-0.5 flex-shrink-0 text-primary-400" />
                <span className="text-sm">
                  123 Filipino Street, Malolos City, Bulacan, Philippines
                </span>
              </li>
              <li className="flex items-center">
                <PhoneIcon size={18} className="mr-2 flex-shrink-0 text-primary-400" />
                <span className="text-sm">+63 912 345 6789</span>
              </li>
              <li className="flex items-center">
                <MailIcon size={18} className="mr-2 flex-shrink-0 text-primary-400" />
                <span className="text-sm">info@filipinoflavors.com</span>
              </li>
            </ul>
          </div>
          {/* Newsletter */}
          <div className="col-span-1 md:col-span-3 lg:col-span-1">
            <h4 className="text-white font-semibold mb-4">Newsletter</h4>
            <p className="mb-4 text-sm">
              Subscribe to our newsletter to get updates on new dishes,
              restaurants, and events.
            </p>
            <form className="flex">
              <input type="email" placeholder="Your email" className="px-3 py-2 rounded-l-md w-full text-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500" />
              <button type="submit" className="bg-primary-500 hover:bg-primary-600 px-4 py-2 rounded-r-md text-white font-medium text-sm transition-colors">
                Subscribe
              </button>
            </form>
          </div>
        </div>
        <div className="border-t border-neutral-700 mt-8 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-xs text-neutral-400 mb-4 md:mb-0">
              &copy; {new Date().getFullYear()} Mapping Filipino Flavors. All
              rights reserved.
            </p>
            <div className="flex space-x-4">
              <Link to="#" className="text-xs text-neutral-400 hover:text-primary-400 transition-colors">
                Privacy Policy
              </Link>
              <Link to="#" className="text-xs text-neutral-400 hover:text-primary-400 transition-colors">
                Terms of Service
              </Link>
              <Link to="#" className="text-xs text-neutral-400 hover:text-primary-400 transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;