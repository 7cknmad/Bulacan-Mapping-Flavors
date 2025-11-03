import React from 'react';
import { Star, ThumbsUp, Flag, BadgeCheck } from 'lucide-react';

import type { ReviewStats as ReviewStatsType } from '../utils/api';

interface ReviewStatsProps {
  stats: ReviewStatsType;
}

const ReviewStats: React.FC<ReviewStatsProps> = ({ stats }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
      {/* Overall Stats */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-semibold">{stats.stats.average_rating}</h3>
          <div className="flex items-center gap-1 text-yellow-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                className={i < Math.round(stats.stats.average_rating) ? 'fill-yellow-400' : ''}
              />
            ))}
          </div>
          <p className="text-sm text-neutral-500 mt-1">{stats.stats.total_reviews} reviews</p>
        </div>
        <div className="space-y-2 text-sm text-neutral-600">
          <div className="flex items-center gap-2">
            <ThumbsUp size={14} />
            <span>{stats.stats.total_helpful_votes} helpful votes</span>
          </div>
          <div className="flex items-center gap-2">
            <BadgeCheck size={14} className="text-green-600" />
            <span>{stats.stats.verified_visits} verified reviews</span>
          </div>
        </div>
      </div>

      {/* Rating Breakdown */}
      <div className="space-y-2">
        {stats.distribution
          .sort((a, b) => b.rating - a.rating)
          .map(({ rating, count, avg_weight }) => {
            const percentage = Number(stats.stats.rating_percentages[rating] || 0);
            return (
              <div key={rating} className="flex items-center gap-4">
                <div className="flex items-center gap-1 w-20">
                  <span>{rating}</span>
                  <Star size={14} className="fill-yellow-400 text-yellow-400" />
                  <span className="text-xs text-neutral-500">(x{avg_weight.toFixed(2)})</span>
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="w-24 text-right text-sm text-neutral-600">
                  {count} ({percentage.toFixed(1)}%)
                </div>
              </div>
            );
          })}
      </div>

      {/* Trend Section - Optional */}
      {stats.trend.length > 0 && (
        <div className="pt-4 border-t border-neutral-200">
          <h4 className="text-sm font-semibold mb-2">Rating Trend</h4>
          <div className="space-y-1">
            {stats.trend.slice(0, 3).map(({ month, review_count, avg_rating }) => (
              <div key={month} className="flex justify-between text-sm">
                <span>{month}</span>
                <span>{review_count} reviews, avg {avg_rating.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewStats;