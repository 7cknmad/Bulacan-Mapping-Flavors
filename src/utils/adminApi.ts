// src/utils/adminApi.ts
// Split bases: PUBLIC for read-only lists; ADMIN for writes/analytics.
export const PUBLIC_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
export const ADMIN_BASE  = (import.meta.env.VITE_ADMIN_API_URL ?? "http://localhost:3002").replace(/\/+$/, "");

// If your admin server uses a different prefix, change this:
const ADMIN_PREFIX = "/admin";   // admin API prefix
const PUBLIC_PREFIX = "/api";    // public API prefix

// --- tiny fetch helpers (no cookies for now)
async function fetchJSON<T>(method: string, url: string, body?: any) {
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
const getPublic = <T>(path: string) => fetchJSON<T>("GET", `${PUBLIC_BASE}${path}`);
const getAdmin  = <T>(path: string) => fetchJSON<T>("GET", `${ADMIN_BASE}${path}`);
const postAdmin = <T>(path: string, b?: any) => fetchJSON<T>("POST", `${ADMIN_BASE}${path}`, b);
const patchAdmin= <T>(path: string, b?: any) => fetchJSON<T>("PATCH", `${ADMIN_BASE}${path}`, b);
const delAdmin  = <T>(path: string) => fetchJSON<T>("DELETE", `${ADMIN_BASE}${path}`);

// ================= Types =================
export type Municipality = { id: number; name: string; slug: string };
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
  is_signature?: number | null;   // 0/1
  panel_rank?: number | null;     // 1..3 or null
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
  featured?: number | null;       // 0/1
  featured_rank?: number | null;  // 1..3 or null
};

// ================= Read-only lists (PUBLIC API) =================
export const listMunicipalities = () =>
  getPublic<Municipality[]>(`${PUBLIC_PREFIX}/municipalities`);

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
  return getPublic<Dish[]>(`${PUBLIC_PREFIX}/dishes${qs.toString() ? `?${qs}` : ""}`);
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
  return getPublic<Restaurant[]>(`${PUBLIC_PREFIX}/restaurants${qs.toString() ? `?${qs}` : ""}`);
};

// ================= Admin-only (ADMIN API under /admin/*) =================
// CRUD – dishes
export const createDish = (payload: Partial<Dish>) =>
  postAdmin<Dish>(`${ADMIN_PREFIX}/dishes`, payload);
export const updateDish = (id: number, payload: Partial<Dish>) =>
  patchAdmin<Dish>(`${ADMIN_PREFIX}/dishes/${id}`, payload);
export const deleteDish = (id: number) =>
  delAdmin<void>(`${ADMIN_PREFIX}/dishes/${id}`);

// CRUD – restaurants
export const createRestaurant = (payload: Partial<Restaurant>) =>
  postAdmin<Restaurant>(`${ADMIN_PREFIX}/restaurants`, payload);
export const updateRestaurant = (id: number, payload: Partial<Restaurant>) =>
  patchAdmin<Restaurant>(`${ADMIN_PREFIX}/restaurants/${id}`, payload);
export const deleteRestaurant = (id: number) =>
  delAdmin<void>(`${ADMIN_PREFIX}/restaurants/${id}`);

// Linking
export const listRestaurantsForDish = (dishId: number) =>
  getAdmin<Restaurant[]>(`${ADMIN_PREFIX}/dishes/${dishId}/restaurants`);
export const listDishesForRestaurant = (restId: number) =>
  getAdmin<Dish[]>(`${ADMIN_PREFIX}/restaurants/${restId}/dishes`);

export const linkDishRestaurant = (
  dish_id: number,
  restaurant_id: number,
  price_note?: string | null,
  availability: "regular" | "seasonal" | "preorder" = "regular"
) => postAdmin(`${ADMIN_PREFIX}/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });

export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  delAdmin(`${ADMIN_PREFIX}/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// Curation (enforce in UI; API just patches flags)
export const setDishCuration = (id: number, payload: { is_signature?: 0 | 1; panel_rank?: number | null }) =>
  patchAdmin(`${ADMIN_PREFIX}/dishes/${id}`, payload);

export const setRestaurantCuration = (id: number, payload: { featured?: 0 | 1; featured_rank?: number | null }) =>
  patchAdmin(`${ADMIN_PREFIX}/restaurants/${id}`, payload);

// ---------- Analytics with endpoint fallback ----------
export type MunicipalityCounts = { municipality_id: number; municipality_name: string; dishes: number; restaurants: number };

async function tryGet<T>(paths: string[]): Promise<T> {
  let lastErr: any;
  for (const p of paths) {
    try {
      return await getAdmin<T>(p);
    } catch (e: any) {
      lastErr = e;
      // only swallow 404; surface other errors immediately
      if (!String(e?.message ?? "").includes("HTTP 404")) throw e;
    }
  }
  throw lastErr ?? new Error("No analytics endpoint found.");
}

export const getPerMunicipalityCounts = () =>
  tryGet<MunicipalityCounts[]>([
    `${ADMIN_PREFIX}/analytics/per-municipality`,
    `${ADMIN_PREFIX}/analytics/municipality-counts`,
    `${ADMIN_PREFIX}/analytics/per_municipality`,
  ]);

export const getAnalyticsSummary = () =>
  tryGet<any>([
    `${ADMIN_PREFIX}/analytics/summary`,
    `${ADMIN_PREFIX}/analytics/overview`,
  ]);

// Optional: health
export const getAdminHealth = () =>
  getAdmin<{ ok: true }>(`${ADMIN_PREFIX}/health`);

// Utilities
export function coerceStringArray(x: unknown): string[] | null {
  if (x == null) return null;
  if (Array.isArray(x)) return x.map(String);
  const s = String(x).trim();
  if (!s) return null;
  return s.split(",").map((v) => v.trim()).filter(Boolean);
}

// small, dependency-free slugify
export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
