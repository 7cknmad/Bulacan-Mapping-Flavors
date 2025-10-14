// src/utils/adminApi.ts
// Centralized Admin API client (cookie-based auth + helpers)

export const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// ----- low-level helpers -----
async function req<T>(
  path: string,
  init: RequestInit = {},
  absolute = false
): Promise<T> {
  const url = absolute || path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    credentials: "include", // send/receive httpOnly admin cookie
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${url}: ${text.slice(0, 200)}`);
  }
  try {
    return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
  } catch {
    throw new Error(`Bad JSON from ${url}: ${text.slice(0, 200)}`);
  }
}

const get = <T>(p: string) => req<T>(p);
const post = <T>(p: string, body?: any) =>
  req<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = <T>(p: string, body?: any) =>
  req<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
const del = <T>(p: string) => req<T>(p, { method: "DELETE" });

// ----- types (minimal) -----
export type Municipality = {
  id: number;
  name: string;
  slug: string;
};

export type DishLite = {
  id: number;
  name: string;
  slug: string;
  category: "food" | "delicacy" | "drink";
};

export type RestaurantLite = {
  id: number;
  name: string;
  slug: string;
};

export type DishPayload = {
  municipality_id: number;
  category_code: "food" | "delicacy" | "drink";
  name: string;
  slug: string;
  description?: string | null;
  flavor_profile?: string[] | null;
  ingredients?: string[] | null;
  history?: string | null;
  image_url?: string | null;
  popularity?: number;
  rating?: number;
  is_signature?: boolean;
  panel_rank?: number | null;
};

export type RestaurantPayload = {
  municipality_id: number;
  name: string;
  slug: string;
  kind?: "restaurant" | "stall" | "store" | "dealer" | "market" | "home-based";
  address: string;
  lat: number;
  lng: number;
  description?: string | null;
  price_range?: "budget" | "moderate" | "expensive";
  cuisine_types?: string[] | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  opening_hours?: string | null;
  rating?: number;
  is_featured?: boolean;
  panel_rank?: number | null;
};

// ----- Admin API surface -----
export const AdminAPI = {
  // auth
  async login(email: string, password: string) {
    await post<{ ok: true }>("/api/admin/auth/login", { email, password });
    // keep your existing ProtectedRoute happy (uses localStorage):
    localStorage.setItem("admin_token", "1");
    return true;
  },
  async logout() {
    await post<{ ok: true }>("/api/admin/auth/logout");
    localStorage.removeItem("admin_token");
  },
  me: () => get<{ ok: true; admin: { email: string; name: string } }>("/api/admin/auth/me"),

  // lookups
  municipalities: () => get<Municipality[]>("/api/municipalities"),
  searchDishes: (q: string) =>
    get<DishLite[]>(`/api/admin/search/dishes?q=${encodeURIComponent(q)}`),
  searchRestaurants: (q: string) =>
    get<RestaurantLite[]>(`/api/admin/search/restaurants?q=${encodeURIComponent(q)}`),

  // CRUD dishes
  createDish: (payload: DishPayload) => post<{ id: number }>("/api/admin/dishes", payload),
  updateDish: (id: number, partial: Partial<DishPayload>) =>
    patch<{ ok: true }>(`/api/admin/dishes/${id}`, partial),
  deleteDish: (id: number) => del<{ ok: true }>(`/api/admin/dishes/${id}`),

  // CRUD restaurants
  createRestaurant: (payload: RestaurantPayload) =>
    post<{ id: number }>("/api/admin/restaurants", payload),
  updateRestaurant: (id: number, partial: Partial<RestaurantPayload>) =>
    patch<{ ok: true }>(`/api/admin/restaurants/${id}`, partial),
  deleteRestaurant: (id: number) => del<{ ok: true }>(`/api/admin/restaurants/${id}`),

  // linking
  linkDishRestaurant: (dish_id: number, restaurant_id: number, price_note?: string | null, availability?: "regular" | "seasonal" | "preorder") =>
    post<{ ok: true }>("/api/admin/dish-restaurants", { dish_id, restaurant_id, price_note, availability }),
  unlinkDishRestaurant: (dish_id: number, restaurant_id: number) =>
    del<{ ok: true }>(`/api/admin/dish-restaurants?dishId=${dish_id}&restaurantId=${restaurant_id}`),

  // analytics / stats
  statsOverview: () => get<{ municipalities: number; dishes: number; delicacies: number; restaurants: number; links: number }>("/api/admin/stats/overview"),
  statsTopDishes: (municipalityId?: number, category?: string, limit = 10) => {
    const qs = new URLSearchParams();
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    if (category) qs.set("category", category);
    qs.set("limit", String(limit));
    return get<Array<{ id: number; name: string; slug: string; category: string; rank_hint: number; places: number }>>(
      `/api/admin/stats/top-dishes?${qs.toString()}`
    );
  },
  statsTopRestaurants: (municipalityId?: number, limit = 10) => {
    const qs = new URLSearchParams();
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    qs.set("limit", String(limit));
    return get<Array<{ id: number; name: string; slug: string; rank_hint: number; dishes: number }>>(
      `/api/admin/stats/top-restaurants?${qs.toString()}`
    );
  },
};
