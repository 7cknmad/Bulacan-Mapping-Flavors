// src/utils/adminApi.ts
// Admin client for Bulacan-Mapping-Flavors (single tunnel).
// Now supports header-based JWT (no cookies): login/me/logout + auto Bearer header.

const BASE = (import.meta as any).env?.VITE_ADMIN_API_URL?.replace(/\/$/, "") || "";

/* ------------------------ Token storage (no cookies) ----------------------- */
const TOK_KEY = "bmf_admin_token";
export function setAdminToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOK_KEY, token);
    else localStorage.removeItem(TOK_KEY);
  } catch {}
}
export function getAdminToken(): string | null {
  try { return localStorage.getItem(TOK_KEY); } catch { return null; }
}
export function isLoggedIn() { return !!getAdminToken(); }

/* ------------------------------ HTTP wrapper ------------------------------ */
async function http(path: string, init: RequestInit = {}) {
  const token = getAdminToken();
  const res = await fetch(`${BASE}${path}`, {
    credentials: "omit", // <- no cookies
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}), // <- Bearer token if present
      ...(init.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text || "Request failed"}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

function qs(params: Record<string, any>) {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    u.append(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : "";
}

/* ----------------------------- Helpers & Types ---------------------------- */
export type Municipality = { id: number; name: string; slug: string };
export type Dish = {
  id: number; name: string; slug: string;
  municipality_id?: number | null;
  category?: string | null;
  image_url?: string | null;
  flavor_profile?: string[] | null;
  ingredients?: string[] | null;
  rating?: number | null; // 1..5
  popularity?: number | null; // 0..100
  is_signature?: 0 | 1 | boolean | null;
  panel_rank?: number | null; // 1..3 unique per muni
};
export type Restaurant = {
  id: number; name: string; slug: string;
  municipality_id: number;
  kind?: string | null; address?: string | null;
  cuisine_types?: string[] | null;
  rating?: number | null; lat?: number | null; lng?: number | null;
  image_url?: string | null; featured?: 0 | 1 | boolean | null; featured_rank?: number | null;
};

export const slugify = (s: string) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export function coerceStringArray(x: unknown): string[] | null {
  if (x == null) return null;
  if (Array.isArray(x)) return x.map(String);
  const s = String(x);
  if (!s.trim()) return [];
  return s.split(",").map((v) => v.trim()).filter(Boolean);
}

/* ---------------------------------- Auth ---------------------------------- */
// Use these in your AuthGate (or wherever you sign in/out).
export async function login(email: string, password: string) {
  const res: any = await http(`/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (res?.token) setAdminToken(res.token);
  return res;
}
export async function me() { return http(`/auth/me`); }
export function logout() { setAdminToken(null); }

/* --------------------------------- Public --------------------------------- */
export async function listMunicipalities(): Promise<Municipality[]> {
  const data = await http(`/api/municipalities`);
  return Array.isArray(data) ? data : [];
}


// Add these API functions
export async function listDishCategories(): Promise<any[]> {
  const res = await fetch('/api/dish-categories');
  if (!res.ok) throw new Error('Failed to fetch dish categories');
  return res.json();
}

export async function listDishes(filters?: { q?: string; municipality_id?: number; category?: string }): Promise<any[]> {
  const params = new URLSearchParams();
  if (filters?.q) params.append('q', filters.q);
  if (filters?.municipality_id) params.append('municipality_id', filters.municipality_id.toString());
  if (filters?.category) params.append('category', filters.category);
  
  const res = await fetch(`/api/dishes?${params}`);
  if (!res.ok) throw new Error('Failed to fetch dishes');
  return res.json();
}

export async function listRestaurants(filters?: { q?: string; municipality_id?: number; kind?: string }): Promise<any[]> {
  const params = new URLSearchParams();
  if (filters?.q) params.append('q', filters.q);
  if (filters?.municipality_id) params.append('municipality_id', filters.municipality_id.toString());
  if (filters?.kind) params.append('kind', filters.kind);
  
  const res = await fetch(`/api/restaurants?${params}`);
  if (!res.ok) throw new Error('Failed to fetch restaurants');
  return res.json();
}

export async function createDish(payload: any): Promise<any> {
  const res = await fetch('/api/dishes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create dish');
  return res.json();
}

export async function updateDish(id: number, payload: any): Promise<any> {
  const res = await fetch(`/api/dishes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update dish');
  return res.json();
}

export async function deleteDish(id: number): Promise<void> {
  const res = await fetch(`/api/dishes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete dish');
}

export async function createRestaurant(payload: any): Promise<any> {
  const res = await fetch('/api/restaurants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create restaurant');
  return res.json();
}

export async function updateRestaurant(id: number, payload: any): Promise<any> {
  const res = await fetch(`/api/restaurants/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update restaurant');
  return res.json();
}

export async function deleteRestaurant(id: number): Promise<void> {
  const res = await fetch(`/api/restaurants/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete restaurant');
}
/* ---------------------------------- Admin --------------------------------- */




/* ------------------------------ Analytics API ----------------------------- */
export async function getAnalyticsSummary(): Promise<{ dishes: number; restaurants: number; municipalities: number }> {
  const raw = await http(`/admin/analytics/summary`);
  const payload = raw ?? {};

  // server may return { counts: { ... }, ... } or top-level fields
  const countsSource: any = payload.counts ?? payload;

  const dishes = Number(countsSource.dishes ?? countsSource.dishCount ?? countsSource.dish_count ?? countsSource.dish ?? 0);
  const restaurants = Number(countsSource.restaurants ?? countsSource.restCount ?? countsSource.rest_count ?? countsSource.restaurant ?? 0);
  const municipalities = Number(countsSource.municipalities ?? countsSource.muniCount ?? countsSource.muni_count ?? countsSource.municipality ?? 0);

  return { dishes, restaurants, municipalities };
}

// ---------- replace getPerMunicipalityCounts ----------
export async function getPerMunicipalityCounts(): Promise<Array<{ municipality_id: number | null; municipality_name: string; dishes: number; restaurants: number }>> {
  // normalizer for different possible key names
  const normalize = (r: any) => ({
    municipality_id: r.municipality_id ?? r.muni_id ?? r.id ?? null,
    municipality_name: r.municipality_name ?? r.municipality ?? r.name ?? r.slug ?? "(unknown)",
    dishes: Number(r.dishes ?? r.dish_count ?? r.dishes_count ?? 0),
    restaurants: Number(r.restaurants ?? r.restaurant_count ?? r.rest_count ?? 0),
  });

  // Try canonical endpoint first
  try {
    const raw = await http(`/admin/analytics/per-municipality`);
    if (Array.isArray(raw)) return raw.map(normalize);
  } catch (e) {
    // ignore and try fallbacks below
  }

  // some servers return the per-municipality array inside the summary endpoint
  try {
    const summary = await http(`/admin/analytics/summary`);
    const arr = summary?.perMunicipality ?? summary?.per_municipality ?? summary?.perMunicipalityCounts ?? null;
    if (Array.isArray(arr)) return arr.map(normalize);
  } catch (e) {
    // ignore
  }

  // last resort: try alternate kebab/snake variants
  try {
    const rawAlt = await http(`/admin/analytics/municipality-counts`);
    if (Array.isArray(rawAlt)) return rawAlt.map(normalize);
  } catch (e) {}

  // nothing found — return empty array
  return [];
}

// ----------------------------- getting debugged ---------------------------- //
/* ----------------------------- Linking (M2M) ------------------------------ */


export async function listRestaurantsForDish(dishId: number): Promise<Restaurant[]> {
  if (!dishId) return [];

  const paths = [
    `/admin/dishes/${dishId}/restaurants`,         // canonical (returns full restaurant objects)
    `/admin/links${qs({ dishId })}`,               // sometimes present (may return objects or ids)
    `/admin/dish-restaurants${qs({ dish_id: dishId })}`, // may return { restaurant_id } objects
    `/admin/links/ids${qs({ dishId })}`,           // some variants return numeric id arrays
    `/api/restaurants${qs({ dishId })}`,           // public fallback
  ];

  let lastErr: any = null;
  for (const p of paths) {
    try {
      const res: any = await http(p);
      if (!res) continue;

      // 1) array of restaurant objects
      if (Array.isArray(res) && res.length && typeof res[0] === "object" && ("id" in res[0] || "name" in res[0])) {
        return res as Restaurant[];
      }

      // 2) array of numbers (ids) -> map to restaurant objects
      if (Array.isArray(res) && res.length && typeof res[0] === "number") {
        const ids = new Set(res as number[]);
        const all = await listRestaurants({});
        return all.filter(r => ids.has(r.id));
      }

      // 3) array of { restaurant_id } objects -> map to restaurant objects
      if (Array.isArray(res) && res.length && typeof res[0] === "object" && ("restaurant_id" in res[0])) {
        const ids = new Set((res as any[]).map(x => x.restaurant_id));
        const all = await listRestaurants({});
        return all.filter(r => ids.has(r.id));
      }

      // 4) shape { restaurants: [...] }
      if (res && Array.isArray((res as any).restaurants)) {
        return (res as any).restaurants as Restaurant[];
      }

      // 5) empty array
      if (Array.isArray(res) && res.length === 0) return [];
    } catch (e) {
      lastErr = e;
      // try next path
    }
  }

  // nothing found — return empty array (don't throw so UI can show empty state)
  return [];
}

export async function listDishesForRestaurant(restId: number): Promise<Dish[]> {
  if (!restId) return [];

  const paths = [
    `/admin/restaurants/${restId}/dishes`,        // canonical (returns full dish objects)
    `/admin/links${qs({ restaurantId: restId })}`,// alt (may return objects or ids)
    `/admin/dish-restaurants${qs({ restaurant_id: restId })}`, // alt shape
    `/api/dishes${qs({ restaurantId: restId })}`, // public fallback
  ];

  let lastErr: any = null;
  for (const p of paths) {
    try {
      const res: any = await http(p);
      if (!res) continue;

      // 1) array of dish objects
      if (Array.isArray(res) && res.length && typeof res[0] === "object" && ("id" in res[0] || "name" in res[0])) {
        return res as Dish[];
      }

      // 2) array of numbers (ids) -> map to dishes
      if (Array.isArray(res) && res.length && typeof res[0] === "number") {
        const ids = new Set(res as number[]);
        const all = await listDishes({});
        return all.filter(d => ids.has(d.id));
      }

      // 3) array of { dish_id } objects -> map to dishes
      if (Array.isArray(res) && res.length && typeof res[0] === "object" && ("dish_id" in res[0])) {
        const ids = new Set((res as any[]).map(x => x.dish_id));
        const all = await listDishes({});
        return all.filter(d => ids.has(d.id));
      }

      // 4) shape { dishes: [...] }
      if (res && Array.isArray((res as any).dishes)) {
        return (res as any).dishes as Dish[];
      }

      // 5) empty array
      if (Array.isArray(res) && res.length === 0) return [];
    } catch (e) {
      lastErr = e;
      // continue trying other endpoints
    }
  }

  // nothing found — return empty array
  return [];
}


export async function linkDishRestaurant({ dish_id, restaurant_id, dishId, restaurantId }: { dish_id?: number; restaurant_id?: number; dishId?: number; restaurantId?: number }) {
  const d = dishId ?? dish_id; const r = restaurantId ?? restaurant_id;
  if (d == null || r == null) throw new Error("dishId and restaurantId are required");
  try {
    return await http(`/admin/links`, { method: "POST", body: JSON.stringify({ dishId: d, restaurantId: r }) });
  } catch (_) {
    return await http(`/admin/dish-restaurants`, { method: "POST", body: JSON.stringify({ dish_id: d, restaurant_id: r }) });
  }
}

export async function unlinkDishRestaurant({ dish_id, restaurant_id, dishId, restaurantId }: { dish_id?: number; restaurant_id?: number; dishId?: number; restaurantId?: number }) {
  const d = dishId ?? dish_id; const r = restaurantId ?? restaurant_id;
  if (d == null || r == null) throw new Error("dishId and restaurantId are required");
  try {
    return await http(`/admin/links${qs({ dishId: d, restaurantId: r })}`, { method: "DELETE" });
  } catch (_) {
    try {
      return await http(`/admin/dish-restaurants/unlink`, { method: "POST", body: JSON.stringify({ dish_id: d, restaurant_id: r }) });
    } catch {
      return await http(`/admin/links/unlink`, { method: "POST", body: JSON.stringify({ dishId: d, restaurantId: r }) });
    }
  }
}

/* ------------------------------ Curation APIs ----------------------------- */
export async function setDishCuration(id: number, payload: { panel_rank: number | null; is_signature: 0 | 1 | boolean }) {
  try {
    return await http(`/admin/curation/dishes/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  } catch (_) {
    // Fallback to regular dish update endpoint
    return await http(`/admin/dishes/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
}



export async function setRestaurantCuration(id: number, payload: { featured_rank: number | null; featured: 0 | 1 | boolean }) {
  try {
    return await http(`/admin/curation/restaurants/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  } catch (_) {
    // Fallback to regular restaurant update endpoint
    return await http(`/admin/restaurants/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
}
