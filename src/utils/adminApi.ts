// src/utils/adminApi.ts
export const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/* ------------ core fetch helper ------------ */
async function req(method: string, path: string, body?: any) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt}`);
  try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}
const get = (p: string) => req("GET", p);
const post = (p: string, b?: any) => req("POST", p, b);
const patch = (p: string, b?: any) => req("PATCH", p, b);
const del = (p: string) => req("DELETE", p);

/* ------------ Auth ------------ */
export const adminAuth = {
  me: () => get("/api/admin/auth/me"),
  login: (email: string, password: string) =>
    post("/api/admin/auth/login", { email, password }),
  logout: () => post("/api/admin/auth/logout"),
};
// Object alias used by the dashboard
export const AdminAuth = adminAuth;

/* ------------ Shared lookups ------------ */
export type Municipality = { id: number; name: string; slug: string };
export const listMunicipalities = () => get("/api/municipalities");

/* ------------ Dishes ------------ */
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

  // curation flags in your schema
  is_signature?: number | null;   // 1/0
  panel_rank?: number | null;     // 1..3 or null

  // some setups use featured on dishes—kept for compatibility
  featured?: number | null;
  featured_rank?: number | null;
};

export const listDishes = (opts: {
  municipalityId?: number | null;
  category?: string;
  q?: string;
  signature?: 0 | 1;      // filter by is_signature if provided
  limit?: number;
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.category) qs.set("category", String(opts.category));
  if (opts.q) qs.set("q", String(opts.q));
  if (opts.signature != null) qs.set("signature", String(opts.signature));
  if (opts.limit) qs.set("limit", String(opts.limit));
  return get(`/api/dishes${qs.toString() ? `?${qs.toString()}` : ""}`);
};

export const createDish = (payload: any) => post("/api/admin/dishes", payload);
export const updateDish = (id: number, payload: any) => patch(`/api/admin/dishes/${id}`, payload);
export const deleteDish = (id: number) => del(`/api/admin/dishes/${id}`);

/** Curation for dishes (maps to your fields is_signature + panel_rank) */
export const setDishCuration = (id: number, payload: { is_signature?: 0 | 1; panel_rank?: number | null }) =>
  patch(`/api/admin/dishes/${id}`, payload);

/** Compatibility wrapper used by some UI code */
export const setDishFeatured = (id: number, featured: 0 | 1, rank: number | null) =>
  setDishCuration(id, { is_signature: featured, panel_rank: rank });

/* ------------ Restaurants ------------ */
export type Restaurant = {
  id: number;
  municipality_id?: number;
  name: string; slug: string; kind?: "restaurant"|"stall"|"store"|"dealer"|"market"|"home-based";
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

  // curation flags in your schema
  featured?: number | null;       // 1/0
  featured_rank?: number | null;  // 1..3 or null

  // some setups used signature on restaurants—wrapper provided below
  signature?: number | null;
  signature_rank?: number | null;
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
  return get(`/api/restaurants${qs.toString() ? `?${qs.toString()}` : ""}`);
};

export const createRestaurant = (payload: any) => post("/api/admin/restaurants", payload);
export const updateRestaurant = (id: number, payload: any) => patch(`/api/admin/restaurants/${id}`, payload);
export const deleteRestaurant = (id: number) => del(`/api/admin/restaurants/${id}`);

/** Curation for restaurants (maps to featured + featured_rank) */
export const setRestaurantCuration = (id: number, payload: { featured?: 0 | 1; featured_rank?: number | null }) =>
  patch(`/api/admin/restaurants/${id}`, payload);

/** Compatibility wrapper expected by some UI (treats “signature” as featured). */
export const setRestaurantSignature = (id: number, signature: 0 | 1, rank: number | null) =>
  setRestaurantCuration(id, { featured: signature, featured_rank: rank });

/** Also expose a “featured” wrapper explicitly */
export const setRestaurantFeatured = (id: number, featured: 0 | 1, rank: number | null) =>
  setRestaurantCuration(id, { featured, featured_rank: rank });

/* ------------ Linking ------------ */
export const listRestaurantsForDish = (dishId: number) =>
  get(`/api/admin/dishes/${dishId}/restaurants`); // if your backend supports it

export const listDishesForRestaurant = (restId: number) =>
  get(`/api/admin/restaurants/${restId}/dishes`);

export const linkDishRestaurant = (
  dish_id: number,
  restaurant_id: number,
  price_note?: string | null,
  availability: "regular" | "seasonal" | "preorder" = "regular"
) => post(`/api/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });

export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  del(`/api/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

/** Helper: return list of restaurant IDs linked to a dish.
 *  Tries admin route first; if 404, falls back to public /api/restaurants/by-dish/:id
 */
export async function getLinkedRestaurantIds(dishId: number): Promise<number[]> {
  try {
    const rows = await listRestaurantsForDish(dishId) as { id: number }[];
    if (Array.isArray(rows)) return rows.map(r => r.id);
  } catch {
    // fall through
  }
  const rows = await get(`/api/restaurants/by-dish/${dishId}`) as { id: number }[] | null;
  return Array.isArray(rows) ? rows.map(r => r.id) : [];
}

/* ------------ Analytics (optional server route) ------------ */
export const getAnalyticsSummary = () => get(`/api/admin/analytics/summary`);

/* ------------ Grouped object API (used by dashboard) ------------ */
export const AdminAPI = {
  // lookups
  listMunicipalities,

  // dishes
  getDishes: listDishes,
  createDish,
  updateDish,
  deleteDish,
  setDishCuration,
  setDishFeatured,

  // restaurants
  getRestaurants: listRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  setRestaurantCuration,
  setRestaurantSignature,
  setRestaurantFeatured,

  // linking
  listRestaurantsForDish,
  listDishesForRestaurant,
  linkDishRestaurant,
  unlinkDishRestaurant,
  getLinkedRestaurantIds,

  // analytics
  getAnalyticsSummary,
};
