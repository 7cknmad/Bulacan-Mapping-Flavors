
import { Star, StarHalf } from 'lucide-react';

interface RatingDisplayProps {
  rating: number;
  totalRatings?: number;
  showCount?: boolean;
  size?: number;
  className?: string;
}

export default function RatingDisplay({ rating, totalRatings, showCount = true, size = 14, className = "" }: RatingDisplayProps) {
  const safeRating = typeof rating === 'number' && !isNaN(rating) ? rating : null;
  let fullStars = 0, hasHalfStar = false, emptyStars = 5;
  if (safeRating !== null && safeRating > 0) {
    fullStars = Math.floor(safeRating);
    const fraction = safeRating - fullStars;
    // More visually accurate: show half star for 0.25 <= fraction < 0.75
    hasHalfStar = fraction >= 0.25 && fraction < 0.75;
    emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  }
  return (
    <div className={`flex items-center gap-1.5 ${className}`} data-testid="rating-display">
      <div className="flex gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star
            key={`full-${i}`}
            size={size}
            className="text-yellow-400 fill-yellow-400"
          />
        ))}
        {hasHalfStar && (
          <StarHalf
            size={size}
            className="text-yellow-400 fill-yellow-400"
          />
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star
            key={`empty-${i}`}
            size={size}
            className="text-gray-300"
          />
        ))}
      </div>
      {showCount && (
        <span className="text-black text-xs">
          {safeRating !== null && safeRating > 0 ? safeRating.toFixed(1) : 'N/A'}
          {totalRatings !== undefined && safeRating !== null && safeRating > 0 && totalRatings > 0 && ` (${totalRatings})`}
        </span>
      )}
    </div>
  );
}