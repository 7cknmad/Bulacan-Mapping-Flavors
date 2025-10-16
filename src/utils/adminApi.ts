// src/utils/adminApi.ts
// Admin-only API client that talks to your admin API server (separate from the public API).
// It also includes a couple of helpers (slugify, coerceStringArray) used by the UI.

export const ADMIN = (import.meta.env.VITE_ADMIN_API_URL ?? "http://localhost:3002").replace(/\/+$/, "");

/** fetch JSON (throws a nice error message on non-2xx) */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${ADMIN}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "omit", // admin API is open for now (no login), per your request
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url}\n${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as T) : (null as T);
}

const get = <T,>(p: string) => request<T>(p);
const post = <T,>(p: string, b?: any) => request<T>(p, { method: "POST", body: b ? JSON.stringify(b) : undefined });
const patch = <T,>(p: string, b?: any) => request<T>(p, { method: "PATCH", body: b ? JSON.stringify(b) : undefined });
const del = <T,>(p: string) => request<T>(p, { method: "DELETE" });

/** Try several paths (for minor backend naming differences) and resolve on first success. */
async function getFirst<T>(paths: string[]): Promise<T> {
  let lastErr: any;
  for (const p of paths) {
    try {
      return await get<T>(p);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/* ================== Helpers used by UI ================== */
export function slugify(s: string): string {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function coerceStringArray(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
    } catch { /* not JSON, fall back to CSV */ }
    return trimmed.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

/* ================== Types ================== */
export type Municipality = {
  id: number;
  name: string;
  slug: string;
};

export type Dish = {
  id: number;
  municipality_id: number;
  name: string;
  slug: string;
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

export type Restaurant = {
  id: number;
  municipality_id?: number | null;
  name: string;
  slug: string;
  kind?: string | null;
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
  lat: number;
  lng: number;
  image_url?: string | null;
  featured?: number | null;
  featured_rank?: number | null;
};

/* ================== Lists & CRUD ================== */
// Municipalities
export const listMunicipalities = () => get<Municipality[]>(`/api/municipalities`);

// Dishes
export const listDishes = (opts: { municipalityId?: number; category?: string; q?: string; signature?: 0 | 1 } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.category) qs.set("category", String(opts.category));
  if (opts.q) qs.set("q", String(opts.q));
  if (opts.signature != null) qs.set("signature", String(opts.signature));
  const suf = qs.toString() ? `?${qs.toString()}` : "";
  return get<Dish[]>(`/api/dishes${suf}`);
};
export const createDish = (payload: Partial<Dish>) => post<Dish>(`/api/dishes`, payload);
export const updateDish = (id: number, payload: Partial<Dish>) => patch<Dish>(`/api/dishes/${id}`, payload);
export const deleteDish = (id: number) => del<null>(`/api/dishes/${id}`);

// Restaurants
export const listRestaurants = (opts: { municipalityId?: number; dishId?: number; q?: string; featured?: 0 | 1 } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.dishId) qs.set("dishId", String(opts.dishId));
  if (opts.q) qs.set("q", String(opts.q));
  if (opts.featured != null) qs.set("featured", String(opts.featured));
  const suf = qs.toString() ? `?${qs.toString()}` : "";
  return get<Restaurant[]>(`/api/restaurants${suf}`);
};
export const createRestaurant = (payload: Partial<Restaurant>) => post<Restaurant>(`/api/restaurants`, payload);
export const updateRestaurant = (id: number, payload: Partial<Restaurant>) => patch<Restaurant>(`/api/restaurants/${id}`, payload);
export const deleteRestaurant = (id: number) => del<null>(`/api/restaurants/${id}`);

/* ================== Linking ================== */
export const listRestaurantsForDish = (dishId: number) =>
  // Common variants used in your threads
  getFirst<Restaurant[]>([
    `/api/dishes/${dishId}/restaurants`,
    `/admin/dishes/${dishId}/restaurants`,
  ]);

export const listDishesForRestaurant = (restId: number) =>
  getFirst<Dish[]>([
    `/api/restaurants/${restId}/dishes`,
    `/admin/restaurants/${restId}/dishes`,
  ]);

export const linkDishRestaurant = (dish_id: number, restaurant_id: number, price_note?: string | null, availability: 'regular' | 'seasonal' | 'preorder' = 'regular') =>
  // both variants supported
  post<null>(`/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });

export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  del<null>(`/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

/* ================== Curation (enforce in UI, patch here) ================== */
export const setDishCuration = (id: number, payload: { is_signature?: 0 | 1; panel_rank?: number | null }) =>
  patch<Dish>(`/api/dishes/${id}`, payload);

export const setRestaurantCuration = (id: number, payload: { featured?: 0 | 1; featured_rank?: number | null }) =>
  patch<Restaurant>(`/api/restaurants/${id}`, payload);

/* ================== Analytics ================== */
export const getAnalyticsSummary = () =>
  getFirst<{ counts: { dishes: number; restaurants: number; municipalities: number } }>([
    `/admin/analytics/summary`,
    `/api/admin/analytics/summary`,
  ]);

export const getPerMunicipalityCounts = () =>
  getFirst<Array<{ municipality_id: number; municipality_name: string; dishes: number; restaurants: number }>>([
    `/admin/analytics/municipality-counts`,   // preferred
    `/admin/analytics/per-municipality`,      // alt kebab
    `/admin/analytics/per_municipality`,      // alt snake
    `/api/admin/analytics/municipality-counts`,
  ]);

/* ================== Health (optional) ================== */
export const getHealth = () => get<{ ok: true }>(`/admin/health`);
