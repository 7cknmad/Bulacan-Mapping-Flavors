import React from 'react';
import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import type { Restaurant } from '../../utils/api';
import { Heart } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../ToastProvider';
import { useNavigate } from 'react-router-dom';

// Helper function to calculate distance between coordinates
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

// Create custom icons for different restaurant types
const createRestaurantIcon = (kind: Restaurant['kind'] = 'restaurant', isHighlighted = false) => {
  const colors = {
    restaurant: '#e76f51', // coral
    stall: '#f4a261', // sandy brown
    store: '#2a9d8f', // persian green
    dealer: '#e9c46a', // sandy brown
    market: '#264653', // charcoal
    'home-based': '#457b9d', // steel blue
  };

  const size = isHighlighted ? 40 : 32;
  const color = colors[kind] || colors.restaurant;
  const baseColor = color.replace('#', '');
  
  return L.divIcon({
    className: 'custom-restaurant-marker',
    html: `
      <div class="relative group transition-transform duration-300 ease-out hover:scale-110" 
           style="width: ${size}px; height: ${size}px; transform: translate(-50%, -50%)">
        <div class="absolute inset-0 rounded-full bg-white/5 backdrop-blur-sm 
                    shadow-lg transition-all duration-300 ease-out group-hover:scale-110">
        </div>
        ${isHighlighted ? `
          <div class="absolute inset-0 rounded-full border-2"
               style="border-color: ${color}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;">
          </div>
          <div class="absolute inset-0 rounded-full border-2"
               style="border-color: ${color}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; animation-delay: 0.5s;">
          </div>
        ` : ''}
        <svg viewBox="0 0 24 24" 
             class="absolute inset-0 w-full h-full transition-transform duration-300"
             style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
          <defs>
            <radialGradient id="marker-gradient-${baseColor}" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style="stop-color: ${color}; stop-opacity: 1"/>
              <stop offset="90%" style="stop-color: ${color}; stop-opacity: 0.9"/>
              <stop offset="100%" style="stop-color: ${color}; stop-opacity: 0.8"/>
            </radialGradient>
          </defs>
          <path fill="url(#marker-gradient-${baseColor})" 
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                class="transition-all duration-300"/>
        </svg>
        <style>
          @keyframes ping {
            75%, 100% {
              transform: scale(2);
              opacity: 0;
            }
          }
        </style>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size],
    popupAnchor: [0, -size]
  });
};

interface RestaurantMarkerProps {
  restaurant: Pick<Restaurant, 'id' | 'lat' | 'lng' | 'kind' | 'name' | 'address' | 'municipality_name' | 'image_url'>;
  userLocation?: [number, number] | null;
  onClick?: () => void;
  isHighlighted?: boolean;
  showPopup?: boolean;
}

const RestaurantMarker: React.FC<RestaurantMarkerProps> = ({ restaurant, userLocation, onClick, isHighlighted = false, showPopup = false }) => {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const favorited = isFavorite(Number(restaurant.id), 'restaurant');
  const { user } = useAuth();
  const addToast = useToast();
  const navigate = useNavigate();

  // Validate coordinates
  if (!restaurant.lat || !restaurant.lng || isNaN(restaurant.lat) || isNaN(restaurant.lng)) {
    console.warn(`Invalid coordinates for restaurant ${restaurant.id}: ${restaurant.lat}, ${restaurant.lng}`);
    return null;
  }

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (favorited) {
        await removeFavorite(Number(restaurant.id), 'restaurant');
      } else {
        await addFavorite({
          id: Number(restaurant.id),
          type: 'restaurant',
          name: restaurant.name,
          lat: restaurant.lat,
          lng: restaurant.lng,
          municipality_name: restaurant.municipality_name
        });
        addToast('Added to favorites!', 'success');
      }
    } catch (error: any) {
      if (error?.code === 'LOGIN_REQUIRED') {
        addToast('Please log in to manage favorites.', 'error');
        navigate('/auth');
        return;
      }
      addToast('Failed to update favorites.', 'error');
    }
  };

  // Calculate distance from user if location is available
  const distance = userLocation ? getDistanceFromLatLonInKm(
    userLocation[0],
    userLocation[1],
    restaurant.lat,
    restaurant.lng
  ) : null;

  return (
    <Marker
      position={[restaurant.lat, restaurant.lng]}
      icon={createRestaurantIcon(restaurant.kind, isHighlighted)}
      eventHandlers={{
        click: onClick
      }}
      zIndexOffset={isHighlighted ? 1000 : 0}
    >
      {showPopup && (
        <Popup>
          <div className="p-3 backdrop-blur-md bg-white/95 rounded-lg shadow-lg min-w-[200px]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-neutral-900">{restaurant.name}</h3>
                {restaurant.address && (
                  <div className="text-sm text-neutral-600 mt-0.5 line-clamp-2">
                    {restaurant.address}
                  </div>
                )}
              </div>
              <button
                onClick={handleFavoriteClick}
                className={`p-2 rounded-full hover:bg-neutral-100 transition-all duration-300 transform active:scale-90
                  ${favorited ? 'text-red-500 hover:bg-red-50' : 'text-neutral-400 hover:text-neutral-600'} 
                  ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!user}
                title={!user ? 'Login required to manage favorites' : undefined}
              >
                <Heart
                  size={18}
                  className={`transition-all duration-300 ${favorited ? 'fill-current scale-110' : 'scale-100'}`}
                />
              </button>
            </div>
            
            {distance && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary-50 text-primary-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium">
                    {distance >= 1 ? `${distance.toFixed(1)} km` : `${Math.round(distance * 1000)}m`} away
                  </span>
                </div>
              </div>
            )}
          </div>
        </Popup>
      )}
    </Marker>
  );
};

export default RestaurantMarker;
