// Helper: calculate average rating from reviews array using weights
export function calculateAverageRating(reviews: Array<{ rating?: number; weight?: number }>): number {
  if (!reviews || !reviews.length) return 0;
  
  // Filter out reviews with invalid ratings
  const validReviews = reviews.filter(r => 
    !isNaN(Number(r.rating)) && 
    r.rating != null && 
    r.rating > 0 && 
    r.rating <= 5
  );
  
  if (!validReviews.length) return 0;

  // Calculate weighted average
  const weightedSum = validReviews.reduce((sum, r) => 
    sum + (Number(r.rating) * (r.weight ?? 1)), 0
  );
  const totalWeight = validReviews.reduce((sum, r) => 
    sum + (r.weight ?? 1), 0
  );

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
// src/utils/api.ts — public client, safe for admin builds too

const env = (import.meta as any).env || {};
export const API = (() => {
  const base = (
    env.VITE_ADMIN_API_URL ||  // prefer admin base in admin builds
    env.VITE_API_URL ||        // public base otherwise
    "http://localhost:3002"
  ).replace(/\/+$/, "");
  
  console.log('[API] Using base URL:', {
    VITE_ADMIN_API_URL: env.VITE_ADMIN_API_URL,
    VITE_API_URL: env.VITE_API_URL,
    base
  });
  
  return base;
})();

// Send cookies only when needed (auth/admin)
function needsCreds(path: string) {
  const p = path.startsWith("http") ? new URL(path).pathname : path;
  return p.startsWith("/auth") || p.startsWith("/admin");
}

export class ApiError extends Error {
  code?: string;
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public data?: any,
    public url?: string
  ) {
    super(message);
    this.name = 'ApiError';
    // Add code property for auth errors
    if (status === 401 || message.includes('must be logged in')) {
      this.code = 'LOGIN_REQUIRED';
    }
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  // Attach Authorization header from localStorage token when available
  const headers: Record<string,string> = { "Content-Type": "application/json", ...((init?.headers as any) ?? {}) };
  try {
    const token = localStorage.getItem('auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {}

  console.log(`[API] ${init?.method || 'GET'} ${url}`);
  
  const startTime = Date.now();
  try {
    const res = await fetch(url, {
      credentials: needsCreds(path) ? "include" : "omit",
      headers,
      ...init,
    });
    
    const text = await res.text().catch(() => "");
    const endTime = Date.now();
    
    console.log(`[API] Response for ${url} (${endTime - startTime}ms):`, {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      bodyPreview: text.slice(0, 200)
    });

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (!res.ok) {
        throw new ApiError(
          `HTTP ${res.status} ${res.statusText}`,
          res.status,
          res.statusText,
          text,
          url
        );
      }
      return text as unknown as T;
    }

    if (!res.ok) {
      throw new ApiError(
        data.message || `HTTP ${res.status} ${res.statusText}`,
        res.status,
        res.statusText,
        data,
        url
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error(`[API] Request failed for ${url}:`, error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      undefined,
      undefined,
      error,
      url
    );
  }
}

export const get  = <T,>(p: string) => request<T>(p);
export const post = <T,>(p: string, b?: any) => request<T>(p, { method: "POST", body: b ? JSON.stringify(b) : undefined });
export const del  = <T,>(p: string) => request<T>(p, { method: "DELETE" });

/* ================== Types (same as yours, keep as-is or trim) ================== */
export type Municipality = { id: number; name: string; slug: string; description?: string|null; province?: string; lat?: number; lng?: number; image_url?: string|null };
export type Dish = { 
  id: number; 
  slug: string; 
  name: string; 
  description?: string|null; 
  image_url?: string|null; 
  rating?: number|null; 
  avg_rating?: number|null; 
  total_ratings?: number|null; 
  popularity?: number|null; 
  flavor_profile?: string[]|null; 
  ingredients?: string[]|null; 
  municipality_id: number; 
  municipality_name?: string; 
  category?: "food"|"delicacy"|"drink";
  price?: number|null;
  dietary_info?: Array<"vegetarian"|"vegan"|"halal"|"gluten_free">;
  spicy_level?: "not_spicy"|"mild"|"medium"|"hot"|"very_hot";
};
export type Restaurant = { id: number; name: string; slug: string; kind?: 'restaurant'|'stall'|'store'|'dealer'|'market'|'home-based'; description?: string|null; address?: string; phone?: string|null; website?: string|null; facebook?: string|null; instagram?: string|null; opening_hours?: string|null; price_range?: "budget"|"moderate"|"expensive"; cuisine_types?: string[]|null; rating?: number|null; avg_rating?: number|null; total_ratings?: number|null; lat?: number; lng?: number; image_url?: string|null; municipality_name?: string };

export type Variant = {
  id: number;
  dish_id?: number | null;
  restaurant_id?: number | null;
  name: string;
  description?: string | null;
  price?: number | null;
  is_available?: boolean | number | null;
  image_url?: string | null;
};

/* ================== Public endpoints ================== */
export const fetchMunicipalities = () => get<Municipality[]>(`/api/municipalities`);

export const fetchDishBySlug = async (slug: string) => get<Dish>(`/api/dish/${slug}`);

export const fetchDishes = (opts: { municipalityId?: number; category?: string; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.category)       qs.set("category", String(opts.category));
  if (opts.q)              qs.set("q", String(opts.q));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return get<Dish[]>(`/api/dishes${suffix}`);
};

export type RestaurantsResponse = { rows: Restaurant[]; total: number };
export const fetchRestaurants = (opts: { municipalityId?: number; dishId?: number; q?: string; lat?: number; lng?: number; radiusKm?: number; page?: number; perPage?: number } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.dishId)         qs.set("dishId", String(opts.dishId));
  if (opts.q)              qs.set("q", String(opts.q));
  if (opts.lat != null)    qs.set('lat', String(opts.lat));
  if (opts.lng != null)    qs.set('lng', String(opts.lng));
  if (opts.radiusKm != null) qs.set('radiusKm', String(opts.radiusKm));
  if (opts.page != null)   qs.set('page', String(opts.page));
  if (opts.perPage != null) qs.set('perPage', String(opts.perPage));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return get<RestaurantsResponse>(`/api/restaurants${suffix}`);
};
export const fetchTopDishes = async (municipalityId: number): Promise<Dish[]> => {
  const qs = new URLSearchParams({ municipalityId: String(municipalityId) });
  return get<Dish[]>(`/api/top-dishes?${qs}`);
};

// Simple in-memory cache for restaurant queries to reduce repeated network calls
const _cache = new Map<string, { ts: number; data: any }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function _cacheGet<T>(key: string): T | null {
  const ent = _cache.get(key);
  if (!ent) return null;
  if (Date.now() - ent.ts > CACHE_TTL) {
    _cache.delete(key);
    return null;
  }
  return ent.data as T;
}

function _cacheSet(key: string, data: any) {
  _cache.set(key, { ts: Date.now(), data });
}

export function clearRestaurantsCache() {
  _cache.clear();
}

export const fetchTopRestaurants = async (municipalityId: number): Promise<Restaurant[]> => {
  const key = `topRest:${municipalityId}`;
  const cached = _cacheGet<Restaurant[]>(key);
  if (cached) return cached;
  const qs = new URLSearchParams({ municipalityId: String(municipalityId) });
  const data = await get<Restaurant[]>(`/api/top-restaurants?${qs}`);
  _cacheSet(key, data);
  return data;
};

export const fetchRestaurantsCached = async (opts: { municipalityId?: number; dishId?: number; q?: string; lat?: number; lng?: number; radiusKm?: number; page?: number; perPage?: number } = {}): Promise<RestaurantsResponse> => {
  // Build a stable cache key based on relevant params
  const parts: string[] = [];
  if (opts.municipalityId) parts.push(`m:${opts.municipalityId}`);
  if (opts.dishId) parts.push(`d:${opts.dishId}`);
  if (opts.q) parts.push(`q:${opts.q}`);
  if (opts.lat != null && opts.lng != null) parts.push(`geo:${opts.lat},${opts.lng},r:${opts.radiusKm ?? ''}`);
  if (opts.page != null) parts.push(`p:${opts.page}`);
  if (opts.perPage != null) parts.push(`pp:${opts.perPage}`);
  const key = `rests:${parts.join('|')}`;
  const cached = _cacheGet<RestaurantsResponse>(key);
  if (cached) return cached;
  const resp = await fetchRestaurants(opts);
  _cacheSet(key, resp);
  return resp;
};

// Variants
export const fetchDishVariants = (dishId: number) => get<Variant[]>(`/api/dishes/${dishId}/variants`);
export const fetchRestaurantVariants = (restaurantId: number) => get<Variant[]>(`/api/restaurants/${restaurantId}/variants`);


// ================== User-based Review Endpoints ==================
export type Review = {
  id: number;
  user_id: number;
  rateable_id: number;
  rateable_type: 'dish' | 'restaurant' | 'variant';
  rating: number;
  comment?: string|null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  helpfulness_votes: number;
  is_verified_visit: boolean;
  reported_count: number;
  response_text?: string|null;
  response_date?: string|null;
  response_by_name?: string|null;
  weight: number;
  helpful_votes: number;
  report_votes: number;
  helpful_user_ids: number[];
  reported_user_ids: number[];
};

export type ReviewStats = {
  distribution: Array<{
    rating: number;
    count: number;
    avg_weight: number;
  }>;
  stats: {
    total_reviews: number;
    average_rating: number;
    verified_visits: number;
    total_helpful_votes: number;
    rating_percentages: Record<number, string>; // e.g. { "5": "45.5", "4": "30.0", ... }
  };
  trend: Array<{
    month: string;
    review_count: number;
    avg_rating: number;
  }>;
};

// Fetch all reviews for a dish or restaurant
export const fetchReviews = (
  rateable_id: number,
  rateable_type: 'dish'|'restaurant',
  opts?: { sort?: 'helpfulness'|'recent'|'rating'; page?: number; perPage?: number }
) => {
  const qs = new URLSearchParams();
  if (opts?.sort) qs.set('sort', String(opts.sort));
  if (opts?.page != null) qs.set('page', String(opts.page));
  if (opts?.perPage != null) qs.set('perPage', String(opts.perPage));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return get<Review[]>(`/api/reviews/${rateable_type}/${rateable_id}${suffix}`);
};

// Fetch all reviews by the logged-in user
export const fetchUserReviews = () => get<Review[]>(`/api/user/reviews`);

// Create or update a review (rating + comment)
export const postReview = async (data: {
  type: 'dish'|'restaurant';
  id: number;
  rating: number;
  comment?: string;
}) => {
    // Log request data for debugging
    console.log('[Review API] Starting review submission:', {
      type: data.type,
      id: data.id,
      rating: data.rating,
      hasComment: !!data.comment,
      commentLength: data.comment?.length
    });

    // Check for login
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('auth_user');
    console.log('[Review API] Auth check:', { 
      hasToken: !!token, 
      hasUser: !!user 
    });
    
    if (!token || !user) {
      console.error('[Review API] Auth required error - missing token or user');
      const err = new ApiError('You must be logged in to post a review.');
      err.code = 'LOGIN_REQUIRED';
      throw err;
    }

    // Validate data
    if (!data.type || !['dish', 'restaurant'].includes(data.type)) {
      console.error('[Review API] Invalid type:', data.type);
      throw new ApiError('Invalid review type');
    }
    if (!data.id || isNaN(Number(data.id))) {
      console.error('[Review API] Invalid ID:', data.id);
      throw new ApiError('Invalid item ID');
    }
    if (!data.rating || isNaN(Number(data.rating)) || data.rating < 1 || data.rating > 5) {
      console.error('[Review API] Invalid rating:', data.rating);
      throw new ApiError('Rating must be between 1 and 5');
    }

    console.log('[Review API] Validation passed, submitting review:', { 
      type: data.type,
      id: data.id,
      rating: data.rating,
      hasComment: !!data.comment,
      userLoggedIn: !!user
    });

    try {
      console.log('[Review API] Making POST request to:', `/api/reviews/${data.type}/${data.id}`);
      
      const response = await post<Review>(`/api/reviews/${data.type}/${data.id}`, {
        rating: Number(data.rating),
        comment: data.comment?.trim() || undefined
      });
      
      console.log('[Review API] Success response:', response);
      return response;
    } catch (err: any) {
      console.error('[Review API] Error details:', {
        error: err,
        status: err.status,
        message: err.message,
        data: err.data,
        stack: err.stack
      });

      if (err.status === 401) {
        const authErr = new ApiError('You must be logged in to post a review.');
        authErr.code = 'LOGIN_REQUIRED';
        throw authErr;
      }

      if (err instanceof ApiError) {
        throw err;
      }

      throw new ApiError(
        err.data?.error || err.message || 'Failed to submit review',
        err.status,
        err.statusText,
        err.data
      );
    }
};

// Edit a review
export const updateReview = async (id: number, data: { rating: number; comment?: string }) => {
  return request<Review>(`/api/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};

// Delete a review
export const deleteReview = async (id: number) => {
  return del(`/api/reviews/${id}`);
};

// Vote on a review (helpful or report)
export const voteOnReview = async (reviewId: number, voteType: 'helpful'|'report') => {
  return post(`/api/reviews/${reviewId}/vote`, { voteType });
};

// Add owner response to a review
export const respondToReview = async (reviewId: number, response: string) => {
  return post(`/api/reviews/${reviewId}/respond`, { response });
};

// Mark a review as a verified visit
export const verifyReview = async (reviewId: number) => {
  return post(`/api/reviews/${reviewId}/verify`, {});
};

// Get review statistics for an item
export const getReviewStats = async (type: 'dish'|'restaurant', id: number): Promise<ReviewStats> => {
  return get(`/api/reviews/${type}/${id}/stats`);
};

// ================== User Favorites Endpoints ==================

// Fetch all favorites for the logged-in user
export const fetchUserFavorites = () => get<Array<{item_id: number, item_type: 'dish'|'restaurant'}>>(`/api/user/favorites`);

// Add an item to favorites
export const addToFavorites = async (itemType: 'dish'|'restaurant', itemId: number) => {
  const token = localStorage.getItem('auth_token');
  const user = localStorage.getItem('auth_user');
  if (!token || !user) {
    const err: any = new Error('You must be logged in to add favorites.');
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }
  return post(`/api/user/favorites`, { itemType, itemId });
};

// Remove an item from favorites
export const removeFromFavorites = async (itemType: 'dish'|'restaurant', itemId: number) => {
  const token = localStorage.getItem('auth_token');
  const user = localStorage.getItem('auth_user');
  if (!token || !user) {
    const err: any = new Error('You must be logged in to remove favorites.');
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }
  return del(`/api/user/favorites/${itemType}/${itemId}`);
};

// Check favorite status for multiple items at once
export const checkFavoritesStatus = (items: Array<{itemType: 'dish'|'restaurant', itemId: number}>) =>
  post<Record<string, boolean>>(`/api/user/favorites/check`, { items });