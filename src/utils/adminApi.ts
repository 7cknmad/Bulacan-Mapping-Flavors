// src/utils/adminApi.ts
import { API } from "./api";

/** Low-level helpers (always send cookies) */
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
const del = <T,>(p: string) => request<T>(p, { method: "DELETE" });

/** Types for admin analytics */
export type Overview = {
  municipalities: number;
  dishes: number;
  delicacies: number;
  restaurants: number;
  links: number;
};
export type TopDish = { id: number; name: string; slug: string; category: string; rank_hint: number; places: number; };
export type TopRestaurant = { id: number; name: string; slug: string; rank_hint: number; dishes: number; };

/** Auth */
export const adminAuth = {
  me: () => get<{ ok: boolean; admin?: { name: string; email: string } }>("/api/admin/auth/me"),
  login: (email: string, password: string) => post<{ ok: true; name: string; email: string }>("/api/admin/auth/login", { email, password }),
  logout: () => post<{ ok: true }>("/api/admin/auth/logout"),
};

/** Analytics (tries new endpoints first; falls back to legacy aliases if necessary) */
async function tryBoth<T>(primary: string, fallback: string) {
  try {
    return await get<T>(primary);
  } catch {
    return await get<T>(fallback);
  }
}
export const adminStats = {
  overview: () => tryBoth<Overview>("/api/admin/stats/overview", "/api/admin/analytics/summary"),
  topDishes: (municipalityId?: number, category?: string, limit = 10) => {
    const qs = new URLSearchParams();
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    if (category) qs.set("category", category);
    qs.set("limit", String(limit));
    const suffix = `?${qs.toString()}`;
    return tryBoth<TopDish[]>(`/api/admin/stats/top-dishes${suffix}`, `/api/admin/analytics/top-dishes${suffix}`);
  },
  topRestaurants: (municipalityId?: number, limit = 10) => {
    const qs = new URLSearchParams();
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    qs.set("limit", String(limit));
    const suffix = `?${qs.toString()}`;
    return tryBoth<TopRestaurant[]>(`/api/admin/stats/top-restaurants${suffix}`, `/api/admin/analytics/top-restaurants${suffix}`);
  },
};

/** Admin data helpers (CRUD you already use elsewhere) */
export const adminData = {
  searchDishes: (q: string) => get<Array<{ id: number; name: string; slug: string; category: string }>>(`/api/admin/search/dishes?q=${encodeURIComponent(q)}`),
  searchRestaurants: (q: string) => get<Array<{ id: number; name: string; slug: string }>>(`/api/admin/search/restaurants?q=${encodeURIComponent(q)}`),

  // Dishes
  createDish: (payload: any) => post<{ id: number }>("/api/admin/dishes", payload),
  updateDish: (id: number, payload: any) => patch<{ ok: true }>(`/api/admin/dishes/${id}`, payload),
  deleteDish: (id: number) => del<{ ok: true }>(`/api/admin/dishes/${id}`),

  // Restaurants
  createRestaurant: (payload: any) => post<{ id: number }>("/api/admin/restaurants", payload),
  updateRestaurant: (id: number, payload: any) => patch<{ ok: true }>(`/api/admin/restaurants/${id}`, payload),
  deleteRestaurant: (id: number) => del<{ ok: true }>(`/api/admin/restaurants/${id}`),

  // Linking
  linkDishRestaurant: (dish_id: number, restaurant_id: number, price_note?: string, availability?: string) =>
    post<{ ok: true }>("/api/admin/dish-restaurants", { dish_id, restaurant_id, price_note, availability }),
  unlinkDishRestaurant: (dishId: number, restaurantId: number) =>
    del<{ ok: true }>(`/api/admin/dish-restaurants?dishId=${dishId}&restaurantId=${restaurantId}`),
};
