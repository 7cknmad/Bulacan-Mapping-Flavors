
import React, { useEffect, useMemo, useState } from "react";
import MunicipalitySelect from "../../components/admin/MunicipalitySelect";
import useDebounce from "../../hooks/useDebounce";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/* ==================== Types ==================== */
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

/* ==================== Fetch helpers ==================== */
async function jget<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: "include" });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `${res.status}`);
  return text ? (JSON.parse(text) as T) : (null as T);
}
async function jsend<T>(path: string, body: any, method: "POST"|"PATCH"|"DELETE"="POST"): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `${res.status}`);
  return text ? (JSON.parse(text) as T) : (null as T);
}

/* ==================== Tiny Tabs (no dependency) ==================== */
function Tabs({
  value, onValueChange, children,
}: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) {
  return <div>{React.Children.map(children, (child: any) => {
    if (!React.isValidElement(child)) return child;
    return React.cloneElement(child, { __tabsValue: value, __setTabsValue: onValueChange });
  })}</div>;
}
function TabsList({ children, __tabsValue, __setTabsValue }: any) {
  return <div className="flex gap-2 mb-4">{React.Children.map(children, (c: any) =>
    React.cloneElement(c, { __tabsValue, __setTabsValue }))}</div>;
}
function TabsTrigger({ value, children, __tabsValue, __setTabsValue }: any) {
  const active = __tabsValue === value;
  return (
    <button
      onClick={() => __setTabsValue(value)}
      className={`px-3 py-1 rounded ${active ? "bg-primary-600 text-white" : "bg-neutral-100"}`}
    >
      {children}
    </button>
  );
}
function TabsContent({ value, children, __tabsValue }: any) {
  if (__tabsValue !== value) return null;
  return <div>{children}</div>;
}

/* ==================== Admin Dashboard ==================== */
export default function AdminDashboard() {
  // global filters
  const [selectedMuniId, setSelectedMuniId] = useState<number | null>(null);
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounce(searchRaw, 250);
  const [tab, setTab] = useState<"analytics"|"manage"|"curation"|"link">("analytics");

  return (
    <div className="p-4 md:p-6">
      {/* top filter bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="text-lg font-semibold">Admin Dashboard</div>
        <div className="flex flex-wrap gap-2 items-center">
          <MunicipalitySelect
            value={selectedMuniId}
            onChange={setSelectedMuniId}
            placeholder="All municipalities"
            allowAll
          />
          <input
            className="border rounded px-3 py-2 w-72"
            placeholder="Search (dish / delicacy / restaurant)…"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={v=>setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="manage">Manage</TabsTrigger>
          <TabsTrigger value="curation">Curation</TabsTrigger>
          <TabsTrigger value="link">Link</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <AnalyticsTab municipalityId={selectedMuniId} />
        </TabsContent>

        <TabsContent value="manage">
          <ManageTab municipalityId={selectedMuniId} q={search} />
        </TabsContent>

        <TabsContent value="curation">
          <CurationTab municipalityId={selectedMuniId} />
        </TabsContent>

        <TabsContent value="link">
          <LinkTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ==================== Analytics Tab ==================== */
function AnalyticsTab({ municipalityId }: { municipalityId: number | null }) {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [topDishes, setTopDishes] = useState<any[]>([]);
  const [topRestos, setTopRestos] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (municipalityId) qs.set("municipalityId", String(municipalityId));
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        const [a, b, c] = await Promise.all([
          jget<OverviewStats>(`/api/admin/stats/overview${suffix}`),
          jget<any[]>(`/api/admin/stats/top-dishes${suffix}&limit=7`.replace("?&","?")),
          jget<any[]>(`/api/admin/stats/top-restaurants${suffix}&limit=7`.replace("?&","?")),
        ]);
        setOverview(a);
        setTopDishes(Array.isArray(b) ? b : []);
        setTopRestos(Array.isArray(c) ? c : []);
      } catch (e) {
        // Degrade gracefully if admin stats not implemented yet
        setOverview({ municipalities: 0, dishes: 0, delicacies: 0, restaurants: 0, links: 0 });
        setTopDishes([]); setTopRestos([]);
        console.warn("Admin stats endpoints not available yet:", e);
      }
    })();
  }, [municipalityId]);

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

/* ==================== Manage Tab (CRUD) ==================== */
function ManageTab({ municipalityId, q }: { municipalityId: number | null; q: string }) {
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
      {active === "dishes"
        ? <ManageDishes municipalityId={municipalityId} q={q} />
        : <ManageRestaurants municipalityId={municipalityId} q={q} />
      }
    </div>
  );
}

