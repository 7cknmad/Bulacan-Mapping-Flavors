// src/utils/adminApi.ts
export const ADMIN = (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3002').replace(/\/+$/,'');

async function req<T=any>(method: string, path: string, body?: any): Promise<T> {
  const url = path.startsWith('http') ? path : `${ADMIN}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'omit', // no cookies yet
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text || ''}`.trim());
  try { return text ? JSON.parse(text) : (null as T); } catch { return null as T; }
}
const get = <T=any>(p:string)=>req<T>('GET',p);
const post=<T=any>(p:string,b?:any)=>req<T>('POST',p,b);
const patch=<T=any>(p:string,b?:any)=>req<T>('PATCH',p,b);
const del =<T=any>(p:string)=>req<T>('DELETE',p);

// --- Health (used to hide "writes disabled" banner) ---
export const adminHealth = () => get<{ ok:boolean; db?:string; error?:string }>(`/admin/health`);
export async function adminReady(): Promise<boolean> {
  try { const h = await adminHealth(); return !!h?.ok; } catch { return false; }
}

// --- Lookups ---
export type Municipality = { id:number; name:string; slug:string; };
export const listMunicipalities = () => get<Municipality[]>(`/admin/municipalities`);

// --- Dishes ---
export type Dish = {
  id:number; municipality_id:number;
  name:string; slug:string; description:string|null; image_url:string|null;
  rating:number|null; popularity:number|null;
  is_signature?: number|null; panel_rank?: number|null;
  flavor_profile?: string[]|null; ingredients?: string[]|null;
  category: 'food'|'delicacy'|'drink';
};
export const listDishes = (opts: {municipalityId?:number|null; q?:string; limit?:number} = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set('municipalityId', String(opts.municipalityId));
  if (opts.q) qs.set('q', String(opts.q));
  if (opts.limit) qs.set('limit', String(opts.limit));
  return get<Dish[]>(`/admin/dishes${qs.toString()?`?${qs.toString()}`:''}`);
};
export const createDish = (payload: Partial<Dish>&{category: Dish['category']}) => post(`/admin/dishes`, payload);
export const updateDish = (id:number, payload: Partial<Dish>&{category?: Dish['category']}) => patch(`/admin/dishes/${id}`, payload);
export const deleteDish = (id:number) => del(`/admin/dishes/${id}`);

// --- Restaurants ---
export type Restaurant = {
  id:number; municipality_id:number;
  name:string; slug:string; kind:string;
  description:string|null; address:string;
  phone:string|null; website:string|null; facebook:string|null; instagram:string|null;
  opening_hours:string|null; price_range:'budget'|'moderate'|'expensive'|null;
  cuisine_types?: string[]|null; rating:number|null; lat:number; lng:number;
  image_url?:string|null; featured?:number|null; featured_rank?:number|null;
};
export const listRestaurants = (opts:{municipalityId?:number|null; q?:string; limit?:number} = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set('municipalityId', String(opts.municipalityId));
  if (opts.q) qs.set('q', String(opts.q));
  if (opts.limit) qs.set('limit', String(opts.limit));
  return get<Restaurant[]>(`/admin/restaurants${qs.toString()?`?${qs.toString()}`:''}`);
};
export const createRestaurant = (payload: Partial<Restaurant>) => post(`/admin/restaurants`, payload);
export const updateRestaurant = (id:number, payload: Partial<Restaurant>) => patch(`/admin/restaurants/${id}`, payload);
export const deleteRestaurant = (id:number) => del(`/admin/restaurants/${id}`);

// --- Linking ---
export const restaurantsForDish = (dishId:number) => get<Restaurant[]>(`/admin/dishes/${dishId}/restaurants`);
export const dishesForRestaurant = (restId:number) => get<Dish[]>(`/admin/restaurants/${restId}/dishes`);
export const linkDishRestaurant = (dish_id:number, restaurant_id:number, price_note?:string|null, availability:'regular'|'seasonal'|'preorder'='regular') =>
  post(`/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });
export const unlinkDishRestaurant = (dish_id:number, restaurant_id:number) =>
  del(`/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// --- Curation ---
export const curateDish = (id:number, payload:{is_signature?:0|1, panel_rank?:number|null}) =>
  patch(`/admin/curate/dishes/${id}`, payload);
export const curateRestaurant = (id:number, payload:{featured?:0|1, featured_rank?:number|null}) =>
  patch(`/admin/curate/restaurants/${id}`, payload);

// --- Analytics ---
export const analyticsSummary = () => get<{
  counts:{dishes:number; restaurants:number; municipalities:number};
  perMunicipality:{dishes:{id:number;name:string;count:number}[]; restaurants:{id:number;name:string;count:number}[]};
  top:{dishes:any[]; restaurants:any[]};
}>(`/admin/analytics/summary`);
