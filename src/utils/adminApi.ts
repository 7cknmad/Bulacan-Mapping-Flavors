// src/utils/adminApi.ts
// Admin-only API helpers (use public calls from src/utils/api.ts for the user-facing app)

export const API = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

/** Core fetch with cookies (admin endpoints rely on a session cookie) */
async function req<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    method,
    credentials: "include", // important: send/receive session cookie
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt || res.statusText}`);
  return txt ? (JSON.parse(txt) as T) : (null as T);
}

const get = <T = any>(p: string) => req<T>("GET", p);
const post = <T = any>(p: string, b?: unknown) => req<T>("POST", p, b);
const patch = <T = any>(p: string, b?: unknown) => req<T>("PATCH", p, b);
const del = <T = any>(p: string) => req<T>("DELETE", p);

// ---------- Types ----------
export type Municipality = { id: number; name: string; slug: string };

export type Dish = {
  id: number;
  municipality_id: number;
  name: string; slug: string;
  description: string | null;
  image_url: string | null;
  category: "food" | "delicacy" | "drink";
  flavor_profile: string[] | null | string;
  ingredients: string[] | null | string;
  popularity?: number | null;
  rating?: number | null;
  is_signature?: 0 | 1 | null;
  panel_rank?: number | null;
};

export type Restaurant = {
  id: number;
  municipality_id: number;
  name: string; slug: string;
  kind?: 'restaurant'|'stall'|'store'|'dealer'|'market'|'home-based';
  description?: string | null;
  address: string;
  phone?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  opening_hours?: string | null;
  price_range?: "budget" | "moderate" | "expensive" | null;
  cuisine_types: string[] | null | string;
  rating?: number | null;
  lat: number; lng: number;
  image_url?: string | null;
  featured?: 0 | 1 | null;
  featured_rank?: number | null;
};

// ---------- Normalizers to avoid `.join is not a function` ----------
const toArray = (v: unknown): string[] =>
  Array.isArray(v) ? v as string[] :
  (typeof v === "string" && v.trim().length ? safeJSON<string[]>(v, []) : []);

function safeJSON<T>(src: string, fallback: T): T {
  try { return JSON.parse(src) as T; } catch { return fallback; }
}

function normalizeDish(d: Dish): Dish {
  return {
    ...d,
    flavor_profile: toArray(d.flavor_profile as any),
    ingredients: toArray(d.ingredients as any),
  };
}

function normalizeRestaurant(r: Restaurant): Restaurant {
  return {
    ...r,
    cuisine_types: toArray(r.cuisine_types as any),
  };
}

// ---------- Auth ----------
export const adminAuth = {
  login: (email: string, password: string) => post("/api/admin/auth/login", { email, password }),
  logout: () => post("/api/admin/auth/logout"),
  me: () => get<{ id: number; email: string; name?: string }>("/api/admin/auth/me"),
};

// ---------- Lookups ----------
export const listMunicipalities = () =>
  get<Municipality[]>("/api/municipalities");

// ---------- Dishes ----------
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
  return get<Dish[]>(`/api/dishes${qs.toString() ? `?${qs.toString()}` : ""}`)
    .then(arr => arr.map(normalizeDish));
};

export const createDish = (payload: Partial<Dish>) =>
  post<{ id: number }>("/api/admin/dishes", payload);

export const updateDish = (id: number, payload: Partial<Dish>) =>
  patch(`/api/admin/dishes/${id}`, payload);

export const deleteDish = (id: number) =>
  del(`/api/admin/dishes/${id}`);

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
  if (opts.dishId) qs.set("dishId", String(opts.dishId));
  if (opts.q) qs.set("q", String(opts.q));
  if (opts.featured != null) qs.set("featured", String(opts.featured));
  if (opts.limit) qs.set("limit", String(opts.limit));
  return get<Restaurant[]>(`/api/restaurants${qs.toString() ? `?${qs.toString()}` : ""}`)
    .then(arr => arr.map(normalizeRestaurant));
};

export const createRestaurant = (payload: Partial<Restaurant>) =>
  post<{ id: number }>("/api/admin/restaurants", payload);

export const updateRestaurant = (id: number, payload: Partial<Restaurant>) =>
  patch(`/api/admin/restaurants/${id}`, payload);

export const deleteRestaurant = (id: number) =>
  del(`/api/admin/restaurants/${id}`);

// ---------- Linking ----------
export const listRestaurantsForDish = (dishId: number) =>
  get<Restaurant[]>(`/api/admin/dishes/${dishId}/restaurants`).then(a => a.map(normalizeRestaurant));

export const listDishesForRestaurant = (restId: number) =>
  get<Dish[]>(`/api/admin/restaurants/${restId}/dishes`).then(a => a.map(normalizeDish));

export const linkDishRestaurant = (
  dish_id: number,
  restaurant_id: number,
  price_note?: string | null,
  availability: "regular" | "seasonal" | "preorder" = "regular"
) => post(`/api/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });

export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  del(`/api/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// ---------- Curation ----------
export const setDishCuration = (id: number, payload: { is_signature?: 0|1; panel_rank?: number|null }) =>
  patch(`/api/admin/dishes/${id}`, payload);

export const setRestaurantCuration = (id: number, payload: { featured?: 0|1; featured_rank?: number|null }) =>
  patch(`/api/admin/restaurants/${id}`, payload);

// ---------- Analytics ----------
export const getAnalyticsSummary = () =>
  get<{ byMunicipality: Array<{ id: number; name: string; dishes: number; restaurants: number; links: number }>;
         topDishes: Array<{ id:number; name:string; count:number }>;
         topRestaurants: Array<{ id:number; name:string; count:number }>; }>("/api/admin/analytics/summary");
