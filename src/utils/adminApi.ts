// src/utils/adminApi.ts
import { API } from "./api";

/** Always send cookies for admin endpoints */
async function req<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
  try { return JSON.parse(text) as T; } catch { return text as any; }
}

export type Dish = {
  id: number;
  municipality_id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  rating: number | null;
  popularity: number | null;
  flavor_profile: string[] | null;
  ingredients: string[] | null;
  category: "food" | "delicacy" | "drink";
  featured?: 0 | 1;
  featured_rank?: number | null;
};

export type Restaurant = {
  id: number;
  municipality_id: number;
  name: string;
  slug: string;
  kind: "restaurant"|"stall"|"store"|"dealer"|"market"|"home-based";
  description: string | null;
  image_url: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  opening_hours: string | null;
  price_range: "budget"|"moderate"|"expensive";
  cuisine_types: string[] | null;
  rating: number | null;
  lat: number | null;
  lng: number | null;
  signature?: 0 | 1;
  signature_rank?: number | null;
};

export type Municipality = {
  id: number;
  name: string;
  slug: string;
};

export const AdminAuth = {
  login: (email: string, password: string) =>
    req<{ ok: boolean; user: { email: string } }>("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => req<{ user?: { email: string } }>("/api/admin/auth/me"),
  logout: () => req<{ ok: boolean }>("/api/admin/auth/logout", { method: "POST" }),
};

export const AdminAPI = {
  municipalities: () => req<Municipality[]>("/api/municipalities"),

  // Dishes CRUD
  getDishes: (opts: { municipalityId?: number; q?: string } = {}) => {
    const p = new URLSearchParams();
    if (opts.municipalityId) p.set("municipalityId", String(opts.municipalityId));
    if (opts.q) p.set("q", opts.q);
    const qs = p.toString() ? `?${p.toString()}` : "";
    return req<Dish[]>(`/api/admin/dishes${qs}`);
  },
  createDish: (payload: Partial<Dish> & { category: Dish["category"] }) =>
    req<{ id: number }>("/api/admin/dishes", { method: "POST", body: JSON.stringify(payload) }),
  updateDish: (id: number, payload: Partial<Dish> & { category: Dish["category"] }) =>
    req<{ ok: boolean }>(`/api/admin/dishes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteDish: (id: number) =>
    req<{ ok: boolean }>(`/api/admin/dishes/${id}`, { method: "DELETE" }),
  setDishFeatured: (id: number, featured: 0|1, rank: number|null) =>
    req<{ ok: boolean }>(`/api/admin/dishes/${id}/feature`, { method: "POST", body: JSON.stringify({ featured, rank }) }),

  // Restaurants CRUD
  getRestaurants: (opts: { municipalityId?: number; q?: string } = {}) => {
    const p = new URLSearchParams();
    if (opts.municipalityId) p.set("municipalityId", String(opts.municipalityId));
    if (opts.q) p.set("q", opts.q);
    const qs = p.toString() ? `?${p.toString()}` : "";
    return req<Restaurant[]>(`/api/admin/restaurants${qs}`);
  },
  createRestaurant: (payload: Partial<Restaurant>) =>
    req<{ ok: boolean }>("/api/admin/restaurants", { method: "POST", body: JSON.stringify(payload) }),
  updateRestaurant: (id: number, payload: Partial<Restaurant>) =>
    req<{ ok: boolean }>(`/api/admin/restaurants/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteRestaurant: (id: number) =>
    req<{ ok: boolean }>(`/api/admin/restaurants/${id}`, { method: "DELETE" }),
  setRestaurantSignature: (id: number, signature: 0|1, rank: number|null) =>
    req<{ ok: boolean }>(`/api/admin/restaurants/${id}/signature`, { method: "POST", body: JSON.stringify({ signature, rank }) }),

  // Linking
  listLinks: (opts: { dishId?: number; restaurantId?: number }) => {
    const p = new URLSearchParams();
    if (opts.dishId) p.set("dishId", String(opts.dishId));
    if (opts.restaurantId) p.set("restaurantId", String(opts.restaurantId));
    const qs = p.toString() ? `?${p.toString()}` : "";
    return req(`/api/admin/links${qs}`);
  },
  linkDishRestaurant: (dish_id: number, restaurant_id: number, price_note?: string|null, availability: "regular"|"seasonal"|"preorder" = "regular") =>
    req(`/api/admin/links`, { method: "POST", body: JSON.stringify({ dish_id, restaurant_id, price_note, availability }) }),
  unlinkDishRestaurant: (dish_id: number, restaurant_id: number) =>
    req(`/api/admin/links`, { method: "DELETE", body: JSON.stringify({ dish_id, restaurant_id }) }),

  // Analytics
  analyticsSummary: () => req("/api/admin/analytics/summary"),
};
