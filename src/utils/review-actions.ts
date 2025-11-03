import { request } from './api';
import type { ReviewStats } from './api';

export interface ReviewVoteResponse {
  message: string;
}

export interface ReviewResponse {
  message: string;
}

export interface ReviewVerificationResponse {
  message: string;
}

export const voteReview = async (reviewId: number, voteType: 'helpful' | 'report'): Promise<ReviewVoteResponse> => {
  return request<ReviewVoteResponse>(`/api/reviews/${reviewId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ voteType }),
  });
};

export const respondToReview = async (reviewId: number, response: string): Promise<ReviewResponse> => {
  return request<ReviewResponse>(`/api/reviews/${reviewId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ response }),
  });
};

export const verifyReview = async (reviewId: number): Promise<ReviewVerificationResponse> => {
  return request<ReviewVerificationResponse>(`/api/reviews/${reviewId}/verify`, {
    method: 'POST',
  });
};

export const getReviewStats = async (type: 'dish' | 'restaurant', id: number): Promise<ReviewStats> => {
  return request<ReviewStats>(`/api/reviews/${type}/${id}/stats`);
};