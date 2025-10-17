// src/utils/api.ts — public client, safe for admin builds too

// Prefer admin base first so the admin build never crosses hosts.
// Fall back to public base, then local 3001 (public API).
const env = (import.meta as any).env || {};
export const API = (
  env.VITE_ADMIN_API_URL ||
  env.VITE_API_URL ||
  "http://localhost:3001"
).replace(/\/+$/, "");

// Decide when to send credentials (cookies):
// - needed for /auth/* and /admin/*
// - omit for plain public /api/* requests
function needsCreds(path: string) {
  const pathname = path.startsWith("http")
    ? new URL(path).pathname
    : path;
  return pathname.startsWith("/auth") || pathname.startsWith("/admin");
}

// Core fetch helper with good error text
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    credentials: needsCreds(path) ? "include" : "omit",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url}\n${text.slice(0, 300)}`);
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

const get  = <T,>(p: string) => request<T>(p);
const post = <T,>(p: string, b?: any) => request<T>(p, { method: "POST", body: b ? JSON.stringify(b) : undefined });
const del  = <T,>(p: string) => request<T>(p, { method: "DELETE" });
const patch= <T,>(p: string, b?: any) => request<T>(p, { method: "PATCH", body: b ? JSON.stringify(b) : undefined });

/* ================== Types ================== */
export type Municipality = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  province?: string;
  lat?: number;
  lng?: number;
  image_url?: string | null;
};

export type Dish = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  rating?: number | null;
  popularity?: number | null;
  flavor_profile?: string[] | null;
  ingredients?: string[] | null;
  municipality_id: number;
  municipality_name?: string;
  category?: "food" | "delicacy" | "drink";
};

export type Restaurant = {
  id: number;
  name: string;
  slug: string;
  kind?: 'restaurant'|'stall'|'store'|'dealer'|'market'|'home-based';
  description?: string | null;
  address?: string;
  phone?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  opening_hours?: string | null;
  price_range?: "budget" | "moderate" | "expensive";
  cuisine_types?: string[] | null;
  rating?: number | null;
  lat?: number;
  lng?: number;
  image_url?: string | null;
  municipality_name?: string;
};

/* ================== Public endpoints ================== */
export const fetchMunicipalities = () =>
  get<Municipality[]>(`/api/municipalities`);

export const fetchDishes = (opts: { municipalityId?: number; category?: string; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.category)       qs.set("category", String(opts.category));
  if (opts.q)              qs.set("q", String(opts.q));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return get<Dish[]>(`/api/dishes${suffix}`);
};

export const fetchRestaurants = (opts: { municipalityId?: number; dishId?: number; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
  if (opts.dishId)         qs.set("dishId", String(opts.dishId));
  if (opts.q)              qs.set("q", String(opts.q));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return get<Restaurant[]>(`/api/restaurants${suffix}`);
};

/* (Optional) If any non-admin screens call /admin/* from this client,
   they will automatically send cookies because needsCreds() returns true. */
