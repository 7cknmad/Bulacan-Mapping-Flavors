import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

/** ========= Config & Types ========= */
const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type AdminMe = { ok: boolean; admin: { sub: number; name: string; email: string } };

type Dish = {
  id: number; slug: string; name: string; description: string | null;
  image_url: string | null; rating: number | null; popularity: number | null;
  flavor_profile: string[] | null; ingredients: string[] | null;
  municipality_id: number; category: "food" | "delicacy" | "drink";
  is_signature?: 0|1; panel_rank?: number | null;
};

type Restaurant = {
  id: number; name: string; slug: string; kind: string; description: string | null;
  address: string; phone: string | null; website: string | null;
  facebook: string | null; instagram: string | null; opening_hours: string | null;
  price_range: "budget" | "moderate" | "expensive";
  cuisine_types: string[] | null; rating: number; lat: number; lng: number;
  municipality_id?: number; is_featured?: 0|1; panel_rank?: number | null;
};

type OverviewStats = {
  municipalities: number; dishes: number; delicacies: number; restaurants: number; links: number;
};

/** ========= Utilities ========= */
async function jget<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function jpost<T>(path: string, body: any, method: "POST"|"PATCH"|"DELETE"="POST"): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** ========= Auth small hook ========= */
function useAdminGuard() {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const data = await jget<AdminMe>("/api/admin/auth/me");
        setMe(data);
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return { me, loading };
}

/** ========= Main Shell with Tabs ========= */
type TabKey = "analytics" | "manage" | "link" | "curation";

