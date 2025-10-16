// src/utils/adminApi.ts
// Admin-only API client (uses credentials so it can hit session-protected routes)

export const API = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

/** Core fetcher with cookies + nice error text */
async function req<T = any>(method: "GET"|"POST"|"PATCH"|"DELETE", path: string, body?: any): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include", // IMPORTANT for sessions
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`);
  if (!text) return null as unknown as T;
  try { return JSON.parse(text) as T; } catch { return null as unknown as T; }
}
const get  = <T=any>(p: string)         => req<T>("GET", p);
const post = <T=any>(p: string, b?: any)=> req<T>("POST", p, b);
const patch= <T=any>(p: string, b?: any)=> req<T>("PATCH", p, b);
const del  = <T=any>(p: string)         => req<T>("DELETE", p);

// ---------- Shared Types ----------
export type Municipality = {
  id: number;
  name: string;
  slug: string;
};

export type Dish = {
  id: number;
  municipality_id: number;
  name: string; slug: string;
  description: string | null;
  image_url: string | null;
  category: "food" | "delicacy" | "drink";
  flavor_profile?: string[] | null;
  ingredients?: string[] | null;
  popularity?: number | null;
  rating?: number | null;
  is_signature?: 0 | 1 | null;
  panel_rank?: number | null;
};

export type Restaurant = {
  id: number;
  municipality_id?: number | null;
  name: string; slug: string; kind?: string | null;
  description?: string | null;
  address: string;
  phone?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  opening_hours?: string | null;
  price_range?: "budget" | "moderate" | "expensive" | null;
  cuisine_types?: string[] | null;
  rating?: number | null;
  lat: number; lng: number;
  image_url?: string | null;
  featured?: 0 | 1 | null;
  featured_rank?: number | null;
};

// Defensive array coercion (guards old data)
const ensureArray = (x: unknown): string[] | null => {
  if (x == null) return null;
  if (Array.isArray(x)) return x as string[];
  if (typeof x === "string") {
    try {
      const j = JSON.parse(x);
      return Array.isArray(j) ? (j as string[]) : null;
    } catch {
      // fallback: comma-separated string
      const trimmed = x.trim();
      return trimmed ? trimmed.split(",").map(s => s.trim()).filter(Boolean) : null;
    }
  }
  return null;
};

// ---------- Auth ----------
export const adminAuth = {
  login: (username: string, password: string) =>
    post<{ ok: true; admin: { username: string } }>("/api/admin/auth/login", { username, password }),
  me: () => get<{ ok: true; admin: { username: string } }>("/api/admin/auth/me"),
  logout: () => post<{ ok: true }>("/api/admin/auth/logout"),
};

// ---------- Lookups ----------
export const listMunicipalities = () =>
  get<Municipality[]>("/api/municipalities");

// ---------- Dishes ----------
export const listDishes = (opts: {
  municipalityId?: number | null;
  category?: "food" | "delicacy" | "drink" | string;
  q?: string;
  signature?: 0 | 1;
  limit?: number;
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.category)       qs.set("category", String(opts.category));
  if (opts.q)              qs.set("q", String(opts.q));
  if (opts.signature != null) qs.set("signature", String(opts.signature));
  if (opts.limit)          qs.set("limit", String(opts.limit));
  return get<Dish[]>(`/api/dishes${qs.toString() ? `?${qs.toString()}` : ""}`)
    .then(rows => rows.map(d => ({
      ...d,
      flavor_profile: ensureArray(d.flavor_profile),
      ingredients: ensureArray(d.ingredients),
    })));
};

export const createDish = (payload: Partial<Dish>) =>
  post<{ ok: true; id: number }>("/api/admin/dishes", payload);

export const updateDish = (id: number, payload: Partial<Dish>) =>
  patch<{ ok: true }>(`/api/admin/dishes/${id}`, payload);

export const deleteDish = (id: number) =>
  del<{ ok: true }>(`/api/admin/dishes/${id}`);

// ---------- Restaurants ----------
export const listRestaurants = (opts: {
  municipalityId?: number | null;
  dishId?: number;
  q?: string;
  featured?: 0 | 1;
  limit?: number;
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.dishId)         qs.set("dishId", String(opts.dishId));
  if (opts.q)              qs.set("q", String(opts.q));
  if (opts.featured != null) qs.set("featured", String(opts.featured));
  if (opts.limit)          qs.set("limit", String(opts.limit));
  return get<Restaurant[]>(`/api/restaurants${qs.toString() ? `?${qs.toString()}` : ""}`)
    .then(rows => rows.map(r => ({
      ...r,
      cuisine_types: ensureArray(r.cuisine_types),
    })));
};

export const createRestaurant = (payload: Partial<Restaurant>) =>
  post<{ ok: true; id: number }>("/api/admin/restaurants", payload);

export const updateRestaurant = (id: number, payload: Partial<Restaurant>) =>
  patch<{ ok: true }>(`/api/admin/restaurants/${id}`, payload);

export const deleteRestaurant = (id: number) =>
  del<{ ok: true }>(`/api/admin/restaurants/${id}`);

// ---------- Linking ----------
export const listRestaurantsForDish = (dishId: number) =>
  get<Array<Restaurant & { link?: { price_note: string | null; availability: 'regular'|'seasonal'|'preorder' } }>>(
    `/api/admin/dishes/${dishId}/restaurants`
  ).then(rows => rows.map(r => ({ ...r, cuisine_types: ensureArray(r.cuisine_types) })));

export const listDishesForRestaurant = (restId: number) =>
  get<Array<Dish & { link?: { price_note: string | null; availability: 'regular'|'seasonal'|'preorder' } }>>(
    `/api/admin/restaurants/${restId}/dishes`
  ).then(rows => rows.map(d => ({ ...d, flavor_profile: ensureArray(d.flavor_profile), ingredients: ensureArray(d.ingredients) })));

export const linkDishRestaurant = (
  dish_id: number,
  restaurant_id: number,
  price_note?: string | null,
  availability: 'regular'|'seasonal'|'preorder' = 'regular'
) => post<{ ok: true }>(`/api/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });

export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  del<{ ok: true }>(`/api/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// ---------- Curation ----------
export const setDishCuration = (id: number, payload: { is_signature?: 0|1; panel_rank?: number|null }) =>
  patch<{ ok: true }>(`/api/admin/dishes/${id}`, payload);

export const setRestaurantCuration = (id: number, payload: { featured?: 0|1; featured_rank?: number|null }) =>
  patch<{ ok: true }>(`/api/admin/restaurants/${id}`, payload);

// ---------- Analytics ----------
export const getAnalyticsSummary = () =>
  get<{
    dishCounts: Array<{ municipality_id: number; municipality_name: string; category: string; total: number }>;
    featuredRests: Array<{ municipality_id: number; municipality_name: string; featured_total: number }>;
    linkCounts: Array<{ dish_id: number; dish_name: string; restaurants_linked: number }>;
  }>(`/api/admin/analytics/summary`);


// ========= Back-compat named exports (so older imports keep working) =========
export const AdminAuth = adminAuth;

export const AdminAPI = {
  listMunicipalities,
  listDishes, createDish, updateDish, deleteDish,
  listRestaurants, createRestaurant, updateRestaurant, deleteRestaurant,
  listRestaurantsForDish, listDishesForRestaurant, linkDishRestaurant, unlinkDishRestaurant,
  setDishCuration, setRestaurantCuration,
  getAnalyticsSummary,
};
