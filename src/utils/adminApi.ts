
const BASE = ((import.meta as any).env?.VITE_ADMIN_API_URL || (import.meta as any).env?.VITE_API_URL || "http://localhost:3002")?.replace(/\/$/, "");

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
  // Debug logging for development
  if (import.meta.env.DEV) {
    console.log('🔄 API Call:', { path, method: init.method || 'GET', base: BASE });
  }

  const token = getAdminToken();
  const url = `${BASE}${path}`;
  
  try {
    const res = await fetch(url, {
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
      ...init,
    });

    // Enhanced error handling
    if (!res.ok) {
      let errorMessage = `${res.status} ${res.statusText}`;
      
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // If not JSON, try text
        const text = await res.text().catch(() => "");
        if (text) errorMessage = `${errorMessage}: ${text.slice(0, 200)}`;
      }
      
      throw new Error(errorMessage);
    }

    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await res.json();
    }
    
    return await res.text();
  } catch (error: any) {
    // Network errors or CORS issues
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error(`Network error: Cannot connect to server. Check if ${BASE} is accessible.`);
    }
    throw error;
  }
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
export type DishWithRestaurants = Dish & {
  restaurants: Restaurant[];
  restaurant_count: number;
  municipality_name: string;
};

export type RestaurantWithDishes = Restaurant & {
  dishes: Dish[];
  dish_count: number;
  municipality_name: string;
};

export type RestaurantDishLink = {
  dish_id: number;
  restaurant_id: number;
  dish_name: string;
  restaurant_name: string;
  municipality_name: string;
  is_featured: boolean;
  featured_rank: number;
  restaurant_specific_description?: string;
  restaurant_specific_price?: number;
  availability: string;
  created_at: string;
  updated_at: string;
};

