// src/pages/admin/AdminDashboard.tsx — UI polish pass
// NOTE: purely visual/interactive upgrades; data flow & API calls unchanged.

import React, { useMemo, useState } from "react";
import { Card, Toolbar, Button, Input, KPI, Badge, ScrollArea } from "../ui";
import {
  listMunicipalities, listDishes, listRestaurants,
  createDish, updateDish, deleteDish,
  createRestaurant, updateRestaurant, deleteRestaurant,
  listRestaurantsForDish, linkDishRestaurant, unlinkDishRestaurant,
  setDishCuration, setRestaurantCuration,
  getAnalyticsSummary, getPerMunicipalityCounts,
  type Municipality, type Dish, type Restaurant,
  coerceStringArray, slugify
} from "../../utils/adminApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from "recharts";

/* -------------------- tiny helpers -------------------- */
const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
const confirmThen = (msg: string) => Promise.resolve(window.confirm(msg));
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function ChartShell({ children, height = 420 }: { children: React.ReactNode; height?: number }) {
  const [k, setK] = useState(0);
  React.useEffect(() => { const id = setTimeout(() => setK(1), 60); return () => clearTimeout(id); }, []);
  return (
    <Card className="p-3">
      <div style={{ height }}>
        <ResponsiveContainer key={k} width="100%" height="100%" debounce={150}>
          {children as any}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl" onClick={(e)=>e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function Field({ label, hint, children, error }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="text-xs font-medium text-neutral-600 mb-1">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-neutral-500 mt-1">{hint}</div>}
      {error && <div className="text-[12px] text-red-600 mt-1">{error}</div>}
    </label>
  );
}

/* ======================================================
   Analytics (UI-polished)
   ====================================================== */
function AnalyticsTab() {
  const summaryQ = useQuery({ queryKey: ["analytics:summary"], queryFn: getAnalyticsSummary, staleTime: 120_000 });
  const perMuniQ = useQuery({ queryKey: ["analytics:per-muni"], queryFn: getPerMunicipalityCounts, staleTime: 120_000 });

  const [type, setType] = useState<"bar" | "line" | "pie">("bar");
  const [stacked, setStacked] = useState(false);

  const counts = (summaryQ.data as any)?.counts ?? summaryQ.data ?? { dishes: 0, restaurants: 0, municipalities: 0 };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPI label="Dishes" value={counts.dishes} />
        <KPI label="Restaurants" value={counts.restaurants} />
        <KPI label="Municipalities" value={counts.municipalities} />
      </div>

      <Card
        title="Per-municipality totals"
        toolbar={
          <div className="flex gap-2">
            {["bar","line","pie"].map((t)=> (
              <Button key={t} size="sm" variant={type===t?"primary":"default"} onClick={()=>setType(t as any)}>{t}</Button>
            ))}
            {type === "bar" && (
              <Button size="sm" variant={stacked?"primary":"default"} onClick={()=>setStacked(s=>!s)}>{stacked?"Unstack":"Stack"}</Button>
            )}
          </div>
        }
      >
        {summaryQ.isLoading || perMuniQ.isLoading ? (
          <div className="h-[440px] bg-neutral-100 animate-pulse rounded-xl" />
        ) : (
          <ChartShell height={440}>
            {type === "pie" ? (
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie data={(perMuniQ.data ?? []).map((r)=>({ name:r.municipality_name, value:r.dishes }))} dataKey="value" nameKey="name" outerRadius={110} />
                <Pie data={(perMuniQ.data ?? []).map((r)=>({ name:r.municipality_name, value:r.restaurants }))} dataKey="value" nameKey="name" innerRadius={120} outerRadius={160} />
              </PieChart>
            ) : type === "line" ? (
              <LineChart data={(perMuniQ.data ?? []).map((r)=>({ name:r.municipality_name, dishes:r.dishes, restaurants:r.restaurants }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="dishes" />
                <Line type="monotone" dataKey="restaurants" />
              </LineChart>
            ) : (
              <BarChart data={(perMuniQ.data ?? []).map((r)=>({ name:r.municipality_name, dishes:r.dishes, restaurants:r.restaurants }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Legend />
                {stacked ? (
                  <>
                    <Bar dataKey="dishes" stackId="a" />
                    <Bar dataKey="restaurants" stackId="a" />
                  </>
                ) : (
                  <>
                    <Bar dataKey="dishes" />
                    <Bar dataKey="restaurants" />
                  </>
                )}
              </BarChart>
            )}
          </ChartShell>
        )}
      </Card>
    </div>
  );
}

/* ======================================================
   Dishes (UI-polished, logic preserved)
   ====================================================== */
function DishesTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", slug: "", category: "food", municipality_id: 0, rating: null, popularity: null, autoSlug: true });
  const [serverError, setServerError] = useState<string | null>(null);

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const dishesQ = useQuery({ queryKey: ["dishes", q], queryFn: () => listDishes({ q }), keepPreviousData: true });

  const createM = useMutation({
    mutationFn: (payload: any) => createDish(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setForm({ name: "", slug: "", category: "food", municipality_id: 0, rating: null, popularity: null, autoSlug: true }); setServerError(null); alert("Dish created."); },
    onError: (e: any) => setServerError(e?.message || "Create failed."),
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: any }) => updateDish(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setEditOpen(false); setServerError(null); alert("Dish saved."); },
    onError: (e: any) => setServerError(e?.message || "Update failed."),
  });
  const deleteM = useMutation({ mutationFn: (id: number) => deleteDish(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); alert("Dish deleted."); } });

  function setName(name: string) {
    setForm((f: any) => ({ ...f, name, slug: f.autoSlug ? slugify(name) : f.slug }));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card title="Create Dish" className="lg:col-span-1">
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e)=>setName(e.target.value)} /></Field>
          <div className="flex items-center gap-2 -mt-2"><input id="autoslug" type="checkbox" checked={!!form.autoSlug} onChange={(e)=>setForm((f:any)=>({ ...f, autoSlug: e.target.checked }))} /><label htmlFor="autoslug" className="text-sm text-neutral-600 select-none">Auto-generate slug</label></div>
          <Field label="Slug"><Input value={form.slug} onChange={(e)=>setForm((f:any)=>({ ...f, slug: e.target.value }))} /></Field>
          <Field label="Municipality">
            <select className="w-full rounded-xl border px-3 py-2" value={form.municipality_id} onChange={(e)=>setForm((f:any)=>({ ...f, municipality_id: Number(e.target.value) }))}>
              <option value={0}>Select…</option>
              {(muniQ.data ?? []).map((m)=> <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select className="w-full rounded-xl border px-3 py-2" value={form.category} onChange={(e)=>setForm((f:any)=>({ ...f, category: e.target.value }))}>
              <option value="food">Food</option><option value="delicacy">Delicacy</option><option value="drink">Drink</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Rating (0–5)"><Input type="number" step="0.1" min={0} max={5} value={form.rating ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, rating: e.target.value===""?null: Number(e.target.value) }))} /></Field>
            <Field label="Popularity (0–100)"><Input type="number" min={0} max={100} value={form.popularity ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, popularity: e.target.value===""?null: Number(e.target.value) }))} /></Field>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" disabled={createM.isPending} onClick={()=>{
              createM.mutate({
                name: String(form.name), slug: String(form.slug), municipality_id: Number(form.municipality_id), category: form.category,
                rating: form.rating==null?null: clamp(Number(form.rating),0,5), popularity: form.popularity==null?null: clamp(Number(form.popularity),0,100)
              });
            }}>Save</Button>
            <Button variant="soft" onClick={()=>{ setForm({ name:"", slug:"", category:"food", municipality_id:0, rating:null, popularity:null, autoSlug:true }); setServerError(null); }}>Reset</Button>
          </div>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        </div>
      </Card>

      <Card className="lg:col-span-2" toolbar={<Input placeholder="Search dishes…" value={q} onChange={(e)=>setQ(e.target.value)} />}>
        {!dishesQ.data ? (
          <div className="grid md:grid-cols-2 gap-3">
            {Array.from({length:6}).map((_,i)=> <div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse" />)}
          </div>
        ) : (dishesQ.data.length === 0 ? (
          <div className="text-sm text-neutral-500">No dishes found.</div>
        ) : (
          <ScrollArea height={520}>
            <div className="grid md:grid-cols-2 gap-3 pr-1">
              {(dishesQ.data ?? []).map((d) => (
                <div key={d.id} className="border rounded-xl p-4 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {d.name}
                        {d.is_signature ? <Badge variant="solid">Signature</Badge> : null}
                        {d.panel_rank ? <Badge variant="solid">Top {d.panel_rank}</Badge> : null}
                      </div>
                      <div className="text-xs text-neutral-500">{d.slug} • {d.category}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setServerError(null); setEditOpen(true); setForm({ ...d, autoSlug:false }); }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={async ()=>{ if(await confirmThen(`Delete ${d.name}?`)) deleteM.mutate(d.id); }}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ))}
      </Card>

      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title="Edit Dish">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name"><Input value={form.name ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, name: e.target.value }))} /></Field>
          <Field label="Slug"><Input value={form.slug ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, slug: e.target.value }))} /></Field>
          <Field label="Municipality">
            <select className="w-full rounded-xl border px-3 py-2" value={form.municipality_id ?? 0} onChange={(e)=>setForm((f:any)=>({ ...f, municipality_id: Number(e.target.value) }))}>
              <option value={0}>Select…</option>
              {/* optional: prefill from cache if needed */}
            </select>
          </Field>
          <Field label="Category">
            <select className="w-full rounded-xl border px-3 py-2" value={form.category ?? "food"} onChange={(e)=>setForm((f:any)=>({ ...f, category: e.target.value }))}>
              <option value="food">Food</option><option value="delicacy">Delicacy</option><option value="drink">Drink</option>
            </select>
          </Field>
          <Field label="Image URL"><Input value={form.image_url ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, image_url: e.target.value }))} /></Field>
          <Field label="Rating (0–5)"><Input type="number" min={0} max={5} step="0.1" value={form.rating ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, rating: e.target.value===""?null: clamp(Number(e.target.value),0,5) }))} /></Field>
          <Field label="Popularity (0–100)"><Input type="number" min={0} max={100} value={form.popularity ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, popularity: e.target.value===""?null: clamp(Number(e.target.value),0,100) }))} /></Field>
          <Field label="Flavor profile (comma separated)"><Input value={(Array.isArray(form.flavor_profile)? form.flavor_profile.join(", ") : (form.flavor_profile ?? "")) as string} onChange={(e)=>setForm((f:any)=>({ ...f, flavor_profile: e.target.value }))} /></Field>
          <Field label="Ingredients (comma separated)"><Input value={(Array.isArray(form.ingredients)? form.ingredients.join(", ") : (form.ingredients ?? "")) as string} onChange={(e)=>setForm((f:any)=>({ ...f, ingredients: e.target.value }))} /></Field>
          <Field label="Description"><textarea className="w-full rounded-xl border px-3 py-2" value={form.description ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, description: e.target.value }))} /></Field>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={()=>{ if(!form.id) return; updateM.mutate({ id: form.id, payload: { ...form, flavor_profile: coerceStringArray(form.flavor_profile), ingredients: coerceStringArray(form.ingredients) } }); }}>Save</Button>
          <Button onClick={()=>setEditOpen(false)}>Cancel</Button>
        </div>
        {serverError && <p className="text-sm text-red-600 mt-2">{serverError}</p>}
      </Modal>
    </div>
  );
}

