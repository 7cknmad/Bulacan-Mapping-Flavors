import React, { useState, useEffect } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import StarRating from './StarRating';
import { postReview, type Review } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ToastProvider';
import ConfirmModal from './ConfirmModal';
import { containsProfanity } from '../utils/content-filter';
import { useAuth } from '../hooks/useAuth';
import { deleteReview } from '../utils/api';

interface RatingFormProps {
  id: number;
  type: 'dish' | 'restaurant';
  currentReview?: Review;
  onDeleteReview?: () => void;
}

const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 500;

const RatingForm: React.FC<RatingFormProps> = ({ id, type, currentReview, onDeleteReview }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(currentReview?.rating || 0);
  const [message, setMessage] = useState<string | null>(null);
  const [comment, setComment] = useState<string>(currentReview?.comment || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ comment?: string; rating?: string }>({});
  // Always derive formMode from props
  const formMode: 'create' | 'edit' = currentReview?.id ? 'edit' : 'create';
  const qc = useQueryClient();

  // Reset form when currentReview changes
  useEffect(() => {
    if (currentReview?.id) {
      setRating(currentReview.rating || 0);
      setComment(currentReview.comment || '');
    } else {
      setRating(0);
      setComment('');
    }
  }, [currentReview?.id]);

  console.log('RatingForm props:', { id, type });
  const addToast = useToast();
  type NewReviewPayload = { type: 'dish'|'restaurant'; id: number; rating: number; comment?: string };
  // optimistic mutation
  type MutationContext = { prevReviews: any[]; prevDish?: any; prevRestaurant?: any; prevVariant?: any };
  const mutation = useMutation<Review, Error, NewReviewPayload, MutationContext>({
    mutationFn: async (payload: NewReviewPayload) => {
      try {
        console.log('Submitting review to API:', payload);
        const response = await postReview(payload);
        console.log('API response:', response);
        return response;
      } catch (err: any) {
        console.error('Mutation error:', err);
        throw err;
      }
    },
    // run before the mutation is sent
    onMutate: async (newReview: NewReviewPayload) => {
        setMessage(null);
    // cancel any outgoing refetches for all possible rateable types
    await qc.cancelQueries({ queryKey: ['dish-reviews', newReview.id] });
    await qc.cancelQueries({ queryKey: ['restaurant-reviews', newReview.id] });
    await qc.cancelQueries({ queryKey: ['variant-reviews', newReview.id] });

    // snapshot previous values depending on type
  let prevReviews: any[] = [];
  if (newReview.type === 'dish') prevReviews = qc.getQueryData<any[]>(['dish-reviews', newReview.id]) || [];
  else if (newReview.type === 'restaurant') prevReviews = qc.getQueryData<any[]>(['restaurant-reviews', newReview.id]) || [];
  else prevReviews = qc.getQueryData<any[]>(['variant-reviews', newReview.id]) || [];

  const prevDish = qc.getQueryData<any>(['dish', newReview.id]);
  const prevRestaurant = qc.getQueryData<any>(['restaurant', newReview.id]);
  const prevVariant = qc.getQueryData<any>(['variant', newReview.id]);

        if (!user || !user.id) {
          throw new Error('User must be logged in to submit a review');
        }

        // Create an optimistic review entry (id is temporary)
        const optimistic: Review = {
          id: Math.floor(Math.random() * 1e9) * -1, // negative temp id
          user_id: Number(user.id),
          user_name: user.displayName || user.email || 'You',
          user_email: user.email,
          rateable_id: newReview.id,
          rateable_type: newReview.type as 'dish' | 'restaurant' | 'variant',
          rating: newReview.rating,
          comment: newReview.comment || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          helpfulness_votes: 0,
          is_verified_visit: false,
          reported_count: 0,
          weight: 1,
          helpful_votes: 0,
          report_votes: 0,
          helpful_user_ids: [],
          reported_user_ids: []
        };

        // optimistically update the appropriate reviews cache
        if (newReview.type === 'dish') {
          qc.setQueryData(['dish-reviews', newReview.id], (old: any[] | undefined) => {
            return [optimistic, ...(old || [])];
          });
          // also bump dish aggregates locally
          if (prevDish) {
            const total = (prevDish.total_ratings || 0) + 1;
            const avg = ((prevDish.avg_rating || 0) * (total - 1) + newReview.rating) / total;
            qc.setQueryData(['dish', newReview.id], { ...prevDish, total_ratings: total, avg_rating: avg, rating: Number(avg).toFixed(1) });
          }
        } else if (newReview.type === 'restaurant') {
          qc.setQueryData(['restaurant-reviews', newReview.id], (old: any[] | undefined) => {
            return [optimistic, ...(old || [])];
          });
          if (prevRestaurant) {
            const total = (prevRestaurant.total_ratings || 0) + 1;
            const avg = ((prevRestaurant.avg_rating || 0) * (total - 1) + newReview.rating) / total;
            qc.setQueryData(['restaurant', newReview.id], { ...prevRestaurant, total_ratings: total, avg_rating: avg, rating: Number(avg).toFixed(1) });
          }
        } else if (newReview.type === 'variant') {
          qc.setQueryData(['variant-reviews', newReview.id], (old: any[] | undefined) => {
            return [optimistic, ...(old || [])];
          });
          // bump variant aggregates locally if present
          if (prevVariant) {
            const total = (prevVariant.total_ratings || 0) + 1;
            const avg = ((prevVariant.avg_rating || 0) * (total - 1) + newReview.rating) / total;
            qc.setQueryData(['variant', newReview.id], { ...prevVariant, total_ratings: total, avg_rating: avg, rating: Number(avg).toFixed(1) });
          }
  }

  return { prevReviews, prevDish, prevRestaurant, prevVariant };
      },
  onError: (_err: any, newReview: NewReviewPayload, context: MutationContext | undefined) => {
  addToast('Failed to submit rating', 'error');
        // rollback
        if (newReview.type === 'dish') {
          qc.setQueryData(['dish-reviews', newReview.id], context?.prevReviews || []);
          if (context?.prevDish) qc.setQueryData(['dish', newReview.id], context.prevDish);
        } else if (newReview.type === 'restaurant') {
          qc.setQueryData(['restaurant-reviews', newReview.id], context?.prevReviews || []);
          if (context?.prevRestaurant) qc.setQueryData(['restaurant', newReview.id], context.prevRestaurant);
        } else if (newReview.type === 'variant') {
          qc.setQueryData(['variant-reviews', newReview.id], context?.prevReviews || []);
          if (context?.prevVariant) qc.setQueryData(['variant', newReview.id], context.prevVariant);
        }
      },
      onSettled: (_data: any, _error: any, variables?: NewReviewPayload) => {
        // Invalidate so server truth is re-fetched
        if (!variables) return;
        if (variables.type === 'dish') {
          qc.invalidateQueries({ queryKey: ['dish-reviews', variables.id] });
          qc.invalidateQueries({ queryKey: ['dish', variables.id] });
        } else if (variables.type === 'restaurant') {
          qc.invalidateQueries({ queryKey: ['restaurant-reviews', variables.id] });
          qc.invalidateQueries({ queryKey: ['restaurant', variables.id] });
        } else if (variables.type === 'variant') {
          qc.invalidateQueries({ queryKey: ['variant-reviews', variables.id] });
          qc.invalidateQueries({ queryKey: ['variant', variables.id] });
        }
      }
    }
  );

  // Component mounted - can be used for any initialization if needed
  useEffect(() => {}, []);

  const validateForm = () => {
    const newErrors: { comment?: string; rating?: string; general?: string } = {};
    
    // Check required props
    if (!type || !id) {
      newErrors.general = 'Cannot submit review - missing required properties';
      console.error('Validation failed - missing props:', { type, id });
    }
    
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

  const handleSubmit = async () => {
    if (!validateForm()) {
      const errorMessage = Object.values(errors).join('. ');
      setMessage(errorMessage);
      addToast(errorMessage, 'error');
      return;
    }

    // Additional validation for required props
    if (!type || !id) {
      const errorMessage = 'Missing required review properties';
      setMessage(errorMessage);
      addToast(errorMessage, 'error');
      console.error('Review submission failed - missing required props:', { type, id });
      return;
    }

    try {
      setMessage(null);
      setLoading(true);
      
      // Validate auth before submission
      if (!user) {
        setMessage('You must be logged in to submit a review.');
        addToast('Please log in to submit a review.', 'error');
        navigate('/auth');
        return;
      }

      // Additional validation that user ID exists
      if (!user.id) {
        setMessage('Invalid user account. Please try logging in again.');
        addToast('Invalid user account', 'error');
        navigate('/auth');
        return;
      }

      // Log more detailed user info
      console.log('Submitting review with data:', { 
        type, 
        id, 
        rating, 
        comment,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName
        }
      });

      // Submit the review
      const response = await mutation.mutateAsync({ 
        type,
        id,
        rating,
        comment: comment?.trim() || undefined
      });

      // Log the response to verify the user_id is set correctly
      console.log('Review submitted successfully:', response);
      
      // Force refresh the reviews list to ensure we get the latest data
      qc.invalidateQueries({ queryKey: [`${type}-reviews`, id] });
      qc.invalidateQueries({ queryKey: [type, id] });
      
      setMessage('Thank you for your rating!');
      setRating(0);
      setComment('');
      setShowConfirmModal(false);
      addToast('Rating submitted — thanks!', 'success');
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      
      // Handle specific error cases
      if (error?.code === 'LOGIN_REQUIRED') {
        setMessage('You must be logged in to submit a review.');
        addToast('Please log in to submit a review.', 'error');
        navigate('/auth');
        return;
      }

      // Use the error message from the server if available
      const errorMessage = error?.data?.error || error?.message || 'Failed to submit rating. Please try again later.';
      setMessage(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // modal state for confirmation
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      try {
        await deleteReview(reviewId);
        // Force refresh the reviews list
        qc.invalidateQueries({ queryKey: [`${type}-reviews`, id] });
        qc.invalidateQueries({ queryKey: [type, id] });
        addToast('Review deleted successfully', 'success');
        if (onDeleteReview) {
          onDeleteReview();
        }
      } catch (error: any) {
        console.error('Error deleting review:', error);
        addToast(error?.message || 'Failed to delete review', 'error');
        throw error;
      }
    }
  });

  const handleDelete = async () => {
    // Prevent deletion of optimistic reviews (negative IDs)
    if (!currentReview?.id || currentReview.id < 1) {
      addToast('Cannot delete review: Review not yet saved or invalid.', 'error');
      setShowDeleteModal(false);
      return;
    }

    try {
      await deleteMutation.mutateAsync(currentReview.id);
      setShowDeleteModal(false);
    } catch (error) {
      // Error is handled in the mutation
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="border p-4 rounded shadow-sm">
      <h3 className="text-lg font-semibold mb-2">Rate this {type}</h3>
      <div className="space-y-2">
        <p className="text-sm text-gray-600 mb-2">Click on the stars below to rate this {type}.</p>
        <StarRating 
          rating={rating} 
          setRating={(newRating) => {
            setRating(newRating);
            setErrors(prev => ({ ...prev, rating: undefined }));
          }}
        />
        {errors.rating && (
          <p className="text-sm text-red-500">{errors.rating}</p>
        )}
      </div>
      <div className="relative">
        <textarea
          className={`w-full border rounded p-2 mt-3 ${
            errors.comment ? 'border-red-500' : 'border-gray-300'
          }`}
          rows={4}
          placeholder={`Write a short comment about this ${type} (${MIN_COMMENT_LENGTH}-${MAX_COMMENT_LENGTH} characters)`}
          value={comment}
          onChange={e => {
            setComment(e.target.value);
            setErrors(prev => ({ ...prev, comment: undefined }));
          }}
          disabled={loading}
        />
        <div className="absolute bottom-2 right-2 text-sm text-gray-500">
          {comment.length}/{MAX_COMMENT_LENGTH}
        </div>
        {errors.comment && (
          <p className="mt-1 text-sm text-red-500">{errors.comment}</p>
        )}
      </div>
      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={() => {
            if (!validateForm()) {
              const errorMessage = Object.values(errors).join('. ');
              setMessage(errorMessage);
              addToast(errorMessage, 'error');
              return;
            }
            setShowConfirmModal(true);
          }}
          className={`px-4 py-2 text-white rounded transition-all duration-200 ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : rating < 1
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
          disabled={loading || rating < 1}
        >
          {loading ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </div>
          ) : (
            'Submit Rating'
          )}
        </button>
        <span className="text-sm text-gray-500">
          {rating ? `Your rating: ${rating} star${rating !== 1 ? 's' : ''}` : 'Select a rating'}
        </span>
      </div>
      {/* Submit Review Modal */}
      <ConfirmModal
        open={showConfirmModal}
        title="Submit review"
        message="Are you sure you want to submit this review?"
        confirmLabel="Submit"
        cancelLabel="Cancel"
        onConfirm={() => handleSubmit()}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* Delete Review Modal */}
      <ConfirmModal
        open={showDeleteModal}
        title="Delete Review"
        message="Are you sure you want to delete this review? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => handleDelete()}
        onCancel={() => setShowDeleteModal(false)}
      />

  {/* Delete Button: Always show for user's own review in edit mode, regardless of id value */}
  {formMode === 'edit' && currentReview && user?.id === currentReview.user_id && !loading && !mutation.isPending && (
    <div className="mt-4 border-t pt-4">
      <button
        onClick={() => setShowDeleteModal(true)}
        className="flex items-center gap-1 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors text-sm"
        disabled={deleteMutation.isPending}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {deleteMutation.isPending ? 'Deleting...' : 'Delete Review'}
      </button>
    </div>
  )}

      {message && <p className="mt-2 text-sm">{message}</p>}
    </div>
  );
};

export default RatingForm;