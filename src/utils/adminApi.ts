// src/utils/adminApi.ts — header-based auth (no cookies), single tunnel ready

const BASE = (import.meta as any).env?.VITE_ADMIN_API_URL?.replace(/\/$/, "") || "";

// ---- token store (localStorage) ----
const TOK_KEY = "bmf_admin_token";
export function setAdminToken(token: string | null) {
  if (token) localStorage.setItem(TOK_KEY, token);
  else localStorage.removeItem(TOK_KEY);
}
export function getAdminToken(): string | null {
  try { return localStorage.getItem(TOK_KEY); } catch { return null; }
}
export function isLoggedIn() { return !!getAdminToken(); }

// ---- low-level HTTP ----
async function http(path: string, init: RequestInit = {}) {
  const token = getAdminToken();
  const res = await fetch(`${BASE}${path}`, {
    credentials: "omit", // NO cookies
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
    ...init,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 400) || "Request failed"}`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return JSON.parse(text);
  return text;
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
  rating?: number | null;       // 1..5
  popularity?: number | null;   // 0..100
  is_signature?: 0 | 1 | boolean | null;
  panel_rank?: number | null;   // 1..3 unique per muni
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

/* ------------------------------- Auth API -------------------------------- */
export async function login(email: string, password: string) {
  const res: any = await http(`/auth/login`, { method: "POST", body: JSON.stringify({ email, password }) });
  if (res?.token) setAdminToken(res.token);
  return res;
}
export function logout() { setAdminToken(null); }
export async function me() {
  return http(`/auth/me`);
}

/* --------------------------------- Public -------------------------------- */
export async function listMunicipalities(): Promise<Municipality[]> {
  const data = await http(`/api/municipalities`);
  return Array.isArray(data) ? data : [];
}
export async function listDishes(params: { q?: string; municipalityId?: number; category?: string; signature?: 0 | 1; limit?: number } = {}): Promise<Dish[]> {
  const data = await http(`/api/dishes${qs(params)}`); return Array.isArray(data) ? data : [];
}
export async function listRestaurants(params: { q?: string; municipalityId?: number; dishId?: number; featured?: 0 | 1; limit?: number } = {}): Promise<Restaurant[]> {
  const data = await http(`/api/restaurants${qs(params)}`); return Array.isArray(data) ? data : [];
}

/* ---------------------------------- Admin -------------------------------- */
export async function createDish(payload: Partial<Dish>): Promise<Dish> {
  return http(`/admin/dishes`, { method: "POST", body: JSON.stringify(payload) });
}
export async function updateDish(id: number, payload: Partial<Dish>): Promise<Dish> {
  return http(`/admin/dishes/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}
export async function deleteDish(id: number): Promise<{ ok: true }> {
  return http(`/admin/dishes/${id}`, { method: "DELETE" });
}

export async function createRestaurant(payload: Partial<Restaurant>): Promise<Restaurant> {
  return http(`/admin/restaurants`, { method: "POST", body: JSON.stringify(payload) });
}
export async function updateRestaurant(id: number, payload: Partial<Restaurant>): Promise<Restaurant> {
  return http(`/admin/restaurants/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}
export async function deleteRestaurant(id: number): Promise<{ ok: true }> {
  return http(`/admin/restaurants/${id}`, { method: "DELETE" });
}

/* ------------------------------ Analytics API ----------------------------- */
export async function getAnalyticsSummary(): Promise<{ dishes: number; restaurants: number; municipalities: number }> {
  const d: any = await http(`/admin/analytics/summary`);
  return {
    dishes: d?.dishes ?? d?.dish_count ?? d?.dishTotal ?? 0,
    restaurants: d?.restaurants ?? d?.restaurant_count ?? d?.restaurantTotal ?? 0,
    municipalities: d?.municipalities ?? d?.municipality_count ?? d?.muniTotal ?? 0,
  };
}
export async function getPerMunicipalityCounts(): Promise<Array<{ municipality_id: number | null; municipality_name: string; dishes: number; restaurants: number }>> {
  const arr: any[] = await http(`/admin/analytics/per-municipality`);
  return (Array.isArray(arr) ? arr : []).map((r) => ({
    municipality_id: r.municipality_id ?? r.muni_id ?? r.id ?? null,
    municipality_name: r.municipality_name ?? r.municipality ?? r.name ?? r.slug ?? "(unknown)",
    dishes: r.dishes ?? r.dish_count ?? r.dishTotal ?? 0,
    restaurants: r.restaurants ?? r.restaurant_count ?? r.restTotal ?? 0,
  }));
}

/* ----------------------------- Linking (M2M) ------------------------------ */
export async function listRestaurantsForDish(dishId: number): Promise<Restaurant[]> {
  try {
    const a = await http(`/admin/links${qs({ dishId })}`);
    if (Array.isArray(a)) {
      if (a.length === 0) return [];
      const sample = a[0];
      if (typeof sample === "number") {
        const ids = new Set(a as number[]); const all = await listRestaurants({}); return all.filter(r => ids.has(r.id));
      }
      if (sample && typeof sample === "object" && "restaurant_id" in sample && !("name" in sample)) {
        const ids = new Set((a as any[]).map((x) => x.restaurant_id)); const all = await listRestaurants({}); return all.filter((r) => ids.has(r.id));
      }
      return a as Restaurant[];
    }
  } catch {}
  try { return await listRestaurants({ dishId }); } catch { return []; }
}
export async function linkDishRestaurant({ dish_id, restaurant_id, dishId, restaurantId }: { dish_id?: number; restaurant_id?: number; dishId?: number; restaurantId?: number }) {
  const d = dishId ?? dish_id, r = restaurantId ?? restaurant_id; if (d == null || r == null) throw new Error("dishId and restaurantId are required");
  try { return await http(`/admin/links`, { method: "POST", body: JSON.stringify({ dishId: d, restaurantId: r }) }); }
  catch { return await http(`/admin/dish-restaurants`, { method: "POST", body: JSON.stringify({ dish_id: d, restaurant_id: r }) }); }
}
export async function unlinkDishRestaurant({ dish_id, restaurant_id, dishId, restaurantId }: { dish_id?: number; restaurant_id?: number; dishId?: number; restaurantId?: number }) {
  const d = dishId ?? dish_id, r = restaurantId ?? restaurant_id; if (d == null || r == null) throw new Error("dishId and restaurantId are required");
  try { return await http(`/admin/links${qs({ dishId: d, restaurantId: r })}`, { method: "DELETE" }); }
  catch {
    try { return await http(`/admin/dish-restaurants/unlink`, { method: "POST", body: JSON.stringify({ dish_id: d, restaurant_id: r }) }); }
    catch { return await http(`/admin/links/unlink`, { method: "POST", body: JSON.stringify({ dishId: d, restaurantId: r }) }); }
  }
}

/* ------------------------------ Curation APIs ----------------------------- */
export async function setDishCuration(id: number, payload: { panel_rank: number | null; is_signature: 0 | 1 | boolean }) {
  try { return await http(`/admin/curation/dishes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
  catch {
    try { return await http(`/admin/curation`, { method: "POST", body: JSON.stringify({ kind: "dish", id, ...payload }) }); }
    catch { return await http(`/admin/dishes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
  }
}
export async function setRestaurantCuration(id: number, payload: { featured_rank: number | null; featured: 0 | 1 | boolean }) {
  try { return await http(`/admin/curation/restaurants/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
  catch {
    try { return await http(`/admin/curation`, { method: "POST", body: JSON.stringify({ kind: "restaurant", id, ...payload }) }); }
    catch { return await http(`/admin/restaurants/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
  }
}
