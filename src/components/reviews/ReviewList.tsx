import { Star as StarIcon } from "lucide-react";
import { Review } from "../../utils/api";

type ReviewListProps = {
  reviews: Review[];
  isLoading: boolean;
  error: Error | null;
  myReviewId?: number;
  onEditReview?: (review: Review) => void;
  onDeleteReview?: (review: Review) => void;
  refetch?: () => void;
};

export function ReviewList({
  reviews,
  isLoading,
  error,
  myReviewId,
  onEditReview,
  onDeleteReview,
  refetch
}: ReviewListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-neutral-200 rounded w-32 mb-2" />
            <div className="h-4 bg-neutral-200 rounded w-full mb-1" />
            <div className="h-4 bg-neutral-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 text-xl mb-4">
          Failed to load reviews
        </div>
        {refetch && (
          <button
            onClick={refetch}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors text-sm"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-600">
        <div className="mb-2">No reviews yet</div>
        <div className="text-sm">Be the first to share your thoughts!</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div 
          key={review.id} 
          className={`${review.id === myReviewId ? 'bg-blue-50 border border-blue-100' : 'border-b'} p-4 rounded-lg mb-4`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{review.user_name || "User"}</span>
              {review.id === myReviewId && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  Your Review
                </span>
              )}
            </div>
            {review.id === myReviewId && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditReview?.(review)}
                  className="text-sm px-3 py-1.5 text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors duration-150 flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => onDeleteReview?.(review)}
                  className="text-sm px-3 py-1.5 text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors duration-150 flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center text-yellow-500">
              {[...Array(review.rating)].map((_, i) => (
                <StarIcon key={i} size={14} className="fill-yellow-400" />
              ))}
            </span>
            <span className="text-xs text-neutral-500">
              {new Date(review.created_at).toLocaleDateString()}
              {review.updated_at !== review.created_at && 
                ` · Edited ${new Date(review.updated_at).toLocaleDateString()}`
              }
            </span>
          </div>
          <div className="text-neutral-700">{review.comment}</div>
        </div>
      ))}
    </div>
  );
}