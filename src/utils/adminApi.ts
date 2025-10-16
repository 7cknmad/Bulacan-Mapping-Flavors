// src/utils/adminApi.ts
export type Municipality = { id: number; name: string; slug: string; };

export type Dish = {
  id: number;
  municipality_id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  rating: number | null;
  popularity: number | null;
  flavor_profile: string[] | string | null;
  ingredients: string[] | string | null;
  category: "food" | "delicacy" | "drink";
  is_signature?: 0 | 1 | null;
  panel_rank?: number | null;
};

export type Restaurant = {
  id: number;
  municipality_id: number | null;
  name: string;
  slug: string;
  kind?: 'restaurant'|'stall'|'store'|'dealer'|'market'|'home-based'|null;
  description: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  opening_hours: string | null;
  price_range: "budget"|"moderate"|"expensive"|null;
  cuisine_types: string[] | string | null;
  rating: number | null;
  lat: number | null;
  lng: number | null;
  image_url?: string | null;
  featured?: 0 | 1 | null;
  featured_rank?: number | null;
};

const BASE = (import.meta.env.VITE_ADMIN_API_URL ?? 'http://localhost:3002').replace(/\/+$/, '');

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'omit' });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}
async function sendJSON<T>(path: string, method: 'POST'|'PATCH'|'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'omit'
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    throw new Error(`${res.status} ${path}: ${text}`);
  }
  return res.json().catch(() => ({} as T));
}

/* ---------- utilities ---------- */
export function coerceStringArray(v: unknown): string[] | null {
  if (v == null || v === '') return null;
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); if (Array.isArray(j)) return j.map(x => String(x).trim()).filter(Boolean); } catch {}
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  return null;
}
export function slugify(s: string): string {
  return String(s || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '').slice(0, 100);
}

/* -------- lookups ---------- */
export const listMunicipalities = () => getJSON<Municipality[]>('/admin/municipalities');

/* -------- analytics ---------- */
export type PerMuniRow = { municipality_id: number; municipality_name: string; dishes: number; restaurants: number; };
export type Summary = {
  counts: { dishes: number; restaurants: number; municipalities: number; };
  perMunicipality: PerMuniRow[];
  top: { dishes: any[]; restaurants: any[]; };
};

export async function getAnalyticsSummary(): Promise<Summary> {
  return getJSON<Summary>('/admin/analytics/summary');
}

export async function getPerMunicipalityCounts(): Promise<PerMuniRow[]> {
  const paths = [
    '/admin/analytics/municipality-counts',
    '/admin/analytics/per-municipality',
    '/admin/analytics/per_municipality',
  ];
  for (const p of paths) {
    try {
      const data = await getJSON<any>(p);
      if (Array.isArray(data)) return data as PerMuniRow[];
    } catch {}
  }
  // Fallback: derive from summary
  try {
    const s = await getAnalyticsSummary();
    if (Array.isArray(s?.perMunicipality)) return s.perMunicipality;
  } catch {}
  return [];
}

/* -------- dishes CRUD ---------- */
export function listDishes(opts: { q?: string; municipalityId?: number; category?: string } = {}) {
  const qs = new URLSearchParams();
  if (opts.q) qs.set('q', opts.q);
  if (opts.municipalityId) qs.set('municipalityId', String(opts.municipalityId));
  if (opts.category) qs.set('category', opts.category);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return getJSON<Dish[]>(`/admin/dishes${suffix}`);
}
export const createDish = (payload: Partial<Dish>) => sendJSON<any>('/admin/dishes', 'POST', payload);
export const updateDish = (id: number, payload: Partial<Dish>) => sendJSON<any>(`/admin/dishes/${id}`, 'PATCH', payload);
export const deleteDish = (id: number) => sendJSON<any>(`/admin/dishes/${id}`, 'DELETE');

/* ------ restaurants CRUD ------- */
export function listRestaurants(opts: { q?: string; municipalityId?: number } = {}) {
  const qs = new URLSearchParams();
  if (opts.q) qs.set('q', opts.q);
  if (opts.municipalityId) qs.set('municipalityId', String(opts.municipalityId));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return getJSON<Restaurant[]>(`/admin/restaurants${suffix}`);
}
export const createRestaurant = (payload: Partial<Restaurant>) => sendJSON<any>('/admin/restaurants', 'POST', payload);
export const updateRestaurant = (id: number, payload: Partial<Restaurant>) => sendJSON<any>(`/admin/restaurants/${id}`, 'PATCH', payload);
export const deleteRestaurant = (id: number) => sendJSON<any>(`/admin/restaurants/${id}`, 'DELETE');

/* ---------- linking ----------- */
export const listRestaurantsForDish = (dishId: number) => getJSON<Restaurant[]>(`/admin/dishes/${dishId}/restaurants`);
export const linkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  sendJSON<any>('/admin/dish-restaurants', 'POST', { dish_id, restaurant_id });
export const unlinkDishRestaurant = (dish_id: number, restaurant_id: number) =>
  sendJSON<any>(`/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`, 'DELETE');

/* ---------- curation ---------- */
export const setDishCuration = (id: number, payload: { panel_rank?: number|null; is_signature?: 0|1|null }) =>
  sendJSON<any>(`/admin/curate/dishes/${id}`, 'PATCH', payload);
export const setRestaurantCuration = (id: number, payload: { featured_rank?: number|null; featured?: 0|1|null }) =>
  sendJSON<any>(`/admin/curate/restaurants/${id}`, 'PATCH', payload);
