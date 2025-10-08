import React from 'react';
import { Link } from 'react-router-dom';
import { StarIcon, MapPinIcon } from 'lucide-react';
import { Restaurant } from '../../types';
interface RestaurantCardProps {
  restaurant: Restaurant;
  compact?: boolean;
}
const RestaurantCard: React.FC<RestaurantCardProps> = ({
  restaurant,
  compact = false
}) => {
  return compact ? <Link to={`/restaurant/${restaurant.id}`} className="block">
      <div className="flex items-center p-3 hover:bg-neutral-50 transition-colors rounded-lg">
        <img src={restaurant.images[0]} alt={restaurant.name} className="w-16 h-16 object-cover rounded-md mr-3" />
        <div>
          <h3 className="font-medium text-neutral-900">{restaurant.name}</h3>
          <div className="flex items-center text-xs text-neutral-500 mt-0.5">
            <MapPinIcon size={12} className="mr-1" />
            <span>{restaurant.address.split(',')[0]}</span>
          </div>
          <div className="flex items-center mt-1">
            {[...Array(5)].map((_, i) => <StarIcon key={i} size={12} className={`${i < Math.floor(restaurant.rating) ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-300'} mr-0.5`} />)}
            <span className="text-xs text-neutral-500 ml-1">
              {restaurant.rating.toFixed(1)}
            </span>
            <span className="text-xs text-neutral-500 ml-2">
              {restaurant.priceRange}
            </span>
          </div>
        </div>
      </div>
    </Link> : <Link to={`/restaurant/${restaurant.id}`} className="block">
      <div className="card group hover:scale-[1.02]">
        <div className="relative">
          <img src={restaurant.images[0]} alt={restaurant.name} className="w-full h-48 object-cover" />
          <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-md text-xs font-medium">
            {restaurant.priceRange}
          </div>
          <div className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded-md text-xs font-medium flex items-center">
            <StarIcon size={14} className="text-yellow-500 fill-yellow-500 mr-1" />
            {restaurant.rating.toFixed(1)}
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-medium text-lg mb-1 group-hover:text-primary-600 transition-colors">
            {restaurant.name}
          </h3>
          <div className="flex items-center text-sm text-neutral-600 mb-2">
            <MapPinIcon size={16} className="mr-1 text-neutral-500" />
            <span>{restaurant.address.split(',')[0]}</span>
          </div>
          <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
            {restaurant.description}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {restaurant.cuisineType.map((type, index) => <span key={index} className="text-xs bg-neutral-100 text-neutral-700 px-2 py-1 rounded-full">
                {type}
              </span>)}
          </div>
        </div>
      </div>
    </Link>;
};
export default RestaurantCard;