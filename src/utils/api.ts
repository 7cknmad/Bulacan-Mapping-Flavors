// src/utils/api.ts — public client (works in admin builds too)
// Routes /api/* to VITE_API_URL and /admin|/auth to VITE_ADMIN_API_URL.

const env = (import.meta as any).env || {};

// Bases: public first for /api, admin for /admin|/auth.
// Fallbacks keep local dev friendly.
const PUBLIC_BASE = (
  env.VITE_API_URL ||
  env.VITE_ADMIN_API_URL ||
  "http://localhost:3001"
).replace(/\/+$/, "");

const ADMIN_BASE = (
  env.VITE_ADMIN_API_URL ||
  env.VITE_API_URL ||
  "http://localhost:3002"
).replace(/\/+$/, "");

function baseFor(path: string) {
  const p = path.startsWith("http") ? new URL(path).pathname : path;
  return (p.startsWith("/admin") || p.startsWith("/auth")) ? ADMIN_BASE : PUBLIC_BASE;
}

export function absoluteUrl(path: string) {
  if (path.startsWith("http")) return path;
  return `${baseFor(path)}${path}`;
}

// No login anymore => never send cookies
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = absoluteUrl(path);
  const res = await fetch(url, {
    credentials: "omit",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url}\n${text.slice(0, 300)}`);
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

const get   = <T,>(p: string) => request<T>(p);
const post  = <T,>(p: string, b?: any) => request<T>(p, { method: "POST",  body: b ? JSON.stringify(b) : undefined });
const patch = <T,>(p: string, b?: any) => request<T>(p, { method: "PATCH", body: b ? JSON.stringify(b) : undefined });
const del   = <T,>(p: string) => request<T>(p, { method: "DELETE" });

/* ================== Types (kept light/compatible) ================== */
export type Municipality = {
  id: number; name: string; slug: string;
  description?: string|null; province?: string; lat?: number; lng?: number; image_url?: string|null;
};
export type Dish = {
  id: number; slug: string; name: string; municipality_id: number;
  description?: string|null; image_url?: string|null; rating?: number|null; popularity?: number|null;
  flavor_profile?: string[]|null; ingredients?: string[]|null; municipality_name?: string;
  category?: "food"|"delicacy"|"drink";
};
export type Restaurant = {
  id: number; name: string; slug: string;
  kind?: 'restaurant'|'stall'|'store'|'dealer'|'market'|'home-based';
  description?: string|null; address?: string; phone?: string|null; website?: string|null;
  facebook?: string|null; instagram?: string|null; opening_hours?: string|null;
  price_range?: "budget"|"moderate"|"expensive"; cuisine_types?: string[]|null;
  rating?: number|null; lat?: number; lng?: number; image_url?: string|null; municipality_name?: string;
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
