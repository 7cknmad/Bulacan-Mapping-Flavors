// src/components/cards/RestaurantCard.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Star as StarIcon, MapPin as MapPinIcon } from "lucide-react";
import type { Restaurant } from "../../utils/api";
import { assetUrl } from "../../utils/assets";
import { useFavorites } from "../../hooks/useFavorites";
import ConfirmModal from "../ConfirmModal";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../ToastProvider";
import { useNavigate } from "react-router-dom";
import FavoriteButton from "../common/FavoriteButton";

// Normalize cuisine_types: null | string | JSON string | string[] -> string[]
function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (v == null) return [];
  if (typeof v === 'string') {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return arr;
      return [v];
    } catch {
      return [v];
    }
  }
  return [];
}
const RestaurantCard: React.FC<{ restaurant: Restaurant; compact?: boolean }> = ({ restaurant, compact = false }) => {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const isRestaurantFavorite = isFavorite(restaurant.id, 'restaurant');
  const { user } = useAuth();
  const addToast = useToast();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const rating = Number(restaurant.rating ?? 0);
  const price = restaurant.price_range
    ? restaurant.price_range.charAt(0).toUpperCase() + restaurant.price_range.slice(1)
    : "—";
  const cuisines = toArray((restaurant as any).cuisine_types);
  const allCuisines = cuisines.slice(0, 4);
  const addressFirst = (restaurant.address || "").split(",")[0] || "Bulacan";
  const distanceKm = (restaurant as any).distance_km ?? (restaurant as any).distance ?? (restaurant as any).distanceKm ?? (restaurant as any).distance;
  const href = `/restaurant/${encodeURIComponent(restaurant.slug || String(restaurant.id))}`;
  const thumbUrl = restaurant.image_url?.startsWith("http")
    ? restaurant.image_url!
    : assetUrl(restaurant.image_url || "images/placeholders/restaurant.jpg");

  const handleFavoriteToggle = async () => {
    try {
      if (isRestaurantFavorite) {
        await removeFavorite(restaurant.id, 'restaurant');
      } else {
        await addFavorite({
          id: restaurant.id,
          type: 'restaurant',
          name: restaurant.name,
          lat: restaurant.lat,
          lng: restaurant.lng,
          image_url: restaurant.image_url,
          municipality_name: restaurant.municipality_name
        });
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

  return (
    <>
      <div className="relative">
        <Link to={href} className="block">
          <div className={`card group transition overflow-hidden ${compact ? 'flex items-center p-3 hover:bg-neutral-50 rounded-lg gap-3' : 'hover:scale-[1.02]'}`}>
            <div className={compact ? "w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-neutral-100" : "relative"}>
              <img
                src={thumbUrl}
                alt={restaurant.name}
                className={compact ? "w-full h-full object-cover" : "w-full h-40 object-cover"}
                onError={(e) => { e.currentTarget.src = assetUrl("images/placeholders/restaurant.jpg"); }}
              />
              {!compact && (
                <>
                  <div className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded-md text-xs font-medium flex items-center">
                    <StarIcon size={14} className="text-yellow-500 fill-yellow-500 mr-1" />
                    {rating.toFixed(1)}
                  </div>
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    <div className="bg-white/90 px-2 py-1 rounded-md text-xs font-medium">
                      {price}
                    </div>
                    <FavoriteButton
                      restaurant={restaurant}
                      isFavorite={isRestaurantFavorite}
                      onToggle={() => {
                        if (!user) {
                          setShowLoginModal(true);
                          return;
                        }
                        handleFavoriteToggle();
                      }}
                    />
                  </div>
                </>
              )}
            </div>
            <div className={compact ? "flex-1 min-w-0" : "p-4"}>
              <h3 className={compact ? "font-medium text-neutral-900 truncate" : "font-medium text-lg mb-1 group-hover:text-primary-600 transition-colors"}>{restaurant.name}</h3>
              <div className={compact ? "flex items-center mt-1" : "flex items-center text-sm text-neutral-600 mb-2"}>
                <MapPinIcon size={compact ? 12 : 16} className={compact ? "mr-1 text-neutral-500" : "mr-1 text-neutral-500"} />
                <span>{addressFirst}</span>
                {typeof distanceKm === 'number' ? (
                  <span className={compact ? "ml-2 text-xs text-neutral-500" : "ml-2 text-sm text-neutral-500"}>• {distanceKm >= 1 ? `${distanceKm.toFixed(1)} km` : `${(distanceKm*1000).toFixed(0)} m`}</span>
                ) : null}
                {compact && (
                  <>
                    <span className="ml-2 text-xs text-neutral-500">{rating.toFixed(1)}</span>
                  </>
                )}
              </div>
              {!compact && restaurant.description && (
                <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{restaurant.description}</p>
              )}
              {!compact && allCuisines.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {allCuisines.map((type, idx) => (
                    <span key={`${type}-${idx}`} className="text-xs bg-neutral-100 text-neutral-700 px-2 py-1 rounded-full">
                      {type}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {compact && (
              <FavoriteButton
                restaurant={restaurant}
                isFavorite={isRestaurantFavorite}
                onToggle={() => {
                  if (!user) {
                    setShowLoginModal(true);
                    return;
                  }
                  handleFavoriteToggle();
                }}
                className="ml-2"
              />
            )}
          </div>
        </Link>
      </div>
      <ConfirmModal
        open={showLoginModal}
        title="Login Required"
        message="You need to log in to manage favorites. Would you like to proceed to the login page?"
        confirmLabel="Go to Login"
        cancelLabel="Cancel"
        onConfirm={() => {
          setShowLoginModal(false);
          navigate('/auth');
        }}
        onCancel={() => setShowLoginModal(false)}
      />
    </>
  );
}

export default RestaurantCard;
