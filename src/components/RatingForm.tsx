import React, { useState, useEffect } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import StarRating from './StarRating';
import { postReview } from '../utils/api';
import { useToast } from './ToastProvider';
import ConfirmModal from './ConfirmModal';
import { containsProfanity, filterProfanity, RATE_LIMIT } from '../utils/content-filter';

interface RatingFormProps {
  rateableId: number;
  rateableType: 'dish' | 'restaurant' | 'variant';
}

const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 500;

const RatingForm: React.FC<RatingFormProps> = ({ rateableId, rateableType }) => {
  const [rating, setRating] = useState<number>(0);
  const [message, setMessage] = useState<string | null>(null);
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ comment?: string; rating?: string }>({});
  const qc = useQueryClient();
  const addToast = useToast();
  type NewReviewPayload = { rateable_id: number; rateable_type: 'dish'|'restaurant'|'variant'; rating: number; comment?: string };
  // optimistic mutation
  type MutationContext = { prevReviews: any[]; prevDish?: any; prevRestaurant?: any; prevVariant?: any };
  const mutation = useMutation<unknown, unknown, NewReviewPayload, MutationContext>({
    mutationFn: (payload: NewReviewPayload) => postReview(payload),
    // run before the mutation is sent
    onMutate: async (newReview: NewReviewPayload) => {
        setMessage(null);
    // cancel any outgoing refetches for all possible rateable types
    await qc.cancelQueries({ queryKey: ['dish-reviews', newReview.rateable_id] });
    await qc.cancelQueries({ queryKey: ['restaurant-reviews', newReview.rateable_id] });
    await qc.cancelQueries({ queryKey: ['variant-reviews', newReview.rateable_id] });

    // snapshot previous values depending on rateable type
  let prevReviews: any[] = [];
  if (newReview.rateable_type === 'dish') prevReviews = qc.getQueryData<any[]>(['dish-reviews', newReview.rateable_id]) || [];
  else if (newReview.rateable_type === 'restaurant') prevReviews = qc.getQueryData<any[]>(['restaurant-reviews', newReview.rateable_id]) || [];
  else prevReviews = qc.getQueryData<any[]>(['variant-reviews', newReview.rateable_id]) || [];

  const prevDish = qc.getQueryData<any>(['dish', newReview.rateable_id]);
  const prevRestaurant = qc.getQueryData<any>(['restaurant', newReview.rateable_id]);
  const prevVariant = qc.getQueryData<any>(['variant', newReview.rateable_id]);

        // create an optimistic review entry (id is temporary)
        const optimistic: any = {
          id: Math.floor(Math.random() * 1e9) * -1, // negative temp id
          user_id: Number((localStorage.getItem('auth_user') && JSON.parse(localStorage.getItem('auth_user')!)).id) || null,
          user_name: (localStorage.getItem('auth_user') && JSON.parse(localStorage.getItem('auth_user')!).display_name) || (localStorage.getItem('auth_user') && JSON.parse(localStorage.getItem('auth_user')!).email) || 'You',
          rateable_id: newReview.rateable_id,
          rateable_type: newReview.rateable_type,
          rating: newReview.rating,
          comment: newReview.comment || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // optimistically update the appropriate reviews cache
        if (newReview.rateable_type === 'dish') {
          qc.setQueryData(['dish-reviews', newReview.rateable_id], (old: any[] | undefined) => {
            return [optimistic, ...(old || [])];
          });
          // also bump dish aggregates locally
          if (prevDish) {
            const total = (prevDish.total_ratings || 0) + 1;
            const avg = ((prevDish.avg_rating || 0) * (total - 1) + newReview.rating) / total;
            qc.setQueryData(['dish', newReview.rateable_id], { ...prevDish, total_ratings: total, avg_rating: avg, rating: Number(avg).toFixed(1) });
          }
        } else if (newReview.rateable_type === 'restaurant') {
          qc.setQueryData(['restaurant-reviews', newReview.rateable_id], (old: any[] | undefined) => {
            return [optimistic, ...(old || [])];
          });
          if (prevRestaurant) {
            const total = (prevRestaurant.total_ratings || 0) + 1;
            const avg = ((prevRestaurant.avg_rating || 0) * (total - 1) + newReview.rating) / total;
            qc.setQueryData(['restaurant', newReview.rateable_id], { ...prevRestaurant, total_ratings: total, avg_rating: avg, rating: Number(avg).toFixed(1) });
          }
        } else if (newReview.rateable_type === 'variant') {
          qc.setQueryData(['variant-reviews', newReview.rateable_id], (old: any[] | undefined) => {
            return [optimistic, ...(old || [])];
          });
          // bump variant aggregates locally if present
          if (prevVariant) {
            const total = (prevVariant.total_ratings || 0) + 1;
            const avg = ((prevVariant.avg_rating || 0) * (total - 1) + newReview.rating) / total;
            qc.setQueryData(['variant', newReview.rateable_id], { ...prevVariant, total_ratings: total, avg_rating: avg, rating: Number(avg).toFixed(1) });
          }
  }

  return { prevReviews, prevDish, prevRestaurant, prevVariant };
      },
  onError: (_err: any, newReview: NewReviewPayload, context: MutationContext | undefined) => {
  addToast('Failed to submit rating', 'error');
        // rollback
        if (newReview.rateable_type === 'dish') {
          qc.setQueryData(['dish-reviews', newReview.rateable_id], context?.prevReviews || []);
          if (context?.prevDish) qc.setQueryData(['dish', newReview.rateable_id], context.prevDish);
        } else if (newReview.rateable_type === 'restaurant') {
          qc.setQueryData(['restaurant-reviews', newReview.rateable_id], context?.prevReviews || []);
          if (context?.prevRestaurant) qc.setQueryData(['restaurant', newReview.rateable_id], context.prevRestaurant);
        } else if (newReview.rateable_type === 'variant') {
          qc.setQueryData(['variant-reviews', newReview.rateable_id], context?.prevReviews || []);
          if (context?.prevVariant) qc.setQueryData(['variant', newReview.rateable_id], context.prevVariant);
        }
      },
      onSettled: (_data: any, _error: any, variables?: NewReviewPayload) => {
        // Invalidate so server truth is re-fetched
        if (!variables) return;
        if (variables.rateable_type === 'dish') {
          qc.invalidateQueries({ queryKey: ['dish-reviews', variables.rateable_id] });
          qc.invalidateQueries({ queryKey: ['dish', variables.rateable_id] });
        } else if (variables.rateable_type === 'restaurant') {
          qc.invalidateQueries({ queryKey: ['restaurant-reviews', variables.rateable_id] });
          qc.invalidateQueries({ queryKey: ['restaurant', variables.rateable_id] });
        } else if (variables.rateable_type === 'variant') {
          qc.invalidateQueries({ queryKey: ['variant-reviews', variables.rateable_id] });
          qc.invalidateQueries({ queryKey: ['variant', variables.rateable_id] });
        }
      }
    }
  );

  useEffect(() => {
    // Check rate limiting on component mount
    const reviews = JSON.parse(localStorage.getItem('user_reviews') || '[]');
    const recentReviews = reviews.filter((r: any) => 
      Date.now() - new Date(r.timestamp).getTime() < RATE_LIMIT.timeframe
    );
    
    if (recentReviews.length >= RATE_LIMIT.maxReviews) {
      setMessage('You have reached the maximum number of reviews for today. Please try again tomorrow.');
      setLoading(true); // Disable the form
    }
  }, []);

  const validateForm = () => {
    const newErrors: { comment?: string; rating?: string } = {};
    
    // Check rate limiting
    const reviews = JSON.parse(localStorage.getItem('user_reviews') || '[]');
    const recentReviews = reviews.filter((r: any) => 
      Date.now() - new Date(r.timestamp).getTime() < RATE_LIMIT.timeframe
    );
    
    if (recentReviews.length >= RATE_LIMIT.maxReviews) {
      newErrors.rating = 'You have reached the maximum number of reviews for today. Please try again tomorrow.';
      return false;
    }
    
    const lastReview = recentReviews[recentReviews.length - 1];
    if (lastReview && Date.now() - new Date(lastReview.timestamp).getTime() < RATE_LIMIT.minTimeBetweenReviews) {
      newErrors.rating = 'Please wait a few minutes before submitting another review.';
      return false;
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

    try {
      setMessage(null);
      setLoading(true);
      mutation.mutate({ rateable_id: rateableId, rateable_type: rateableType, rating, comment: comment?.trim() || undefined });
      // Track the review for rate limiting
      const reviews = JSON.parse(localStorage.getItem('user_reviews') || '[]');
      reviews.push({
        timestamp: new Date().toISOString(),
        rateableId,
        rateableType
      });
      localStorage.setItem('user_reviews', JSON.stringify(reviews));
      
      setMessage('Thank you for your rating!');
      // reset form
      setRating(0);
      setComment('');
  addToast('Rating submitted — thanks!', 'success');
    } catch (error) {
      console.error('Error submitting rating:', error);
      setMessage('Failed to submit rating. Please try again later.');
  addToast('Failed to submit rating', 'error');
    } finally {
      setLoading(false);
    }
  };

  // modal state for confirmation
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  return (
    <div className="border p-4 rounded shadow-sm">
      <h3 className="text-lg font-semibold mb-2">Rate this {rateableType}</h3>
      <div className="space-y-2">
        <p className="text-sm text-gray-600 mb-2">Click on the stars below to rate this {rateableType}.</p>
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
          placeholder={`Write a short comment about this ${rateableType} (${MIN_COMMENT_LENGTH}-${MAX_COMMENT_LENGTH} characters)`}
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
      <ConfirmModal
        open={showConfirmModal}
        title="Submit review"
        message="Are you sure you want to submit this review?"
        confirmLabel="Submit"
        cancelLabel="Cancel"
        onConfirm={() => handleSubmit()}
        onCancel={() => setShowConfirmModal(false)}
      />
      {message && <p className="mt-2 text-sm">{message}</p>}
    </div>
  );
};

export default RatingForm;