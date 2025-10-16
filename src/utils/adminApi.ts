// src/utils/adminApi.ts

// --- Base URLs ---------------------------------------------------------------
export const PUBLIC_API =
  (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
export const ADMIN_API =
  (import.meta.env.VITE_ADMIN_API_URL ?? "http://localhost:3002").replace(/\/+$/, "");

// --- Small fetch helpers (no credentials: we disabled auth for now) ----------
async function request(method: string, url: string, body?: any) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "omit",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text || ""}`);
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}
const get  = (url: string) => request("GET", url);
const post = (url: string, body?: any) => request("POST", url, body);
const patch= (url: string, body?: any) => request("PATCH", url, body);
const del  = (url: string) => request("DELETE", url);

// --- Utility: robust array normalization for csv / json fields ---------------
export function toArr(v: unknown): string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    // json array?
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
      } catch { /* fallthrough to csv */ }
    }
    return s.split(",").map(x => x.trim()).filter(Boolean);
  }
  return [];
}

// --- Types mirrored from your DB shape ---------------------------------------
export type Municipality = { id: number; name: string; slug: string };

export type Dish = {
  id: number;
  municipality_id: number | null;
  name: string; slug: string;
  description: string | null;
  image_url: string | null;
  category: "food" | "delicacy" | "drink";
  flavor_profile?: any;
  ingredients?: any;
  popularity?: number | null;
  rating?: number | null;
  is_signature?: 0 | 1 | null;
  panel_rank?: number | null;
};

export type Restaurant = {
  id: number;
  municipality_id: number | null;
  name: string; slug: string;
  kind?: "restaurant"|"stall"|"store"|"dealer"|"market"|"home-based";
  description?: string | null;
  address: string;
  phone?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  opening_hours?: string | null;
  price_range?: "budget"|"moderate"|"expensive";
  cuisine_types?: any;
  rating?: number | null;
  lat: number; lng: number;
  image_url?: string | null;
  featured?: 0 | 1 | null;
  featured_rank?: number | null;
};

// --- Health / write-cap check ------------------------------------------------
export async function writeCap(): Promise<boolean> {
  try {
    // Your admin API should expose GET /admin/health -> { ok: true }
    const data = await get(`${ADMIN_API}/admin/health`);
    return !!(data && (data.ok === true || data.status === "ok"));
  } catch {
    return false;
  }
}

// --- Lookups (READS) use PUBLIC API -----------------------------------------
export const listMunicipalities = () =>
  get(`${PUBLIC_API}/api/municipalities`) as Promise<Municipality[]>;

export const listDishes = (opts: {
  municipalityId?: number;
  category?: string;
  q?: string;
  signature?: 0|1;
  limit?: number;
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.category)       qs.set("category", String(opts.category));
  if (opts.q)              qs.set("q", opts.q);
  if (opts.signature!=null)qs.set("signature", String(opts.signature));
  if (opts.limit)          qs.set("limit", String(opts.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return get(`${PUBLIC_API}/api/dishes${suffix}`) as Promise<Dish[]>;
};

export const listRestaurants = (opts: {
  municipalityId?: number;
  dishId?: number;
  q?: string;
  featured?: 0|1;
  limit?: number;
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.dishId)         qs.set("dishId", String(opts.dishId));
  if (opts.q)              qs.set("q", opts.q);
  if (opts.featured!=null) qs.set("featured", String(opts.featured));
  if (opts.limit)          qs.set("limit", String(opts.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return get(`${PUBLIC_API}/api/restaurants${suffix}`) as Promise<Restaurant[]>;
};

// --- Admin CRUD (WRITES) use ADMIN API --------------------------------------
export const createDish        = (payload: Partial<Dish>) => post(`${ADMIN_API}/admin/dishes`, payload);
export const updateDish        = (id: number, payload: Partial<Dish>) => patch(`${ADMIN_API}/admin/dishes/${id}`, payload);
export const deleteDish        = (id: number) => del(`${ADMIN_API}/admin/dishes/${id}`);

export const createRestaurant  = (payload: Partial<Restaurant>) => post(`${ADMIN_API}/admin/restaurants`, payload);
export const updateRestaurant  = (id: number, payload: Partial<Restaurant>) => patch(`${ADMIN_API}/admin/restaurants/${id}`, payload);
export const deleteRestaurant  = (id: number) => del(`${ADMIN_API}/admin/restaurants/${id}`);

// --- Linking (1 dish -> many restaurants) -----------------------------------
export const linkedRestaurantsForDish = (dishId: number) =>
  get(`${ADMIN_API}/admin/dishes/${dishId}/restaurants`) as Promise<Restaurant[]>;

export const linkedDishesForRestaurant = (restId: number) =>
  get(`${ADMIN_API}/admin/restaurants/${restId}/dishes`) as Promise<Dish[]>;

export const linkDishRestaurant = (dish_id: number, restaurant_id: number, price_note?: string|null, availability: 'regular'|'seasonal'|'preorder' = 'regular') =>
  post(`${ADMIN_API}/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });

export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  del(`${ADMIN_API}/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// --- Curation flags ----------------------------------------------------------
export const setDishCuration = (id: number, payload: { is_signature?: 0|1, panel_rank?: number|null }) =>
  patch(`${ADMIN_API}/admin/dishes/${id}`, payload);

export const setRestaurantCuration = (id: number, payload: { featured?: 0|1, featured_rank?: number|null }) =>
  patch(`${ADMIN_API}/admin/restaurants/${id}`, payload);

// --- Analytics ---------------------------------------------------------------
export const getAnalyticsSummary = () =>
  get(`${ADMIN_API}/admin/analytics/summary`) as Promise<{
    counts: { dishes: number; restaurants: number };
    perMunicipality: Array<{ slug: string; dishes: number; restaurants: number }>;
    topDishes: Array<{ id:number; name:string; panel_rank:number|null }>;
    topRestaurants: Array<{ id:number; name:string; featured_rank:number|null }>;
  }>;
