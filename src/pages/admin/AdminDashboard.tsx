// src/pages/admin/AdminDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  listMunicipalities, type Municipality,
  listDishes, type Dish, createDish, updateDish, deleteDish,
  listRestaurants, type Restaurant, createRestaurant, updateRestaurant, deleteRestaurant,
  listRestaurantsForDish, listDishesForRestaurant,
  linkDishRestaurant, unlinkDishRestaurant,
  setDishCuration, setRestaurantCuration,
  getPerMunicipalityCounts, getAnalyticsSummary,
  coerceStringArray
} from "../../utils/adminApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Recharts
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";

// ========== Tiny helpers ==========
const useLocalStorage = <T,>(key: string, initial: T) => {
  const [v, setV] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, setV] as const;
};

const colors = ["#2563eb","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];

// ========== Zod Schemas ==========
const dishSchema = z.object({
  id: z.number().optional(),
  municipality_id: z.coerce.number().min(1, "Municipality is required"),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  image_url: z.string().url().nullish(),
  category: z.enum(["food","delicacy","drink"]),
  flavor_profile: z.string().optional(), // comma list
  ingredients: z.string().optional(),    // comma list
  popularity: z.coerce.number().nullable().optional(),
  rating: z.coerce.number().nullable().optional(),
  is_signature: z.coerce.number().nullable().optional(), // 0/1
  panel_rank: z.coerce.number().nullable().optional(),   // 1..3 or null
});

const restaurantSchema = z.object({
  id: z.number().optional(),
  municipality_id: z.coerce.number().min(1, "Municipality is required"),
  name: z.string().min(1),
  slug: z.string().min(1),
  kind: z.enum(["restaurant","stall","store","dealer","market","home-based"]).nullish(),
  description: z.string().nullable().optional(),
  address: z.string().min(1),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  opening_hours: z.string().nullable().optional(),
  price_range: z.enum(["budget","moderate","expensive"]).nullish(),
  cuisine_types: z.string().optional(), // comma list
  rating: z.coerce.number().nullable().optional(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  image_url: z.string().url().nullish(),
  featured: z.coerce.number().nullable().optional(),
  featured_rank: z.coerce.number().nullable().optional(),
});

// ========== Small Select for Municipalities ==========
function MunicipalitySelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 5 * 60_000 });
  return (
    <select
      className="border rounded px-2 py-1"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">All municipalities</option>
      {(muniQ.data ?? []).map((m) => (
        <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>
      ))}
    </select>
  );
}

