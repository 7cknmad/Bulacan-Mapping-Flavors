const env = (import.meta as any).env || {};
export const API = (
  env.VITE_ADMIN_API_URL ||  // prefer admin base in admin build
  env.VITE_API_URL || "http://localhost:3001"
).replace(/\/+$/, "");


/** Fetch a URL (absolute) and parse JSON with helpful error messages */
async function getJSONAbsolute<T>(url: string): Promise<T> {
  // Keep omit here — public endpoints don't need cookies
  const res = await fetch(url, { credentials: "omit" });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

/** Fetch a PATH (relative) and auto-prefix with API base */
async function getPath<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  return getJSONAbsolute<T>(url);
}
/* ================== Types ================== */
export type Municipality = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  province: string;
  lat: number;
  lng: number;
  image_url: string | null;
};

export type Dish = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  rating: number | null;
  popularity: number | null;
  flavor_profile: string[] | null;
  ingredients: string[] | null;
  municipality_id: number;
  municipality_name: string;
  category: "food" | "delicacy" | "drink";
};

export type Restaurant = {
  id: number;
  name: string;
  slug: string;
  kind: 'restaurant'|'stall'|'store'|'dealer'|'market'|'home-based';
  description: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  opening_hours: string | null;
  price_range: "budget" | "moderate" | "expensive";
  cuisine_types: string[] | null;
  rating: number;
  lat: number;
  lng: number;
  image_url: string | null;
  municipality_name?: string;
};

/* ================== Calls ================== */
export const fetchMunicipalities = () =>
  getPath<Municipality[]>("/api/municipalities");

export const fetchDishes = (opts: { municipalityId?: number; category?: string; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.category) qs.set("category", opts.category);
  if (opts.q) qs.set("q", opts.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return getPath<Dish[]>(`/api/dishes${suffix}`);
};

export const fetchRestaurants = (opts: { municipalityId?: number; dishId?: number; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.dishId) qs.set("dishId", String(opts.dishId));
  if (opts.q) qs.set("q", opts.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return getPath<Restaurant[]>(`/api/restaurants${suffix}`);
};