/* ======================================================
   Restaurants (UI-polished, logic preserved)
   ====================================================== */
function RestaurantsTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", slug: "", municipality_id: 0, address: "", lat: 0, lng: 0, rating: null, autoSlug: true });
  const [serverError, setServerError] = useState<string | null>(null);

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const restQ = useQuery({ queryKey: ["rests", q], queryFn: () => listRestaurants({ q }), keepPreviousData: true });

  const createM = useMutation({
    mutationFn: (payload: any) => createRestaurant(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rests"] }); setForm({ name: "", slug: "", municipality_id: 0, address: "", lat: 0, lng: 0, rating: null, autoSlug: true }); setServerError(null); alert("Restaurant created."); }
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: any }) => updateRestaurant(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rests"] }); setEditOpen(false); setServerError(null); alert("Restaurant saved."); }
  });
  const deleteM = useMutation({ mutationFn: (id: number) => deleteRestaurant(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["rests"] }); alert("Restaurant deleted."); } });

  function setName(name: string) {
    setForm((f: any) => ({ ...f, name, slug: f.autoSlug ? slugify(name) : f.slug }));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card title="Create Restaurant" className="lg:col-span-1">
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e)=>setName(e.target.value)} /></Field>
          <div className="flex items-center gap-2 -mt-2"><input id="autoslug2" type="checkbox" checked={!!form.autoSlug} onChange={(e)=>setForm((f:any)=>({ ...f, autoSlug: e.target.checked }))} /><label htmlFor="autoslug2" className="text-sm text-neutral-600 select-none">Auto-generate slug</label></div>
          <Field label="Slug"><Input value={form.slug} onChange={(e)=>setForm((f:any)=>({ ...f, slug: e.target.value }))} /></Field>
          <Field label="Municipality">
            <select className="w-full rounded-xl border px-3 py-2" value={form.municipality_id} onChange={(e)=>setForm((f:any)=>({ ...f, municipality_id: Number(e.target.value) }))}>
              <option value={0}>Select…</option>
              {(muniQ.data ?? []).map((m)=> <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
            </select>
          </Field>
          <Field label="Address"><Input value={form.address} onChange={(e)=>setForm((f:any)=>({ ...f, address: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Lat"><Input type="number" step="any" value={form.lat ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, lat: e.target.value===""? null: Number(e.target.value) }))} /></Field>
            <Field label="Lng"><Input type="number" step="any" value={form.lng ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, lng: e.target.value===""? null: Number(e.target.value) }))} /></Field>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={()=>{
              createM.mutate({
                name: String(form.name), slug: String(form.slug), municipality_id: Number(form.municipality_id), address: String(form.address),
                lat: Number(form.lat)||0, lng: Number(form.lng)||0, rating: form.rating==null?null: clamp(Number(form.rating),0,5)
              });
            }}>Save</Button>
            <Button variant="soft" onClick={()=>{ setForm({ name:"", slug:"", municipality_id:0, address:"", lat:0, lng:0, rating:null, autoSlug:true }); setServerError(null); }}>Reset</Button>
          </div>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        </div>
      </Card>

      <Card className="lg:col-span-2" toolbar={<Input placeholder="Search restaurants…" value={q} onChange={(e)=>setQ(e.target.value)} />}>
        {!restQ.data ? (
          <div className="grid md:grid-cols-2 gap-3">
            {Array.from({length:6}).map((_,i)=> <div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse" />)}
          </div>
        ) : (restQ.data.length === 0 ? (
          <div className="text-sm text-neutral-500">No restaurants found.</div>
        ) : (
          <ScrollArea height={520}>
            <div className="grid md:grid-cols-2 gap-3 pr-1">
              {(restQ.data ?? []).map((r) => (
                <div key={r.id} className="border rounded-xl p-4 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {r.name}
                        {r.featured ? <Badge variant="solid">Featured</Badge> : null}
                        {r.featured_rank ? <Badge variant="solid">Top {r.featured_rank}</Badge> : null}
                      </div>
                      <div className="text-xs text-neutral-500">{r.slug} • {r.address}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setServerError(null); setEditOpen(true); setForm({ ...r, autoSlug:false }); }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={async ()=>{ if(await confirmThen(`Delete ${r.name}?`)) deleteM.mutate(r.id); }}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ))}
      </Card>

      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title="Edit Restaurant">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name"><Input value={form.name ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, name: e.target.value }))} /></Field>
          <Field label="Slug"><Input value={form.slug ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, slug: e.target.value }))} /></Field>
          <Field label="Municipality">
            <select className="w-full rounded-xl border px-3 py-2" value={form.municipality_id ?? 0} onChange={(e)=>setForm((f:any)=>({ ...f, municipality_id: Number(e.target.value) }))}>
              <option value={0}>Select…</option>
              {(muniQ.data ?? []).map((m)=> <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
            </select>
          </Field>
          <Field label="Kind">
            <select className="w-full rounded-xl border px-3 py-2" value={(form.kind as any) ?? "restaurant"} onChange={(e)=>setForm((f:any)=>({ ...f, kind: e.target.value }))}>
              <option>restaurant</option><option>stall</option><option>store</option><option>dealer</option><option>market</option><option>home-based</option>
            </select>
          </Field>
          <Field label="Image URL"><Input value={form.image_url ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, image_url: e.target.value }))} /></Field>
          <Field label="Address"><Input value={form.address ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, address: e.target.value }))} /></Field>
          <Field label="Lat"><Input type="number" step="any" value={form.lat ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, lat: e.target.value===""?null:Number(e.target.value) }))} /></Field>
          <Field label="Lng"><Input type="number" step="any" value={form.lng ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, lng: e.target.value===""?null:Number(e.target.value) }))} /></Field>
          <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, phone: e.target.value }))} /></Field>
          <Field label="Website"><Input value={form.website ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, website: e.target.value }))} /></Field>
          <Field label="Facebook"><Input value={form.facebook ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, facebook: e.target.value }))} /></Field>
          <Field label="Instagram"><Input value={form.instagram ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, instagram: e.target.value }))} /></Field>
          <Field label="Opening Hours"><Input value={form.opening_hours ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, opening_hours: e.target.value }))} /></Field>
          <Field label="Price Range">
            <select className="w-full rounded-xl border px-3 py-2" value={(form.price_range as any) ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, price_range: (e.target.value||null) }))}>
              <option value="">(none)</option><option value="budget">budget</option><option value="moderate">moderate</option><option value="expensive">expensive</option>
            </select>
          </Field>
          <Field label="Cuisine types (comma separated)"><Input value={(Array.isArray(form.cuisine_types)? form.cuisine_types.join(", ") : (form.cuisine_types ?? "")) as string} onChange={(e)=>setForm((f:any)=>({ ...f, cuisine_types: e.target.value }))} /></Field>
          <Field label="Rating (0–5)"><Input type="number" min={0} max={5} step="0.1" value={form.rating ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, rating: e.target.value===""?null: clamp(Number(e.target.value),0,5) }))} /></Field>
          <Field label="Description"><textarea className="w-full rounded-xl border px-3 py-2" value={form.description ?? ""} onChange={(e)=>setForm((f:any)=>({ ...f, description: e.target.value }))} /></Field>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={()=>{ if(!form.id) return; updateM.mutate({ id: form.id, payload: { ...form, cuisine_types: coerceStringArray(form.cuisine_types) } }); }}>Save</Button>
          <Button onClick={()=>setEditOpen(false)}>Cancel</Button>
        </div>
        {serverError && <p className="text-sm text-red-600 mt-2">{serverError}</p>}
      </Modal>
    </div>
  );
}

