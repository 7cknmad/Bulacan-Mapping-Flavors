import React from "react";
import { Link } from "react-router-dom";
import { Star as StarIcon, MapPin as MapPinIcon } from "lucide-react";
import type { Restaurant } from "../../utils/api";

// Normalize cuisine_types: null | string | JSON string | string[] -> string[]
function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (v == null) return [];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : (v.trim() ? [v] : []);
    } catch {
      return v.trim() ? [v] : [];
    }
  }
  return [];
}

interface RestaurantCardProps {
  restaurant: Restaurant;  // from utils/api
  compact?: boolean;
}

const RestaurantCard: React.FC<RestaurantCardProps> = ({ restaurant, compact = false }) => {
  const rating = Number(restaurant.rating ?? 0);
  const price = restaurant.price_range
    ? restaurant.price_range.charAt(0).toUpperCase() + restaurant.price_range.slice(1)
    : "—";

  const cuisines = toArray((restaurant as any).cuisine_types);
  const primaryCuisine = cuisines[0] ?? "Cuisine";
  const allCuisines = cuisines.slice(0, 4);

  const addressFirst = (restaurant.address || "").split(",")[0] || "Bulacan";
  const href = `/restaurant/${encodeURIComponent(restaurant.slug || String(restaurant.id))}`;

  // no images in API yet; use a neutral placeholder (swap once you add image_url)
  const hero =
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1200&auto=format&fit=crop";

  if (compact) {
    return (
      <Link to={href} className="block">
        <div className="flex items-center p-3 hover:bg-neutral-50 transition-colors rounded-lg">
          <img
            src={hero}
            alt={restaurant.name}
            className="w-16 h-16 object-cover rounded-md mr-3"
          />
          <div>
            <h3 className="font-medium text-neutral-900">{restaurant.name}</h3>
            <div className="flex items-center text-xs text-neutral-500 mt-0.5">
              <MapPinIcon size={12} className="mr-1" />
              <span>{addressFirst}</span>
            </div>
            <div className="flex items-center mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon
                  key={i}
                  size={12}
                  className={`${i < Math.floor(rating) ? "text-yellow-500 fill-yellow-500" : "text-neutral-300"} mr-0.5`}
                />
              ))}
              <span className="text-xs text-neutral-500 ml-1">
                {rating.toFixed(1)}
              </span>
              <span className="text-xs text-neutral-500 ml-2">{price}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={href} className="block">
      <div className="card group hover:scale-[1.02] transition overflow-hidden">
        <div className="relative">
          <img src={hero} alt={restaurant.name} className="w-full h-48 object-cover" />
          <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-md text-xs font-medium">
            {price}
          </div>
          <div className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded-md text-xs font-medium flex items-center">
            <StarIcon size={14} className="text-yellow-500 fill-yellow-500 mr-1" />
            {rating.toFixed(1)}
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-medium text-lg mb-1 group-hover:text-primary-600 transition-colors">
            {restaurant.name}
          </h3>
          <div className="flex items-center text-sm text-neutral-600 mb-2">
            <MapPinIcon size={16} className="mr-1 text-neutral-500" />
            <span>{addressFirst}</span>
          </div>
          {restaurant.description && (
            <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
              {restaurant.description}
            </p>
          )}
          {allCuisines.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {allCuisines.map((type, idx) => (
                <span
                  key={`${type}-${idx}`}
                  className="text-xs bg-neutral-100 text-neutral-700 px-2 py-1 rounded-full"
                >
                  {type}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default RestaurantCard;