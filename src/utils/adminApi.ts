// src/utils/adminApi.ts
// Single client for admin UI. No auth, no cookies. Uses VITE_ADMIN_API_URL.
export const ADMIN_BASE = (import.meta.env.VITE_ADMIN_API_URL ?? "http://localhost:3002").replace(/\/+$/, "");

// Helper: fetch JSON safely
async function j<T>(method: string, path: string, body?: any): Promise<T> {
  const url = path.startsWith("http") ? path : `${ADMIN_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "omit",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text ? (JSON.parse(text) as T) : (null as any);
}
const get = <T>(p: string) => j<T>("GET", p);
const post = <T>(p: string, b?: any) => j<T>("POST", p, b);
const patch = <T>(p: string, b?: any) => j<T>("PATCH", p, b);
const del = <T>(p: string) => j<T>("DELETE", p);

// ================= Types (match your DB) =================
export type Municipality = {
  id: number;
  name: string;
  slug: string;
};

export type DishCategory = "food" | "delicacy" | "drink";

export type Dish = {
  id: number;
  municipality_id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  category: DishCategory;
  flavor_profile?: string[] | string | null;
  ingredients?: string[] | string | null;
  popularity?: number | null;
  rating?: number | null;
  is_signature?: number | null;      // 0/1
  panel_rank?: number | null;        // 1..3 or null
};

export type Restaurant = {
  id: number;
  municipality_id?: number | null;
  name: string;
  slug: string;
  kind?: "restaurant" | "stall" | "store" | "dealer" | "market" | "home-based" | null;
  description?: string | null;
  address: string;
  phone?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  opening_hours?: string | null;
  price_range?: "budget" | "moderate" | "expensive" | null;
  cuisine_types?: string[] | string | null;
  rating?: number | null;
  lat: number;
  lng: number;
  image_url?: string | null;
  featured?: number | null;          // 0/1
  featured_rank?: number | null;     // 1..3 or null
};

// ================ Lookups =================
export const listMunicipalities = () => get<Municipality[]>("/api/municipalities");

// ================ Public list endpoints (with filters) =================
export const listDishes = (opts: {
  municipalityId?: number | null;
  category?: string;
  q?: string;
  signature?: 0 | 1;
  limit?: number;
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.category) qs.set("category", String(opts.category));
  if (opts.q) qs.set("q", opts.q);
  if (opts.signature != null) qs.set("signature", String(opts.signature));
  if (opts.limit) qs.set("limit", String(opts.limit));
  return get<Dish[]>(`/api/dishes${qs.toString() ? `?${qs}` : ""}`);
};

export const listRestaurants = (opts: {
  municipalityId?: number | null;
  dishId?: number;
  q?: string;
  featured?: 0 | 1;
  limit?: number;
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.dishId) qs.set("dishId", String(opts.dishId));
  if (opts.q) qs.set("q", opts.q);
  if (opts.featured != null) qs.set("featured", String(opts.featured));
  if (opts.limit) qs.set("limit", String(opts.limit));
  return get<Restaurant[]>(`/api/restaurants${qs.toString() ? `?${qs}` : ""}`);
};

// ================ Admin CRUD (same DB) =================
export const createDish = (payload: Partial<Dish>) => post<Dish>("/api/admin/dishes", payload);
export const updateDish = (id: number, payload: Partial<Dish>) => patch<Dish>(`/api/admin/dishes/${id}`, payload);
export const deleteDish = (id: number) => del<void>(`/api/admin/dishes/${id}`);

export const createRestaurant = (payload: Partial<Restaurant>) => post<Restaurant>("/api/admin/restaurants", payload);
export const updateRestaurant = (id: number, payload: Partial<Restaurant>) => patch<Restaurant>(`/api/admin/restaurants/${id}`, payload);
export const deleteRestaurant = (id: number) => del<void>(`/api/admin/restaurants/${id}`);

// ================ Linking =================
export const listRestaurantsForDish = (dishId: number) => get<Restaurant[]>(`/api/admin/dishes/${dishId}/restaurants`);
export const listDishesForRestaurant = (restId: number) => get<Dish[]>(`/api/admin/restaurants/${restId}/dishes`);

export const linkDishRestaurant = (
  dish_id: number,
  restaurant_id: number,
  price_note?: string | null,
  availability: "regular" | "seasonal" | "preorder" = "regular"
) => post(`/api/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });

export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  del(`/api/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// ================ Curation =================
export const setDishCuration = (id: number, payload: { is_signature?: 0 | 1; panel_rank?: number | null }) =>
  patch(`/api/admin/dishes/${id}`, payload);

export const setRestaurantCuration = (id: number, payload: { featured?: 0 | 1; featured_rank?: number | null }) =>
  patch(`/api/admin/restaurants/${id}`, payload);

// ================ Analytics =================
export type MunicipalityCounts = { municipality_id: number; municipality_name: string; dishes: number; restaurants: number };
export const getPerMunicipalityCounts = () => get<MunicipalityCounts[]>("/api/admin/analytics/per-municipality");
export const getAnalyticsSummary = () => get<any>("/api/admin/analytics/summary"); // keep flexible

// Utility: coerce strings->arrays for view safety
export function coerceStringArray(x: unknown): string[] | null {
  if (x == null) return null;
  if (Array.isArray(x)) return x.map(String);
  const s = String(x).trim();
  if (!s) return null;
  return s.split(",").map((v) => v.trim()).filter(Boolean);
}
