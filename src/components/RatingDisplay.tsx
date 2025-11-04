import React from 'react';
import { Star, StarHalf } from 'lucide-react';

interface RatingDisplayProps {
  rating: number;
  totalRatings?: number;
  showCount?: boolean;
  size?: number;
  className?: string;
}

export default function RatingDisplay({ rating, totalRatings, showCount = true, size = 14, className = "" }: RatingDisplayProps) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

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
        <span className="text-white/90 text-xs">
          {rating.toFixed(1)}
          {totalRatings !== undefined && ` (${totalRatings})`}
        </span>
      )}
    </div>
  );
}