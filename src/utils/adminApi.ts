export const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

async function req<T=any>(method: string, path: string, body?: any): Promise<T> {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include', // cookies for admin
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt}`);
  try { return txt ? JSON.parse(txt) : null as any; } catch { return null as any; }
}
const get = <T=any>(p: string) => req<T>('GET', p);
const post = <T=any>(p: string, b?: any) => req<T>('POST', p, b);
const patch = <T=any>(p: string, b?: any) => req<T>('PATCH', p, b);
const del = <T=any>(p: string) => req<T>('DELETE', p);

// ---- Types
export type Municipality = { id:number; name:string; slug:string; };
export type Dish = {
  id:number; municipality_id:number; name:string; slug:string;
  description:string|null; image_url:string|null; category:'food'|'delicacy'|'drink';
  flavor_profile?: string[]|null; ingredients?: string[]|null;
  popularity?: number|null; rating?: number|null;
  is_signature?: number|null; panel_rank?: number|null;
};
export type Restaurant = {
  id:number; municipality_id:number; name:string; slug:string; kind?:string;
  description?:string|null; address:string; phone?:string|null;
  website?:string|null; facebook?:string|null; instagram?:string|null;
  opening_hours?:string|null; price_range?:'budget'|'moderate'|'expensive';
  cuisine_types?: string[]|null; rating?: number|null; lat:number; lng:number;
  image_url?:string|null; featured?: number|null; featured_rank?: number|null;
};

// ---- Auth
export const adminAuth = {
  me: () => get<{id:number; email:string} | null>('/api/admin/auth/me'),
  login: (email: string, password: string) => post('/api/admin/auth/login', { email, password }),
  logout: () => post('/api/admin/auth/logout', {})
};

// ---- Lookups
export const listMunicipalities = () => get<Municipality[]>('/api/municipalities');

// ---- Dishes
export const listDishesAdmin = (params: { municipalityId?: number|null; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.municipalityId) qs.set('municipalityId', String(params.municipalityId));
  if (params.q) qs.set('q', params.q);
  return get<Dish[]>(`/api/admin/dishes${qs.toString() ? `?${qs}` : ''}`).then(arr =>
    arr.map(d => ({
      ...d,
      flavor_profile: Array.isArray(d.flavor_profile) ? d.flavor_profile : (d.flavor_profile ? tryJSON(d.flavor_profile) : null),
      ingredients: Array.isArray(d.ingredients) ? d.ingredients : (d.ingredients ? tryJSON(d.ingredients) : null)
    }))
  );
};
export const createDish = (payload: Partial<Dish>) => post<{id:number}>('/api/admin/dishes', payload);
export const updateDish = (id: number, payload: Partial<Dish>) => patch(`/api/admin/dishes/${id}`, payload);
export const deleteDish = (id: number) => del(`/api/admin/dishes/${id}`);

// ---- Restaurants
export const listRestaurantsAdmin = (params: { municipalityId?: number|null; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.municipalityId) qs.set('municipalityId', String(params.municipalityId));
  if (params.q) qs.set('q', params.q);
  return get<Restaurant[]>(`/api/admin/restaurants${qs.toString() ? `?${qs}` : ''}`).then(arr =>
    arr.map(r => ({
      ...r,
      cuisine_types: Array.isArray(r.cuisine_types) ? r.cuisine_types : (r.cuisine_types ? tryJSON(r.cuisine_types) : null)
    }))
  );
};
export const createRestaurant = (payload: Partial<Restaurant>) => post<{id:number}>('/api/admin/restaurants', payload);
export const updateRestaurant = (id: number, payload: Partial<Restaurant>) => patch(`/api/admin/restaurants/${id}`, payload);
export const deleteRestaurant = (id: number) => del(`/api/admin/restaurants/${id}`);

// ---- Linking
export const listRestaurantsForDish = (dishId:number) => get<Restaurant[]>(`/api/admin/dishes/${dishId}/restaurants`);
export const listDishesForRestaurant = (restId:number) => get<Dish[]>(`/api/admin/restaurants/${restId}/dishes`);
export const linkDishRestaurant = (dish_id:number, restaurant_id:number, price_note?:string|null, availability:'regular'|'seasonal'|'preorder'='regular') =>
  post('/api/admin/dish-restaurants', { dish_id, restaurant_id, price_note: price_note ?? null, availability });
export const unlinkDishRestaurant = (dish_id:number, restaurant_id:number) =>
  del(`/api/admin/dish-restaurants?dish_id=${dish_id}&restaurant_id=${restaurant_id}`);

// ---- Curation
export const curateDish = (id:number, payload:{is_signature?:0|1; panel_rank?:number|null}) =>
  patch(`/api/admin/dishes/${id}/curation`, payload);
export const curateRestaurant = (id:number, payload:{featured?:0|1; featured_rank?:number|null}) =>
  patch(`/api/admin/restaurants/${id}/curation`, payload);

// ---- Analytics
export const getAnalyticsSummary = () => get(`/api/admin/analytics/summary`);

// helpers
function tryJSON(x:any){ try { return JSON.parse(x); } catch { return null; } }
