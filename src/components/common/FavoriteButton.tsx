import { Heart } from 'lucide-react';
import type { Restaurant } from "../../utils/api";

interface FavoriteButtonProps {
  restaurant: Restaurant;
  isFavorite: boolean;
  onToggle: () => void;
  className?: string;
  disabled?: boolean;
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({ restaurant, isFavorite, onToggle, className = '', disabled = false }) => {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onToggle();
      }}
      className={`group p-2 rounded-full bg-white/90 hover:bg-white transition-colors ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-label={isFavorite ? `Remove ${restaurant.name} from favorites` : `Add ${restaurant.name} to favorites`}
      disabled={disabled}
      title={disabled ? 'Login required to manage favorites' : undefined}
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