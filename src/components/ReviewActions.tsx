import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Flag, BadgeCheck } from 'lucide-react';
import { voteReview, respondToReview, verifyReview } from '../utils/review-actions';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../hooks/useAuth';

interface ReviewActionsProps {
  reviewId: number;
  helpfulVotes: number;
  reportCount: number;
  isVerified: boolean;
  hasUserVotedHelpful: boolean;
  hasUserReported: boolean;
  onVoteChange: () => void;
}

const ReviewActions: React.FC<ReviewActionsProps> = ({
  reviewId,
  helpfulVotes,
  reportCount,
  isVerified,
  hasUserVotedHelpful,
  hasUserReported,
  onVoteChange,
}) => {
  const { user } = useAuth();
  const addToast = useToast();
  const [loading, setLoading] = useState<'helpful' | 'report' | 'verify' | null>(null);

  const handleVote = async (voteType: 'helpful' | 'report') => {
    if (!user) {
      addToast('Please log in to vote on reviews', 'error');
      return;
    }

    try {
      setLoading(voteType);
      await voteReview(reviewId, voteType);
      onVoteChange();
      addToast(
        voteType === 'helpful' 
          ? hasUserVotedHelpful ? 'Helpful vote removed' : 'Marked as helpful' 
          : hasUserReported ? 'Report removed' : 'Review reported',
        hasUserVotedHelpful || hasUserReported ? 'info' : 'success'
      );
    } catch (error) {
      addToast('Failed to process vote', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleVerify = async () => {
    if (!user || !['admin', 'owner'].includes(user.role)) {
      return;
    }

    try {
      setLoading('verify');
      await verifyReview(reviewId);
      onVoteChange();
      addToast('Review marked as verified', 'success');
    } catch (error) {
      addToast('Failed to verify review', 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-3 text-sm mt-2">
      <button
        onClick={() => handleVote('helpful')}
        disabled={loading !== null}
        className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
          hasUserVotedHelpful
            ? 'bg-green-100 text-green-700'
            : 'hover:bg-neutral-100'
        }`}
      >
        <ThumbsUp size={16} className={loading === 'helpful' ? 'animate-pulse' : ''} />
        <span>{helpfulVotes}</span>
      </button>

      {user && ['admin', 'owner', 'moderator'].includes(user.role) && (
        <button
          onClick={() => handleVote('report')}
          disabled={loading !== null}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
            hasUserReported
              ? 'bg-red-100 text-red-700'
              : 'hover:bg-neutral-100'
          }`}
        >
          <Flag size={16} className={loading === 'report' ? 'animate-pulse' : ''} />
          <span>{reportCount}</span>
        </button>
      )}

      {isVerified && (
        <span className="flex items-center gap-1 text-green-600">
          <BadgeCheck size={16} />
          Verified
        </span>
      )}

      {user && ['admin', 'owner'].includes(user.role) && !isVerified && (
        <button
          onClick={handleVerify}
          disabled={loading !== null}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-100 transition-colors"
        >
          <BadgeCheck size={16} className={loading === 'verify' ? 'animate-pulse' : ''} />
          Verify
        </button>
      )}
    </div>
  );
};

export default ReviewActions;