// src/utils/adminApi.ts
// API base (no trailing slash)
export const API = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

// Generic request helper (ALWAYS send credentials for admin endpoints)
async function request<T = any>(method: string, path: string, body?: any): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`);
  try { return text ? JSON.parse(text) as T : (null as T); } catch { return null as T; }
}
const get  = <T=any>(p: string) => request<T>("GET", p);
const post = <T=any>(p: string, b?: any) => request<T>("POST", p, b);
const patch= <T=any>(p: string, b?: any) => request<T>("PATCH", p, b);
const del  = <T=any>(p: string) => request<T>("DELETE", p);

// ---------------------- Auth ----------------------
export const adminAuth = {
  // POST /api/admin/auth/login  -> sets httpOnly cookie
  login: (email: string, password: string) =>
    post<{ user: { id: number; email: string } }>("/api/admin/auth/login", { email, password }),

  // GET /api/admin/auth/me      -> reads cookie
  me: () => get<{ user?: { id: number; email: string } }>("/api/admin/auth/me"),

  // POST /api/admin/auth/logout -> clears cookie
  logout: () => post("/api/admin/auth/logout"),
};

// ---------------------- Shared lookups ----------------------
export type Municipality = { id: number; name: string; slug: string };

// ---------------------- Dishes ----------------------
export type Dish = {
  id: number;
  municipality_id: number;
  name: string; slug: string;
  description: string | null;
  image_url: string | null;
  category: "food" | "delicacy" | "drink";
  flavor_profile?: string[] | string | null;
  ingredients?: string[] | string | null;
  popularity?: number | null;
  rating?: number | null;
  is_signature?: number | null;
  panel_rank?: number | null;
};

export const listDishes = (opts: { municipalityId?: number|null; category?: string; q?: string; signature?: 0|1; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.category)      qs.set("category", String(opts.category));
  if (opts.q)             qs.set("q", String(opts.q));
  if (opts.signature != null) qs.set("signature", String(opts.signature));
  if (opts.limit)         qs.set("limit", String(opts.limit));
  return get<Dish[]>(`/api/dishes${qs.toString() ? `?${qs.toString()}` : ""}`);
};
export const createDish       = (payload: Partial<Dish>) => post<Dish>("/api/admin/dishes", payload);
export const updateDish       = (id: number, payload: Partial<Dish>) => patch<Dish>(`/api/admin/dishes/${id}`, payload);
export const deleteDish       = (id: number) => del(`/api/admin/dishes/${id}`);

// ---------------------- Restaurants ----------------------
export type Restaurant = {
  id: number;
  municipality_id?: number;
  name: string; slug: string; kind?: string;
  description?: string | null;
  address: string;
  phone?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  opening_hours?: string | null;
  price_range?: "budget" | "moderate" | "expensive";
  cuisine_types?: string[] | string | null;
  rating?: number | null;
  lat: number; lng: number;
  image_url?: string | null;
  featured?: number | null;
  featured_rank?: number | null;
};

export const listRestaurants = (opts: { municipalityId?: number|null; dishId?: number; q?: string; featured?: 0|1; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.dishId)         qs.set("dishId", String(opts.dishId));
  if (opts.q)              qs.set("q", String(opts.q));
  if (opts.featured != null) qs.set("featured", String(opts.featured));
  if (opts.limit)          qs.set("limit", String(opts.limit));
  return get<Restaurant[]>(`/api/restaurants${qs.toString() ? `?${qs.toString()}` : ""}`);
};
export const createRestaurant = (payload: Partial<Restaurant>) => post<Restaurant>("/api/admin/restaurants", payload);
export const updateRestaurant = (id: number, payload: Partial<Restaurant>) => patch<Restaurant>(`/api/admin/restaurants/${id}`, payload);
export const deleteRestaurant = (id: number) => del(`/api/admin/restaurants/${id}`);

// ---------------------- Linking ----------------------
export const listRestaurantsForDish = (dishId: number) =>
  get<any[]>(`/api/admin/dishes/${dishId}/restaurants`);

export const listDishesForRestaurant = (restId: number) =>
  get<any[]>(`/api/admin/restaurants/${restId}/dishes`);

export const linkDishRestaurant = (dish_id: number, restaurant_id: number, price_note?: string|null, availability: 'regular'|'seasonal'|'preorder' = 'regular') =>
  post(`/api/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });

export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  del(`/api/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// ---------------------- Curation ----------------------
export const setDishCuration = (id: number, payload: { is_signature?: 0|1, panel_rank?: number|null }) =>
  patch(`/api/admin/dishes/${id}`, payload);

export const setRestaurantCuration = (id: number, payload: { featured?: 0|1, featured_rank?: number|null }) =>
  patch(`/api/admin/restaurants/${id}`, payload);

// (Optional) if you later add server-side analytics
export const getAnalyticsSummary = () => get(`/api/admin/analytics/summary`);