/* ======================================================
   Curation (UI-polished, logic preserved)
   ====================================================== */
function CurationTab() {
  const qc = useQueryClient();
  const [qDish, setQDish] = useState("");
  const [qRest, setQRest] = useState("");
  const [muniId, setMuniId] = useState<number | null>(null);
  const [category, setCategory] = useState<"all" | "food" | "delicacy" | "drink">("all");

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const dishesQ = useQuery({ queryKey: ["dishes", qDish, muniId, category], queryFn: () => listDishes({ q: qDish, municipalityId: muniId ?? undefined, category: category === "all" ? undefined : category }), keepPreviousData: true });
  const restsQ = useQuery({ queryKey: ["rests", qRest, muniId], queryFn: () => listRestaurants({ q: qRest, municipalityId: muniId ?? undefined }), keepPreviousData: true });

  const patchDishM = useMutation({ mutationFn: ({ id, payload }: { id: number, payload: any }) => setDishCuration(id, payload), onSuccess: () => qc.invalidateQueries({ queryKey: ["dishes"] }) });
  const patchRestM = useMutation({ mutationFn: ({ id, payload }: { id: number, payload: any }) => setRestaurantCuration(id, payload), onSuccess: () => qc.invalidateQueries({ queryKey: ["rests"] }) });

  async function setDishRank(d: Dish, rank: number | null) {
    const list = (dishesQ.data ?? []).filter((x:any) => !muniId || x.municipality_id === muniId);
    const conflict = rank ? list.find((x:any) => x.panel_rank === rank && x.id !== d.id) : null;
    if (conflict) {
      const ok = await confirmThen(`Replace "${conflict.name}" at TOP ${rank} with "${d.name}"?`);
      if (!ok) return;
      await patchDishM.mutateAsync({ id: conflict.id, payload: { panel_rank: null, is_signature: 0 as 0 } });
    }
    await patchDishM.mutateAsync({ id: d.id, payload: { panel_rank: rank, is_signature: rank ? 1 as 1 : 0 as 0 } });
  }
  async function setRestRank(r: Restaurant, rank: number | null) {
    const list = (restsQ.data ?? []).filter((x:any) => !muniId || x.municipality_id === muniId);
    const conflict = rank ? list.find((x:any) => x.featured_rank === rank && x.id !== r.id) : null;
    if (conflict) {
      const ok = await confirmThen(`Replace "${conflict.name}" at TOP ${rank} with "${r.name}"?`);
      if (!ok) return;
      await patchRestM.mutateAsync({ id: conflict.id, payload: { featured_rank: null, featured: 0 as 0 } });
    }
    await patchRestM.mutateAsync({ id: r.id, payload: { featured_rank: rank, featured: rank ? 1 as 1 : 0 as 0 } });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card title="Top Dishes/Delicacy" toolbar={
        <div className="flex gap-2">
          <select className="border rounded px-2 py-1 text-sm" value={muniId ?? 0} onChange={(e)=>setMuniId(Number(e.target.value)||null)}>
            <option value={0}>All municipalities</option>
            {(muniQ.data ?? []).map((m)=> <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="border rounded px-2 py-1 text-sm" value={category} onChange={(e)=>setCategory(e.target.value as any)}>
            <option value="all">All</option><option value="food">Food</option><option value="delicacy">Delicacy</option><option value="drink">Drink</option>
          </select>
        </div>
      }>
        <Input className="mb-3" placeholder="Search dishes…" value={qDish} onChange={(e)=>setQDish(e.target.value)} />
        <ScrollArea height={420}>
          <div className="grid sm:grid-cols-2 gap-3 pr-1">
            {(dishesQ.data ?? []).map((d)=> (
              <div key={d.id} className="border rounded-xl p-3 hover:shadow-sm transition">
                <div className="font-semibold">{d.name}</div>
                <div className="text-xs text-neutral-500">{d.category} • {(muniQ.data ?? []).find((m)=>m.id===d.municipality_id)?.name}</div>
                <div className="flex items-center gap-2 mt-2">
                  {[1,2,3].map((rank)=> (
                    <Button key={rank} size="sm" variant={d.panel_rank===rank?"primary":"default"} onClick={()=>setDishRank(d, d.panel_rank===rank?null:rank)}>Top {rank}</Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Card title="Top Restaurants" toolbar={
        <div className="flex gap-2">
          <select className="border rounded px-2 py-1 text-sm" value={muniId ?? 0} onChange={(e)=>setMuniId(Number(e.target.value)||null)}>
            <option value={0}>All municipalities</option>
            {(muniQ.data ?? []).map((m)=> <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      }>
        <Input className="mb-3" placeholder="Search restaurants…" value={qRest} onChange={(e)=>setQRest(e.target.value)} />
        <ScrollArea height={420}>
          <div className="grid sm:grid-cols-2 gap-3 pr-1">
            {(restsQ.data ?? []).map((r)=> (
              <div key={r.id} className="border rounded-xl p-3 hover:shadow-sm transition">
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-neutral-500">{(muniQ.data ?? []).find((m)=>m.id===(r.municipality_id ?? 0))?.name}</div>
                <div className="flex items-center gap-2 mt-2">
                  {[1,2,3].map((rank)=> (
                    <Button key={rank} size="sm" variant={(r as any).featured_rank===rank?"primary":"default"} onClick={()=>setRestRank(r, (r as any).featured_rank===rank?null:rank)}>Top {rank}</Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}

/* ======================================================
   Linking (UI-polished, logic preserved)
   ====================================================== */
function LinkingTab() {
  const [qDish, setQDish] = useState("");
  const [qRest, setQRest] = useState("");
  const [selDish, setSelDish] = useState<Dish | null>(null);
  const [filterMuni, setFilterMuni] = useState<number | null>(null);

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const dishesQ = useQuery({ queryKey: ["dishes", qDish], queryFn: () => listDishes({ q: qDish }) });
  const restsQ = useQuery({ queryKey: ["rests", qRest, filterMuni], queryFn: () => listRestaurants({ q: qRest, municipalityId: filterMuni ?? undefined }) });

  const linkedQ = useQuery({
    queryKey: ["linked-rests", selDish?.id],
    queryFn: () => (selDish ? listRestaurantsForDish(selDish.id) : Promise.resolve([])),
    enabled: !!selDish,
    retry: false,
  });

  const linkM = useMutation({ mutationFn: ({ dish_id, restaurant_id }: { dish_id: number; restaurant_id: number }) => linkDishRestaurant(dish_id, restaurant_id), onSuccess: () => linkedQ.refetch() });
  const unlinkM = useMutation({ mutationFn: ({ dish_id, restaurant_id }: { dish_id: number; restaurant_id: number }) => unlinkDishRestaurant(dish_id, restaurant_id), onSuccess: () => linkedQ.refetch() });

  const linkedIds = new Set((linkedQ.data ?? []).map((r: any) => r.id ?? r.restaurant_id ?? r));

  const restaurants = useMemo(() => {
    const all = restsQ.data ?? [];
    const linked = all.filter((r:any) => linkedIds.has(r.id));
    const unlinked = all.filter((r:any) => !linkedIds.has(r.id));
    return [...linked, ...unlinked];
  }, [restsQ.data, linkedIds]);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card title="Choose Dish" className="lg:col-span-1" toolbar={<Input placeholder="Search dishes…" value={qDish} onChange={(e)=>setQDish(e.target.value)} />}>
        <ScrollArea height={520}>
          <div className="space-y-2 pr-1">
            {(dishesQ.data ?? []).map((d)=> (
              <button key={d.id} className={cx("w-full text-left border rounded-lg p-2 hover:bg-neutral-50 transition ring-focus", selDish?.id===d.id && "border-neutral-900 bg-neutral-50")} onClick={()=>setSelDish(d)}>
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-neutral-500">{d.category}</div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Card title="Link Restaurants" className="lg:col-span-2"
        toolbar={
          <div className="flex gap-2 items-center">
            <select className="border rounded px-2 py-1 text-sm" value={filterMuni ?? 0} onChange={(e)=>setFilterMuni(Number(e.target.value)||null)}>
              <option value={0}>All municipalities</option>
              {(muniQ.data ?? []).map((m)=> <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <Input placeholder="Search restaurants…" value={qRest} onChange={(e)=>setQRest(e.target.value)} />
          </div>
        }
      >
        {!selDish ? (
          <div className="text-sm text-neutral-500">Select a dish first.</div>
        ) : (
          <ScrollArea height={520}>
            <div className="grid md:grid-cols-2 gap-3 pr-1">
              {restaurants.map((r:any)=>{
                const isLinked = linkedIds.has(r.id);
                return (
                  <div key={r.id} className={cx("border rounded-xl p-3 hover:shadow-sm transition", isLinked && "border-neutral-900") }>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold flex items-center gap-2">{r.name}{isLinked && <Badge variant="solid">Linked</Badge>}</div>
                        <div className="text-xs text-neutral-500">{(muniQ.data ?? []).find((m)=>m.id === (r.municipality_id ?? 0))?.name}</div>
                      </div>
                      <div className="flex gap-2">
                        {!isLinked ? (
                          <Button size="sm" onClick={()=> selDish && linkM.mutate({ dish_id: selDish.id, restaurant_id: r.id })}>Link</Button>
                        ) : (
                          <Button size="sm" variant="danger" onClick={()=> selDish && unlinkM.mutate({ dish_id: selDish.id, restaurant_id: r.id })}>Unlink</Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}

/* ======================================================
   Main Admin Dashboard with tabs (UI-polished)
   ====================================================== */
export default function AdminDashboard() {
  const [tab, setTab] = useState<"analytics" | "dishes" | "restaurants" | "curation" | "linking">("analytics");

  return (
    <div className="space-y-6">
      <Toolbar
        left={<div><h2 className="text-2xl font-bold">Admin Dashboard</h2><div className="text-sm text-neutral-500">Bulacan – Mapping Flavors</div></div>}
        right={
          <div className="flex gap-2">
            {(["analytics","dishes","restaurants","curation","linking"] as const).map((t)=> (
              <Button key={t} size="sm" variant={tab===t?"primary":"default"} onClick={()=>setTab(t)}>
                {t[0].toUpperCase()+t.slice(1)}
              </Button>
            ))}
          </div>
        }
      />

      {tab === "analytics" && <AnalyticsTab />}
      {tab === "dishes" && <DishesTab />}
      {tab === "restaurants" && <RestaurantsTab />}
      {tab === "curation" && <CurationTab />}
      {tab === "linking" && <LinkingTab />}
    </div>
  );
}
