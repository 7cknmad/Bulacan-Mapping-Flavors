// src/utils/adminApi.ts
// Single source of truth for the Admin Dashboard API (no login for now)

export const ADMIN = (import.meta.env.VITE_ADMIN_API_URL ?? "").replace(/\/+$/, "");

// Basic helpers
async function req<T>(method: string, path: string, body?: any): Promise<T> {
  if (!ADMIN) throw new Error("VITE_ADMIN_API_URL is not set");
  const url = path.startsWith("http") ? path : `${ADMIN}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    // no cookies/session right now:
    credentials: "omit",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text || url}`);
  return text ? (JSON.parse(text) as T) : (null as T);
}
const get = <T>(p: string) => req<T>("GET", p);
const post = <T>(p: string, b?: any) => req<T>("POST", p, b);
const patch = <T>(p: string, b?: any) => req<T>("PATCH", p, b);
const del = <T>(p: string) => req<T>("DELETE", p);

// Optional: tiny health ping you can use for a banner if desired
export async function pingAdmin(): Promise<boolean> {
  try {
    // support either /health or /admin/health depending on server
    await get<any>("/health");
    return true;
  } catch {
    try {
      await get<any>("/admin/health");
      return true;
    } catch {
      return false;
    }
  }
}

/* ================= Types kept lean to what the Dashboard uses ================= */

export type Municipality = {
  id: number;
  name: string;
  slug: string;
};

export type Dish = {
  id: number;
  municipality_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  image_url?: string | null;
  category: "food" | "delicacy" | "drink";
  // curation fields:
  is_signature?: 0 | 1 | null;
  panel_rank?: number | null;
  // optional metrics (won’t break if server omits)
  rating?: number | null;
  popularity?: number | null;
};

export type Restaurant = {
  id: number;
  municipality_id: number | null;
  name: string;
  slug: string;
  address: string;
  lat: number;
  lng: number;
  description?: string | null;
  image_url?: string | null;
  // curation fields:
  featured?: 0 | 1 | null;
  featured_rank?: number | null;
};

/* ================= Reads (all hit /api/* on admin server) ================= */

export function listMunicipalities(): Promise<Municipality[]> {
  return get<Municipality[]>("/api/municipalities");
}

export function listDishes(opts: { municipalityId?: number; q?: string } = {}): Promise<Dish[]> {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.q) qs.set("q", opts.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return get<Dish[]>(`/api/dishes${suffix}`);
}

export function listRestaurants(opts: { municipalityId?: number; q?: string } = {}): Promise<Restaurant[]> {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.q) qs.set("q", opts.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return get<Restaurant[]>(`/api/restaurants${suffix}`);
}

/* ================= Writes (all under /admin/* on admin server) ================= */

// Dishes CRUD
export function createDish(payload: Partial<Dish>): Promise<Dish> {
  return post<Dish>("/admin/dishes", payload);
}
export function updateDish(id: number, payload: Partial<Dish>): Promise<Dish> {
  return patch<Dish>(`/admin/dishes/${id}`, payload);
}
export function deleteDish(id: number): Promise<{ ok: true }> {
  return del<{ ok: true }>(`/admin/dishes/${id}`);
}

// Restaurants CRUD
export function createRestaurant(payload: Partial<Restaurant>): Promise<Restaurant> {
  return post<Restaurant>("/admin/restaurants", payload);
}
export function updateRestaurant(id: number, payload: Partial<Restaurant>): Promise<Restaurant> {
  return patch<Restaurant>(`/admin/restaurants/${id}`, payload);
}
export function deleteRestaurant(id: number): Promise<{ ok: true }> {
  return del<{ ok: true }>(`/admin/restaurants/${id}`);
}

/* ================= Linking ================= */

export function linkedRestaurantsForDish(dishId: number): Promise<Restaurant[]> {
  return get<Restaurant[]>(`/admin/dishes/${dishId}/restaurants`);
}

export function linkDishRestaurant(
  dish_id: number,
  restaurant_id: number,
  price_note?: string | null,
  availability: "regular" | "seasonal" | "preorder" = "regular"
): Promise<{ ok: true }> {
  return post<{ ok: true }>(`/admin/dish-restaurants`, {
    dish_id,
    restaurant_id,
    price_note: price_note ?? null,
    availability,
  });
}

export function unlinkDishRestaurant(dish_id: number, restaurant_id: number): Promise<{ ok: true }> {
  // as query params for simplicity
  return del<{ ok: true }>(`/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);
}

/* ================= Curation ================= */

export function setDishCuration(
  id: number,
  payload: { is_signature?: 0 | 1 | null; panel_rank?: number | null }
): Promise<Dish> {
  // same update route — server should upsert those two columns
  return patch<Dish>(`/admin/dishes/${id}`, payload);
}

export function setRestaurantCuration(
  id: number,
  payload: { featured?: 0 | 1 | null; featured_rank?: number | null }
): Promise<Restaurant> {
  return patch<Restaurant>(`/admin/restaurants/${id}`, payload);
}

/* ================= Analytics ================= */

export function getAnalyticsSummary(): Promise<{
  counts: { dishes: number; restaurants: number };
  perMunicipality: Array<{ municipality_id: number; dishes: number; restaurants: number }>;
  top: {
    dishes: Array<{ id: number; name: string; panel_rank: number }>;
    restaurants: Array<{ id: number; name: string; featured_rank: number }>;
  };
}> {
  return get(`/admin/analytics/summary`);
}
