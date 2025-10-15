// src/utils/adminApi.ts
export const API = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

type Cred = "include" | "omit";
const isAdmin = (p: string) => p.startsWith("/api/admin/");

async function req(method: string, path: string, body?: any) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const admin = isAdmin(path);
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: admin ? "include" : "omit",
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt}`);
  try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}
const get  = (p: string) => req("GET", p);
const post = (p: string, b?: any) => req("POST", p, b);
const patch= (p: string, b?: any) => req("PATCH", p, b);
const del  = (p: string) => req("DELETE", p);

// ---------- Shared lookups ----------
export type Municipality = { id: number; name: string; slug: string; };
export const listMunicipalities = () => get("/api/municipalities");

// ---------- Dishes ----------
export type Dish = {
  id: number;
  municipality_id: number;
  name: string; slug: string;
  description: string | null;
  image_url: string | null;
  category: "food"|"delicacy"|"drink";
  flavor_profile?: any;
  ingredients?: any;
  popularity?: number | null;
  rating?: number | null;
  is_signature?: number | null;
  panel_rank?: number | null;
};
export const listDishes = (opts: { municipalityId?: number|null; category?: string; q?: string; signature?: 0|1; limit?: number } = {}) => {
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
  price_range?: "budget"|"moderate"|"expensive";
  cuisine_types?: any;
  rating?: number | null;
  lat: number; lng: number;
  image_url?: string | null;
  featured?: number | null;
  featured_rank?: number | null;
};
export const listRestaurants = (opts: { municipalityId?: number|null; dishId?: number; q?: string; featured?: 0|1; limit?: number } = {}) => {
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

// ---------- Linking ----------
export const listRestaurantsForDish = (dishId: number) =>
  get(`/api/admin/dishes/${dishId}/restaurants`);
export const listDishesForRestaurant = (restId: number) =>
  get(`/api/admin/restaurants/${restId}/dishes`);

export const linkDishRestaurant = (
  dish_id: number,
  restaurant_id: number,
  price_note?: string|null,
  availability: 'regular'|'seasonal'|'preorder' = 'regular'
) => post(`/api/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });

export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  del(`/api/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// ---------- Curation ----------
export const setDishCuration = (id: number, payload: { is_signature?: 0|1, panel_rank?: number|null }) =>
  patch(`/api/admin/dishes/${id}`, payload);
export const setRestaurantCuration = (id: number, payload: { featured?: 0|1, featured_rank?: number|null }) =>
  patch(`/api/admin/restaurants/${id}`, payload);

// ---------- Analytics ----------
export const getAnalyticsSummary = () => get(`/api/admin/analytics/summary`);

// ---------- Admin auth (cookie-based) ----------
export const adminAuth = {
  me: () => get(`/api/admin/auth/me`),
};

// For compatibility with older imports:
export const AdminAPI = {
  adminAuth,
  listMunicipalities,
  listDishes, createDish, updateDish, deleteDish,
  listRestaurants, createRestaurant, updateRestaurant, deleteRestaurant,
  listRestaurantsForDish, listDishesForRestaurant, linkDishRestaurant, unlinkDishRestaurant,
  setDishCuration, setRestaurantCuration,
  getAnalyticsSummary,
};
export const AdminAuth = adminAuth;
