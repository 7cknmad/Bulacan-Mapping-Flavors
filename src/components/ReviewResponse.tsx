import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { respondToReview } from '../utils/review-actions';
import { MessageSquare } from 'lucide-react';

interface ReviewResponseProps {
  reviewId: number;
  existingResponse?: {
    text: string;
    by: string;
    date: string;
  };
  onResponseSubmit: () => void;
}

const ReviewResponse: React.FC<ReviewResponseProps> = ({
  reviewId,
  existingResponse,
  onResponseSubmit
}) => {
  const { user } = useAuth();
  const addToast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [response, setResponse] = useState(existingResponse?.text || '');
  const [loading, setLoading] = useState(false);

  // Only owners/admins can respond
  if (!user || !['owner', 'admin'].includes(user.role || '')) {
    if (existingResponse) {
      return (
        <div className="mt-4 pl-8 border-l-2 border-neutral-200">
          <div className="text-sm text-neutral-500 mb-1">
            Response from {existingResponse.by} ({new Date(existingResponse.date).toLocaleDateString()})
          </div>
          <div className="text-neutral-700">{existingResponse.text}</div>
        </div>
      );
    }
    return null;
  }

  const handleSubmit = async () => {
    if (!response.trim()) {
      addToast('Response cannot be empty', 'error');
      return;
    }

    try {
      setLoading(true);
      await respondToReview(reviewId, response.trim());
      setIsEditing(false);
      onResponseSubmit();
      addToast('Response submitted successfully', 'success');
    } catch (error) {
      addToast('Failed to submit response', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isEditing && existingResponse) {
    return (
      <div className="mt-4 pl-8 border-l-2 border-neutral-200">
        <div className="text-sm text-neutral-500 mb-1 flex justify-between items-center">
          <span>
            Response from {existingResponse.by} ({new Date(existingResponse.date).toLocaleDateString()})
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="text-primary-600 hover:text-primary-700 text-sm"
          >
            Edit
          </button>
        </div>
        <div className="text-neutral-700">{existingResponse.text}</div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {!existingResponse && (
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-2"
        >
          <MessageSquare size={16} />
          <span>Respond to this review</span>
        </button>
      )}
      
      {isEditing && (
        <div className="space-y-3">
          <textarea
            className="w-full border rounded-lg p-3 min-h-[100px]"
            placeholder="Write your response..."
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            disabled={loading}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Response'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setResponse(existingResponse?.text || '');
              }}
              disabled={loading}
              className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewResponse;