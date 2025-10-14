// src/utils/adminApi.ts
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

export function apiGet<T>(path: string) {
  return fetch(`${API_BASE}${path}`, { credentials: 'include' }).then(handle<T>);
}
export function apiPost<T>(path: string, body: any) {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle<T>);
}
export function apiPatch<T>(path: string, body: any) {
  return fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle<T>);
}
export function apiDelete<T>(path: string) {
  return fetch(`${API_BASE}${path}`, { method: 'DELETE', credentials: 'include' }).then(handle<T>);
}

export const AdminAPI = {
  // auth
  login: (email: string, password: string) => apiPost('/api/admin/auth/login', { email, password }),
  me:    () => apiGet('/api/admin/auth/me'),
  logout: () => apiPost('/api/admin/auth/logout', {}),

  // lookups
  municipalities: () => apiGet<Array<{id:number; name:string; slug:string}>>('/api/municipalities'),

  // analytics (points to server aliases we added)
  summary: () => apiGet('/api/admin/analytics/summary'),
  topDishes: (municipalityId?: number, category?: string) => {
    const qs = new URLSearchParams();
    if (municipalityId) qs.set('municipalityId', String(municipalityId));
    if (category) qs.set('category', category);
    return apiGet(`/api/admin/analytics/top-dishes?${qs.toString()}`);
  },
  topRestaurants: (municipalityId?: number) => {
    const qs = new URLSearchParams();
    if (municipalityId) qs.set('municipalityId', String(municipalityId));
    return apiGet(`/api/admin/analytics/top-restaurants?${qs.toString()}`);
  },

  // dishes
  createDish: (body: any) => apiPost('/api/admin/dishes', body),
  updateDish: (id: number, body: any) => apiPatch(`/api/admin/dishes/${id}`, body),
  deleteDish: (id: number) => apiDelete(`/api/admin/dishes/${id}`),

  // restaurants
  createRestaurant: (body: any) => apiPost('/api/admin/restaurants', body),
  updateRestaurant: (id: number, body: any) => apiPatch(`/api/admin/restaurants/${id}`, body),
  deleteRestaurant: (id: number) => apiDelete(`/api/admin/restaurants/${id}`),

  // linking
  linkDishRestaurant: (dish_id: number, restaurant_id: number, price_note?: string, availability: 'regular'|'seasonal'|'preorder'='regular') =>
    apiPost('/api/admin/dish-restaurants', { dish_id, restaurant_id, price_note, availability }),
  unlinkDishRestaurant: (dish_id: number, restaurant_id: number) =>
    apiDelete(`/api/admin/dish-restaurants?dishId=${dish_id}&restaurantId=${restaurant_id}`),

  // search (for curation by name)
  searchDishes: (q: string) => apiGet(`/api/admin/search/dishes?q=${encodeURIComponent(q)}`),
  searchRestaurants: (q: string) => apiGet(`/api/admin/search/restaurants?q=${encodeURIComponent(q)}`),

  // public reads used inside admin
  dishesList: (qs: string) => apiGet(`/api/dishes${qs}`),
  restaurantsList: (qs: string) => apiGet(`/api/restaurants${qs}`),
};