export default function AdminDashboard() {
  const { me, loading } = useAdminGuard();
  const [tab, setTab] = useState<TabKey>("analytics");

  useEffect(() => {
    if (!loading && !me?.ok) {
      // Not logged in
      window.location.href = "/#/admin/login";
    }
  }, [loading, me]);

  if (loading || !me?.ok) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <button
          className="text-sm px-3 py-2 rounded border"
          onClick={async () => {
            await jpost("/api/admin/auth/logout", {}, "POST");
            window.location.href = "/#/admin/login";
          }}
        >
          Logout
        </button>
      </header>

      {/* Tabs */}
      <nav className="flex gap-2 border-b">
        {[
          ["analytics", "Analytics"],
          ["manage", "Manage"],
          ["link", "Linking"],
          ["curation", "Curation"],
        ].map(([k, label]) => (
          <button
            key={k}
            className={`px-3 py-2 -mb-px border-b-2 ${
              tab === (k as TabKey) ? "border-primary-600 text-primary-700" : "border-transparent text-neutral-500"
            }`}
            onClick={() => setTab(k as TabKey)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "analytics" && <AnalyticsTab />}
      {tab === "manage" && <ManageTab />}
      {tab === "link" && <LinkTab />}
      {tab === "curation" && <CurationTab />}
    </div>
  );
}

/** ========= Tab A: Analytics ========= */
function AnalyticsTab() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [topDishes, setTopDishes] = useState<any[]>([]);
  const [topRestos, setTopRestos] = useState<any[]>([]);

useEffect(() => {
  (async () => {
    try {
      const [a, b, c] = await Promise.all([
        jget<OverviewStats>("/api/admin/stats/overview"),
        jget<any[]>("/api/admin/stats/top-dishes?limit=7"),
        jget<any[]>("/api/admin/stats/top-restaurants?limit=7"),
      ]);
      setOverview(a); setTopDishes(b); setTopRestos(c);
    } catch (e) {
      // Gracefully degrade if stats endpoints aren't ready
      setOverview({ municipalities: 0, dishes: 0, delicacies: 0, restaurants: 0, links: 0 });
      setTopDishes([]); setTopRestos([]);
      console.warn("Admin stats endpoints not available yet:", e);
    }
  })();
}, []);

  return (
    <div className="space-y-8">
      {overview && (
        <div className="grid sm:grid-cols-4 gap-3">
          <StatCard label="Municipalities" value={overview.municipalities} />
          <StatCard label="Dishes" value={overview.dishes} />
          <StatCard label="Delicacies" value={overview.delicacies} />
          <StatCard label="Restaurants" value={overview.restaurants} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <ChartCard title="Top Dishes (by places)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topDishes}>
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="places" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top Restaurants (by dish count)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topRestos}>
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="dishes" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-4 rounded-lg border bg-white shadow-sm">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-lg border bg-white shadow-sm">
      <div className="font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}

/** ========= Tab B: Manage (CRUD + Edit) ========= */
function ManageTab() {
  const [active, setActive] = useState<"dishes" | "restaurants">("dishes");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          className={`px-3 py-1 rounded ${active === "dishes" ? "bg-primary-600 text-white" : "bg-neutral-100"}`}
          onClick={() => setActive("dishes")}
        >
          Dishes
        </button>
        <button
          className={`px-3 py-1 rounded ${active === "restaurants" ? "bg-primary-600 text-white" : "bg-neutral-100"}`}
          onClick={() => setActive("restaurants")}
        >
          Restaurants
        </button>
      </div>
      {active === "dishes" ? <ManageDishes /> : <ManageRestaurants />}
    </div>
  );
}

/** --- Dishes CRUD --- */
function ManageDishes() {
  const [list, setList] = useState<Dish[]>([]);
  const [q, setQ] = useState("");
  const [muni, setMuni] = useState<number | "">("");
  const [cat, setCat] = useState<"" | "food" | "delicacy" | "drink">("");

  const [editing, setEditing] = useState<Dish | null>(null);

  const reload = async () => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (muni) qs.set("municipalityId", String(muni));
    if (cat) qs.set("category", cat);
    qs.set("limit", "200");
    const rows = await jget<Dish[]>(`/api/dishes?${qs.toString()}`);
    // ensure arrays are arrays
    setList(rows.map(r => ({
      ...r,
      flavor_profile: Array.isArray(r.flavor_profile) ? r.flavor_profile : (r.flavor_profile ? JSON.parse(String(r.flavor_profile)) : null),
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : (r.ingredients ? JSON.parse(String(r.ingredients)) : null),
    })));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      municipality_id: Number(fd.get("municipality_id")),
      category_code: String(fd.get("category_code")),
      name: String(fd.get("name")),
      slug: String(fd.get("slug")),
      description: String(fd.get("description") || ""),
      flavor_profile: String(fd.get("flavor_profile") || "")
        .split(",").map(s => s.trim()).filter(Boolean),
      ingredients: String(fd.get("ingredients") || "")
        .split(",").map(s => s.trim()).filter(Boolean),
      image_url: String(fd.get("image_url") || "") || null,
      popularity: Number(fd.get("popularity") || 0),
      rating: Number(fd.get("rating") || 0),
    };
    await jpost("/api/admin/dishes", payload, "POST");
    (e.target as HTMLFormElement).reset();
    reload();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const body = {
      name: editing.name,
      slug: editing.slug,
      municipality_id: editing.municipality_id,
      category_code: editing.category,
      description: editing.description,
      flavor_profile: editing.flavor_profile,
      ingredients: editing.ingredients,
      image_url: editing.image_url,
      popularity: editing.popularity ?? 0,
      rating: editing.rating ?? 0,
    };
    await jpost(`/api/admin/dishes/${editing.id}`, body, "PATCH");
    setEditing(null);
    reload();
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Left: filters + list */}
      <div className="md:col-span-2 space-y-3">
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Search name…" value={q} onChange={e=>setQ(e.target.value)} />
          <input className="input w-32" placeholder="Municipality ID" value={muni} onChange={e=>setMuni((e.target.value as any) || "")} />
          <select className="input w-40" value={cat} onChange={e=>setCat(e.target.value as any)}>
            <option value="">All categories</option>
            <option value="food">Food</option>
            <option value="delicacy">Delicacy</option>
            <option value="drink">Drink</option>
          </select>
          <button className="btn" onClick={reload}>Reload</button>
        </div>

        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2">Cat</th>
                <th className="p-2">Muni</th>
                <th className="p-2">Rank</th>
                <th className="p-2 w-24">Edit</th>
              </tr>
            </thead>
            <tbody>
              {list.map(d => (
                <tr key={d.id} className="border-t">
                  <td className="p-2">{d.name}</td>
                  <td className="p-2 text-center">{d.category}</td>
                  <td className="p-2 text-center">{d.municipality_id}</td>
                  <td className="p-2 text-center">{d.panel_rank ?? "—"}</td>
                  <td className="p-2 text-center">
                    <button className="text-primary-600 underline" onClick={()=>setEditing(d)}>Edit</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-neutral-500">No results.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Create or Edit */}
      <div className="space-y-3">
        {!editing ? (
          <>
            <h3 className="font-semibold">Create Dish</h3>
            <form className="space-y-2" onSubmit={create}>
              <input className="input" name="name" placeholder="Name" required />
              <input className="input" name="slug" placeholder="slug-like-this" required />
              <input className="input" name="municipality_id" placeholder="Municipality ID" required />
              <select className="input" name="category_code" required>
                <option value="food">Food</option>
                <option value="delicacy">Delicacy</option>
                <option value="drink">Drink</option>
              </select>
              <textarea className="input" name="description" placeholder="Description" />
              <input className="input" name="flavor_profile" placeholder="Flavor profile (comma-sep)" />
              <input className="input" name="ingredients" placeholder="Ingredients (comma-sep)" />
              <input className="input" name="image_url" placeholder="Image URL" />
              <div className="flex gap-2">
                <input className="input" name="popularity" type="number" step="1" placeholder="Popularity" />
                <input className="input" name="rating" type="number" step="0.1" placeholder="Rating" />
              </div>
              <button className="btn btn-primary w-full">Create</button>
            </form>
          </>
        ) : (
          <>
            <h3 className="font-semibold">Edit Dish</h3>
            <div className="space-y-2">
              <input className="input" value={editing.name} onChange={e=>setEditing({...editing, name:e.target.value})} />
              <input className="input" value={editing.slug} onChange={e=>setEditing({...editing, slug:e.target.value})} />
              <input className="input" value={editing.municipality_id} onChange={e=>setEditing({...editing, municipality_id:Number(e.target.value)||0})} />
              <select className="input" value={editing.category} onChange={e=>setEditing({...editing, category:e.target.value as any})}>
                <option value="food">Food</option>
                <option value="delicacy">Delicacy</option>
                <option value="drink">Drink</option>
              </select>
              <textarea className="input" value={editing.description ?? ""} onChange={e=>setEditing({...editing, description:e.target.value})} />
              <input className="input" value={(editing.flavor_profile??[]).join(", ")} onChange={e=>setEditing({...editing, flavor_profile:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})} />
              <input className="input" value={(editing.ingredients??[]).join(", ")} onChange={e=>setEditing({...editing, ingredients:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})} />
              <input className="input" value={editing.image_url ?? ""} onChange={e=>setEditing({...editing, image_url:e.target.value||null})} />
              <div className="flex gap-2">
                <input className="input" type="number" step="1" value={editing.popularity ?? 0} onChange={e=>setEditing({...editing, popularity:Number(e.target.value)||0})} />
                <input className="input" type="number" step="0.1" value={editing.rating ?? 0} onChange={e=>setEditing({...editing, rating:Number(e.target.value)||0})} />
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                <button className="btn" onClick={()=>setEditing(null)}>Cancel</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** --- Restaurants CRUD --- */
function ManageRestaurants() {
  const [list, setList] = useState<Restaurant[]>([]);
  const [q, setQ] = useState("");
  const [muni, setMuni] = useState<number | "">("");

  const [editing, setEditing] = useState<Restaurant | null>(null);

  const reload = async () => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (muni) qs.set("municipalityId", String(muni));
    qs.set("limit", "200");
    const rows = await jget<Restaurant[]>(`/api/restaurants?${qs.toString()}`);
    setList(rows.map(r => ({
      ...r,
      cuisine_types: Array.isArray(r.cuisine_types) ? r.cuisine_types : (r.cuisine_types ? JSON.parse(String(r.cuisine_types)) : null),
    })));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      municipality_id: Number(fd.get("municipality_id")),
      name: String(fd.get("name")),
      slug: String(fd.get("slug")),
      kind: String(fd.get("kind") || "restaurant"),
      address: String(fd.get("address")),
      lat: Number(fd.get("lat")),
      lng: Number(fd.get("lng")),
      description: String(fd.get("description") || "") || null,
      price_range: String(fd.get("price_range") || "moderate"),
      cuisine_types: String(fd.get("cuisine_types") || "")
        .split(",").map(s => s.trim()).filter(Boolean),
      phone: String(fd.get("phone") || "") || null,
      email: String(fd.get("email") || "") || null,
      website: String(fd.get("website") || "") || null,
      facebook: String(fd.get("facebook") || "") || null,
      instagram: String(fd.get("instagram") || "") || null,
      opening_hours: String(fd.get("opening_hours") || "") || null,
      rating: Number(fd.get("rating") || 0),
    };
    await jpost("/api/admin/restaurants", payload, "POST");
    (e.target as HTMLFormElement).reset();
    reload();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const body = {
      name: editing.name,
      slug: editing.slug,
      kind: editing.kind,
      description: editing.description,
      municipality_id: editing.municipality_id,
      address: editing.address,
      phone: editing.phone, email: undefined, website: editing.website,
      facebook: editing.facebook, instagram: editing.instagram,
      opening_hours: editing.opening_hours,
      price_range: editing.price_range,
      cuisine_types: editing.cuisine_types,
      rating: editing.rating,
      lat: editing.lat, lng: editing.lng,
    };
    await jpost(`/api/admin/restaurants/${editing.id}`, body, "PATCH");
    setEditing(null);
    reload();
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Left: filters + list */}
      <div className="md:col-span-2 space-y-3">
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Search name…" value={q} onChange={e=>setQ(e.target.value)} />
          <input className="input w-32" placeholder="Municipality ID" value={muni} onChange={e=>setMuni((e.target.value as any) || "")} />
          <button className="btn" onClick={reload}>Reload</button>
        </div>

        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2">Muni</th>
                <th className="p-2">Price</th>
                <th className="p-2">Rank</th>
                <th className="p-2 w-24">Edit</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-center">{r.municipality_id ?? "—"}</td>
                  <td className="p-2 text-center">{r.price_range}</td>
                  <td className="p-2 text-center">{r.panel_rank ?? "—"}</td>
                  <td className="p-2 text-center">
                    <button className="text-primary-600 underline" onClick={()=>setEditing(r)}>Edit</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-neutral-500">No results.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Create or Edit */}
      <div className="space-y-3">
        {!editing ? (
          <>
            <h3 className="font-semibold">Create Restaurant</h3>
            <form className="space-y-2" onSubmit={create}>
              <input className="input" name="name" placeholder="Name" required />
              <input className="input" name="slug" placeholder="slug-like-this" required />
              <input className="input" name="municipality_id" placeholder="Municipality ID" required />
              <input className="input" name="address" placeholder="Address" required />
              <div className="flex gap-2">
                <input className="input" name="lat" placeholder="Lat" required />
                <input className="input" name="lng" placeholder="Lng" required />
              </div>
              <select className="input" name="kind" defaultValue="restaurant">
                <option>restaurant</option>
                <option>stall</option>
                <option>store</option>
                <option>dealer</option>
                <option>market</option>
                <option>home-based</option>
              </select>
              <select className="input" name="price_range" defaultValue="moderate">
                <option>budget</option>
                <option>moderate</option>
                <option>expensive</option>
              </select>
              <textarea className="input" name="description" placeholder="Description" />
              <input className="input" name="cuisine_types" placeholder="Cuisines (comma-sep)" />
              <input className="input" name="phone" placeholder="Phone" />
              <input className="input" name="website" placeholder="Website" />
              <input className="input" name="facebook" placeholder="Facebook" />
              <input className="input" name="instagram" placeholder="Instagram" />
              <input className="input" name="opening_hours" placeholder="Opening hours" />
              <input className="input" name="rating" type="number" step="0.1" placeholder="Rating" />
              <button className="btn btn-primary w-full">Create</button>
            </form>
          </>
        ) : (
          <>
            <h3 className="font-semibold">Edit Restaurant</h3>
            <div className="space-y-2">
              <input className="input" value={editing.name} onChange={e=>setEditing({...editing, name:e.target.value})} />
              <input className="input" value={editing.slug} onChange={e=>setEditing({...editing, slug:e.target.value})} />
              <input className="input" value={editing.municipality_id ?? 0} onChange={e=>setEditing({...editing, municipality_id:Number(e.target.value)||0})} />
              <input className="input" value={editing.address} onChange={e=>setEditing({...editing, address:e.target.value})} />
              <div className="flex gap-2">
                <input className="input" value={editing.lat} onChange={e=>setEditing({...editing, lat:Number(e.target.value)||0})} />
                <input className="input" value={editing.lng} onChange={e=>setEditing({...editing, lng:Number(e.target.value)||0})} />
              </div>
              <select className="input" value={editing.kind} onChange={e=>setEditing({...editing, kind:e.target.value})}>
                <option>restaurant</option><option>stall</option><option>store</option>
                <option>dealer</option><option>market</option><option>home-based</option>
              </select>
              <select className="input" value={editing.price_range} onChange={e=>setEditing({...editing, price_range:e.target.value as any})}>
                <option>budget</option><option>moderate</option><option>expensive</option>
              </select>
              <textarea className="input" value={editing.description ?? ""} onChange={e=>setEditing({...editing, description:e.target.value||null})} />
              <input className="input" value={(editing.cuisine_types??[]).join(", ")} onChange={e=>setEditing({...editing, cuisine_types:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})} />
              <input className="input" value={editing.phone ?? ""} onChange={e=>setEditing({...editing, phone:e.target.value||null})} />
              <input className="input" value={editing.website ?? ""} onChange={e=>setEditing({...editing, website:e.target.value||null})} />
              <input className="input" value={editing.facebook ?? ""} onChange={e=>setEditing({...editing, facebook:e.target.value||null})} />
              <input className="input" value={editing.instagram ?? ""} onChange={e=>setEditing({...editing, instagram:e.target.value||null})} />
              <input className="input" value={editing.opening_hours ?? ""} onChange={e=>setEditing({...editing, opening_hours:e.target.value||null})} />
              <input className="input" type="number" step="0.1" value={editing.rating} onChange={e=>setEditing({...editing, rating:Number(e.target.value)||0})} />
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                <button className="btn" onClick={()=>setEditing(null)}>Cancel</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** ========= Tab C: Link dish ↔ restaurant (by name) ========= */
function LinkTab() {
  const [dishQ, setDishQ] = useState("");
  const [restoQ, setRestoQ] = useState("");
  const [dishes, setDishes] = useState<{id:number; name:string; slug:string; category:string}[]>([]);
  const [restos, setRestos] = useState<{id:number; name:string; slug:string}[]>([]);
  const [dishId, setDishId] = useState<number | null>(null);
  const [restoId, setRestoId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const searchDishes = async () => {
    const rows = await jget<{id:number; name:string; slug:string; category:string}[]>(`/api/admin/search/dishes?q=${encodeURIComponent(dishQ)}`);
    setDishes(rows);
  };
  const searchRestos = async () => {
    const rows = await jget<{id:number; name:string; slug:string}[]>(`/api/admin/search/restaurants?q=${encodeURIComponent(restoQ)}`);
    setRestos(rows);
  };
  const link = async () => {
    if (!dishId || !restoId) { setMsg("Pick both dish and restaurant"); return; }
    await jpost("/api/admin/dish-restaurants", { dish_id: dishId, restaurant_id: restoId }, "POST");
    setMsg("Linked!");
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <div className="font-semibold">Dish</div>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Search dish by name…" value={dishQ} onChange={e=>setDishQ(e.target.value)} />
          <button className="btn" onClick={searchDishes}>Search</button>
        </div>
        <div className="border rounded max-h-64 overflow-auto">
          {dishes.map(d => (
            <div key={d.id}
              className={`px-3 py-2 cursor-pointer ${dishId===d.id ? "bg-primary-50" : ""}`}
              onClick={()=>setDishId(d.id)}
            >
              <div className="font-medium">{d.name}</div>
              <div className="text-xs text-neutral-500">{d.slug} · {d.category}</div>
            </div>
          ))}
          {dishes.length===0 && <div className="p-3 text-sm text-neutral-500">No results.</div>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="font-semibold">Restaurant</div>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Search restaurant by name…" value={restoQ} onChange={e=>setRestoQ(e.target.value)} />
          <button className="btn" onClick={searchRestos}>Search</button>
        </div>
        <div className="border rounded max-h-64 overflow-auto">
          {restos.map(r => (
            <div key={r.id}
              className={`px-3 py-2 cursor-pointer ${restoId===r.id ? "bg-primary-50" : ""}`}
              onClick={()=>setRestoId(r.id)}
            >
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-neutral-500">{r.slug}</div>
            </div>
          ))}
          {restos.length===0 && <div className="p-3 text-sm text-neutral-500">No results.</div>}
        </div>
      </div>

      <div className="md:col-span-2 flex items-center gap-3">
        <button className="btn btn-primary" onClick={link}>Link Selected</button>
        {msg && <div className="text-sm">{msg}</div>}
      </div>
    </div>
  );
}

/** ========= Tab D: Curation (Top 3) ========= */
function CurationTab() {
  const [municipalityId, setMunicipalityId] = useState<number>(1);
  const [foods, setFoods] = useState<Dish[]>([]);
  const [delics, setDelics] = useState<Dish[]>([]);
  const [restos, setRestos] = useState<Restaurant[]>([]);

  const reload = async () => {
    const [a,b,c] = await Promise.all([
      jget<Dish[]>(`/api/dishes?municipalityId=${municipalityId}&category=food&limit=100`),
      jget<Dish[]>(`/api/dishes?municipalityId=${municipalityId}&category=delicacy&limit=100`),
      jget<Restaurant[]>(`/api/restaurants?municipalityId=${municipalityId}&limit=100`),
    ]);
    setFoods(a); setDelics(b); setRestos(c);
  };
  useEffect(() => { reload(); }, [municipalityId]);

  const setDishRank = async (id:number, rank:number|null) => {
    await jpost(`/api/admin/dishes/${id}`, { is_signature: rank!=null, panel_rank: rank }, "PATCH");
    reload();
  };
  const setRestoRank = async (id:number, rank:number|null) => {
    await jpost(`/api/admin/restaurants/${id}`, { is_featured: rank!=null, panel_rank: rank }, "PATCH");
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 items-center">
        <div className="font-semibold">Municipality ID</div>
        <input className="input w-32" value={municipalityId} onChange={e=>setMunicipalityId(Number(e.target.value)||1)} />
        <button className="btn" onClick={reload}>Reload</button>
      </div>

      <CurationList title="Top Dishes" items={foods} onRank={setDishRank} />
      <CurationList title="Top Delicacies" items={delics} onRank={setDishRank} />
      <CurationList title="Featured Restaurants" items={restos} onRank={setRestoRank} />
    </div>
  );
}
function CurationList({
  title, items, onRank
}: { title: string; items: (Dish|Restaurant)[]; onRank: (id:number, rank:number|null)=>void }) {
  return (
    <div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="grid md:grid-cols-2 gap-2">
        {items.map(it => (
          <div key={it.id} className="p-3 border rounded flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-medium truncate">{(it as any).name}</div>
              <div className="text-xs text-neutral-500 truncate">{(it as any).slug}</div>
            </div>
            <div className="flex items-center gap-2">
              {[1,2,3].map(n => (
                <button
                  key={n}
                  className={`px-2 py-1 rounded text-sm ${((it as any).panel_rank===n) ? 'bg-primary-600 text-white' : 'bg-neutral-100'}`}
                  onClick={()=>onRank((it as any).id, n)}
                >#{n}</button>
              ))}
              <button className="px-2 py-1 rounded text-sm bg-neutral-100" onClick={()=>onRank((it as any).id, null)}>Clear</button>
            </div>
          </div>
        ))}
        {items.length===0 && <div className="text-sm text-neutral-500 p-3">None.</div>}
      </div>
    </div>
  );
}

/** ========= Tiny inputs CSS (optional) =========
Add these to your global CSS if you don't have input/btn classes:
.input { @apply w-full px-3 py-2 border rounded outline-none focus:ring; }
.btn { @apply px-3 py-2 rounded border; }
.btn-primary { @apply bg-primary-600 text-white border-primary-600; }
*/
