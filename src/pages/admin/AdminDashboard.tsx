// src/pages/admin/AdminDashboard.tsx
import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listMunicipalities, listDishes, listRestaurants, toArr,
  createDish, updateDish, deleteDish,
  createRestaurant, updateRestaurant, deleteRestaurant,
  linkedRestaurantsForDish, linkedDishesForRestaurant,
  linkDishRestaurant, unlinkDishRestaurant,
  setDishCuration, setRestaurantCuration,
  getAnalyticsSummary, writeCap,
  type Municipality, type Dish, type Restaurant,
} from "../../utils/adminApi";

// If you don't have recharts installed yet:
// npm i recharts
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
} from "recharts";

const colors = ["#4f46e5","#06b6d4","#f59e0b","#10b981","#ef4444","#8b5cf6","#ec4899","#14b8a6"];

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function useWriteEnabled() {
  const { data } = useQuery({ queryKey: ["admin:write-cap"], queryFn: writeCap });
  return !!data;
}

function MuniSelect({
  value, onChange, allowAll = true,
}: { value: number | null; onChange: (v:number|null)=>void; allowAll?: boolean }) {
  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const opts = muniQ.data ?? [];
  return (
    <select
      className="border rounded px-2 py-1"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      {allowAll && <option value="">All municipalities</option>}
      {opts.map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
    </select>
  );
}

/* ========================== Analytics ========================== */
function AnalyticsTab() {
  const q = useQuery({ queryKey: ["analytics"], queryFn: getAnalyticsSummary, refetchOnWindowFocus: false });
  const [chart, setChart] = useState<"bar"|"pie">("bar");
  if (q.isLoading) return <Section title="Analytics"><div>Loading…</div></Section>;
  if (q.isError) return <Section title="Analytics"><div className="text-red-600">Failed to load analytics</div></Section>;
  const data = q.data!;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="Totals">
        <div className="flex gap-4">
          <div className="flex-1 bg-indigo-50 rounded-lg p-4">
            <div className="text-sm text-indigo-800/80">Dishes</div>
            <div className="text-3xl font-semibold">{data.counts.dishes}</div>
          </div>
          <div className="flex-1 bg-cyan-50 rounded-lg p-4">
            <div className="text-sm text-cyan-800/80">Restaurants</div>
            <div className="text-3xl font-semibold">{data.counts.restaurants}</div>
          </div>
        </div>
      </Section>

      <Section
        title="Per municipality"
        right={
          <div className="flex items-center gap-2">
            <button className={`px-2 py-1 rounded border ${chart==="bar"?"bg-neutral-100":""}`} onClick={()=>setChart("bar")}>Bar</button>
            <button className={`px-2 py-1 rounded border ${chart==="pie"?"bg-neutral-100":""}`} onClick={()=>setChart("pie")}>Pie</button>
          </div>
        }
      >
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            {chart === "bar" ? (
              <BarChart data={data.perMunicipality}>
                <XAxis dataKey="slug" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="dishes" />
                <Bar dataKey="restaurants" />
              </BarChart>
            ) : (
              <PieChart>
                <Pie data={data.perMunicipality} dataKey="dishes" nameKey="slug" outerRadius={80} label>
                  {data.perMunicipality.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Top dishes (signature/panel_rank)">
        <ul className="space-y-2">
          {data.topDishes.map((d: any) => (
            <li key={d.id} className="p-3 border rounded-md flex items-center justify-between">
              <div>
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-neutral-500">panel_rank: {d.panel_rank ?? "—"}</div>
              </div>
              <span className="text-xs px-2 py-1 bg-neutral-100 rounded">signature</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Top restaurants (featured/featured_rank)">
        <ul className="space-y-2">
          {data.topRestaurants.map((r: any) => (
            <li key={r.id} className="p-3 border rounded-md flex items-center justify-between">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-neutral-500">featured_rank: {r.featured_rank ?? "—"}</div>
              </div>
              <span className="text-xs px-2 py-1 bg-neutral-100 rounded">featured</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* ========================== Dishes CRUD ========================== */
function DishesTab() {
  const qc = useQueryClient();
  const writable = useWriteEnabled();
  const [muniId, setMuniId] = useState<number|null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Dish|null>(null);

  const dishQ = useQuery({
    queryKey: ["dishes", muniId, q],
    queryFn: () => listDishes({ municipalityId: muniId ?? undefined, q: q || undefined }),
  });

  const save = useMutation({
    mutationFn: async (payload: Partial<Dish>) => {
      if (!writable) throw new Error("Admin backend not running");
      if (editing) return updateDish(editing.id, payload);
      return createDish(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setEditing(null); }
  });
  const del = useMutation({
    mutationFn: async (id: number) => {
      if (!writable) throw new Error("Admin backend not running");
      return deleteDish(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dishes"] })
  });

  const [autoSlug, setAutoSlug] = useState(true);
  function slugify(s: string) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  const [form, setForm] = useState<Partial<Dish>>({
    name: "", slug: "", category: "food", municipality_id: null, description: "", image_url: "",
    flavor_profile: null, ingredients: null, is_signature: 0, panel_rank: null
  });

  function startEdit(d: Dish) {
    setEditing(d);
    setForm({
      ...d,
      flavor_profile: toArr(d.flavor_profile) ?? null,
      ingredients: toArr(d.ingredients) ?? null,
    });
  }

  function resetForm() {
    setEditing(null);
    setForm({ name: "", slug: "", category: "food", municipality_id: null, description: "", image_url: "", flavor_profile: null, ingredients: null, is_signature: 0, panel_rank: null });
  }

  const list = (dishQ.data ?? []).filter(d => !q || d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section
        title="Find or create dishes"
        right={
          <div className="flex items-center gap-2">
            <MuniSelect value={muniId} onChange={setMuniId} />
            <input className="border rounded px-2 py-1" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
        }
      >
        <div className="max-h-[430px] overflow-auto divide-y">
          {list.map(d => (
            <button
              key={d.id}
              onClick={()=>startEdit(d)}
              className="w-full text-left p-3 hover:bg-neutral-50 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-neutral-500">{d.slug} • {d.category}</div>
              </div>
              {(d.is_signature === 1) && <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 border border-amber-200">signature #{d.panel_rank ?? "?"}</span>}
            </button>
          ))}
          {list.length === 0 && <div className="p-4 text-sm text-neutral-500">No dishes</div>}
        </div>
      </Section>

      <Section
        title={editing ? `Edit dish: ${editing.name}` : "Create dish"}
        right={!writable && <span className="text-xs px-2 py-1 rounded bg-neutral-100 border">Writes disabled (admin API off)</span>}
      >
        <form
          onSubmit={e=>{ e.preventDefault(); save.mutate(form); }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Name
              <input className="mt-1 w-full border rounded px-2 py-1" required
                value={form.name ?? ""}
                onChange={e=>{
                  const name = e.target.value;
                  setForm(f => ({...f, name, slug: autoSlug ? slugify(name) : (f.slug ?? "")}));
                }} />
            </label>
            <label className="text-sm flex items-end gap-2">
              <span>Slug</span>
              <input className="flex-1 border rounded px-2 py-1" required
                value={form.slug ?? ""}
                onChange={e=>{ setForm(f=>({...f, slug: e.target.value})); setAutoSlug(false); }} />
              <label className="text-xs flex items-center gap-1">
                <input type="checkbox" checked={autoSlug} onChange={e=>setAutoSlug(e.target.checked)} />
                auto
              </label>
            </label>
            <label className="text-sm">Municipality
              <MuniSelect value={form.municipality_id ?? null} onChange={(v)=>setForm(f=>({...f, municipality_id: v}))} allowAll={false}/>
            </label>
            <label className="text-sm">Category
              <select className="mt-1 w-full border rounded px-2 py-1" value={form.category ?? "food"} onChange={e=>setForm(f=>({...f, category: e.target.value as any}))}>
                <option value="food">Food</option>
                <option value="delicacy">Delicacy</option>
                <option value="drink">Drink</option>
              </select>
            </label>
            <label className="col-span-2 text-sm">Image URL
              <input className="mt-1 w-full border rounded px-2 py-1" value={form.image_url ?? ""} onChange={e=>setForm(f=>({...f, image_url: e.target.value}))}/>
            </label>
            <label className="col-span-2 text-sm">Description
              <textarea className="mt-1 w-full border rounded px-2 py-1" rows={3} value={form.description ?? ""} onChange={e=>setForm(f=>({...f, description: e.target.value}))}/>
            </label>
            <label className="text-sm">Flavor profile (csv)
              <input className="mt-1 w-full border rounded px-2 py-1"
                value={(form.flavor_profile ?? []).join?.(", ") ?? ""}
                onChange={e=>setForm(f=>({...f, flavor_profile: toArr(e.target.value)}))}/>
            </label>
            <label className="text-sm">Ingredients (csv)
              <input className="mt-1 w-full border rounded px-2 py-1"
                value={(form.ingredients ?? []).join?.(", ") ?? ""}
                onChange={e=>setForm(f=>({...f, ingredients: toArr(e.target.value)}))}/>
            </label>
            <label className="text-sm">Signature?
              <select className="mt-1 w-full border rounded px-2 py-1" value={form.is_signature ?? 0} onChange={e=>setForm(f=>({...f, is_signature: Number(e.target.value) as 0|1}))}>
                <option value={0}>No</option>
                <option value={1}>Yes</option>
              </select>
            </label>
            <label className="text-sm">Panel rank
              <input type="number" className="mt-1 w-full border rounded px-2 py-1" value={form.panel_rank ?? ""} onChange={e=>setForm(f=>({...f, panel_rank: e.target.value ? Number(e.target.value) : null}))}/>
            </label>
          </div>

          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50" disabled={!writable || save.isLoading} type="submit">
              {editing ? "Save" : "Create"}
            </button>
            {editing && (
              <>
                <button type="button" className="px-3 py-1.5 rounded border" onClick={resetForm}>Cancel</button>
                <button type="button" className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50"
                  disabled={!writable || del.isLoading}
                  onClick={()=>editing && del.mutate(editing.id)}
                >Delete</button>
              </>
            )}
          </div>
          {(save.isError || del.isError) && <div className="text-sm text-red-600">Action failed: {(save.error as any)?.message || (del.error as any)?.message}</div>}
        </form>
      </Section>
    </div>
  );
}

/* ========================== Restaurants CRUD ========================== */
function RestaurantsTab() {
  const qc = useQueryClient();
  const writable = useWriteEnabled();
  const [muniId, setMuniId] = useState<number|null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Restaurant|null>(null);

  const restQ = useQuery({
    queryKey: ["restaurants", muniId, q],
    queryFn: () => listRestaurants({ municipalityId: muniId ?? undefined, q: q || undefined }),
  });

  const save = useMutation({
    mutationFn: async (payload: Partial<Restaurant>) => {
      if (!writable) throw new Error("Admin backend not running");
      if (editing) return updateRestaurant(editing.id, payload);
      return createRestaurant(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurants"] }); setEditing(null); }
  });
  const del = useMutation({
    mutationFn: async (id: number) => {
      if (!writable) throw new Error("Admin backend not running");
      return deleteRestaurant(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["restaurants"] })
  });

  const [autoSlug, setAutoSlug] = useState(true);
  function slugify(s: string) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  const [form, setForm] = useState<Partial<Restaurant>>({
    name: "", slug: "", municipality_id: null, address: "", lat: 0, lng: 0,
    cuisine_types: null, kind: "restaurant", description: "", image_url: "",
    featured: 0, featured_rank: null,
  });

  function startEdit(r: Restaurant) {
    setEditing(r);
    setForm({
      ...r,
      cuisine_types: toArr(r.cuisine_types) ?? null,
    });
  }

  function resetForm() {
    setEditing(null);
    setForm({
      name: "", slug: "", municipality_id: null, address: "", lat: 0, lng: 0,
      cuisine_types: null, kind: "restaurant", description: "", image_url: "",
      featured: 0, featured_rank: null,
    });
  }

  const list = (restQ.data ?? []).filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section
        title="Find or create restaurants"
        right={
          <div className="flex items-center gap-2">
            <MuniSelect value={muniId} onChange={setMuniId} />
            <input className="border rounded px-2 py-1" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
        }
      >
        <div className="max-h-[430px] overflow-auto divide-y">
          {list.map(r => (
            <button
              key={r.id}
              onClick={()=>startEdit(r)}
              className="w-full text-left p-3 hover:bg-neutral-50 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-neutral-500">{r.slug}</div>
              </div>
              {(r.featured === 1) && <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">featured #{r.featured_rank ?? "?"}</span>}
            </button>
          ))}
          {list.length === 0 && <div className="p-4 text-sm text-neutral-500">No restaurants</div>}
        </div>
      </Section>

      <Section
        title={editing ? `Edit restaurant: ${editing.name}` : "Create restaurant"}
        right={!writable && <span className="text-xs px-2 py-1 rounded bg-neutral-100 border">Writes disabled (admin API off)</span>}
      >
        <form onSubmit={e=>{ e.preventDefault(); save.mutate(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Name
              <input className="mt-1 w-full border rounded px-2 py-1" required
                value={form.name ?? ""}
                onChange={e=>{
                  const name = e.target.value;
                  setForm(f => ({...f, name, slug: autoSlug ? slugify(name) : (f.slug ?? "")}));
                }}/>
            </label>
            <label className="text-sm flex items-end gap-2">
              <span>Slug</span>
              <input className="flex-1 border rounded px-2 py-1" required
                value={form.slug ?? ""}
                onChange={e=>{ setForm(f=>({...f, slug: e.target.value})); setAutoSlug(false); }} />
              <label className="text-xs flex items-center gap-1">
                <input type="checkbox" checked={autoSlug} onChange={e=>setAutoSlug(e.target.checked)} />
                auto
              </label>
            </label>
            <label className="text-sm">Municipality
              <MuniSelect value={form.municipality_id ?? null} onChange={(v)=>setForm(f=>({...f, municipality_id: v}))} allowAll={false}/>
            </label>
            <label className="text-sm">Kind
              <select className="mt-1 w-full border rounded px-2 py-1" value={form.kind ?? "restaurant"} onChange={e=>setForm(f=>({...f, kind: e.target.value}))}>
                <option>restaurant</option><option>stall</option><option>store</option><option>dealer</option><option>market</option><option>home-based</option>
              </select>
            </label>
            <label className="col-span-2 text-sm">Address
              <input className="mt-1 w-full border rounded px-2 py-1" value={form.address ?? ""} onChange={e=>setForm(f=>({...f, address: e.target.value}))}/>
            </label>
            <label className="text-sm">Lat
              <input type="number" step="any" className="mt-1 w-full border rounded px-2 py-1" value={form.lat ?? 0} onChange={e=>setForm(f=>({...f, lat: Number(e.target.value)}))}/>
            </label>
            <label className="text-sm">Lng
              <input type="number" step="any" className="mt-1 w-full border rounded px-2 py-1" value={form.lng ?? 0} onChange={e=>setForm(f=>({...f, lng: Number(e.target.value)}))}/>
            </label>
            <label className="col-span-2 text-sm">Image URL
              <input className="mt-1 w-full border rounded px-2 py-1" value={form.image_url ?? ""} onChange={e=>setForm(f=>({...f, image_url: e.target.value}))}/>
            </label>
            <label className="col-span-2 text-sm">Description
              <textarea className="mt-1 w-full border rounded px-2 py-1" rows={3} value={form.description ?? ""} onChange={e=>setForm(f=>({...f, description: e.target.value}))}/>
            </label>
            <label className="text-sm">Cuisine types (csv)
              <input className="mt-1 w-full border rounded px-2 py-1"
                value={(form.cuisine_types ?? []).join?.(", ") ?? ""}
                onChange={e=>setForm(f=>({...f, cuisine_types: toArr(e.target.value)}))}/>
            </label>
            <label className="text-sm">Featured?
              <select className="mt-1 w-full border rounded px-2 py-1" value={form.featured ?? 0} onChange={e=>setForm(f=>({...f, featured: Number(e.target.value) as 0|1}))}>
                <option value={0}>No</option>
                <option value={1}>Yes</option>
              </select>
            </label>
            <label className="text-sm">Featured rank
              <input type="number" className="mt-1 w-full border rounded px-2 py-1" value={form.featured_rank ?? ""} onChange={e=>setForm(f=>({...f, featured_rank: e.target.value ? Number(e.target.value) : null}))}/>
            </label>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50" disabled={!writable || save.isLoading} type="submit">
              {editing ? "Save" : "Create"}
            </button>
            {editing && (
              <>
                <button type="button" className="px-3 py-1.5 rounded border" onClick={resetForm}>Cancel</button>
                <button type="button" className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50"
                  disabled={!writable || del.isLoading}
                  onClick={()=>editing && del.mutate(editing.id)}
                >Delete</button>
              </>
            )}
          </div>
          {(save.isError || del.isError) && <div className="text-sm text-red-600">Action failed: {(save.error as any)?.message || (del.error as any)?.message}</div>}
        </form>
      </Section>
    </div>
  );
}

/* ========================== Linking (1 dish → many restaurants) ========================== */
function LinkingTab() {
  const writable = useWriteEnabled();
  const [muniId, setMuniId] = useState<number|null>(null);
  const [activeDish, setActiveDish] = useState<Dish|null>(null);

  const dishQ = useQuery({ queryKey: ["link:dishes", muniId], queryFn: ()=>listDishes({ municipalityId: muniId ?? undefined }) });
  const restQ = useQuery({ queryKey: ["link:restaurants", muniId], queryFn: ()=>listRestaurants({ municipalityId: muniId ?? undefined }) });

  const linkedQ = useQuery({
    queryKey: ["link:linked-rest-for-dish", activeDish?.id],
    queryFn: () => activeDish ? linkedRestaurantsForDish(activeDish.id) : Promise.resolve([] as Restaurant[]),
    enabled: !!activeDish,
  });

  const qc = useQueryClient();
  const doLink = useMutation({
    mutationFn: async (rid: number) => {
      if (!activeDish) throw new Error("No dish selected");
      if (!writable) throw new Error("Admin backend not running");
      return linkDishRestaurant(activeDish.id, rid);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["link:linked-rest-for-dish"] }),
  });

  const doUnlink = useMutation({
    mutationFn: async (rid: number) => {
      if (!activeDish) throw new Error("No dish selected");
      if (!writable) throw new Error("Admin backend not running");
      return unlinkDishRestaurant(activeDish.id, rid);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["link:linked-rest-for-dish"] }),
  });

  const linkedIds = new Set((linkedQ.data ?? []).map(r => r.id));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section
        title="Pick a dish"
        right={<MuniSelect value={muniId} onChange={setMuniId} />}
      >
        <div className="max-h-[430px] overflow-auto divide-y">
          {(dishQ.data ?? []).map(d => (
            <button key={d.id} onClick={()=>setActiveDish(d)} className={`w-full text-left p-3 hover:bg-neutral-50 ${activeDish?.id===d.id?"bg-neutral-50":""}`}>
              <div className="font-medium">{d.name}</div>
              <div className="text-xs text-neutral-500">{d.slug}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section
        title={activeDish ? `Link restaurants to: ${activeDish.name}` : "Select a dish to start linking"}
        right={!writable && <span className="text-xs px-2 py-1 rounded bg-neutral-100 border">Writes disabled (admin API off)</span>}
      >
        {!activeDish ? (
          <div className="text-sm text-neutral-500">Pick a dish on the left.</div>
        ) : (
          <div className="max-h-[430px] overflow-auto divide-y">
            {(restQ.data ?? []).map(r => {
              const on = linkedIds.has(r.id);
              return (
                <label key={r.id} className="flex items-center gap-3 p-3">
                  <input type="checkbox" disabled={!writable || doLink.isLoading || doUnlink.isLoading}
                    checked={on}
                    onChange={(e)=> e.target.checked ? doLink.mutate(r.id) : doUnlink.mutate(r.id) } />
                  <div className="flex-1">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-neutral-500">{r.slug}</div>
                  </div>
                  {on && <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">linked</span>}
                </label>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ========================== Curation ========================== */
function CurationTab() {
  const writable = useWriteEnabled();
  const [muniId, setMuniId] = useState<number|null>(null);

  const dishQ = useQuery({ queryKey: ["cur:dishes", muniId], queryFn: ()=>listDishes({ municipalityId: muniId ?? undefined }) });
  const restQ = useQuery({ queryKey: ["cur:restaurants", muniId], queryFn: ()=>listRestaurants({ municipalityId: muniId ?? undefined }) });

  const qc = useQueryClient();
  const setDish = useMutation({
    mutationFn: (p: { id:number, is_signature?: 0|1, panel_rank?: number|null }) => setDishCuration(p.id, { is_signature: p.is_signature, panel_rank: p.panel_rank }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cur:dishes"] }),
  });
  const setRest = useMutation({
    mutationFn: (p: { id:number, featured?: 0|1, featured_rank?: number|null }) => setRestaurantCuration(p.id, { featured: p.featured, featured_rank: p.featured_rank }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cur:restaurants"] }),
  });

  const sig = useMemo(() =>
    [...(dishQ.data ?? [])].filter(d=>d.is_signature===1).sort((a,b)=>(a.panel_rank??99)-(b.panel_rank??99)).slice(0,3)
  , [dishQ.data]);

  const feat = useMemo(() =>
    [...(restQ.data ?? [])].filter(r=>(r.featured??0)===1).sort((a,b)=>(a.featured_rank??99)-(b.featured_rank??99)).slice(0,3)
  , [restQ.data]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="Municipality" right={<MuniSelect value={muniId} onChange={setMuniId} />}>
        <div className="text-sm text-neutral-500">Choose a municipality to curate its Top 3.</div>
      </Section>

      <Section title="Top 3 dishes" right={!writable && <span className="text-xs px-2 py-1 rounded bg-neutral-100 border">Writes disabled</span>}>
        <div className="space-y-2">
          {(dishQ.data ?? []).map(d => (
            <div key={d.id} className="p-2 border rounded flex items-center gap-3">
              <select className="border rounded px-1 py-0.5"
                value={d.is_signature ?? 0}
                onChange={e=>setDish.mutate({ id: d.id, is_signature: Number(e.target.value) as 0|1 })} disabled={!writable}>
                <option value={0}>Not top</option>
                <option value={1}>Top</option>
              </select>
              <input type="number" className="border rounded px-2 py-1 w-20"
                placeholder="rank"
                value={d.panel_rank ?? ""}
                onChange={e=>setDish.mutate({ id: d.id, panel_rank: e.target.value ? Number(e.target.value) : null })} disabled={!writable}/>
              <div className="flex-1">
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-neutral-500">{d.slug}</div>
              </div>
              {(d.is_signature===1) && <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 border border-amber-200">rank {d.panel_rank ?? "?"}</span>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Top 3 restaurants" right={!writable && <span className="text-xs px-2 py-1 rounded bg-neutral-100 border">Writes disabled</span>}>
        <div className="space-y-2">
          {(restQ.data ?? []).map(r => (
            <div key={r.id} className="p-2 border rounded flex items-center gap-3">
              <select className="border rounded px-1 py-0.5"
                value={r.featured ?? 0}
                onChange={e=>setRest.mutate({ id: r.id, featured: Number(e.target.value) as 0|1 })} disabled={!writable}>
                <option value={0}>Not top</option>
                <option value={1}>Top</option>
              </select>
              <input type="number" className="border rounded px-2 py-1 w-20"
                placeholder="rank"
                value={r.featured_rank ?? ""}
                onChange={e=>setRest.mutate({ id: r.id, featured_rank: e.target.value ? Number(e.target.value) : null })} disabled={!writable}/>
              <div className="flex-1">
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-neutral-500">{r.slug}</div>
              </div>
              {(r.featured===1) && <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">rank {r.featured_rank ?? "?"}</span>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ========================== Page wrapper with tabs ========================== */
export default function AdminDashboard() {
  const [tab, setTab] = useState<"analytics"|"dishes"|"restaurants"|"linking"|"curation">("analytics");
  const writable = useWriteEnabled();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        {!writable && (
          <div className="text-xs px-3 py-1 rounded bg-yellow-50 border border-yellow-200 text-yellow-900">
            Admin writes disabled. Start admin API at <code>VITE_ADMIN_API_URL</code> to enable create/edit/delete/linking/curation.
          </div>
        )}
      </div>

      <nav className="flex gap-2 text-sm">
        {(["analytics","dishes","restaurants","linking","curation"] as const).map(k => (
          <button key={k}
            className={`px-3 py-1.5 rounded border ${tab===k ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
            onClick={()=>setTab(k)}>
            {k[0].toUpperCase()+k.slice(1)}
          </button>
        ))}
      </nav>

      {tab === "analytics" && <AnalyticsTab />}
      {tab === "dishes" && <DishesTab />}
      {tab === "restaurants" && <RestaurantsTab />}
      {tab === "linking" && <LinkingTab />}
      {tab === "curation" && <CurationTab />}
    </div>
  );
}
