// src/utils/adminApi.ts
// Admin-side API client (uses cookies). Public pages should keep using src/utils/api.ts.

export const API = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

async function req<T = any>(method: string, path: string, body?: any): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include", // IMPORTANT: use cookie session for admin
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`);
  return text ? (JSON.parse(text) as T) : (null as T);
}

const get = <T = any>(p: string) => req<T>("GET", p);
const post = <T = any>(p: string, b?: any) => req<T>("POST", p, b);
const patch = <T = any>(p: string, b?: any) => req<T>("PATCH", p, b);
const del = <T = any>(p: string) => req<T>("DELETE", p);

// ---------- Auth ----------
export const adminAuth = {
  login: (email: string, password: string) => post<{ ok: true; email: string }>("/api/admin/auth/login", { email, password }),
  me: () => get<{ email: string; name?: string }>("/api/admin/auth/me"),
  logout: () => post<{ ok: true }>("/api/admin/auth/logout"),
};

// ---------- Lookups ----------
export type Municipality = { id: number; name: string; slug: string };
export const listMunicipalities = () => get<Municipality[]>("/api/municipalities");

// ---------- Dishes ----------
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
  is_signature?: number | null;
  panel_rank?: number | null;
};

function toArrayMaybe(v: unknown): string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string") {
    try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : [v]; } catch { return [v]; }
  }
  return null;
}

export const listDishes = async (opts: { municipalityId?: number|null; category?: string; q?: string; signature?: 0|1; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.category) qs.set("category", String(opts.category));
  if (opts.q) qs.set("q", String(opts.q));
  if (opts.signature != null) qs.set("signature", String(opts.signature));
  if (opts.limit) qs.set("limit", String(opts.limit));
  const data = await get<Dish[]>(`/api/dishes${qs.toString() ? `?${qs.toString()}` : ""}`);
  // normalize arrays so UI can .join() safely
  return data.map(d => ({
    ...d,
    flavor_profile: toArrayMaybe(d.flavor_profile) ?? [],
    ingredients: toArrayMaybe(d.ingredients) ?? [],
  }));
};

export const createDish = (payload: any) => post<{ id: number }>("/api/admin/dishes", payload);
export const updateDish = (id: number, payload: any) => patch<{ ok: true }>(`/api/admin/dishes/${id}`, payload);
export const deleteDish = (id: number) => del<{ ok: true }>(`/api/admin/dishes/${id}`);

// ---------- Restaurants ----------
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
  cuisine_types?: string[] | null;
  rating?: number | null;
  lat: number; lng: number;
  image_url?: string | null;
  featured?: number | null;
  featured_rank?: number | null;
};

export const listRestaurants = async (opts: { municipalityId?: number|null; dishId?: number; q?: string; featured?: 0|1; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.dishId) qs.set("dishId", String(opts.dishId));
  if (opts.q) qs.set("q", String(opts.q));
  if (opts.featured != null) qs.set("featured", String(opts.featured));
  if (opts.limit) qs.set("limit", String(opts.limit));
  const data = await get<Restaurant[]>(`/api/restaurants${qs.toString() ? `?${qs.toString()}` : ""}`);
  return data.map(r => ({
    ...r,
    cuisine_types: toArrayMaybe(r.cuisine_types) ?? [],
  }));
};

export const createRestaurant = (payload: any) => post<{ id: number }>(`/api/admin/restaurants`, payload);
export const updateRestaurant = (id: number, payload: any) => patch<{ ok: true }>(`/api/admin/restaurants/${id}`, payload);
export const deleteRestaurant = (id: number) => del<{ ok: true }>(`/api/admin/restaurants/${id}`);

// ---------- Linking ----------
export const listRestaurantsForDish = (dishId: number) => get(`/api/admin/dishes/${dishId}/restaurants`);
export const listDishesForRestaurant = (restId: number) => get(`/api/admin/restaurants/${restId}/dishes`);
export const linkDishRestaurant = (dish_id: number, restaurant_id: number, price_note?: string|null, availability: 'regular'|'seasonal'|'preorder' = 'regular') =>
  post(`/api/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });
export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  del(`/api/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// ---------- Curation ----------
export const setDishCuration = (id: number, payload: { is_signature?: 0|1, panel_rank?: number|null }) =>
  patch(`/api/admin/dishes/${id}`, payload);
export const setRestaurantCuration = (id: number, payload: { featured?: 0|1, featured_rank?: number|null }) =>
  patch(`/api/admin/restaurants/${id}`, payload);

// ---------- Analytics ----------
export const getAnalyticsSummary = () => get(`/api/admin/analytics/summary`);
