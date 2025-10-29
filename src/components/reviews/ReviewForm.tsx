import { useState } from "react";
import { Star as StarIcon } from "lucide-react";
import { Review } from "../../utils/api";

type ReviewFormProps = {
  onSubmit: (data: { rating: number; comment: string }) => void;
  isLoading?: boolean;
  initialRating?: number;
  initialComment?: string;
  mode?: "create" | "edit";
  onCancel?: () => void;
};

export function ReviewForm({
  onSubmit,
  isLoading = false,
  initialRating = 0,
  initialComment = "",
  mode = "create",
  onCancel
}: ReviewFormProps) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [hoveredStar, setHoveredStar] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    onSubmit({ rating, comment });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="text-sm font-medium mb-2">
          {mode === "create" ? "How would you rate this?" : "Update your rating"}
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className="text-2xl focus:outline-none"
            >
              <StarIcon 
                size={24} 
                className={`${
                  star <= (hoveredStar || rating)
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-neutral-300"
                } transition-colors`}
              />
            </button>
          ))}
          <span className="text-sm text-neutral-500 ml-2">
            {rating ? `${rating} star${rating !== 1 ? "s" : ""}` : "Select rating"}
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="comment" className="block text-sm font-medium mb-2">
          Your review
        </label>
        <textarea
          id="comment"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Share your thoughts about this item..."
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {mode === "edit" && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!rating || isLoading}
          className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md transition-colors
            ${!rating || isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"}`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {mode === "create" ? "Submitting..." : "Updating..."}
            </span>
          ) : (
            mode === "create" ? "Submit Review" : "Update Review"
          )}
        </button>
      </div>
    </form>
  );
}