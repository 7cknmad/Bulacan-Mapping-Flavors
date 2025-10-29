import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import StarRating from './StarRating';
import { useToast } from './ToastProvider';
import ConfirmModal from './ConfirmModal';
import { updateReview, deleteReview } from '../utils/api';
import { containsProfanity } from '../utils/content-filter';

const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 500;

interface EditReviewFormProps {
  review: {
    id: number;
    rating: number;
    comment?: string | null;
    rateable_id: number;
    rateable_type: 'dish' | 'restaurant' | 'variant';
  };
  onCancel: () => void;
  onSave: () => void;
}

const EditReviewForm: React.FC<EditReviewFormProps> = ({ review, onCancel, onSave }) => {
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment || '');
  const [errors, setErrors] = useState<{ comment?: string; rating?: string }>({});
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const queryClient = useQueryClient();
  const addToast = useToast();

  // Reset form when review changes
  useEffect(() => {
    setRating(review.rating);
    setComment(review.comment || '');
    setErrors({});
  }, [review]);

  const validateForm = () => {
    const newErrors: { comment?: string; rating?: string } = {};

    if (rating < 1 || rating > 5) {
      newErrors.rating = 'Please select a rating between 1 and 5 stars';
    }

    if (comment && comment.length < MIN_COMMENT_LENGTH) {
      newErrors.comment = `Comment must be at least ${MIN_COMMENT_LENGTH} characters long`;
    }

    if (comment && comment.length > MAX_COMMENT_LENGTH) {
      newErrors.comment = `Comment must not exceed ${MAX_COMMENT_LENGTH} characters`;
    }

    if (comment && containsProfanity(comment)) {
      newErrors.comment = 'Your comment contains inappropriate language. Please revise and try again.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { rating: number; comment?: string }) =>
      updateReview(review.id, data),
    onMutate: async ({ rating, comment }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [
        `${review.rateable_type}-reviews`,
        review.rateable_id
      ] });

      // Snapshot previous value
      const previousReviews = queryClient.getQueryData([
        `${review.rateable_type}-reviews`,
        review.rateable_id
      ]);

      // Optimistically update
      queryClient.setQueryData(
        [`${review.rateable_type}-reviews`, review.rateable_id],
        (old: any[] = []) => {
          return old.map((r) =>
            r.id === review.id
              ? { ...r, rating, comment, updated_at: new Date().toISOString() }
              : r
          );
        }
      );

      return { previousReviews };
    },
    onSuccess: () => {
      addToast('Review updated successfully', 'success');
      onSave();
    },
    onError: (_, __, context: any) => {
      // Rollback on failure
      queryClient.setQueryData(
        [`${review.rateable_type}-reviews`, review.rateable_id],
        context.previousReviews
      );
      addToast('Failed to update review', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`${review.rateable_type}-reviews`, review.rateable_id]
      });
      setLoading(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteReview(review.id),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: [`${review.rateable_type}-reviews`, review.rateable_id]
      });

      const previousReviews = queryClient.getQueryData([
        `${review.rateable_type}-reviews`,
        review.rateable_id
      ]);

      queryClient.setQueryData(
        [`${review.rateable_type}-reviews`, review.rateable_id],
        (old: any[] = []) => old.filter((r) => r.id !== review.id)
      );

      return { previousReviews };
    },
    onSuccess: () => {
      addToast('Review deleted successfully', 'success');
      onCancel();
    },
    onError: (_, __, context: any) => {
      queryClient.setQueryData(
        [`${review.rateable_type}-reviews`, review.rateable_id],
        context.previousReviews
      );
      addToast('Failed to delete review', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`${review.rateable_type}-reviews`, review.rateable_id]
      });
      setLoading(false);
    },
  });

  const handleSave = async () => {
    if (!validateForm()) {
      const errorMessage = Object.values(errors).join('. ');
      addToast(errorMessage, 'error');
      return;
    }
    setShowEditConfirm(true);
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg shadow-sm border">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Rating</label>
        <StarRating
          rating={rating}
          setRating={(newRating) => {
            setRating(newRating);
            setErrors((prev) => ({ ...prev, rating: undefined }));
          }}
        />
        {errors.rating && (
          <p className="text-sm text-red-500">{errors.rating}</p>
        )}
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Comment
        </label>
        <textarea
          className={`w-full border rounded p-2 ${
            errors.comment ? 'border-red-500' : 'border-gray-300'
          }`}
          rows={4}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setErrors((prev) => ({ ...prev, comment: undefined }));
          }}
          placeholder={`Write your review (${MIN_COMMENT_LENGTH}-${MAX_COMMENT_LENGTH} characters)`}
          disabled={loading}
        />
        <div className="absolute bottom-2 right-2 text-sm text-gray-500">
          {comment.length}/{MAX_COMMENT_LENGTH}
        </div>
        {errors.comment && (
          <p className="mt-1 text-sm text-red-500">{errors.comment}</p>
        )}
      </div>

      <div className="flex justify-between gap-2">
        <div>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            disabled={loading}
          >
            Delete
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Edit Confirmation Modal */}
      <ConfirmModal
        open={showEditConfirm}
        title="Update Review"
        message="Are you sure you want to save these changes to your review?"
        confirmLabel="Save Changes"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={() => {
          setShowEditConfirm(false);
          setLoading(true);
          updateMutation.mutate({ rating, comment: comment.trim() });
        }}
        onCancel={() => setShowEditConfirm(false)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete Review"
        message="Are you sure you want to delete this review? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          setLoading(true);
          deleteMutation.mutate();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

export default EditReviewForm;