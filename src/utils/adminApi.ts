// src/utils/adminApi.ts
export const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// ---------- helpers ----------
async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t) as T;
}

async function sendJSON<T>(url: string, method: "POST"|"PUT"|"PATCH"|"DELETE", body?: any): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
  return t ? (JSON.parse(t) as T) : (undefined as unknown as T);
}

// ---------- types ----------
export type Municipality = {
  id: number;
  name: string;
  slug: string;
};

export type Dish = {
  id: number;
  municipality_id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  category: "food" | "delicacy" | "drink";
  flavor_profile: string[]; // always normalized
  ingredients: string[];    // always normalized
  popularity: number | null;
  rating: number | null;
  is_featured?: number | null;
  featured_rank?: number | null;
};

export type Restaurant = {
  id: number;
  municipality_id: number;
  name: string;
  slug: string;
  kind: "restaurant"|"stall"|"store"|"dealer"|"market"|"home-based";
  description: string | null;
  image_url: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  opening_hours: string | null;
  price_range: "budget" | "moderate" | "expensive";
  cuisine_types: string[]; // always normalized
  rating: number | null;
  lat: number;
  lng: number;
  is_signature?: number | null;
  signature_rank?: number | null;
};

// ---------- normalizers ----------
function toArray(x: unknown): string[] {
  if (x == null) return [];
  if (Array.isArray(x)) return x.filter(v => typeof v === "string");
  if (typeof x === "string") {
    try {
      const p = JSON.parse(x);
      return Array.isArray(p) ? p.filter(v => typeof v === "string") : [];
    } catch {
      // allow comma-separated entry typed by admin
      return x.split(",").map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeDish(row: any): Dish {
  return {
    id: Number(row.id),
    municipality_id: Number(row.municipality_id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description ?? null,
    image_url: row.image_url ?? null,
    category: (row.category ?? "food") as Dish["category"],
    flavor_profile: toArray(row.flavor_profile),
    ingredients: toArray(row.ingredients),
    popularity: row.popularity == null ? null : Number(row.popularity),
    rating: row.rating == null ? null : Number(row.rating),
    is_featured: row.is_featured == null ? null : Number(row.is_featured),
    featured_rank: row.featured_rank == null ? null : Number(row.featured_rank),
  };
}

function normalizeRestaurant(row: any): Restaurant {
  const types = toArray(row.cuisine_types);
  return {
    id: Number(row.id),
    municipality_id: Number(row.municipality_id ?? row.muni_id ?? 0),
    name: String(row.name),
    slug: String(row.slug),
    kind: (row.kind ?? "restaurant") as Restaurant["kind"],
    description: row.description ?? null,
    image_url: row.image_url ?? null,
    address: String(row.address ?? ""),
    phone: row.phone ?? null,
    website: row.website ?? null,
    facebook: row.facebook ?? null,
    instagram: row.instagram ?? null,
    opening_hours: row.opening_hours ?? null,
    price_range: (row.price_range ?? "moderate") as Restaurant["price_range"],
    cuisine_types: types,
    rating: row.rating == null ? null : Number(row.rating),
    lat: Number(row.lat ?? 0),
    lng: Number(row.lng ?? 0),
    is_signature: row.is_signature == null ? null : Number(row.is_signature),
    signature_rank: row.signature_rank == null ? null : Number(row.signature_rank),
  };
}

// ---------- API (auth) ----------
export const AdminAuth = {
  // expects cookie-based session from your backend (already added)
  me: () => getJSON<{ ok: boolean; user?: { id: number; email: string } }>(`${API}/api/admin/auth/me`),
  login: (email: string, password: string) =>
    sendJSON<{ ok: boolean }>(`${API}/api/admin/auth/login`, "POST", { email, password }),
  logout: () => sendJSON<{ ok: boolean }>(`${API}/api/admin/auth/logout`, "POST"),
};

// ---------- API (core) ----------
export const AdminAPI = {
  municipalities: async (): Promise<Municipality[]> => {
    const rows = await getJSON<any[]>(`${API}/api/municipalities`);
    return rows.map(r => ({ id: r.id, name: r.name, slug: r.slug }));
  },

  // Dishes
  getDishes: async (opts: { municipalityId?: number; q?: string } = {}): Promise<Dish[]> => {
    const qs = new URLSearchParams();
    if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
    if (opts.q) qs.set("q", opts.q);
    const rows = await getJSON<any[]>(`${API}/api/dishes?${qs.toString()}`);
    return rows.map(normalizeDish);
  },
  createDish: async (payload: Partial<Dish> & { municipality_id: number; name: string; slug: string; category: Dish["category"] }) => {
    const body = {
      ...payload,
      flavor_profile: payload.flavor_profile ?? [],
      ingredients: payload.ingredients ?? [],
      category_code: payload.category,
    };
    const r = await sendJSON<{ id: number }>(`${API}/api/admin/dishes`, "POST", body);
    return r.id;
  },
  updateDish: async (id: number, payload: Partial<Dish>) => {
    const body = {
      ...payload,
      category_code: payload.category,
    };
    return sendJSON<{ ok: true }>(`${API}/api/admin/dishes/${id}`, "PUT", body);
  },
  deleteDish: async (id: number) => {
    return sendJSON<{ ok: true }>(`${API}/api/admin/dishes/${id}`, "DELETE");
  },

  // Restaurants
  getRestaurants: async (opts: { municipalityId?: number; q?: string } = {}): Promise<Restaurant[]> => {
    const qs = new URLSearchParams();
    if (opts.municipalityId) qs.set("municipalityId", String(opts.municipalityId));
    if (opts.q) qs.set("q", opts.q);
    const rows = await getJSON<any[]>(`${API}/api/restaurants?${qs.toString()}`);
    return rows.map(normalizeRestaurant);
  },
  createRestaurant: async (payload: Partial<Restaurant> & {
    municipality_id: number; name: string; slug: string; address: string; lat: number; lng: number;
  }) => {
    const body = {
      ...payload,
      cuisine_types: payload.cuisine_types ?? [],
    };
    const r = await sendJSON<{ id: number }>(`${API}/api/admin/restaurants`, "POST", body);
    return r.id;
  },
  updateRestaurant: async (id: number, payload: Partial<Restaurant>) => {
    return sendJSON<{ ok: true }>(`${API}/api/admin/restaurants/${id}`, "PUT", payload);
  },
  deleteRestaurant: async (id: number) => {
    return sendJSON<{ ok: true }>(`${API}/api/admin/restaurants/${id}`, "DELETE");
  },

  // Linking
  linkDishRestaurants: async (dish_id: number, restaurant_ids: number[]) => {
    const tasks = restaurant_ids.map(rid =>
      sendJSON(`${API}/api/admin/dish-restaurants`, "POST", { dish_id, restaurant_id: rid, availability: "regular" })
    );
    await Promise.all(tasks);
    return { ok: true };
  },

  // Curation
  setDishFeatured: (id: number, is_featured: 0|1, featured_rank: number | null) =>
    sendJSON<{ ok: true }>(`${API}/api/admin/dishes/${id}/feature`, "POST", { is_featured, featured_rank }),
  setRestaurantSignature: (id: number, is_signature: 0|1, signature_rank: number | null) =>
    sendJSON<{ ok: true }>(`${API}/api/admin/restaurants/${id}/signature`, "POST", { is_signature, signature_rank }),
};
