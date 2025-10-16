// src/utils/adminApi.ts
export const ADMIN_API =
  (import.meta.env.VITE_ADMIN_API_URL ?? "http://localhost:3002").replace(/\/+$/, "");

// generic fetch (no auth)
async function req<T = any>(method: string, path: string, body?: any): Promise<T> {
  const url = path.startsWith("http") ? path : `${ADMIN_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "omit",
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt || ""}`);
  try { return txt ? JSON.parse(txt) : null; } catch { return null as any; }
}
const get = <T=any>(p:string)=>req<T>("GET",p);
const post=<T=any>(p:string,b?:any)=>req<T>("POST",p,b);
const patch=<T=any>(p:string,b?:any)=>req<T>("PATCH",p,b);
const del =<T=any>(p:string)=>req<T>("DELETE",p);

export type Municipality = { id:number; name:string; slug:string };
export type Dish = {
  id:number; municipality_id:number|null;
  name:string; slug:string; description:string|null;
  category:"food"|"delicacy"|"drink";
  flavor_profile?: any; ingredients?: any;
  popularity?: number|null; rating?: number|null;
  is_signature?: 0|1|null; panel_rank?: number|null;
  image_url?: string|null;
};
export type Restaurant = {
  id:number; municipality_id:number|null;
  name:string; slug:string; address:string;
  lat:number; lng:number;
  kind?: "restaurant"|"stall"|"store"|"dealer"|"market"|"home-based";
  description?:string|null; phone?:string|null;
  website?:string|null; facebook?:string|null; instagram?:string|null;
  opening_hours?:string|null; price_range?:"budget"|"moderate"|"expensive";
  cuisine_types?: any; rating?:number|null;
  image_url?:string|null; featured?:0|1|null; featured_rank?:number|null;
};

// READS
export const listMunicipalities = () => get<Municipality[]>(`/api/municipalities`);
export const listDishes = (opts: { municipalityId?:number; q?:string; category?:string; signature?:0|1; limit?:number } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.q) qs.set("q", opts.q);
  if (opts.category) qs.set("category", String(opts.category));
  if (opts.signature!=null) qs.set("signature", String(opts.signature));
  if (opts.limit) qs.set("limit", String(opts.limit));
  return get<Dish[]>(`/api/dishes${qs.toString() ? `?${qs}` : ""}`);
};
export const listRestaurants = (opts: { municipalityId?:number; q?:string; dishId?:number; featured?:0|1; limit?:number } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.q) qs.set("q", opts.q);
  if (opts.dishId) qs.set("dishId", String(opts.dishId));
  if (opts.featured!=null) qs.set("featured", String(opts.featured));
  if (opts.limit) qs.set("limit", String(opts.limit));
  return get<Restaurant[]>(`/api/restaurants${qs.toString() ? `?${qs}` : ""}`);
};

// CRUD
export const createDish = (payload: Partial<Dish>) => post<Dish>(`/admin/dishes`, payload);
export const updateDish = (id:number, payload: Partial<Dish>) => patch<Dish>(`/admin/dishes/${id}`, payload);
export const deleteDish = (id:number) => del<{ok:true}>(`/admin/dishes/${id}`);

export const createRestaurant = (payload: Partial<Restaurant>) => post<Restaurant>(`/admin/restaurants`, payload);
export const updateRestaurant = (id:number, payload: Partial<Restaurant>) => patch<Restaurant>(`/admin/restaurants/${id}`, payload);
export const deleteRestaurant = (id:number) => del<{ok:true}>(`/admin/restaurants/${id}`);

// Linking
export const linkedRestaurantsForDish = (dishId:number) => get<Restaurant[]>(`/admin/dishes/${dishId}/restaurants`);
export const linkedDishesForRestaurant = (restId:number) => get<Dish[]>(`/admin/restaurants/${restId}/dishes`);
export const linkDishRestaurant   = (dish_id:number, restaurant_id:number, price_note?:string|null, availability:'regular'|'seasonal'|'preorder'='regular') =>
  post<{ok:true}>(`/admin/dish-restaurants`, { dish_id, restaurant_id, price_note: price_note ?? null, availability });
export const unlinkDishRestaurant = (dish_id:number, restaurant_id:number) =>
  del<{ok:true}>(`/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// Curation
export const setDishCuration = (id:number, payload: { is_signature:0|1|null; panel_rank:number|null }) =>
  patch<Dish>(`/admin/dishes/${id}/curation`, payload);

export const setRestaurantCuration = (id:number, payload: { featured:0|1|null; featured_rank:number|null }) =>
  patch<Restaurant>(`/admin/restaurants/${id}/curation`, payload);

// Analytics
export const getAnalyticsSummary = () => get<{
  counts: { dishes:number; restaurants:number };
  perMunicipality: Array<{ slug:string; dishes:number; restaurants:number }>;
  topDishes: Array<{ id:number; name:string; panel_rank:number|null }>;
  topRestaurants: Array<{ id:number; name:string; featured_rank:number|null }>;
}>(`/admin/analytics/summary`);