// ========== Analytics Panel ==========
function AnalyticsPanel() {
  const [chart, setChart] = useLocalStorage<"bar" | "line" | "pie">("adm:chart", "bar");
  const muniCounts = useQuery({ queryKey: ["analytics:per-muni"], queryFn: getPerMunicipalityCounts, refetchOnWindowFocus: false });
  const sumQ = useQuery({ queryKey: ["analytics:summary"], queryFn: getAnalyticsSummary, refetchOnWindowFocus: false });

  const data = muniCounts.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Per Municipality Status</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">Chart:</span>
          <select className="border rounded px-2 py-1" value={chart} onChange={(e) => setChart(e.target.value as any)}>
            <option value="bar">Bars</option>
            <option value="line">Lines</option>
            <option value="pie">Pie (donut)</option>
          </select>
        </div>
      </div>

      <div className="h-80 bg-white border rounded-lg p-3">
        {chart === "bar" && (
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="municipality_name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="dishes" name="Dishes" fill={colors[0]} />
              <Bar dataKey="restaurants" name="Restaurants" fill={colors[1]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {chart === "line" && (
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="municipality_name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line dataKey="dishes" name="Dishes" stroke={colors[0]} />
              <Line dataKey="restaurants" name="Restaurants" stroke={colors[1]} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {chart === "pie" && (
          <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-2">
            <ResponsiveContainer>
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie
                  data={data}
                  dataKey="dishes"
                  nameKey="municipality_name"
                  innerRadius="50%"
                  outerRadius="80%"
                  label
                >
                  {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <ResponsiveContainer>
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie
                  data={data}
                  dataKey="restaurants"
                  nameKey="municipality_name"
                  innerRadius="50%"
                  outerRadius="80%"
                  label
                >
                  {data.map((_, i) => <Cell key={i} fill={colors[(i + 1) % colors.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Quick peek: Top items by municipality without going to curation */}
      <TopPeek />
    </div>
  );
}

// Quick "Top by municipality" viewer
function TopPeek() {
  const [muniId, setMuniId] = useLocalStorage<number | null>("adm:peek:muni", null);
  const dishQ = useQuery({
    queryKey: ["peek:dishes", muniId],
    queryFn: () => listDishes({ municipalityId: muniId ?? undefined, signature: 1 }),
    enabled: muniId != null
  });
  const restQ = useQuery({
    queryKey: ["peek:restaurants", muniId],
    queryFn: () => listRestaurants({ municipalityId: muniId ?? undefined, featured: 1 }),
    enabled: muniId != null
  });

  const topD = useMemo(() => (dishQ.data ?? []).slice().sort((a, b) => (a.panel_rank ?? 99) - (b.panel_rank ?? 99)), [dishQ.data]);
  const topR = useMemo(() => (restQ.data ?? []).slice().sort((a, b) => (a.featured_rank ?? 99) - (b.featured_rank ?? 99)), [restQ.data]);

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Top per Municipality</h3>
        <MunicipalitySelect value={muniId} onChange={setMuniId} />
      </div>
      {muniId == null ? (
        <div className="text-sm text-neutral-500 mt-2">Select a municipality to preview its current Top 1–3.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div>
            <div className="font-medium mb-2">Top Dishes/Delicacy</div>
            <ol className="space-y-1">
              {topD.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <span className="text-xs rounded px-2 py-0.5 bg-amber-50 border">{d.panel_rank ?? "—"}</span>
                  <span>{d.name} <span className="text-xs text-neutral-500">({d.category})</span></span>
                </li>
              ))}
              {topD.length === 0 && <div className="text-sm text-neutral-500">No top dishes set.</div>}
            </ol>
          </div>
          <div>
            <div className="font-medium mb-2">Top Restaurants</div>
            <ol className="space-y-1">
              {topR.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="text-xs rounded px-2 py-0.5 bg-sky-50 border">{r.featured_rank ?? "—"}</span>
                  <span>{r.name}</span>
                </li>
              ))}
              {topR.length === 0 && <div className="text-sm text-neutral-500">No top restaurants set.</div>}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== Dishes CRUD ==========
function DishesPanel() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [muniId, setMuniId] = useLocalStorage<number | null>("adm:dish:muni", null);
  const [category, setCategory] = useLocalStorage<"" | "food" | "delicacy" | "drink">("adm:dish:cat", "");

  const listQ = useQuery({
    queryKey: ["dishes", muniId, category, q],
    queryFn: () => listDishes({
      municipalityId: muniId ?? undefined,
      category: category || undefined,
      q: q || undefined
    }),
  });

  const [editing, setEditing] = useState<Dish | null>(null);

  const saveCreate = useMutation({
    mutationFn: (payload: Partial<Dish>) => createDish(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); alert("Dish created."); }
  });
  const saveUpdate = useMutation({
    mutationFn: (payload: Dish) => updateDish(payload.id!, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); alert("Dish updated."); }
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteDish(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); alert("Dish deleted."); }
  });

  const onNew = () => setEditing({
    id: 0,
    municipality_id: muniId ?? 0,
    name: "",
    slug: "",
    description: null,
    image_url: null,
    category: (category || "food") as any,
    flavor_profile: null,
    ingredients: null,
    popularity: null,
    rating: null,
    is_signature: 0,
    panel_rank: null
  });

  const items = listQ.data ?? [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left: List */}
      <div className="lg:col-span-2 bg-white border rounded-lg p-3 flex flex-col">
        <div className="flex items-center gap-2">
          <input className="border rounded px-3 py-2 flex-1" placeholder="Search dishes…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <MunicipalitySelect value={muniId} onChange={setMuniId} />
          <select className="border rounded px-2 py-1" value={category} onChange={(e) => setCategory(e.target.value as any)}>
            <option value="">All</option>
            <option value="food">Food</option>
            <option value="delicacy">Delicacy</option>
            <option value="drink">Drink</option>
          </select>
          <button className="ml-auto px-3 py-1.5 rounded bg-black text-white" onClick={onNew}>+ New Dish</button>
        </div>

        <div className="mt-3 flex-1 overflow-auto divide-y">
          {items.map((d) => {
            const fp = coerceStringArray(d.flavor_profile);
            const ing = coerceStringArray(d.ingredients);
            return (
              <button
                key={d.id}
                onClick={() => setEditing(d)}
                className="w-full text-left px-2 py-2 hover:bg-neutral-50"
              >
                <div className="font-medium">{d.name} <span className="text-xs text-neutral-500">({d.slug})</span></div>
                <div className="text-xs text-neutral-500">
                  {d.category} • {fp?.join(" · ") || "—"} • {ing?.slice(0,3)?.join(", ") || "—"}
                </div>
                {(d.is_signature ? true : false) && (
                  <div className="text-xs mt-1">
                    <span className="px-2 py-0.5 rounded bg-amber-50 border mr-1">Signature</span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 border">Top {d.panel_rank ?? "—"}</span>
                  </div>
                )}
              </button>
            );
          })}
          {items.length === 0 && <div className="p-3 text-sm text-neutral-500">No dishes.</div>}
        </div>
      </div>

      {/* Right: Form */}
      <div className="lg:col-span-3 bg-white border rounded-lg p-4">
        {!editing ? (
          <div className="text-neutral-500">Select a dish to edit, or click “New Dish”.</div>
        ) : (
          <DishForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onDelete={() => { if (editing.id && window.confirm("Delete this dish?")) remove.mutate(editing.id); setEditing(null); }}
            onSave={(payload) => {
              if (payload.id && payload.id !== 0) saveUpdate.mutate(payload as Dish);
              else saveCreate.mutate(payload as Partial<Dish>);
              setEditing(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function DishForm({ initial, onCancel, onDelete, onSave }: {
  initial: Dish;
  onCancel: () => void;
  onDelete: () => void;
  onSave: (payload: Partial<Dish> | Dish) => void;
}) {
  const f = useForm<z.infer<typeof dishSchema>>({
    resolver: zodResolver(dishSchema),
    defaultValues: {
      ...initial,
      flavor_profile: Array.isArray(initial.flavor_profile) ? initial.flavor_profile.join(", ") : (initial.flavor_profile as any) ?? "",
      ingredients: Array.isArray(initial.ingredients) ? initial.ingredients.join(", ") : (initial.ingredients as any) ?? "",
    }
  });

  const watchName = f.watch("name");
  useEffect(() => {
    // auto-slug if field empty
    const slug = f.getValues("slug");
    if (!slug) f.setValue("slug", watchName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), { shouldDirty: true });
  }, [watchName]);

  const submit = f.handleSubmit((v) => {
    const payload: Partial<Dish> = {
      ...v,
      flavor_profile: v.flavor_profile ? v.flavor_profile.split(",").map(s => s.trim()).filter(Boolean) : null,
      ingredients: v.ingredients ? v.ingredients.split(",").map(s => s.trim()).filter(Boolean) : null,
    };
    onSave(initial.id ? { ...payload, id: initial.id } : payload);
  });

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{initial.id ? "Edit Dish" : "Create Dish"}</h3>
        <div className="flex gap-2">
          {initial.id ? <button type="button" className="px-3 py-1.5 rounded border" onClick={onDelete}>Delete</button> : null}
          <button type="button" className="px-3 py-1.5 rounded border" onClick={onCancel}>Cancel</button>
          <button type="submit" className="px-3 py-1.5 rounded bg-black text-white">Save</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm">Municipality
          <MunicipalitySelect value={f.watch("municipality_id") || null} onChange={(v) => f.setValue("municipality_id", v ?? 0, { shouldDirty: true })} />
        </label>
        <label className="text-sm">Category
          <select className="border rounded px-2 py-1 w-full" {...f.register("category")}>
            <option value="food">Food</option>
            <option value="delicacy">Delicacy</option>
            <option value="drink">Drink</option>
          </select>
        </label>
        <label className="text-sm">Image URL
          <input className="border rounded px-2 py-1 w-full" placeholder="https://…" {...f.register("image_url")} />
        </label>

        <label className="text-sm col-span-2">Name
          <input className="border rounded px-2 py-1 w-full" {...f.register("name")} />
        </label>
        <label className="text-sm">Slug
          <input className="border rounded px-2 py-1 w-full" {...f.register("slug")} />
        </label>

        <label className="text-sm col-span-3">Description
          <textarea className="border rounded px-2 py-1 w-full" rows={3} {...f.register("description" as any)} />
        </label>

        <label className="text-sm">Flavor profile (comma)
          <input className="border rounded px-2 py-1 w-full" {...f.register("flavor_profile")} />
        </label>
        <label className="text-sm">Ingredients (comma)
          <input className="border rounded px-2 py-1 w-full" {...f.register("ingredients")} />
        </label>
        <label className="text-sm">Rating
          <input className="border rounded px-2 py-1 w-full" type="number" step="0.1" {...f.register("rating" as any)} />
        </label>
        <label className="text-sm">Popularity
          <input className="border rounded px-2 py-1 w-full" type="number" step="1" {...f.register("popularity" as any)} />
        </label>

        <label className="text-sm">Signature?
          <select className="border rounded px-2 py-1 w-full" {...f.register("is_signature" as any)}>
            <option value="">—</option>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
        <label className="text-sm">Panel Rank (1–3)
          <select className="border rounded px-2 py-1 w-full" {...f.register("panel_rank" as any)}>
            <option value="">—</option>
            {[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    </form>
  );
}

// ========== Restaurants CRUD ==========
function RestaurantsPanel() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [muniId, setMuniId] = useLocalStorage<number | null>("adm:rest:muni", null);

  const listQ = useQuery({
    queryKey: ["restaurants", muniId, q],
    queryFn: () => listRestaurants({ municipalityId: muniId ?? undefined, q: q || undefined }),
  });

  const [editing, setEditing] = useState<Restaurant | null>(null);

  const saveCreate = useMutation({
    mutationFn: (payload: Partial<Restaurant>) => createRestaurant(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurants"] }); alert("Restaurant created."); }
  });
  const saveUpdate = useMutation({
    mutationFn: (payload: Restaurant) => updateRestaurant(payload.id!, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurants"] }); alert("Restaurant updated."); }
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteRestaurant(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurants"] }); alert("Restaurant deleted."); }
  });

  const onNew = () => setEditing({
    id: 0,
    municipality_id: muniId ?? 0,
    name: "",
    slug: "",
    kind: "restaurant",
    description: null,
    address: "",
    phone: null,
    website: null,
    facebook: null,
    instagram: null,
    opening_hours: null,
    price_range: "moderate",
    cuisine_types: null,
    rating: null,
    lat: 0,
    lng: 0,
    image_url: null,
    featured: 0,
    featured_rank: null
  });

  const items = listQ.data ?? [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left: List */}
      <div className="lg:col-span-2 bg-white border rounded-lg p-3 flex flex-col">
        <div className="flex items-center gap-2">
          <input className="border rounded px-3 py-2 flex-1" placeholder="Search restaurants…" value={q} onChange={(e) => setQ(e.target.value)} />
          <MunicipalitySelect value={muniId} onChange={setMuniId} />
          <button className="ml-auto px-3 py-1.5 rounded bg-black text-white" onClick={onNew}>+ New Restaurant</button>
        </div>

        <div className="mt-3 flex-1 overflow-auto divide-y">
          {items.map((r) => {
            const ct = coerceStringArray(r.cuisine_types);
            return (
              <button
                key={r.id}
                onClick={() => setEditing(r)}
                className="w-full text-left px-2 py-2 hover:bg-neutral-50"
              >
                <div className="font-medium">{r.name} <span className="text-xs text-neutral-500">({r.slug})</span></div>
                <div className="text-xs text-neutral-500">
                  {r.kind ?? "—"} • {ct?.join(" · ") || "—"} • {r.address}
                </div>
                {(r.featured ? true : false) && (
                  <div className="text-xs mt-1">
                    <span className="px-2 py-0.5 rounded bg-sky-50 border mr-1">Featured</span>
                    <span className="px-2 py-0.5 rounded bg-sky-50 border">Top {r.featured_rank ?? "—"}</span>
                  </div>
                )}
              </button>
            );
          })}
          {items.length === 0 && <div className="p-3 text-sm text-neutral-500">No restaurants.</div>}
        </div>
      </div>

      {/* Right: Form */}
      <div className="lg:col-span-3 bg-white border rounded-lg p-4">
        {!editing ? (
          <div className="text-neutral-500">Select a restaurant to edit, or click “New Restaurant”.</div>
        ) : (
          <RestaurantForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onDelete={() => { if (editing.id && window.confirm("Delete this restaurant?")) { remove.mutate(editing.id); setEditing(null); }}}
            onSave={(payload) => {
              if (payload.id && payload.id !== 0) saveUpdate.mutate(payload as Restaurant);
              else saveCreate.mutate(payload as Partial<Restaurant>);
              setEditing(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function RestaurantForm({ initial, onCancel, onDelete, onSave }: {
  initial: Restaurant;
  onCancel: () => void;
  onDelete: () => void;
  onSave: (payload: Partial<Restaurant> | Restaurant) => void;
}) {
  const f = useForm<z.infer<typeof restaurantSchema>>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      ...initial,
      cuisine_types: Array.isArray(initial.cuisine_types) ? initial.cuisine_types.join(", ") : (initial.cuisine_types as any) ?? "",
    }
  });
  const watchName = f.watch("name");
  useEffect(() => {
    const slug = f.getValues("slug");
    if (!slug) f.setValue("slug", watchName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), { shouldDirty: true });
  }, [watchName]);

  const submit = f.handleSubmit((v) => {
    const payload: Partial<Restaurant> = {
      ...v,
      cuisine_types: v.cuisine_types ? v.cuisine_types.split(",").map(s => s.trim()).filter(Boolean) : null,
    };
    onSave(initial.id ? { ...payload, id: initial.id } : payload);
  });

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{initial.id ? "Edit Restaurant" : "Create Restaurant"}</h3>
        <div className="flex gap-2">
          {initial.id ? <button type="button" className="px-3 py-1.5 rounded border" onClick={onDelete}>Delete</button> : null}
          <button type="button" className="px-3 py-1.5 rounded border" onClick={onCancel}>Cancel</button>
          <button type="submit" className="px-3 py-1.5 rounded bg-black text-white">Save</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm">Municipality
          <MunicipalitySelect value={f.watch("municipality_id") || null} onChange={(v) => f.setValue("municipality_id", v ?? 0, { shouldDirty: true })} />
        </label>
        <label className="text-sm">Kind
          <select className="border rounded px-2 py-1 w-full" {...f.register("kind" as any)}>
            <option value="">—</option>
            <option value="restaurant">Restaurant</option>
            <option value="stall">Stall</option>
            <option value="store">Store</option>
            <option value="dealer">Dealer</option>
            <option value="market">Market</option>
            <option value="home-based">Home-based</option>
          </select>
        </label>
        <label className="text-sm">Price Range
          <select className="border rounded px-2 py-1 w-full" {...f.register("price_range" as any)}>
            <option value="">—</option>
            <option value="budget">Budget</option>
            <option value="moderate">Moderate</option>
            <option value="expensive">Expensive</option>
          </select>
        </label>

        <label className="text-sm col-span-2">Name
          <input className="border rounded px-2 py-1 w-full" {...f.register("name")} />
        </label>
        <label className="text-sm">Slug
          <input className="border rounded px-2 py-1 w-full" {...f.register("slug")} />
        </label>

        <label className="text-sm col-span-3">Address
          <input className="border rounded px-2 py-1 w-full" {...f.register("address")} />
        </label>

        <label className="text-sm col-span-3">Description
          <textarea className="border rounded px-2 py-1 w-full" rows={3} {...f.register("description" as any)} />
        </label>

        <label className="text-sm">Phone
          <input className="border rounded px-2 py-1 w-full" {...f.register("phone" as any)} />
        </label>
        <label className="text-sm">Website
          <input className="border rounded px-2 py-1 w-full" {...f.register("website" as any)} />
        </label>
        <label className="text-sm">Facebook
          <input className="border rounded px-2 py-1 w-full" {...f.register("facebook" as any)} />
        </label>
        <label className="text-sm">Instagram
          <input className="border rounded px-2 py-1 w-full" {...f.register("instagram" as any)} />
        </label>
        <label className="text-sm">Opening Hours
          <input className="border rounded px-2 py-1 w-full" {...f.register("opening_hours" as any)} />
        </label>
        <label className="text-sm">Cuisine Types (comma)
          <input className="border rounded px-2 py-1 w-full" {...f.register("cuisine_types" as any)} />
        </label>

        <label className="text-sm">Rating
          <input className="border rounded px-2 py-1 w-full" type="number" step="0.1" {...f.register("rating" as any)} />
        </label>
        <label className="text-sm">Latitude
          <input className="border rounded px-2 py-1 w-full" type="number" step="0.000001" {...f.register("lat" as any)} />
        </label>
        <label className="text-sm">Longitude
          <input className="border rounded px-2 py-1 w-full" type="number" step="0.000001" {...f.register("lng" as any)} />
        </label>

        <label className="text-sm">Image URL
          <input className="border rounded px-2 py-1 w-full" {...f.register("image_url" as any)} />
        </label>
        <label className="text-sm">Featured?
          <select className="border rounded px-2 py-1 w-full" {...f.register("featured" as any)}>
            <option value="">—</option>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
        <label className="text-sm">Featured Rank (1–3)
          <select className="border rounded px-2 py-1 w-full" {...f.register("featured_rank" as any)}>
            <option value="">—</option>
            {[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    </form>
  );
}

// ========== Curation ==========
function CurationPanel() {
  const qc = useQueryClient();
  const [muniId, setMuniId] = useLocalStorage<number | null>("adm:cur:muni", null);
  const [cat, setCat] = useLocalStorage<"food"|"delicacy"|"drink">("adm:cur:cat", "food");
  const dishQ = useQuery({
    queryKey: ["cur:dishes", muniId, cat],
    queryFn: () => listDishes({ municipalityId: muniId ?? undefined, category: cat }),
    enabled: muniId != null
  });
  const restQ = useQuery({
    queryKey: ["cur:restaurants", muniId],
    queryFn: () => listRestaurants({ municipalityId: muniId ?? undefined }),
    enabled: muniId != null
  });

  const assignDish = async (dish: Dish, rank: number | null) => {
    if (muniId == null) return;
    // ensure uniqueness: unset same rank from others
    const all = (dishQ.data ?? []).filter(d => d.id !== dish.id);
    const conflicted = all.find(d => d.panel_rank === rank && (d.is_signature ?? 0) === 1);
    if (rank && conflicted) {
      await setDishCuration(conflicted.id, { is_signature: 0, panel_rank: null });
    }
    await setDishCuration(dish.id, { is_signature: rank ? 1 : 0, panel_rank: rank });
    await qc.invalidateQueries({ queryKey: ["cur:dishes"] });
    alert("Dish curation updated.");
  };

  const assignRest = async (r: Restaurant, rank: number | null) => {
    if (muniId == null) return;
    const all = (restQ.data ?? []).filter(x => x.id !== r.id);
    const conflicted = all.find(x => x.featured_rank === rank && (x.featured ?? 0) === 1);
    if (rank && conflicted) {
      await setRestaurantCuration(conflicted.id, { featured: 0, featured_rank: null });
    }
    await setRestaurantCuration(r.id, { featured: rank ? 1 : 0, featured_rank: rank });
    await qc.invalidateQueries({ queryKey: ["cur:restaurants"] });
    alert("Restaurant curation updated.");
  };

  const sortedD = useMemo(() =>
    (dishQ.data ?? []).slice().sort((a,b)=>(a.panel_rank ?? 99)-(b.panel_rank ?? 99))
  ,[dishQ.data]);

  const sortedR = useMemo(() =>
    (restQ.data ?? []).slice().sort((a,b)=>(a.featured_rank ?? 99)-(b.featured_rank ?? 99))
  ,[restQ.data]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <MunicipalitySelect value={muniId} onChange={setMuniId} />
        <select className="border rounded px-2 py-1" value={cat} onChange={(e)=>setCat(e.target.value as any)}>
          <option value="food">Food</option>
          <option value="delicacy">Delicacy</option>
          <option value="drink">Drink</option>
        </select>
      </div>

      {muniId == null ? <div className="text-neutral-500">Select a municipality.</div> : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-lg p-3">
            <div className="font-semibold mb-2">Dishes / Delicacy</div>
            <ul className="space-y-2 max-h-96 overflow-auto">
              {sortedD.map((d)=>(
                <li key={d.id} className={`p-2 border rounded ${d.is_signature? "bg-amber-50" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-neutral-500">Rank: {d.panel_rank ?? "—"}</div>
                    </div>
                    <div className="flex gap-2">
                      {[1,2,3].map(n => (
                        <button key={n}
                          className={`px-2 py-1 rounded border ${d.panel_rank===n ? "bg-amber-200" : ""}`}
                          onClick={()=>assignDish(d, n)}
                        >Top {n}</button>
                      ))}
                      <button className="px-2 py-1 rounded border" onClick={()=>assignDish(d, null)}>Clear</button>
                    </div>
                  </div>
                </li>
              ))}
              {sortedD.length===0 && <div className="text-sm text-neutral-500 p-2">No dishes.</div>}
            </ul>
          </div>

          <div className="bg-white border rounded-lg p-3">
            <div className="font-semibold mb-2">Restaurants</div>
            <ul className="space-y-2 max-h-96 overflow-auto">
              {sortedR.map((r)=>(
                <li key={r.id} className={`p-2 border rounded ${r.featured? "bg-sky-50" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-neutral-500">Rank: {r.featured_rank ?? "—"}</div>
                    </div>
                    <div className="flex gap-2">
                      {[1,2,3].map(n => (
                        <button key={n}
                          className={`px-2 py-1 rounded border ${r.featured_rank===n ? "bg-sky-200" : ""}`}
                          onClick={()=>assignRest(r, n)}
                        >Top {n}</button>
                      ))}
                      <button className="px-2 py-1 rounded border" onClick={()=>assignRest(r, null)}>Clear</button>
                    </div>
                  </div>
                </li>
              ))}
              {sortedR.length===0 && <div className="text-sm text-neutral-500 p-2">No restaurants.</div>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== Linking ==========
function LinkingPanel() {
  const qc = useQueryClient();
  const [muniId, setMuniId] = useLocalStorage<number | null>("adm:link:muni", null);
  const [cat, setCat] = useLocalStorage<""|"food"|"delicacy"|"drink">("adm:link:cat", "");
  const [qDish, setQDish] = useState("");
  const [qRest, setQRest] = useState("");
  const dishQ = useQuery({
    queryKey: ["link:dishes", muniId, cat, qDish],
    queryFn: () => listDishes({ municipalityId: muniId ?? undefined, category: cat || undefined, q: qDish || undefined }),
  });
  const restQ = useQuery({
    queryKey: ["link:restaurants", muniId, qRest],
    queryFn: () => listRestaurants({ municipalityId: muniId ?? undefined, q: qRest || undefined }),
  });

  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const linkedRestQ = useQuery({
    queryKey: ["link:linked-rest", selectedDish?.id],
    queryFn: () => listRestaurantsForDish(selectedDish!.id),
    enabled: !!selectedDish
  });

  const toggleLink = async (r: Restaurant) => {
    if (!selectedDish) return;
    const linked = linkedRestQ.data ?? [];
    const isLinked = linked.some(x => x.id === r.id);
    if (isLinked) {
      if (window.confirm(`Unlink ${r.name} from ${selectedDish.name}?`)) {
        await unlinkDishRestaurant(selectedDish.id, r.id);
        await qc.invalidateQueries({ queryKey: ["link:linked-rest", selectedDish.id] });
        alert("Unlinked.");
      }
    } else {
      await linkDishRestaurant(selectedDish.id, r.id);
      await qc.invalidateQueries({ queryKey: ["link:linked-rest", selectedDish.id] });
      alert("Linked.");
    }
  };

  const linkedSet = new Set((linkedRestQ.data ?? []).map(r => r.id));
  const restaurants = (restQ.data ?? []).slice().sort((a,b) => {
    const A = linkedSet.has(a.id) ? 0 : 1;
    const B = linkedSet.has(b.id) ? 0 : 1;
    return A - B || a.name.localeCompare(b.name);
  });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Dishes list */}
      <div className="bg-white border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <MunicipalitySelect value={muniId} onChange={setMuniId} />
          <select className="border rounded px-2 py-1" value={cat} onChange={(e)=>setCat(e.target.value as any)}>
            <option value="">All categories</option>
            <option value="food">Food</option>
            <option value="delicacy">Delicacy</option>
            <option value="drink">Drink</option>
          </select>
          <input className="border rounded px-2 py-1 flex-1" placeholder="Search dishes…" value={qDish} onChange={(e)=>setQDish(e.target.value)} />
        </div>
        <ul className="max-h-96 overflow-auto divide-y">
          {(dishQ.data ?? []).map((d)=>(
            <li key={d.id}>
              <button
                className={`w-full text-left px-2 py-2 hover:bg-neutral-50 ${selectedDish?.id===d.id ? "bg-amber-50" : ""}`}
                onClick={() => setSelectedDish(d)}
              >
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-neutral-500">{d.category} • {d.slug}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Restaurants list with link toggles */}
      <div className="bg-white border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <input className="border rounded px-2 py-1 flex-1" placeholder="Search restaurants…" value={qRest} onChange={(e)=>setQRest(e.target.value)} />
          <div className="text-sm text-neutral-500">
            {selectedDish ? <span>Linking to: <b>{selectedDish.name}</b></span> : "Select a dish to start linking"}
          </div>
        </div>
        <ul className="max-h-96 overflow-auto divide-y">
          {restaurants.map((r)=>(
            <li key={r.id} className="flex items-center justify-between px-2 py-2">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-neutral-500">{r.slug} • {r.address}</div>
                {linkedSet.has(r.id) && <span className="inline-block text-xs mt-1 px-2 py-0.5 rounded bg-green-50 border text-green-700">Linked</span>}
              </div>
              <button
                className={`px-3 py-1.5 rounded border ${linkedSet.has(r.id) ? "bg-green-600 text-white" : ""}`}
                disabled={!selectedDish}
                onClick={()=>toggleLink(r)}
              >{linkedSet.has(r.id) ? "Unlink" : "Link"}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ========== Main Admin Page (Tabs) ==========
export default function AdminDashboard() {
  const [tab, setTab] = useLocalStorage<"analytics"|"dishes"|"restaurants"|"curation"|"linking">("adm:tab","analytics");

  return (
    <div className="space-y-4">
      <div className="sticky top-0 bg-neutral-50/70 backdrop-blur z-10 py-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold mr-4">Admin Dashboard</h1>
          {(["analytics","dishes","restaurants","curation","linking"] as const).map(t => (
            <button
              key={t}
              className={`px-3 py-1.5 rounded border ${tab===t ? "bg-black text-white" : ""}`}
              onClick={()=>setTab(t)}
            >
              {t[0].toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab==="analytics" && <AnalyticsPanel />}
      {tab==="dishes" && <DishesPanel />}
      {tab==="restaurants" && <RestaurantsPanel />}
      {tab==="curation" && <CurationPanel />}
      {tab==="linking" && <LinkingPanel />}
    </div>
  );
}
