// src/utils/adminApi.ts
export const API = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

// core fetcher
async function req(method: string, path: string, body?: any, withCreds = true) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: withCreds ? "include" : "omit",
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt}`);
  try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}

const get = (p: string, withCreds = true) => req("GET", p, undefined, withCreds);
const post = (p: string, b?: any, withCreds = true) => req("POST", p, b, withCreds);
const patch = (p: string, b?: any, withCreds = true) => req("PATCH", p, b, withCreds);
const del = (p: string, withCreds = true) => req("DELETE", p, undefined, withCreds);

/* ============== Auth used by Admin ============== */
export const AdminAuth = {
  me:       () => get("/api/admin/auth/me", true),
  login:    (email: string, password: string) => post("/api/admin/auth/login", { email, password }, true),
  logout:   () => post("/api/admin/auth/logout", undefined, true),
};

/* ============== Shared types ============== */
export type Municipality = { id: number; name: string; slug: string; };

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
  // optional curation fields (may not exist in DB; UI treats as optional)
  featured?: number | null;
  featured_rank?: number | null;
  is_signature?: number | null;
  panel_rank?: number | null;
};

export type Restaurant = {
  id: number;
  municipality_id: number;
  name: string; slug: string;
  kind?: "restaurant"|"stall"|"store"|"dealer"|"market"|"home-based";
  description?: string | null;
  image_url?: string | null;
  address: string;
  phone?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  opening_hours?: string | null;
  price_range?: "budget"|"moderate"|"expensive";
  cuisine_types?: string[] | null;
  rating?: number | null;
  lat: number; lng: number;
  // optional curation fields (may not exist in DB)
  featured?: number | null;
  featured_rank?: number | null;
};

export const listMunicipalities = () => get("/api/municipalities", false);

/* ============== Public list endpoints (no creds) ============== */
export const AdminAPI = {
  // lists (public)
  getDishes: (opts: { municipalityId?: number; category?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
    if (opts.category)       qs.set("category", opts.category);
    if (opts.q)              qs.set("q", opts.q);
    return get(`/api/dishes${qs.toString() ? `?${qs.toString()}` : ""}`, false);
  },
  getRestaurants: (opts: { municipalityId?: number; dishId?: number; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
    if (opts.dishId)         qs.set("dishId", String(opts.dishId));
    if (opts.q)              qs.set("q", opts.q);
    return get(`/api/restaurants${qs.toString() ? `?${qs.toString()}` : ""}`, false);
  },

  // CRUD (admin)
  createDish:        (payload: Partial<Dish>)                => post("/api/admin/dishes", payload, true),
  updateDish:        (id: number, payload: Partial<Dish>)    => patch(`/api/admin/dishes/${id}`, payload, true),
  deleteDish:        (id: number)                            => del(`/api/admin/dishes/${id}`, true),

  createRestaurant:  (payload: Partial<Restaurant>)          => post("/api/admin/restaurants", payload, true),
  updateRestaurant:  (id: number, payload: Partial<Restaurant>) => patch(`/api/admin/restaurants/${id}`, payload, true),
  deleteRestaurant:  (id: number)                            => del(`/api/admin/restaurants/${id}`, true),

  // Linking (admin, with graceful fallback handled in UI already)
  getLinkedRestaurantIds: (dishId: number) =>
    get(`/api/admin/dishes/${dishId}/restaurants`, true), // returns number[] (ids)

  linkDishRestaurant:   (dish_id: number, restaurant_id: number, price_note?: string|null, availability: 'regular'|'seasonal'|'preorder' = 'regular') =>
    post(`/api/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability }, true),

  unlinkDishRestaurant: (dish_id: number, restaurant_id: number) =>
    del(`/api/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`, true),

  // Curation (accepts either featured/featured_rank or is_signature/panel_rank – server picks what exists)
  setDishFeatured:       (id: number, featured: 0|1, rank: number|null)      =>
    patch(`/api/admin/dishes/${id}`, { featured, featured_rank: rank, is_signature: featured, panel_rank: rank }, true),

  setRestaurantSignature:(id: number, signature: 0|1, rank: number|null)     =>
    patch(`/api/admin/restaurants/${id}`, { featured: signature, featured_rank: rank, is_signature: signature, panel_rank: rank }, true),
};
