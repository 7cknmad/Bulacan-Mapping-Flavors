import React from 'react';
import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import type { Restaurant } from '../../utils/api';
import { Heart } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';

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

  // Use a larger size and different opacity for highlighted markers
  const size = isHighlighted ? 32 : 24;
  const opacity = isHighlighted ? 1 : 0.85;

  const color = colors[kind] || colors.restaurant;
  
  return L.divIcon({
    className: 'custom-restaurant-marker',
    html: `
      <div class="relative group">
        <div class="absolute -inset-3 rounded-full bg-${color}/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        ${isHighlighted ? `<div class="absolute -inset-4 rounded-full border-2 border-${color} animate-ping"></div>` : ''}
        <svg viewBox="0 0 24 24" class="w-6 h-6 transform -translate-x-1/2 -translate-y-1/2 ${isHighlighted ? 'marker-pulse' : ''}">
          <path fill="${color}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
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

  // Validate coordinates
  if (!restaurant.lat || !restaurant.lng || isNaN(restaurant.lat) || isNaN(restaurant.lng)) {
    console.warn(`Invalid coordinates for restaurant ${restaurant.id}: ${restaurant.lat}, ${restaurant.lng}`);
    return null;
  }

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorited) {
      removeFavorite(Number(restaurant.id), 'restaurant');
    } else {
      addFavorite({
        id: Number(restaurant.id),
        type: 'restaurant',
        name: restaurant.name,
        lat: restaurant.lat,
        lng: restaurant.lng,
        municipality_name: restaurant.municipality_name
      });
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
          <div className="p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{restaurant.name}</div>
              <button
                onClick={handleFavoriteClick}
                className={`p-2 rounded-full hover:bg-neutral-100 transition-colors ${favorited ? 'text-red-500' : 'text-neutral-400'}`}
              >
                <Heart
                  size={16}
                  className={favorited ? 'fill-current' : ''}
                />
              </button>
            </div>
            {restaurant.address && (
              <div className="text-sm text-gray-600 mt-1">{restaurant.address}</div>
            )}
            {distance && (
              <div className="text-sm text-primary-600 mt-1">
                {distance >= 1 ? `${distance.toFixed(1)} km` : `${Math.round(distance * 1000)}m`} away
              </div>
            )}
          </div>
        </Popup>
      )}
    </Marker>
  );
};

export default RestaurantMarker;
