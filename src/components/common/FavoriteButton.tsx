import { Heart } from 'lucide-react';
import type { Restaurant } from "../../utils/api";

interface FavoriteButtonProps {
  restaurant: Restaurant;
  isFavorite: boolean;
  onToggle: () => void;
  className?: string;
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({ restaurant, isFavorite, onToggle, className = '' }) => {
  return (
    <button
      onClick={(e) => {
        e.preventDefault(); // Prevent navigation when inside a Link
        e.stopPropagation();
        onToggle();
      }}
      className={`group p-2 rounded-full bg-white/90 hover:bg-white transition-colors ${className}`}
      aria-label={isFavorite ? `Remove ${restaurant.name} from favorites` : `Add ${restaurant.name} to favorites`}
    >
      <Heart
        size={20}
        className={`transition-colors ${
          isFavorite 
            ? 'text-red-500 fill-red-500' 
            : 'text-neutral-400 group-hover:text-red-500'
        }`}
      />
    </button>
  );
};

export default FavoriteButton;