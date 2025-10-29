import React from 'react';
import { Star, ThumbsUp, Flag, BadgeCheck } from 'lucide-react';

interface ReviewStatsProps {
  totalReviews: number;
  averageRating: number;
  ratingBreakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  totalHelpfulVotes: number;
  totalReports: number;
  verifiedCount: number;
}

const ReviewStats: React.FC<ReviewStatsProps> = ({
  totalReviews,
  averageRating,
  ratingBreakdown,
  totalHelpfulVotes,
  totalReports,
  verifiedCount
}) => {
  const calculatePercentage = (count: number) => {
    return totalReviews > 0 ? (count / totalReviews) * 100 : 0;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
      {/* Overall Stats */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-semibold">{averageRating.toFixed(1)}</h3>
          <div className="flex items-center gap-1 text-yellow-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                className={i < Math.round(averageRating) ? 'fill-yellow-400' : ''}
              />
            ))}
          </div>
          <p className="text-sm text-neutral-500 mt-1">{totalReviews} reviews</p>
        </div>
        <div className="space-y-2 text-sm text-neutral-600">
          <div className="flex items-center gap-2">
            <ThumbsUp size={14} />
            <span>{totalHelpfulVotes} helpful votes</span>
          </div>
          <div className="flex items-center gap-2">
            <BadgeCheck size={14} className="text-green-600" />
            <span>{verifiedCount} verified reviews</span>
          </div>
          {totalReports > 0 && (
            <div className="flex items-center gap-2 text-red-600">
              <Flag size={14} />
              <span>{totalReports} reported</span>
            </div>
          )}
        </div>
      </div>

      {/* Rating Breakdown */}
      <div className="space-y-2">
        {Object.entries(ratingBreakdown)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([rating, count]) => {
            const percentage = calculatePercentage(count);
            return (
              <div key={rating} className="flex items-center gap-4">
                <div className="flex items-center gap-1 w-20">
                  <span>{rating}</span>
                  <Star size={14} className="fill-yellow-400 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 text-right text-sm text-neutral-600">
                  {count} ({percentage.toFixed(0)}%)
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default ReviewStats;