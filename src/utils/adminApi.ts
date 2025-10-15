// src/utils/adminApi.ts
import { API as PUBLIC_API } from "./api";

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
  kind: 'restaurant'|'stall'|'store'|'dealer'|'market'|'home-based';
  description: string | null;
  image_url: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  opening_hours: string | null;
  price_range: "budget" | "moderate" | "expensive";
  cuisine_types: string[] | null;
  rating: number | null;
  lat: number | null;
  lng: number | null;
  signature?: 0|1;
  signature_rank?: number|null;
};

const API = PUBLIC_API;

/* ---------------- Token handling ---------------- */
const TOKKEY = "adminToken";
export const AdminAuth = {
  get token() { return localStorage.getItem(TOKKEY) || ""; },
  set token(t: string) { if (t) localStorage.setItem(TOKKEY, t); else localStorage.removeItem(TOKKEY); },
  async login(email: string, password: string) {
    const r = await fetch(`${API}/api/admin/auth/login`, {
      method: "POST", headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ email, password }),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`Login failed: ${text.slice(0,200)}`);
    const data = JSON.parse(text);
    AdminAuth.token = data.token;
    return data;
  },
  async me() {
    const r = await fetch(`${API}/api/admin/auth/me`, {
      headers: { Authorization: `Bearer ${AdminAuth.token}` }
    });
    if (r.status === 401) throw new Error("Unauthorized");
    return r.json();
  },
  async logout() {
    try {
      await fetch(`${API}/api/admin/auth/logout`, {
        method: "POST", headers: { Authorization: `Bearer ${AdminAuth.token}` }
      });
    } finally { AdminAuth.token = ""; }
  }
};

/* ---------------- Helpers ---------------- */
async function getJSON<T>(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${AdminAuth.token}` }});
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${text.slice(0,200)}`);
  return JSON.parse(text) as T;
}
async function sendJSON<T>(path: string, method: string, body?: any) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type":"application/json", Authorization: `Bearer ${AdminAuth.token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${text.slice(0,200)}`);
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}
function toArray(v: any): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

/* ---------------- Public: municipalities ---------------- */
async function municipalities() {
  return getJSON<Array<{id:number; name:string; slug:string}>>(`/api/municipalities`);
}

/* ---------------- Dishes ---------------- */
async function getDishes(opts: { municipalityId?: number; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.q) qs.set("q", opts.q);
  const data = await getJSON<any[]>(`/api/admin/dishes?${qs.toString()}`);
  return data.map(row => ({
    ...row,
    flavor_profile: toArray(row.flavor_profile),
    ingredients: toArray(row.ingredients),
  })) as Dish[];
}
async function createDish(payload: Partial<Dish>) {
  return sendJSON<{id:number}>(`/api/admin/dishes`, "POST", payload);
}
async function updateDish(id: number, payload: Partial<Dish>) {
  return sendJSON(`/api/admin/dishes/${id}`, "PUT", payload);
}
async function deleteDish(id: number) {
  return sendJSON(`/api/admin/dishes/${id}`, "DELETE");
}
async function setDishFeatured(id: number, featured: 0|1, rank: number|null) {
  return sendJSON(`/api/admin/dishes/${id}/featured`, "PUT", { featured, rank });
}

/* ---------------- Restaurants ---------------- */
async function getRestaurants(opts: { municipalityId?: number; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.q) qs.set("q", opts.q);
  const data = await getJSON<any[]>(`/api/admin/restaurants?${qs.toString()}`);
  return data.map(r => ({ ...r, cuisine_types: toArray(r.cuisine_types) })) as Restaurant[];
}
async function createRestaurant(payload: Partial<Restaurant>) {
  return sendJSON<{id:number}>(`/api/admin/restaurants`, "POST", payload);
}
async function updateRestaurant(id: number, payload: Partial<Restaurant>) {
  return sendJSON(`/api/admin/restaurants/${id}`, "PUT", payload);
}
async function deleteRestaurant(id: number) {
  return sendJSON(`/api/admin/restaurants/${id}`, "DELETE");
}
async function setRestaurantSignature(id: number, signature: 0|1, rank: number|null) {
  return sendJSON(`/api/admin/restaurants/${id}/signature`, "PUT", { signature, rank });
}

/* ---------------- Linking ---------------- */
async function linkDishRestaurant(dish_id: number, restaurant_id: number, price_note?: string|null, availability?: 'regular'|'seasonal'|'preorder') {
  return sendJSON(`/api/admin/dish-restaurants`, "POST", { dish_id, restaurant_id, price_note, availability });
}
async function unlinkDishRestaurant(dish_id: number, restaurant_id: number) {
  // DELETE with JSON body
  return sendJSON(`/api/admin/dish-restaurants`, "DELETE", { dish_id, restaurant_id });
}
async function getLinkedRestaurantIds(dish_id: number) {
  return getJSON<number[]>(`/api/admin/dishes/${dish_id}/restaurants`);
}

/* ---------------- Analytics ---------------- */
async function analyticsSummary(municipalityId?: number) {
  const qs = new URLSearchParams();
  if (municipalityId) qs.set("municipalityId", String(municipalityId));
  return getJSON<{ totals: { dishes:number; restaurants:number }, topRestaurants: any[] }>(
    `/api/admin/analytics/summary?${qs.toString()}`
  );
}

export const AdminAPI = {
  municipalities,
  // dishes
  getDishes, createDish, updateDish, deleteDish, setDishFeatured,
  // restaurants
  getRestaurants, createRestaurant, updateRestaurant, deleteRestaurant, setRestaurantSignature,
  // linking
  linkDishRestaurant, unlinkDishRestaurant, getLinkedRestaurantIds,
  // analytics
  analyticsSummary,
};
