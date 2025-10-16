// src/pages/admin/AdminDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
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
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from "recharts";

// ------------- helpers -------------
function cx(...xs: (string | false | null | undefined)[]) { return xs.filter(Boolean).join(" "); }
function confirmThen(msg: string): Promise<boolean> { return Promise.resolve(window.confirm(msg)); }

// Modal (basic)
function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button className="text-sm text-neutral-500 hover:text-neutral-800" onClick={onClose}>Close</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// Field
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="text-xs font-medium text-neutral-500 mb-1">{label}</div>
      {children}
    </label>
  );
}

// ------------- Analytics -------------
function AnalyticsTab() {
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const countsQ = useQuery({ queryKey: ["admin:analytics:per-muni"], queryFn: getPerMunicipalityCounts, staleTime: 60_000 });
  const summaryQ = useQuery({ queryKey: ["admin:analytics:summary"], queryFn: getAnalyticsSummary, staleTime: 60_000 });

  const data = countsQ.data ?? [];
  const colors = ["#6366F1", "#22C55E", "#F59E0B", "#EC4899", "#06B6D4", "#F43F5E", "#84CC16"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">Per Municipality Status</h3>
        <div className="ml-auto flex gap-2">
          {(["bar", "line", "pie"] as const).map((t) => (
            <button key={t}
              className={cx("px-3 py-1 rounded border text-sm", chartType === t && "bg-neutral-900 text-white")}
              onClick={() => setChartType(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 bg-white rounded-xl border p-3">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" && (
            <BarChart data={data}>
              <XAxis dataKey="municipality_name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="dishes" fill="#6366F1" name="Dishes" />
              <Bar dataKey="restaurants" fill="#22C55E" name="Restaurants" />
            </BarChart>
          )}
          {chartType === "line" && (
            <LineChart data={data}>
              <XAxis dataKey="municipality_name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="dishes" stroke="#6366F1" name="Dishes" />
              <Line type="monotone" dataKey="restaurants" stroke="#22C55E" name="Restaurants" />
            </LineChart>
          )}
          {chartType === "pie" && (
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie data={data} dataKey="dishes" nameKey="municipality_name" outerRadius={90} label>
                {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Pie data={data} dataKey="restaurants" nameKey="municipality_name" innerRadius={100} outerRadius={130}>
                {data.map((_, i) => <Cell key={i} fill={colors[(i + 3) % colors.length]} />)}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(summaryQ.data ? Object.entries(summaryQ.data) : []).map(([k, v]) => (
          <div key={k} className="bg-white border rounded-xl p-4">
            <div className="text-xs text-neutral-500">{k}</div>
            <div className="text-2xl font-semibold">{String(v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------- Dishes CRUD -------------
type DishFormState = Partial<Dish> & { autoSlug?: boolean };
const emptyDish: DishFormState = { name: "", slug: "", category: "food", municipality_id: 0, autoSlug: true };

function DishesTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<DishFormState>(emptyDish);

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const dishesQ = useQuery({ queryKey: ["dishes", q], queryFn: () => listDishes({ q }), keepPreviousData: true });

  // create
  const createM = useMutation({
    mutationFn: (payload: Partial<Dish>) => createDish(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setForm(emptyDish); }
  });
  // update
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: Partial<Dish> }) => updateDish(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setEditOpen(false); }
  });
  // delete
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteDish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dishes"] })
  });

  function setName(name: string) {
    setForm((f) => {
      const next = { ...f, name };
      if (f.autoSlug) next.slug = slugify(name);
      return next;
    });
  }

  function onQuickCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.slug || !form.municipality_id) {
      alert("Name, slug and municipality are required.");
      return;
    }
    createM.mutate({
      name: String(form.name),
      slug: String(form.slug),
      municipality_id: Number(form.municipality_id),
      category: (form.category as any) ?? "food",
      description: form.description ?? null,
      image_url: form.image_url ?? null,
      flavor_profile: Array.isArray(form.flavor_profile) ? form.flavor_profile : coerceStringArray(form.flavor_profile),
      ingredients: Array.isArray(form.ingredients) ? form.ingredients : coerceStringArray(form.ingredients),
      rating: form.rating ?? null,
      popularity: form.popularity ?? null,
    });
  }

  function openEdit(d: Dish) {
    setForm({
      ...d,
      autoSlug: false,
      flavor_profile: coerceStringArray(d.flavor_profile) ?? [],
      ingredients: coerceStringArray(d.ingredients) ?? [],
    });
    setEditOpen(true);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Quick create panel (always open) */}
      <form onSubmit={onQuickCreate} className="bg-white border rounded-2xl p-4 lg:col-span-1">
        <h3 className="font-semibold mb-3">Create Dish</h3>
        <Field label="Name">
          <input className="w-full border rounded px-3 py-2" value={form.name ?? ""} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="flex items-center gap-2 mb-2">
          <input id="autoslug" type="checkbox" checked={!!form.autoSlug} onChange={(e) => setForm(f => ({ ...f, autoSlug: e.target.checked }))} />
          <label htmlFor="autoslug" className="text-sm text-neutral-600 select-none">Auto-generate slug</label>
        </div>
        <Field label="Slug">
          <input className="w-full border rounded px-3 py-2" value={form.slug ?? ""} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} />
        </Field>
        <Field label="Municipality">
          <select className="w-full border rounded px-3 py-2"
                  value={form.municipality_id ?? 0}
                  onChange={(e) => setForm(f => ({ ...f, municipality_id: Number(e.target.value) }))}>
            <option value={0}>Select…</option>
            {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select className="w-full border rounded px-3 py-2"
                  value={form.category ?? "food"}
                  onChange={(e) => setForm(f => ({ ...f, category: e.target.value as any }))}>
            <option value="food">Food</option>
            <option value="delicacy">Delicacy</option>
            <option value="drink">Drink</option>
          </select>
        </Field>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-neutral-900 text-white" disabled={createM.isPending}>Save</button>
          <button type="button" className="px-3 py-2 rounded border" onClick={() => setForm(emptyDish)}>Reset</button>
        </div>
        {createM.isError && <p className="text-sm text-red-600 mt-2">{String((createM.error as any)?.message ?? "Create failed")}</p>}
      </form>

      {/* Right side: search + list */}
      <div className="lg:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <input className="border rounded px-3 py-2 w-full" placeholder="Search dishes…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid md:grid-cols-2 gap-3 max-h-[70vh] overflow-auto pr-1">
          {(dishesQ.data ?? []).map(d => {
            const flavor = coerceStringArray(d.flavor_profile)?.join(", ") ?? "";
            return (
              <div key={d.id} className="bg-white border rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-xs text-neutral-500">{d.slug} • {d.category}</div>
                    {flavor && <div className="text-xs mt-1 text-neutral-600">Flavor: {flavor}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button className="text-xs px-2 py-1 rounded border" onClick={() => openEdit(d)}>Edit</button>
                    <button className="text-xs px-2 py-1 rounded border text-red-600"
                      onClick={async () => { if (await confirmThen(`Delete ${d.name}?`)) deleteM.mutate(d.id); }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Dish">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name">
            <input className="w-full border rounded px-3 py-2"
                   value={form.name ?? ""} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Slug">
            <input className="w-full border rounded px-3 py-2"
                   value={form.slug ?? ""} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} />
          </Field>
          <Field label="Municipality">
            <select className="w-full border rounded px-3 py-2"
                    value={form.municipality_id ?? 0}
                    onChange={(e) => setForm(f => ({ ...f, municipality_id: Number(e.target.value) }))}>
              <option value={0}>Select…</option>
              {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select className="w-full border rounded px-3 py-2"
                    value={(form.category as any) ?? "food"}
                    onChange={(e) => setForm(f => ({ ...f, category: e.target.value as any }))}>
              <option value="food">Food</option>
              <option value="delicacy">Delicacy</option>
              <option value="drink">Drink</option>
            </select>
          </Field>
          <Field label="Image URL">
            <input className="w-full border rounded px-3 py-2"
                   value={form.image_url ?? ""} onChange={(e) => setForm(f => ({ ...f, image_url: e.target.value }))} />
          </Field>
          <Field label="Rating">
            <input type="number" step="0.1" className="w-full border rounded px-3 py-2"
                   value={form.rating ?? 0} onChange={(e) => setForm(f => ({ ...f, rating: Number(e.target.value) }))} />
          </Field>
          <Field label="Popularity">
            <input type="number" className="w-full border rounded px-3 py-2"
                   value={form.popularity ?? 0} onChange={(e) => setForm(f => ({ ...f, popularity: Number(e.target.value) }))} />
          </Field>
          <Field label="Flavor profile (comma separated)">
            <input className="w-full border rounded px-3 py-2"
                   value={(Array.isArray(form.flavor_profile) ? form.flavor_profile.join(", ") : (form.flavor_profile ?? "")) as string}
                   onChange={(e) => setForm(f => ({ ...f, flavor_profile: e.target.value }))} />
          </Field>
          <Field label="Ingredients (comma separated)">
            <input className="w-full border rounded px-3 py-2"
                   value={(Array.isArray(form.ingredients) ? form.ingredients.join(", ") : (form.ingredients ?? "")) as string}
                   onChange={(e) => setForm(f => ({ ...f, ingredients: e.target.value }))} />
          </Field>
          <Field label="Description">
            <textarea className="w-full border rounded px-3 py-2"
                      value={form.description ?? ""} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="px-4 py-2 rounded bg-neutral-900 text-white"
                  onClick={() => {
                    if (!form.id) return;
                    updateM.mutate({
                      id: form.id,
                      payload: {
                        ...form,
                        flavor_profile: coerceStringArray(form.flavor_profile),
                        ingredients: coerceStringArray(form.ingredients),
                      }
                    });
                  }}
                  disabled={updateM.isPending}>Save</button>
          <button className="px-3 py-2 rounded border" onClick={() => setEditOpen(false)}>Cancel</button>
        </div>
        {updateM.isError && <p className="text-sm text-red-600 mt-2">{String((updateM.error as any)?.message ?? "Update failed")}</p>}
      </Modal>
    </div>
  );
}

// ------------- Restaurants CRUD (mirrors dish UI) -------------
type RestaurantFormState = Partial<Restaurant> & { autoSlug?: boolean };
const emptyRest: RestaurantFormState = { name: "", slug: "", municipality_id: 0, address: "", lat: 0, lng: 0, autoSlug: true };

function RestaurantsTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<RestaurantFormState>(emptyRest);

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const restQ = useQuery({ queryKey: ["rests", q], queryFn: () => listRestaurants({ q }), keepPreviousData: true });

  const createM = useMutation({
    mutationFn: (payload: Partial<Restaurant>) => createRestaurant(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rests"] }); setForm(emptyRest); }
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: Partial<Restaurant> }) => updateRestaurant(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rests"] }); setEditOpen(false); }
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteRestaurant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rests"] })
  });

  function setName(name: string) {
    setForm((f) => {
      const next = { ...f, name };
      if (f.autoSlug) next.slug = slugify(name);
      return next;
    });
  }

  function onQuickCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.slug || !form.municipality_id || !form.address) {
      alert("Name, slug, municipality and address are required.");
      return;
    }
    createM.mutate({
      name: String(form.name),
      slug: String(form.slug),
      municipality_id: Number(form.municipality_id),
      address: String(form.address),
      lat: Number(form.lat) || 0,
      lng: Number(form.lng) || 0,
      image_url: form.image_url ?? null,
      kind: (form.kind as any) ?? "restaurant",
      phone: form.phone ?? null,
      website: form.website ?? null,
      facebook: form.facebook ?? null,
      instagram: form.instagram ?? null,
      opening_hours: form.opening_hours ?? null,
      price_range: (form.price_range as any) ?? null,
      cuisine_types: Array.isArray(form.cuisine_types) ? form.cuisine_types : coerceStringArray(form.cuisine_types),
      rating: form.rating ?? null,
      description: form.description ?? null,
    });
  }

  function openEdit(r: Restaurant) {
    setForm({
      ...r,
      autoSlug: false,
      cuisine_types: coerceStringArray(r.cuisine_types) ?? [],
    });
    setEditOpen(true);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Quick create panel */}
      <form onSubmit={onQuickCreate} className="bg-white border rounded-2xl p-4 lg:col-span-1">
        <h3 className="font-semibold mb-3">Create Restaurant</h3>
        <Field label="Name"><input className="w-full border rounded px-3 py-2" value={form.name ?? ""} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="flex items-center gap-2 mb-2">
          <input id="autoslug2" type="checkbox" checked={!!form.autoSlug} onChange={(e) => setForm(f => ({ ...f, autoSlug: e.target.checked }))} />
          <label htmlFor="autoslug2" className="text-sm text-neutral-600 select-none">Auto-generate slug</label>
        </div>
        <Field label="Slug"><input className="w-full border rounded px-3 py-2" value={form.slug ?? ""} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} /></Field>
        <Field label="Municipality">
          <select className="w-full border rounded px-3 py-2"
                  value={form.municipality_id ?? 0}
                  onChange={(e) => setForm(f => ({ ...f, municipality_id: Number(e.target.value) }))}>
            <option value={0}>Select…</option>
            {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
          </select>
        </Field>
        <Field label="Address"><input className="w-full border rounded px-3 py-2" value={form.address ?? ""} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Lat"><input type="number" className="w-full border rounded px-3 py-2" value={form.lat ?? 0} onChange={(e) => setForm(f => ({ ...f, lat: Number(e.target.value) }))} /></Field>
          <Field label="Lng"><input type="number" className="w-full border rounded px-3 py-2" value={form.lng ?? 0} onChange={(e) => setForm(f => ({ ...f, lng: Number(e.target.value) }))} /></Field>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-neutral-900 text-white" disabled={createM.isPending}>Save</button>
          <button type="button" className="px-3 py-2 rounded border" onClick={() => setForm(emptyRest)}>Reset</button>
        </div>
        {createM.isError && <p className="text-sm text-red-600 mt-2">{String((createM.error as any)?.message ?? "Create failed")}</p>}
      </form>

      {/* List */}
      <div className="lg:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <input className="border rounded px-3 py-2 w-full" placeholder="Search restaurants…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid md:grid-cols-2 gap-3 max-h-[70vh] overflow-auto pr-1">
          {(restQ.data ?? []).map(r => {
            const cuisine = coerceStringArray(r.cuisine_types)?.join(", ") ?? "";
            return (
              <div key={r.id} className="bg-white border rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-neutral-500">{r.slug} • {r.address}</div>
                    {cuisine && <div className="text-xs mt-1 text-neutral-600">Cuisine: {cuisine}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button className="text-xs px-2 py-1 rounded border" onClick={() => openEdit(r)}>Edit</button>
                    <button className="text-xs px-2 py-1 rounded border text-red-600"
                      onClick={async () => { if (await confirmThen(`Delete ${r.name}?`)) deleteM.mutate(r.id); }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Restaurant">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name"><input className="w-full border rounded px-3 py-2" value={form.name ?? ""} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Slug"><input className="w-full border rounded px-3 py-2" value={form.slug ?? ""} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} /></Field>
          <Field label="Municipality">
            <select className="w-full border rounded px-3 py-2" value={form.municipality_id ?? 0}
                    onChange={(e) => setForm(f => ({ ...f, municipality_id: Number(e.target.value) }))}>
              <option value={0}>Select…</option>
              {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
            </select>
          </Field>
          <Field label="Kind">
            <select className="w-full border rounded px-3 py-2" value={(form.kind as any) ?? "restaurant"}
                    onChange={(e) => setForm(f => ({ ...f, kind: e.target.value as any }))}>
              <option>restaurant</option><option>stall</option><option>store</option><option>dealer</option><option>market</option><option>home-based</option>
            </select>
          </Field>
          <Field label="Image URL"><input className="w-full border rounded px-3 py-2" value={form.image_url ?? ""} onChange={(e) => setForm(f => ({ ...f, image_url: e.target.value }))} /></Field>
          <Field label="Address"><input className="w-full border rounded px-3 py-2" value={form.address ?? ""} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
          <Field label="Lat"><input type="number" className="w-full border rounded px-3 py-2" value={form.lat ?? 0} onChange={(e) => setForm(f => ({ ...f, lat: Number(e.target.value) }))} /></Field>
          <Field label="Lng"><input type="number" className="w-full border rounded px-3 py-2" value={form.lng ?? 0} onChange={(e) => setForm(f => ({ ...f, lng: Number(e.target.value) }))} /></Field>
          <Field label="Phone"><input className="w-full border rounded px-3 py-2" value={form.phone ?? ""} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
          <Field label="Website"><input className="w-full border rounded px-3 py-2" value={form.website ?? ""} onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} /></Field>
          <Field label="Facebook"><input className="w-full border rounded px-3 py-2" value={form.facebook ?? ""} onChange={(e) => setForm(f => ({ ...f, facebook: e.target.value }))} /></Field>
          <Field label="Instagram"><input className="w-full border rounded px-3 py-2" value={form.instagram ?? ""} onChange={(e) => setForm(f => ({ ...f, instagram: e.target.value }))} /></Field>
          <Field label="Opening Hours"><input className="w-full border rounded px-3 py-2" value={form.opening_hours ?? ""} onChange={(e) => setForm(f => ({ ...f, opening_hours: e.target.value }))} /></Field>
          <Field label="Price Range">
            <select className="w-full border rounded px-3 py-2" value={(form.price_range as any) ?? ""} onChange={(e) => setForm(f => ({ ...f, price_range: (e.target.value || null) as any }))}>
              <option value="">(none)</option>
              <option value="budget">budget</option>
              <option value="moderate">moderate</option>
              <option value="expensive">expensive</option>
            </select>
          </Field>
          <Field label="Cuisine types (comma separated)">
            <input className="w-full border rounded px-3 py-2"
                   value={(Array.isArray(form.cuisine_types) ? form.cuisine_types.join(", ") : (form.cuisine_types ?? "")) as string}
                   onChange={(e) => setForm(f => ({ ...f, cuisine_types: e.target.value }))} />
          </Field>
          <Field label="Rating">
            <input type="number" step="0.1" className="w-full border rounded px-3 py-2"
                   value={form.rating ?? 0} onChange={(e) => setForm(f => ({ ...f, rating: Number(e.target.value) }))} />
          </Field>
          <Field label="Description"><textarea className="w-full border rounded px-3 py-2" value={form.description ?? ""} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></Field>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="px-4 py-2 rounded bg-neutral-900 text-white"
                  onClick={() => {
                    if (!form.id) return;
                    updateM.mutate({
                      id: form.id,
                      payload: {
                        ...form,
                        cuisine_types: coerceStringArray(form.cuisine_types),
                      }
                    });
                  }}
                  disabled={updateM.isPending}>Save</button>
          <button className="px-3 py-2 rounded border" onClick={() => setEditOpen(false)}>Cancel</button>
        </div>
        {updateM.isError && <p className="text-sm text-red-600 mt-2">{String((updateM.error as any)?.message ?? "Update failed")}</p>}
      </Modal>
    </div>
  );
}

// ------------- Curation -------------
function CurationTab() {
  const qc = useQueryClient();
  const [qDish, setQDish] = useState("");
  const [qRest, setQRest] = useState("");
  const [muniId, setMuniId] = useState<number | null>(null);
  const [category, setCategory] = useState<"all" | "food" | "delicacy" | "drink">("all");

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const dishesQ = useQuery({
    queryKey: ["dishes", qDish, muniId, category],
    queryFn: () => listDishes({ q: qDish, municipalityId: muniId ?? undefined, category: category === "all" ? undefined : category }),
    keepPreviousData: true
  });
  const restsQ = useQuery({
    queryKey: ["rests", qRest, muniId],
    queryFn: () => listRestaurants({ q: qRest, municipalityId: muniId ?? undefined }),
    keepPreviousData: true
  });

  const patchDishM = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: any }) => setDishCuration(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dishes"] })
  });
  const patchRestM = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: any }) => setRestaurantCuration(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rests"] })
  });

  // enforce unique rank per muni (and per category for dishes)
  async function setDishRank(d: Dish, rank: number | null) {
    const list = (dishesQ.data ?? []).filter(x => !muniId || x.municipality_id === muniId);
    const conflict = rank ? list.find(x => x.panel_rank === rank && x.id !== d.id) : null;
    if (conflict) {
      const ok = await confirmThen(`Replace "${conflict.name}" at TOP ${rank} with "${d.name}"?`);
      if (!ok) return;
      await patchDishM.mutateAsync({ id: conflict.id, payload: { panel_rank: null, is_signature: 0 as 0 } });
    }
    await patchDishM.mutateAsync({ id: d.id, payload: { panel_rank: rank, is_signature: rank ? 1 as 1 : 0 as 0 } });
  }

  async function setRestRank(r: Restaurant, rank: number | null) {
    const list = (restsQ.data ?? []).filter(x => !muniId || x.municipality_id === muniId);
    const conflict = rank ? list.find(x => x.featured_rank === rank && x.id !== r.id) : null;
    if (conflict) {
      const ok = await confirmThen(`Replace "${conflict.name}" at TOP ${rank} with "${r.name}"?`);
      if (!ok) return;
      await patchRestM.mutateAsync({ id: conflict.id, payload: { featured_rank: null, featured: 0 as 0 } });
    }
    await patchRestM.mutateAsync({ id: r.id, payload: { featured_rank: rank, featured: rank ? 1 as 1 : 0 as 0 } });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Dishes curation */}
      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold">Top Dishes/Delicacy</h3>
          <select className="ml-auto border rounded px-2 py-1 text-sm" value={muniId ?? 0} onChange={(e) => setMuniId(Number(e.target.value) || null)}>
            <option value={0}>All municipalities</option>
            {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="border rounded px-2 py-1 text-sm" value={category} onChange={(e) => setCategory(e.target.value as any)}>
            <option value="all">All categories</option>
            <option value="food">Food</option>
            <option value="delicacy">Delicacy</option>
            <option value="drink">Drink</option>
          </select>
        </div>
        <input className="border rounded px-3 py-2 w-full mb-3" placeholder="Search dishes…" value={qDish} onChange={(e) => setQDish(e.target.value)} />
        <div className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
          {(dishesQ.data ?? []).map(d => (
            <div key={d.id} className="border rounded-xl p-3">
              <div className="font-semibold">{d.name}</div>
              <div className="text-xs text-neutral-500">{d.category} • {(muniQ.data ?? []).find(m => m.id === d.municipality_id)?.name}</div>
              <div className="flex items-center gap-2 mt-2">
                {[1,2,3].map(rank => (
                  <button key={rank}
                          className={cx("px-2 py-1 text-xs rounded border", d.panel_rank === rank && "bg-neutral-900 text-white")}
                          onClick={() => setDishRank(d, d.panel_rank === rank ? null : rank)}>
                    Top {rank}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Restaurants curation */}
      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold">Top Restaurants</h3>
          <select className="ml-auto border rounded px-2 py-1 text-sm" value={muniId ?? 0} onChange={(e) => setMuniId(Number(e.target.value) || null)}>
            <option value={0}>All municipalities</option>
            {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <input className="border rounded px-3 py-2 w-full mb-3" placeholder="Search restaurants…" value={qRest} onChange={(e) => setQRest(e.target.value)} />
        <div className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
          {(restsQ.data ?? []).map(r => (
            <div key={r.id} className="border rounded-xl p-3">
              <div className="font-semibold">{r.name}</div>
              <div className="text-xs text-neutral-500">{(muniQ.data ?? []).find(m => m.id === (r.municipality_id ?? 0))?.name}</div>
              <div className="flex items-center gap-2 mt-2">
                {[1,2,3].map(rank => (
                  <button key={rank}
                          className={cx("px-2 py-1 text-xs rounded border", r.featured_rank === rank && "bg-neutral-900 text-white")}
                          onClick={() => setRestRank(r, r.featured_rank === rank ? null : rank)}>
                    Top {rank}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------- Linking -------------
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
    enabled: !!selDish
  });

  const linkM = useMutation({
    mutationFn: ({ dish_id, restaurant_id }: { dish_id: number; restaurant_id: number }) => linkDishRestaurant(dish_id, restaurant_id),
    onSuccess: () => linkedQ.refetch()
  });
  const unlinkM = useMutation({
    mutationFn: ({ dish_id, restaurant_id }: { dish_id: number; restaurant_id: number }) => unlinkDishRestaurant(dish_id, restaurant_id),
    onSuccess: () => linkedQ.refetch()
  });

  const linkedIds = new Set((linkedQ.data ?? []).map(r => r.id));

  const restaurants = useMemo(() => {
    const all = restsQ.data ?? [];
    // bring linked to top
    const linked = all.filter(r => linkedIds.has(r.id));
    const unlinked = all.filter(r => !linkedIds.has(r.id));
    return [...linked, ...unlinked];
  }, [restsQ.data, linkedIds]);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="bg-white border rounded-2xl p-4">
        <div className="font-semibold mb-2">Choose Dish</div>
        <input className="border rounded px-3 py-2 w-full mb-2" placeholder="Search dishes…" value={qDish} onChange={(e) => setQDish(e.target.value)} />
        <div className="max-h-[65vh] overflow-auto space-y-2">
          {(dishesQ.data ?? []).map(d => (
            <button key={d.id}
              className={cx("w-full text-left border rounded-lg p-2", selDish?.id === d.id && "border-neutral-900")}
              onClick={() => setSelDish(d)}
            >
              <div className="font-medium">{d.name}</div>
              <div className="text-xs text-neutral-500">{d.category}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 bg-white border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="font-semibold">Link Restaurants</div>
          <select className="ml-auto border rounded px-2 py-1 text-sm" value={filterMuni ?? 0} onChange={(e) => setFilterMuni(Number(e.target.value) || null)}>
            <option value={0}>All municipalities</option>
            {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input className="border rounded px-3 py-2" placeholder="Search restaurants…" value={qRest} onChange={(e) => setQRest(e.target.value)} />
        </div>
        {!selDish && <div className="text-sm text-neutral-500">Select a dish first.</div>}
        {selDish && (
          <div className="grid md:grid-cols-2 gap-3 max-h-[65vh] overflow-auto">
            {restaurants.map(r => {
              const isLinked = linkedIds.has(r.id);
              return (
                <div key={r.id} className={cx("border rounded-xl p-3", isLinked && "border-neutral-900")}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-xs text-neutral-500">{(muniQ.data ?? []).find(m => m.id === (r.municipality_id ?? 0))?.name}</div>
                    </div>
                    <div>
                      {!isLinked ? (
                        <button className="text-xs px-2 py-1 rounded border"
                                onClick={() => selDish && linkM.mutate({ dish_id: selDish.id, restaurant_id: r.id })}>
                          Link
                        </button>
                      ) : (
                        <button className="text-xs px-2 py-1 rounded border text-red-600"
                                onClick={() => selDish && unlinkM.mutate({ dish_id: selDish.id, restaurant_id: r.id })}>
                          Unlink
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------- Main Admin Dashboard with tabs -------------
export default function AdminDashboard() {
  const [tab, setTab] = useState<"analytics" | "dishes" | "restaurants" | "curation" | "linking">("analytics");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <div className="ml-auto flex gap-2">
          {(["analytics","dishes","restaurants","curation","linking"] as const).map(t => (
            <button key={t}
              className={cx("px-3 py-1.5 rounded border text-sm", tab === t && "bg-neutral-900 text-white")}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab === "analytics" && <AnalyticsTab />}
      {tab === "dishes" && <DishesTab />}
      {tab === "restaurants" && <RestaurantsTab />}
      {tab === "curation" && <CurationTab />}
      {tab === "linking" && <LinkingTab />}
    </div>
  );
}