/* -------- Dishes CRUD -------- */
function ManageDishes({ municipalityId, q }: { municipalityId: number | null; q: string }) {
  const [list, setList] = useState<Dish[]>([]);
  const [cat, setCat] = useState<"" | "food" | "delicacy" | "drink">("");
  const [editing, setEditing] = useState<Dish | null>(null);

  const reload = async () => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    if (cat) qs.set("category", cat);
    qs.set("limit", "200");
    const rows = await jget<Dish[]>(`/api/dishes?${qs.toString()}`);
    // ensure arrays are arrays
    setList(rows.map(r => ({
      ...r,
      flavor_profile: Array.isArray(r.flavor_profile) ? r.flavor_profile : (r.flavor_profile ? safeJsonArray(r.flavor_profile) : []),
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : (r.ingredients ? safeJsonArray(r.ingredients) : []),
    })));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [municipalityId, q, cat]);

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      municipality_id: Number(fd.get("municipality_id")),
      category_code: String(fd.get("category_code")),
      name: String(fd.get("name")),
      slug: String(fd.get("slug")),
      description: String(fd.get("description") || ""),
      flavor_profile: toList(fd.get("flavor_profile")),
      ingredients: toList(fd.get("ingredients")),
      image_url: String(fd.get("image_url") || "") || null,
      popularity: Number(fd.get("popularity") || 0),
      rating: Number(fd.get("rating") || 0),
    };
    await jsend("/api/admin/dishes", payload, "POST");
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
    await jsend(`/api/admin/dishes/${editing.id}`, body, "PATCH");
    setEditing(null);
    reload();
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Left: filters + list */}
      <div className="md:col-span-2 space-y-3">
        <div className="flex gap-2 items-center">
          <div className="text-sm text-neutral-500">Category</div>
          <select className="input w-40" value={cat} onChange={e=>setCat(e.target.value as any)}>
            <option value="">All</option>
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
              <input className="input" value={(editing.flavor_profile??[]).join(", ")} onChange={e=>setEditing({...editing, flavor_profile:toList(e.target.value)})} />
              <input className="input" value={(editing.ingredients??[]).join(", ")} onChange={e=>setEditing({...editing, ingredients:toList(e.target.value)})} />
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

/* -------- Restaurants CRUD -------- */
function ManageRestaurants({ municipalityId, q }: { municipalityId: number | null; q: string }) {
  const [list, setList] = useState<Restaurant[]>([]);
  const [editing, setEditing] = useState<Restaurant | null>(null);

  const reload = async () => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    qs.set("limit", "200");
    const rows = await jget<Restaurant[]>(`/api/restaurants?${qs.toString()}`);
    setList(rows.map(r => ({
      ...r,
      cuisine_types: Array.isArray(r.cuisine_types) ? r.cuisine_types : (r.cuisine_types ? safeJsonArray(r.cuisine_types) : []),
    })));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [municipalityId, q]);

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
      cuisine_types: toList(fd.get("cuisine_types")),
      phone: String(fd.get("phone") || "") || null,
      email: String(fd.get("email") || "") || null,
      website: String(fd.get("website") || "") || null,
      facebook: String(fd.get("facebook") || "") || null,
      instagram: String(fd.get("instagram") || "") || null,
      opening_hours: String(fd.get("opening_hours") || "") || null,
      rating: Number(fd.get("rating") || 0),
    };
    await jsend("/api/admin/restaurants", payload, "POST");
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
    await jsend(`/api/admin/restaurants/${editing.id}`, body, "PATCH");
    setEditing(null);
    reload();
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Left: list */}
      <div className="md:col-span-2">
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
              <input className="input" value={(editing.cuisine_types??[]).join(", ")} onChange={e=>setEditing({...editing, cuisine_types:toList(e.target.value)})} />
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

/* ==================== Link Tab (dish ↔ restaurant) ==================== */
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
    await jsend("/api/admin/dish-restaurants", { dish_id: dishId, restaurant_id: restoId }, "POST");
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

/* ==================== Curation Tab (Top 3 per muni) ==================== */
function CurationTab({ municipalityId }: { municipalityId: number | null }) {
  const muni = municipalityId ?? 1;
  const [foods, setFoods] = useState<Dish[]>([]);
  const [delics, setDelics] = useState<Dish[]>([]);
  const [restos, setRestos] = useState<Restaurant[]>([]);

  const reload = async () => {
    const [a,b,c] = await Promise.all([
      jget<Dish[]>(`/api/dishes?municipalityId=${muni}&category=food&limit=100`),
      jget<Dish[]>(`/api/dishes?municipalityId=${muni}&category=delicacy&limit=100`),
      jget<Restaurant[]>(`/api/restaurants?municipalityId=${muni}&limit=100`),
    ]);
    setFoods(normalizeDishes(a));
    setDelics(normalizeDishes(b));
    setRestos(normalizeRestos(c));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [municipalityId]);

  const setDishRank = async (id:number, rank:number|null) => {
    await jsend(`/api/admin/dishes/${id}`, { is_signature: rank!=null ? 1 : 0, panel_rank: rank }, "PATCH");
    reload();
  };
  const setRestoRank = async (id:number, rank:number|null) => {
    await jsend(`/api/admin/restaurants/${id}`, { is_featured: rank!=null ? 1 : 0, panel_rank: rank }, "PATCH");
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-neutral-600">
        Curation for <span className="font-medium">municipality #{muni}</span> (use the selector on top to change).
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
          <div key={(it as any).id} className="p-3 border rounded flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-medium truncate">{(it as any).name}</div>
              <div className="text-xs text-neutral-500 truncate">{(it as any).slug ?? ""}</div>
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

/* ==================== Helpers ==================== */
function safeJsonArray(v: unknown): string[] {
  try {
    const arr = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function toList(v: FormDataEntryValue | null): string[] {
  return String(v || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}
function normalizeDishes(rows: Dish[]): Dish[] {
  return rows.map(r => ({
    ...r,
    flavor_profile: Array.isArray(r.flavor_profile) ? r.flavor_profile : (r.flavor_profile ? safeJsonArray(r.flavor_profile) : []),
    ingredients: Array.isArray(r.ingredients) ? r.ingredients : (r.ingredients ? safeJsonArray(r.ingredients) : []),
  }));
}
function normalizeRestos(rows: Restaurant[]): Restaurant[] {
  return rows.map(r => ({
    ...r,
    cuisine_types: Array.isArray(r.cuisine_types) ? r.cuisine_types : (r.cuisine_types ? safeJsonArray(r.cuisine_types) : []),
  }));
}
