// src/utils/adminApi.ts
// Admin dashboard API helper that reads from the public API today,
// and (optionally) writes to a separate admin API when available.

export const API_PUBLIC =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";
export const API_ADMIN =
  (import.meta.env.VITE_ADMIN_API_URL as string | undefined) ?? "http://localhost:3002";

// Helper: JSON fetch with nice errors
async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}: ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as T) : (null as T);
}

// Probe admin backend once and cache the result
let _writeCapPromise: Promise<boolean> | null = null;
export function writeCap(): Promise<boolean> {
  if (!_writeCapPromise) {
    _writeCapPromise = (async () => {
      try {
        await getJSON(`${API_ADMIN}/admin/health`);
        return true;
      } catch {
        return false;
      }
    })();
  }
  return _writeCapPromise;
}

/* ================== Types ================== */
export type Municipality = { id: number; name: string; slug: string };

export type Dish = {
  id: number;
  municipality_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  category: "food" | "delicacy" | "drink";
  flavor_profile: string[] | null; // can be string in DB; we normalize client-side
  ingredients: string[] | null;
  popularity?: number | null;
  rating?: number | null;
  is_signature?: 0 | 1 | null;
  panel_rank?: number | null;
};

export type Restaurant = {
  id: number;
  municipality_id: number | null;
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
  cuisine_types: string[] | null; // normalize client-side
  rating?: number | null;
  lat: number;
  lng: number;
  image_url?: string | null;
  featured?: 0 | 1 | null;
  featured_rank?: number | null;
};

// Helpers to normalize CSV/JSON-ish fields to arrays
export function toArr(v: unknown): string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    try {
      const p = JSON.parse(t);
      if (Array.isArray(p)) return p.map(String);
    } catch {/* fall back */}
    return t.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [String(v)];
}

/* ================== READS (public API) ================== */
export const listMunicipalities = () =>
  getJSON<Municipality[]>(`${API_PUBLIC}/api/municipalities`);

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
  if (opts.q) qs.set("q", String(opts.q));
  if (opts.signature != null) qs.set("signature", String(opts.signature));
  if (opts.limit) qs.set("limit", String(opts.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return getJSON<Dish[]>(`${API_PUBLIC}/api/dishes${suffix}`);
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
  if (opts.q) qs.set("q", String(opts.q));
  if (opts.featured != null) qs.set("featured", String(opts.featured));
  if (opts.limit) qs.set("limit", String(opts.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return getJSON<Restaurant[]>(`${API_PUBLIC}/api/restaurants${suffix}`);
};

/* ================== WRITES (admin API; disabled if not available) ================== */
async function adminWrite<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: any) {
  const can = await writeCap();
  if (!can) throw new Error("Admin backend not running. Set VITE_ADMIN_API_URL and /admin/health.");
  const res = await fetch(`${API_ADMIN}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// Dishes: create/update/delete
export const createDish = (payload: Partial<Dish>) =>
  adminWrite<{ id: number }>("POST", "/admin/dishes", payload);
export const updateDish = (id: number, payload: Partial<Dish>) =>
  adminWrite("PATCH", `/admin/dishes/${id}`, payload);
export const deleteDish = (id: number) =>
  adminWrite("DELETE", `/admin/dishes/${id}`);

// Restaurants: create/update/delete
export const createRestaurant = (payload: Partial<Restaurant>) =>
  adminWrite<{ id: number }>("POST", "/admin/restaurants", payload);
export const updateRestaurant = (id: number, payload: Partial<Restaurant>) =>
  adminWrite("PATCH", `/admin/restaurants/${id}`, payload);
export const deleteRestaurant = (id: number) =>
  adminWrite("DELETE", `/admin/restaurants/${id}`);

// Linking
export const linkedRestaurantsForDish = (dishId: number) =>
  adminWrite<Restaurant[]>("GET" as any, `/admin/dishes/${dishId}/restaurants`);
export const linkedDishesForRestaurant = (restId: number) =>
  adminWrite<Dish[]>("GET" as any, `/admin/restaurants/${restId}/dishes`);
export const linkDishRestaurant = (dish_id: number, restaurant_id: number, price_note?: string | null, availability: "regular" | "seasonal" | "preorder" = "regular") =>
  adminWrite("POST", `/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });
export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  adminWrite("DELETE", `/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// Curation
export const setDishCuration = (id: number, body: { is_signature?: 0 | 1; panel_rank?: number | null }) =>
  adminWrite("PATCH", `/admin/dishes/${id}`, body);
export const setRestaurantCuration = (id: number, body: { featured?: 0 | 1; featured_rank?: number | null }) =>
  adminWrite("PATCH", `/admin/restaurants/${id}`, body);

// Analytics (admin API if available; otherwise compute on the client)
export async function getAnalyticsSummary() {
  const can = await writeCap();
  if (can) {
    return getJSON(`${API_ADMIN}/admin/analytics/summary`);
  }
  // client-side fallback summary
  const [munis, dishes, restos] = await Promise.all([
    listMunicipalities(),
    listDishes(),
    listRestaurants(),
  ]);
  const perMunicipality = munis.map(m => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    dishes: dishes.filter(d => d.municipality_id === m.id).length,
    restaurants: restos.filter(r => r.municipality_id === m.id).length,
  }));
  const topDishes = [...dishes]
    .filter(d => d.is_signature === 1)
    .sort((a, b) => (a.panel_rank ?? 99) - (b.panel_rank ?? 99))
    .slice(0, 5);
  const topRestaurants = [...restos]
    .filter(r => (r.featured ?? 0) === 1)
    .sort((a, b) => (a.featured_rank ?? 99) - (b.featured_rank ?? 99))
    .slice(0, 5);
  return {
    counts: { dishes: dishes.length, restaurants: restos.length },
    perMunicipality,
    topDishes,
    topRestaurants,
  };
}
