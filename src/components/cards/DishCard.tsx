import React from 'react';
import { Link } from 'react-router-dom';
import { StarIcon } from 'lucide-react';
import { assetUrl } from "../../utils/assets";
// Accepts either old mock shape or new API shape
type AnyDish = {
  id?: number | string;
  slug?: string;
  name: string;
  description?: string | null;
  image?: string | null;       // old mock
  image_url?: string | null;   // new API
  rating?: number | null;
  ingredients?: string[] | null;
  municipalityId?: string | number;   // old mock
  municipality_name?: string | null;  // new API
};

interface DishCardProps {
  dish: AnyDish;
  compact?: boolean;
}

const DishCard: React.FC<DishCardProps> = ({ dish, compact = false }) => {
  const href = `/dish/${encodeURIComponent((dish.slug ?? dish.id) as string)}`;
  const src = dish.image_url?.startsWith("http")
  ? dish.image_url
  : assetUrl(dish.image_url || "images/placeholders/dish.jpg");
  const rating = typeof dish.rating === 'number' ? dish.rating : 0;
  const ingredientsCount = Array.isArray(dish.ingredients) ? dish.ingredients.length : 0;
  const muniLabel = dish.municipality_name || '';

  const Stars = ({ size }: { size: number }) => (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          size={size}
          className={`${i < Math.floor(rating) ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-300'} mr-0.5`}
        />
      ))}
    </>
  );

  if (compact) {
    return (
      <Link to={href} className="block">
        <div className="flex items-center p-3 hover:bg-neutral-50 transition-colors rounded-lg">
          <img src={src} alt={dish.name} />
          <div>
            <h3 className="font-medium text-neutral-900">{dish.name}</h3>
            {muniLabel && <p className="text-xs text-neutral-500">{muniLabel}</p>}
            <div className="flex items-center mt-1">
              <Stars size={12} />
              <span className="text-xs text-neutral-500 ml-1">
                {rating.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={href} className="block">
      <div className="card group hover:scale-[1.02] transition-transform">
        <div className="relative">
          <img src={src} alt={dish.name} />
          <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-md text-xs font-medium flex items-center">
            <StarIcon size={14} className="text-yellow-500 fill-yellow-500 mr-1" />
            {rating.toFixed(1)}
          </div>
          {muniLabel && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <span className="text-white text-xs font-medium">{muniLabel}</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-medium text-lg mb-1 group-hover:text-primary-600 transition-colors">
            {dish.name}
          </h3>
          {dish.description && (
            <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
              {dish.description}
            </p>
          )}
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Stars size={16} />
            </div>
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
              {ingredientsCount} Ingredients
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default DishCard;