export type UnlinkingData = {
  dishes: Dish[];
  restaurants: Restaurant[];
  recentLinks: RestaurantDishLink[];
  summary: {
    totalDishes: number;
    totalRestaurants: number;
    totalLinks: number;
  };
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
  const res: any = await http(`/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  
  // For admin users, make sure we're using the admin token
  if (res?.token && (res.user?.role === 'admin' || res.user?.role === 'owner')) {
    setAdminToken(res.token);
    // Also set the regular auth token to keep sessions in sync
    localStorage.setItem("auth_token", res.token);
    localStorage.setItem("auth_user", JSON.stringify(res.user));
  } else if (res?.token) {
    // Regular user - don't set admin token
    console.warn('Logged in as regular user, not admin');
  }
  
  return res;
}
export async function me() { return http(`/admin/auth/me`); }
export function logout() { setAdminToken(null); }

export async function listDishCategories(): Promise<any[]> {
  return http(`/api/dish-categories`);
}

/* --------------------------------- Public --------------------------------- */
export async function listMunicipalities(): Promise<Municipality[]> {
  const data = await http(`/api/municipalities`);
  return Array.isArray(data) ? data : [];
}

/* ---------------------------------- Admin --------------------------------- */

/* --------------------------- CRUD Operations --------------------------- */

export async function listDishes(filters?: { q?: string; municipality_id?: number; category_id?: number }): Promise<any[]> {
  if (import.meta.env.DEV) {
    console.log('🔄 Fetching dishes with filters:', filters);
  }
  return http(`/admin/dishes${qs(filters || {})}`);
}

export async function listRestaurants(filters?: { q?: string; municipality_id?: number; kind?: string }): Promise<any[]> {
  return http(`/admin/restaurants${qs(filters || {})}`);
}

export async function createDish(payload: any): Promise<any> {
  return http(`/admin/dishes`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateDish(id: number, payload: any): Promise<any> {
  return http(`/admin/dishes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deleteDish(id: number): Promise<void> {
  await http(`/admin/dishes/${id}`, { method: 'DELETE' });
}

export async function createRestaurant(payload: any): Promise<any> {
  return http(`/admin/restaurants`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateRestaurant(id: number, payload: any): Promise<any> {
  return http(`/admin/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteRestaurant(id: number): Promise<void> {
  await http(`/admin/restaurants/${id}`, { method: 'DELETE' });
}


/* ------------------------------ Analytics API ----------------------------- */
export async function getAnalyticsSummary(): Promise<{ dishes: number; restaurants: number; municipalities: number }> {
  let raw;
  
  // Try admin endpoint first
  try {
    raw = await http(`/admin/analytics/summary`);
  } catch (e) {
    console.log('Admin analytics failed, trying public endpoint');
    try {
      // Try public endpoint as fallback
      raw = await http(`/api/analytics/summary`);
    } catch (e2) {
      console.log('Public analytics failed, trying stats endpoint');
      try {
        // Try stats endpoint as last resort
        raw = await http(`/api/stats`);
      } catch (e3) {
        console.error('All analytics endpoints failed');
        raw = null;
      }
    }
  }

  console.log('Raw analytics data:', raw);
  
  const payload = raw ?? {};
  console.log('Payload:', payload);

  // server may return { counts: { ... }, ... } or top-level fields
  const countsSource: any = payload.counts ?? payload.data ?? payload;
  console.log('Counts source:', countsSource);

  // Try to get counts from various possible response shapes
  const dishes = Number(
    countsSource.dishes ?? 
    countsSource.dishCount ?? 
    countsSource.dish_count ?? 
    countsSource.dish ??
    countsSource.totalDishes ?? 
    payload.dishCount ??
    0
  );

  const restaurants = Number(
    countsSource.restaurants ?? 
    countsSource.restCount ?? 
    countsSource.rest_count ?? 
    countsSource.restaurant ??
    countsSource.totalRestaurants ?? 
    payload.restCount ??
    0
  );

  const municipalities = Number(
    countsSource.municipalities ?? 
    countsSource.muniCount ?? 
    countsSource.muni_count ?? 
    countsSource.municipality ??
    countsSource.totalMunicipalities ?? 
    21 // Bulacan has 21 municipalities
  );

  console.log('Parsed values:', { dishes, restaurants, municipalities });

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
    `/api/restaurant-dish-links/dish/${dishId}`,   // NEW: more reliable endpoint
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
    `/api/restaurant-dish-links/restaurant/${restId}`, // NEW: more reliable endpoint
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


/* --------------------------- Health Check --------------------------- */
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  try {
    const result = await http(`/health`);
    return { status: 'connected', timestamp: new Date().toISOString() };
  } catch (error: any) {
    // Try alternative health endpoints
    try {
      await http(`/api/health`);
      return { status: 'connected', timestamp: new Date().toISOString() };
    } catch {
      try {
        await http(`/`);
        return { status: 'connected', timestamp: new Date().toISOString() };
      } catch {
        throw new Error(`Cannot connect to backend at ${BASE}. Please check if the server is running.`);
      }
    }
  }
}

/* ------------------- Restaurant-Specific Dish Features ------------------- */
export async function getRestaurantFeaturedDishes(restaurantId: number): Promise<any[]> {
  return http(`/api/restaurants/${restaurantId}/featured-dishes`);
}

export async function setRestaurantDishFeatured(
  restaurantId: number, 
  dishId: number, 
  payload: { 
    is_featured: boolean; 
    featured_rank?: number; 
    restaurant_specific_description?: string; 
    restaurant_specific_price?: number;
    availability?: string;
  }
): Promise<any> {
  return http(`/admin/restaurants/${restaurantId}/dishes/${dishId}/feature`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function getRestaurantDishDetails(restaurantId: number, dishId: number): Promise<any> {
  return http(`/api/restaurants/${restaurantId}/dishes/${dishId}`);
}

export async function addDishToRestaurant(
  restaurantId: number,
  dishId: number,
  payload: {
    price_note?: string;
    availability?: string;
    is_featured?: boolean;
    featured_rank?: number;
    restaurant_specific_description?: string;
    restaurant_specific_price?: number;
  }
): Promise<any> {
  return http(`/admin/restaurants/${restaurantId}/dishes`, {
    method: 'POST',
    body: JSON.stringify({ dish_id: dishId, ...payload })
  });
}

export async function getDishesWithRestaurants(filters?: { municipalityId?: number; limit?: number }): Promise<DishWithRestaurants[]> {
  return http(`/admin/dishes-with-restaurants${qs(filters || {})}`);
}

// Get restaurants with their linked dishes for unlinking interface  
export async function getRestaurantsWithDishes(filters?: { municipalityId?: number; limit?: number }): Promise<RestaurantWithDishes[]> {
  return http(`/admin/restaurants-with-dishes${qs(filters || {})}`);
}

// Get comprehensive data for unlinking interface
export async function getUnlinkingData(filters?: { municipalityId?: number }): Promise<UnlinkingData> {
  return http(`/admin/unlinking-data${qs(filters || {})}`);
}

// Unlink a dish from one or more restaurants
export async function unlinkDishFromRestaurants(dishId: number, restaurantIds: number[]): Promise<any> {
  return http(`/admin/unlink-dish`, {
    method: 'POST',
    body: JSON.stringify({ dishId, restaurantIds })
  });
}

// Unlink a restaurant from one or more dishes
export async function unlinkRestaurantFromDishes(restaurantId: number, dishIds: number[]): Promise<any> {
  return http(`/admin/unlink-restaurant`, {
    method: 'POST', 
    body: JSON.stringify({ restaurantId, dishIds })
  });
}

// Remove all links for a dish
export async function removeAllDishLinks(dishId: number): Promise<any> {
  return http(`/admin/remove-all-dish-links/${dishId}`, {
    method: 'DELETE'
  });
}

// Remove all links for a restaurant
export async function removeAllRestaurantLinks(restaurantId: number): Promise<any> {
  return http(`/admin/remove-all-restaurant-links/${restaurantId}`, {
    method: 'DELETE'
  });
}

// Test unlinking data
export async function testUnlinkingData(): Promise<any> {
  return http(`/admin/test-unlinking`);
}

/* -------------------- Restaurant-Dish Linking Analytics ------------------- */
// Get all restaurant-dish links with filtering
export async function getRestaurantDishLinks(params?: {
  dishId?: number;
  restaurantId?: number;
  municipalityId?: number;
  limit?: number;
}): Promise<any[]> {
  return http(`/api/restaurant-dish-links${qs(params || {})}`);
}

// Get all restaurants for a specific dish
export async function getRestaurantsForDish(dishId: number): Promise<any[]> {
  return http(`/api/restaurant-dish-links/dish/${dishId}`);
}

// Get all dishes for a specific restaurant
export async function getDishesForRestaurant(restaurantId: number): Promise<any[]> {
  return http(`/api/restaurant-dish-links/restaurant/${restaurantId}`);
}

// Get links for a specific municipality
export async function getMunicipalityLinks(municipalityId: number): Promise<any[]> {
  return http(`/api/restaurant-dish-links/municipality/${municipalityId}`);
}

// Bulk link dishes to restaurants
export async function bulkLinkDishesToRestaurants(dishIds: number[], restaurantIds: number[]): Promise<any> {
  return http(`/api/restaurant-dish-links/bulk-link`, {
    method: 'POST',
    body: JSON.stringify({ dish_ids: dishIds, restaurant_ids: restaurantIds })
  });
}

// Bulk unlink dishes from restaurants
export async function bulkUnlinkDishesFromRestaurants(dishIds: number[], restaurantIds: number[]): Promise<any> {
  return http(`/api/restaurant-dish-links/bulk-unlink`, {
    method: 'POST',
    body: JSON.stringify({ dish_ids: dishIds, restaurant_ids: restaurantIds })
  });
}

// Get link statistics
export async function getLinkStats(): Promise<any> {
  let stats;
  
  // Try each endpoint in sequence until we get data
  const endpoints = [
    '/api/restaurant-dish-links/stats',
    '/admin/restaurant-dish-links/stats',
    '/api/stats/reviews',
    '/api/stats'
  ];

  for (const endpoint of endpoints) {
    try {
      stats = await http(endpoint);
      if (stats) break;
    } catch (e) {
      console.log(`Failed to fetch stats from ${endpoint}:`, e);
    }
  }

  console.log('Link stats:', stats);

  // Normalize the response to ensure we always return the expected shape
  if (!stats) return { totalReviews: 0 };

  return {
    totalReviews: Number(
      stats.totalReviews ?? 
      stats.total_reviews ?? 
      stats.reviews ?? 
      stats.review_count ?? 
      stats.reviewCount ?? 
      0
    )
  };
}

/* -------------------- Admin versions of linking endpoints ------------------- */
// Admin version of restaurant-dish links
export async function getAdminRestaurantDishLinks(params?: {
  dishId?: number;
  restaurantId?: number;
  municipalityId?: number;
  limit?: number;
}): Promise<any[]> {
  return http(`/admin/restaurant-dish-links${qs(params || {})}`);
}

// Admin version of bulk operations
export async function adminBulkLinkDishesToRestaurants(dishIds: number[], restaurantIds: number[]): Promise<any> {
  return http(`/admin/restaurant-dish-links/bulk-link`, {
    method: 'POST',
    body: JSON.stringify({ dish_ids: dishIds, restaurant_ids: restaurantIds })
  });
}

export async function adminBulkUnlinkDishesFromRestaurants(dishIds: number[], restaurantIds: number[]): Promise<any> {
  return http(`/admin/restaurant-dish-links/bulk-unlink`, {
    method: 'POST',
    body: JSON.stringify({ dish_ids: dishIds, restaurant_ids: restaurantIds })
  });
}

// Admin version of link stats
export async function getAdminLinkStats(): Promise<any> {
  return http(`/admin/restaurant-dish-links/stats`);
}