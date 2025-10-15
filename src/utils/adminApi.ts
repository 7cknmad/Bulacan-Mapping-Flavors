// src/utils/adminApi.ts
// API base
export const API = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

// generic fetch
async function req(method: string, path: string, body?: any) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    // admin endpoints use cookie session; public calls also work with include
    credentials: "include",
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt}`);
  try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}
const get  = (p: string) => req("GET", p);
const post = (p: string, b?: any) => req("POST", p, b);
const patch= (p: string, b?: any) => req("PATCH", p, b);
const del  = (p: string) => req("DELETE", p);

// -------- helpers: coerce JSON-ish columns to arrays (defensive) --------
const toArr = (v: unknown) => {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === "string") {
    const s = v.trim();
    if (s.startsWith("[") && s.endsWith("]")) {
      try { return JSON.parse(s); } catch { return []; }
    }
    return [s];
  }
  return [];
};

const normDish = (d: any) => ({
  ...d,
  flavor_profile: toArr(d.flavor_profile),
  ingredients: toArr(d.ingredients),
});
const normRestaurant = (r: any) => ({
  ...r,
  cuisine_types: toArr(r.cuisine_types),
});

// ---------------- Auth ----------------
export const adminAuth = {
  me:     () => get("/api/admin/auth/me"),
  login:  (email: string, password: string) => post("/api/admin/auth/login", { email, password }),
  logout: () => post("/api/admin/auth/logout"),
};

// Keep old name for backwards compatibility with older imports:
export const AdminAuth = adminAuth;

// ---------------- Lookups (shared) ----------------
export type Municipality = { id: number; name: string; slug: string };
export const listMunicipalities = () => get("/api/municipalities");

// ---------------- Dishes ----------------
export type Dish = {
  id: number;
  municipality_id: number;
  name: string; slug: string;
  description: string | null;
  image_url: string | null;
  category: "food" | "delicacy" | "drink";
  flavor_profile?: string[];
  ingredients?: string[];
  popularity?: number | null;
  rating?: number | null;
  is_signature?: number | null;
  panel_rank?: number | null;
};

export const listDishes = (opts: {
  municipalityId?: number|null; category?: string; q?: string; signature?: 0|1; limit?: number;
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.category)       qs.set("category", String(opts.category));
  if (opts.q)              qs.set("q", String(opts.q));
  if (opts.signature != null) qs.set("signature", String(opts.signature));
  if (opts.limit)          qs.set("limit", String(opts.limit));
  const url = `/api/dishes${qs.toString() ? `?${qs.toString()}` : ""}`;
  return get(url).then((rows: any[]) => rows.map(normDish));
};

export const createDish = (payload: any)                => post("/api/admin/dishes", payload);
export const updateDish = (id: number, payload: any)    => patch(`/api/admin/dishes/${id}`, payload);
export const deleteDish = (id: number)                  => del(`/api/admin/dishes/${id}`);

// ---------------- Restaurants ----------------
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
  cuisine_types?: string[];
  rating?: number | null;
  lat: number; lng: number;
  image_url?: string | null;
  featured?: number | null;
  featured_rank?: number | null;
};

export const listRestaurants = (opts: {
  municipalityId?: number|null; dishId?: number; q?: string; featured?: 0|1; limit?: number;
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.dishId)         qs.set("dishId", String(opts.dishId));
  if (opts.q)              qs.set("q", String(opts.q));
  if (opts.featured != null) qs.set("featured", String(opts.featured));
  if (opts.limit)          qs.set("limit", String(opts.limit));
  const url = `/api/restaurants${qs.toString() ? `?${qs.toString()}` : ""}`;
  return get(url).then((rows: any[]) => rows.map(normRestaurant));
};

export const createRestaurant = (payload: any)            => post("/api/admin/restaurants", payload);
export const updateRestaurant = (id: number, payload: any)=> patch(`/api/admin/restaurants/${id}`, payload);
export const deleteRestaurant = (id: number)               => del(`/api/admin/restaurants/${id}`);

// ---------------- Linking ----------------
export const listRestaurantsForDish = (dishId: number) =>
  get(`/api/admin/dishes/${dishId}/restaurants`).then((rows:any[]) => rows.map(normRestaurant));

export const listDishesForRestaurant = (restId: number) =>
  get(`/api/admin/restaurants/${restId}/dishes`).then((rows:any[]) => rows.map(normDish));

export const linkDishRestaurant = (
  dish_id: number,
  restaurant_id: number,
  price_note?: string|null,
  availability: 'regular'|'seasonal'|'preorder' = 'regular'
) => post(`/api/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });

export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  del(`/api/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// ---------------- Curation ----------------
export const setDishCuration = (id: number, payload: { is_signature?: 0|1, panel_rank?: number|null }) =>
  patch(`/api/admin/dishes/${id}`, payload);

export const setRestaurantCuration = (id: number, payload: { featured?: 0|1, featured_rank?: number|null }) =>
  patch(`/api/admin/restaurants/${id}`, payload);

// ---------------- Analytics ----------------
export const getAnalyticsSummary = () => get(`/api/admin/analytics/summary`);

// Old-style aggregate export to keep legacy imports working:
export const AdminAPI = {
  auth: adminAuth,
  listMunicipalities,
  listDishes, createDish, updateDish, deleteDish,
  listRestaurants, createRestaurant, updateRestaurant, deleteRestaurant,
  listRestaurantsForDish, listDishesForRestaurant,
  linkDishRestaurant, unlinkDishRestaurant,
  setDishCuration, setRestaurantCuration,
  getAnalyticsSummary,
};
