// src/utils/adminApi.ts
import { API } from "./api";

/** Always send cookies to the API (admin runs cross-site from GH Pages) */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} @ ${path}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Bad JSON @ ${path}: ${text.slice(0, 200)}`);
  }
}
const get = <T,>(p: string) => request<T>(p);
const post = <T,>(p: string, body?: unknown) => request<T>(p, { method: "POST", body: JSON.stringify(body ?? {}) });
const patch = <T,>(p: string, body?: unknown) => request<T>(p, { method: "PATCH", body: JSON.stringify(body ?? {}) });
const del =  <T,>(p: string) => request<T>(p, { method: "DELETE" });

/** ====== Auth ====== */
export const adminAuth = {
  me:     () => get<{ ok: boolean; admin?: { name: string; email: string } }>("/api/admin/auth/me"),
  login:  (email: string, password: string) => post<{ ok: true; name: string; email: string }>("/api/admin/auth/login", { email, password }),
  logout: () => post<{ ok: true }>("/api/admin/auth/logout"),
};

/** ====== Analytics ====== */
export type Overview = {
  municipalities: number;
  dishes: number;
  delicacies: number;
  restaurants: number;
  links: number;
};
export type TopDish = { id: number; name: string; slug: string; category: string; rank_hint: number; places: number; };
export type TopRestaurant = { id: number; name: string; slug: string; rank_hint: number; dishes: number; };

/** robust fetch with fallback + safe default */
async function getOr<T>(primary: string, fallback: string, def: T): Promise<T> {
  try { return await get<T>(primary); }
  catch {
    try { return await get<T>(fallback); }
    catch { return def; }
  }
}

export const adminStats = {
  overview: () =>
    getOr<Overview>(
      "/api/admin/stats/overview",
      "/api/admin/analytics/summary",
      { municipalities: 0, dishes: 0, delicacies: 0, restaurants: 0, links: 0 }
    ),
  topDishes: (municipalityId?: number, category?: string, limit = 10) => {
    const qs = new URLSearchParams();
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    if (category) qs.set("category", category);
    qs.set("limit", String(limit));
    const suffix = `?${qs.toString()}`;
    return getOr<TopDish[]>(
      `/api/admin/stats/top-dishes${suffix}`,
      `/api/admin/analytics/top-dishes${suffix}`,
      []
    );
  },
  topRestaurants: (municipalityId?: number, limit = 10) => {
    const qs = new URLSearchParams();
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    qs.set("limit", String(limit));
    const suffix = `?${qs.toString()}`;
    return getOr<TopRestaurant[]>(
      `/api/admin/stats/top-restaurants${suffix}`,
      `/api/admin/analytics/top-restaurants${suffix}`,
      []
    );
  },
};

/** ====== Public list helpers (used by admin too) ====== */
export type Municipality = {
  id: number; name: string; slug: string; description: string|null;
  province: string; lat: number; lng: number; image_url: string|null;
};
export type Dish = {
  id: number; slug: string; name: string; description: string|null; image_url: string|null;
  rating: number|null; popularity: number|null; flavor_profile: string[]|null; ingredients: string[]|null;
  municipality_id: number; municipality_name: string; category: "food"|"delicacy"|"drink";
  is_signature?: 0|1; panel_rank?: number|null;
};
export type Restaurant = {
  id: number; name: string; slug: string; kind: 'restaurant'|'stall'|'store'|'dealer'|'market'|'home-based';
  description: string|null; address: string; phone: string|null; website: string|null;
  facebook: string|null; instagram: string|null; opening_hours: string|null;
  price_range: "budget"|"moderate"|"expensive"; cuisine_types: string[]|null;
  rating: number; lat: number; lng: number; is_featured?: 0|1; panel_rank?: number|null;
};

export const list = {
  municipalities: () => get<Municipality[]>("/api/municipalities"),
  dishes: (opts: { municipalityId?: number; category?: string; q?: string; slug?: string; signature?: boolean; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
    if (opts.category) qs.set("category", opts.category);
    if (opts.q) qs.set("q", opts.q);
    if (opts.slug) qs.set("slug", opts.slug);
    if (opts.signature) qs.set("signature", "1");
    if (opts.limit) qs.set("limit", String(opts.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return get<Dish[]>(`/api/dishes${suffix}`);
  },
  restaurants: (opts: { municipalityId?: number; dishId?: number; q?: string; featured?: boolean; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
    if (opts.dishId) qs.set("dishId", String(opts.dishId));
    if (opts.q) qs.set("q", opts.q);
    if (opts.featured) qs.set("featured", "1");
    if (opts.limit) qs.set("limit", String(opts.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return get<Restaurant[]>(`/api/restaurants${suffix}`);
  },
  restaurantsByDish: (dishId: number) => get<(Restaurant & { price_note: string|null; availability: string })[]>(`/api/restaurants/by-dish/${dishId}`),
  dishesByMunicipality: (municipalityId: number) => get<Dish[]>(`/api/municipalities/${municipalityId}/dishes`),
  restaurantsByMunicipality: (municipalityId: number, featured?: boolean) => {
    const qs = new URLSearchParams();
    if (featured) qs.set("featured", "1");
    const suffix = `?${qs.toString()}`;
    return get<Restaurant[]>(`/api/municipalities/${municipalityId}/restaurants${suffix}`);
  },
  dishBySlug: async (slug: string) => (await list.dishes({ slug, limit: 1 }))[0] ?? null,
  restaurantBySlug: async (slug: string) => (await list.restaurants({ q: slug, limit: 1 })).find(r => r.slug === slug) ?? null,
};

/** ====== Admin CRUD + Linking ====== */
export const adminData = {
  searchDishes: (q: string) => get<Array<{ id: number; name: string; slug: string; category: string }>>(`/api/admin/search/dishes?q=${encodeURIComponent(q)}`),
  searchRestaurants: (q: string) => get<Array<{ id: number; name: string; slug: string }>>(`/api/admin/search/restaurants?q=${encodeURIComponent(q)}`),

  createDish: (payload: any) => post<{ id: number }>("/api/admin/dishes", payload),
  updateDish: (id: number, payload: any) => post<{ id: number }>("/api/admin/dishes", { ...payload }),
  deleteDish: (id: number) => del<{ ok: true }>(`/api/admin/dishes/${id}`),

  createRestaurant: (payload: any) => post<{ id: number }>("/api/admin/restaurants", payload),
  updateRestaurant: (id: number, payload: any) => post<{ id: number }>("/api/admin/restaurants", { ...payload }),
  deleteRestaurant: (id: number) => del<{ ok: true }>(`/api/admin/restaurants/${id}`),

  linkDishRestaurant: (dish_id: number, restaurant_id: number, price_note?: string, availability?: string) =>
    post<{ ok: true }>("/api/admin/dish-restaurants", { dish_id, restaurant_id, price_note, availability }),
  unlinkDishRestaurant: (dishId: number, restaurantId: number) =>
    del<{ ok: true }>(`/api/admin/dish-restaurants?dishId=${dishId}&restaurantId=${restaurantId}`),

  async uploadImage(file: File): Promise<{ url: string }> {
    const fd = new FormData();
    fd.append("file", file);
    const url = `${API}/api/admin/upload-image`;
    const res = await fetch(url, { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Upload failed: HTTP ${res.status} ${txt.slice(0, 160)}`);
    }
    const json = await res.json().catch(() => ({}));
    if (!json?.url) throw new Error("Upload endpoint did not return a {url}. Add /api/admin/upload-image.");
    return { url: json.url };
  },
};
