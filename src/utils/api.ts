// Helper: calculate average rating from reviews array
export function calculateAverageRating(reviews: Array<{ rating?: number }>): number {
  if (!reviews || !reviews.length) return 0;
  const valid = reviews.map(r => Number(r.rating ?? 0)).filter(n => !isNaN(n));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
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
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public data?: any,
    public url?: string
  ) {
    super(message);
    this.name = 'ApiError';
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
};

// Fetch all reviews for a dish or restaurant
export const fetchReviews = (rateable_id: number, rateable_type: 'dish'|'restaurant') =>
  get<Review[]>(`/api/reviews?rateable_id=${rateable_id}&rateable_type=${rateable_type}`);

// Fetch all reviews by the logged-in user
export const fetchUserReviews = () => get<Review[]>(`/api/user/reviews`);

// Create or update a review (rating + comment)
export const postReview = async (data: {
  rateable_id: number;
  rateable_type: 'dish'|'restaurant'|'variant';
  rating: number;
  comment?: string;
  // optional: user_id (will be filled from localStorage if not provided)
}) => {
    // Check for login
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('auth_user');
    if (!token || !user) {
      const err: any = new Error('You must be logged in to post a review.');
      err.code = 'LOGIN_REQUIRED';
      throw err;
    }
    const body: any = { rateable_id: data.rateable_id, rateable_type: data.rateable_type, rating: data.rating, comment: data.comment };
    return post('/api/reviews', body);
  };

// Edit a review
export const updateReview = async (id: number, data: { rating: number; comment?: string }) => {
  return request(`/api/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) });
};

// Delete a review
export const deleteReview = async (id: number) => {
  return del(`/api/reviews/${id}`);
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