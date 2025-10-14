import React, { useEffect, useMemo, useState } from "react";
import MunicipalitySelect from "../../components/admin/MunicipalitySelect";
import useDebounce from "../../hooks/useDebounce";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, AreaChart, Area
} from "recharts";


const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toListFromInput(v: string): string[] {
  return (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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
  const [dishChart, setDishChart] = useState<"bar" | "line" | "area">("bar");
  const [restoChart, setRestoChart] = useState<"bar" | "line" | "area">("bar");

  const COLORS = [
    "#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#7c3aed", "#0ea5e9", "#22c55e",
  ];

  useEffect(() => {
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (municipalityId) qs.set("municipalityId", String(municipalityId));
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        const [a, b, c] = await Promise.all([
          jget<OverviewStats>(`/api/admin/stats/overview${suffix}`),
          jget<any[]>(`/api/admin/stats/top-dishes${suffix}&limit=7`.replace("?&", "?")),
          jget<any[]>(`/api/admin/stats/top-restaurants${suffix}&limit=7`.replace("?&", "?")),
        ]);
        setOverview(a);
        setTopDishes(Array.isArray(b) ? b : []);
        setTopRestos(Array.isArray(c) ? c : []);
      } catch (e) {
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
        <ChartCard
          title="Top Dishes (by places)"
          control={
            <select
              className="border rounded px-2 py-1 text-sm"
              value={dishChart}
              onChange={(e) => setDishChart(e.target.value as any)}
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="area">Area</option>
            </select>
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            {dishChart === "bar" ? (
              <BarChart data={topDishes}>
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="places">
                  {topDishes.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : dishChart === "line" ? (
              <LineChart data={topDishes}>
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="places"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            ) : (
              <AreaChart data={topDishes}>
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="places"
                  stroke="#22c55e"
                  fill="#22c55e33"
                  strokeWidth={2}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Top Restaurants (by dish count)"
          control={
            <select
              className="border rounded px-2 py-1 text-sm"
              value={restoChart}
              onChange={(e) => setRestoChart(e.target.value as any)}
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="area">Area</option>
            </select>
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            {restoChart === "bar" ? (
              <BarChart data={topRestos}>
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="dishes">
                  {topRestos.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : restoChart === "line" ? (
              <LineChart data={topRestos}>
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="dishes"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            ) : (
              <AreaChart data={topRestos}>
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="dishes"
                  stroke="#f59e0b"
                  fill="#f59e0b33"
                  strokeWidth={2}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title, control, children
}: { title: string; control?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-lg border bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">{title}</div>
        {control}
      </div>
      {children}
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

/* -------- Dishes CRUD (react-hook-form + Zod) -------- */
const dishSchema = z.object({
  municipality_id: z.number().int().positive({ message: "Municipality is required" }),
  category_code: z.enum(["food", "delicacy", "drink"]),
  name: z.string().min(2, "Name is too short"),
  slug: z.string().min(2, "Slug is too short").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  description: z.string().optional(),
  flavor_profile_csv: z.string().optional(),  // CSV in UI → array on submit
  ingredients_csv: z.string().optional(),
  image_url: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  popularity: z.coerce.number().min(0).max(100).default(0),
  rating: z.coerce.number().min(0).max(5).default(0),
});
type DishForm = z.infer<typeof dishSchema>;

function ManageDishes({ municipalityId, q }: { municipalityId: number | null; q: string }) {
  const [list, setList] = useState<Dish[]>([]);
  const [cat, setCat] = useState<"" | "food" | "delicacy" | "drink">("");
  const [editing, setEditing] = useState<Dish | null>(null);
  const [autoSlug, setAutoSlug] = useState(true);

  const {
    register, handleSubmit, control, setValue, watch, reset,
    formState: { errors, isSubmitting }
  } = useForm<DishForm>({
    resolver: zodResolver(dishSchema),
    defaultValues: {
      municipality_id: municipalityId ?? undefined,
      category_code: "food",
      name: "",
      slug: "",
      description: "",
      flavor_profile_csv: "",
      ingredients_csv: "",
      image_url: "",
      popularity: 0,
      rating: 0,
    }
  });

  // Auto-slug: keep slug in sync with name unless turned off
  const nameWatch = watch("name");
  useEffect(() => {
    if (autoSlug) setValue("slug", slugify(nameWatch || ""));
  }, [nameWatch, autoSlug, setValue]);

  // Reload grid
  const reload = async () => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    if (cat) qs.set("category", cat);
    qs.set("limit", "200");
    const rows = await jget<Dish[]>(`/api/dishes?${qs.toString()}`);
    setList(rows.map((r) => ({
      ...r,
      flavor_profile: Array.isArray(r.flavor_profile) ? r.flavor_profile : (r.flavor_profile ? safeJsonArray(r.flavor_profile) : []),
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : (r.ingredients ? safeJsonArray(r.ingredients) : []),
    })));
  };
  useEffect(() => { reload(); /* eslint-disable-line */ }, [municipalityId, q, cat]);

  // Create
  const onCreate = async (data: DishForm) => {
    const payload = {
      municipality_id: data.municipality_id,
      category_code: data.category_code,
      name: data.name.trim(),
      slug: data.slug.trim(),
      description: data.description || null,
      flavor_profile: toListFromInput(data.flavor_profile_csv || ""),
      ingredients: toListFromInput(data.ingredients_csv || ""),
      image_url: data.image_url || null,
      popularity: data.popularity ?? 0,
      rating: data.rating ?? 0,
    };
    await jsend("/api/admin/dishes", payload, "POST");
    reset({
      municipality_id: municipalityId ?? undefined,
      category_code: "food",
      name: "",
      slug: "",
      description: "",
      flavor_profile_csv: "",
      ingredients_csv: "",
      image_url: "",
      popularity: 0,
      rating: 0,
    });
    setAutoSlug(true);
    reload();
  };

  // Edit (fill form with row)
  const startEdit = (d: Dish) => {
    setEditing(d);
    reset({
      municipality_id: d.municipality_id,
      category_code: d.category,
      name: d.name,
      slug: d.slug,
      description: d.description ?? "",
      flavor_profile_csv: (d.flavor_profile ?? []).join(", "),
      ingredients_csv: (d.ingredients ?? []).join(", "),
      image_url: d.image_url ?? "",
      popularity: d.popularity ?? 0,
      rating: d.rating ?? 0,
    });
    setAutoSlug(false);
  };

  const saveEdit = async (data: DishForm) => {
    if (!editing) return;
    const body = {
      municipality_id: data.municipality_id,
      category_code: data.category_code,
      name: data.name.trim(),
      slug: data.slug.trim(),
      description: data.description || null,
      flavor_profile: toListFromInput(data.flavor_profile_csv || ""),
      ingredients: toListFromInput(data.ingredients_csv || ""),
      image_url: data.image_url || null,
      popularity: data.popularity ?? 0,
      rating: data.rating ?? 0,
    };
    await jsend(`/api/admin/dishes/${editing.id}`, body, "PATCH");
    setEditing(null);
    reset();
    setAutoSlug(true);
    reload();
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Left: filters + list */}
      <div className="md:col-span-2 space-y-3">
        <div className="flex gap-2 items-center">
          <div className="text-sm text-neutral-500">Category</div>
          <select className="input w-40" value={cat} onChange={(e) => setCat(e.target.value as any)}>
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
              {list.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="p-2">{d.name}</td>
                  <td className="p-2 text-center">{d.category}</td>
                  <td className="p-2 text-center">{d.municipality_id}</td>
                  <td className="p-2 text-center">{d.panel_rank ?? "—"}</td>
                  <td className="p-2 text-center">
                    <button className="text-primary-600 underline" onClick={() => startEdit(d)}>Edit</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-neutral-500">
                    No results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Create or Edit (single form) */}
      <div className="space-y-3">
        <h3 className="font-semibold">{editing ? "Edit Dish" : "Create Dish"}</h3>

        <form
          className="space-y-2"
          onSubmit={editing ? handleSubmit(saveEdit) : handleSubmit(onCreate)}
        >
          {/* Municipality dropdown */}
          <div>
            <div className="text-xs text-neutral-500 mb-1">Municipality</div>
            <Controller
              name="municipality_id"
              control={control}
              render={({ field }) => (
                <MunicipalitySelect
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id ?? undefined)}
                  placeholder="Select municipality…"
                  allowAll={false}
                />
              )}
            />
            {errors.municipality_id && (
              <div className="text-xs text-red-600 mt-1">{errors.municipality_id.message}</div>
            )}
          </div>

          {/* Name + Slug (auto) */}
          <div>
            <div className="text-xs text-neutral-500 mb-1">Name</div>
            <input className="input w-full" {...register("name")} placeholder="e.g. Valenciana (SJDM)" />
            {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name.message}</div>}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-xs text-neutral-500 mb-1">Slug</div>
              <input className="input w-full" {...register("slug")} placeholder="auto-generated-from-name" />
              {errors.slug && <div className="text-xs text-red-600 mt-1">{errors.slug.message}</div>}
            </div>
            <label className="text-xs flex items-center gap-1">
              <input
                type="checkbox"
                checked={autoSlug}
                onChange={(e) => setAutoSlug(e.target.checked)}
              />
              Auto-slug
            </label>
          </div>

          {/* Category */}
          <div>
            <div className="text-xs text-neutral-500 mb-1">Category</div>
            <select className="input w-full" {...register("category_code")}>
              <option value="food">Food</option>
              <option value="delicacy">Delicacy</option>
              <option value="drink">Drink</option>
            </select>
          </div>

          <textarea className="input" {...register("description")} placeholder="Description" />
          <input className="input" {...register("flavor_profile_csv")} placeholder="Flavor profile (comma-sep)" />
          <input className="input" {...register("ingredients_csv")} placeholder="Ingredients (comma-sep)" />
          <input className="input" {...register("image_url")} placeholder="Image URL" />
          {errors.image_url && <div className="text-xs text-red-600 mt-1">{errors.image_url.message}</div>}

          <div className="flex gap-2">
            <input className="input" type="number" step="1" {...register("popularity", { valueAsNumber: true })} placeholder="Popularity" />
            <input className="input" type="number" step="0.1" {...register("rating", { valueAsNumber: true })} placeholder="Rating" />
          </div>

          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={isSubmitting}>
              {editing ? "Save" : "Create"}
            </button>
            {editing && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditing(null);
                  reset();
                  setAutoSlug(true);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}


/* -------- Restaurants CRUD -------- */
/* -------- Restaurants CRUD (react-hook-form + Zod) -------- */
const restoSchema = z.object({
  municipality_id: z.number().int().positive({ message: "Municipality is required" }),
  name: z.string().min(2, "Name is too short"),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  kind: z.enum(["restaurant", "stall", "store", "dealer", "market", "home-based"]).default("restaurant"),
  address: z.string().min(3, "Address is required"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  description: z.string().optional(),
  price_range: z.enum(["budget", "moderate", "expensive"]).default("moderate"),
  cuisine_csv: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  facebook: z.string().url().optional().or(z.literal("")),
  instagram: z.string().url().optional().or(z.literal("")),
  opening_hours: z.string().optional(),
  rating: z.coerce.number().min(0).max(5).default(0),
});
type RestoForm = z.infer<typeof restoSchema>;

function ManageRestaurants({ municipalityId, q }: { municipalityId: number | null; q: string }) {
  const [list, setList] = useState<Restaurant[]>([]);
  const [editing, setEditing] = useState<Restaurant | null>(null);

  const {
    register, handleSubmit, control, setValue, reset,
    formState: { errors, isSubmitting }
  } = useForm<RestoForm>({
    resolver: zodResolver(restoSchema),
    defaultValues: {
      municipality_id: municipalityId ?? undefined,
      name: "", slug: "",
      kind: "restaurant",
      address: "",
      lat: 0, lng: 0,
      description: "",
      price_range: "moderate",
      cuisine_csv: "",
      phone: "",
      website: "", facebook: "", instagram: "",
      opening_hours: "",
      rating: 0,
    }
  });

  const nameWatch = watchSafe(register, "name");
  const [autoSlug, setAutoSlug] = useState(true);
  useEffect(() => {
    if (autoSlug) setValue("slug", slugify(nameWatch || ""));
  }, [nameWatch, autoSlug, setValue]);

  const reload = async () => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    qs.set("limit", "200");
    const rows = await jget<Restaurant[]>(`/api/restaurants?${qs.toString()}`);
    setList(rows.map((r) => ({
      ...r,
      cuisine_types: Array.isArray(r.cuisine_types) ? r.cuisine_types : (r.cuisine_types ? safeJsonArray(r.cuisine_types) : []),
    })));
  };
  useEffect(() => { reload(); /* eslint-disable-line */ }, [municipalityId, q]);

  const onCreate = async (data: RestoForm) => {
    const payload = {
      municipality_id: data.municipality_id,
      name: data.name.trim(),
      slug: data.slug.trim(),
      kind: data.kind,
      address: data.address.trim(),
      lat: data.lat, lng: data.lng,
      description: data.description || null,
      price_range: data.price_range,
      cuisine_types: toListFromInput(data.cuisine_csv || ""),
      phone: data.phone || null,
      website: data.website || null,
      facebook: data.facebook || null,
      instagram: data.instagram || null,
      opening_hours: data.opening_hours || null,
      rating: data.rating ?? 0,
    };
    await jsend("/api/admin/restaurants", payload, "POST");
    reset({ municipality_id: municipalityId ?? undefined, kind: "restaurant", price_range: "moderate" } as any);
    setAutoSlug(true);
    reload();
  };

  const startEdit = (r: Restaurant) => {
    setEditing(r);
    reset({
      municipality_id: r.municipality_id ?? municipalityId ?? undefined,
      name: r.name, slug: r.slug, kind: (r.kind as any) || "restaurant",
      address: r.address, lat: r.lat, lng: r.lng,
      description: r.description ?? "",
      price_range: r.price_range,
      cuisine_csv: (r.cuisine_types ?? []).join(", "),
      phone: r.phone ?? "",
      website: r.website ?? "", facebook: r.facebook ?? "", instagram: r.instagram ?? "",
      opening_hours: r.opening_hours ?? "",
      rating: r.rating ?? 0,
    });
    setAutoSlug(false);
  };

  const saveEdit = async (data: RestoForm) => {
    if (!editing) return;
    const body = {
      municipality_id: data.municipality_id,
      name: data.name.trim(),
      slug: data.slug.trim(),
      kind: data.kind,
      address: data.address.trim(),
      lat: data.lat, lng: data.lng,
      description: data.description || null,
      price_range: data.price_range,
      cuisine_types: toListFromInput(data.cuisine_csv || ""),
      phone: data.phone || null,
      website: data.website || null,
      facebook: data.facebook || null,
      instagram: data.instagram || null,
      opening_hours: data.opening_hours || null,
      rating: data.rating ?? 0,
    };
    await jsend(`/api/admin/restaurants/${editing.id}`, body, "PATCH");
    setEditing(null);
    reset();
    setAutoSlug(true);
    reload();
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
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
              {list.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-center">{r.municipality_id ?? "—"}</td>
                  <td className="p-2 text-center">{r.price_range}</td>
                  <td className="p-2 text-center">{r.panel_rank ?? "—"}</td>
                  <td className="p-2 text-center">
                    <button className="text-primary-600 underline" onClick={() => startEdit(r)}>Edit</button>
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

      <div className="space-y-3">
        <h3 className="font-semibold">{editing ? "Edit Restaurant" : "Create Restaurant"}</h3>

        <form
          className="space-y-2"
          onSubmit={editing ? handleSubmit(saveEdit) : handleSubmit(onCreate)}
        >
          {/* Municipality dropdown */}
          <div>
            <div className="text-xs text-neutral-500 mb-1">Municipality</div>
            <Controller
              name="municipality_id"
              control={control}
              render={({ field }) => (
                <MunicipalitySelect
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id ?? undefined)}
                  placeholder="Select municipality…"
                  allowAll={false}
                />
              )}
            />
            {errors.municipality_id && (
              <div className="text-xs text-red-600 mt-1">{errors.municipality_id.message}</div>
            )}
          </div>

          {/* Name + Slug */}
          <div>
            <div className="text-xs text-neutral-500 mb-1">Name</div>
            <input className="input w-full" {...register("name")} placeholder="Name" />
            {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name.message}</div>}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-xs text-neutral-500 mb-1">Slug</div>
              <input className="input w-full" {...register("slug")} placeholder="slug-like-this" />
              {errors.slug && <div className="text-xs text-red-600 mt-1">{errors.slug.message}</div>}
            </div>
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={autoSlug} onChange={(e) => setAutoSlug(e.target.checked)} />
              Auto-slug
            </label>
          </div>

          <select className="input" {...register("kind")}>
            <option>restaurant</option><option>stall</option><option>store</option>
            <option>dealer</option><option>market</option><option>home-based</option>
          </select>

          <input className="input" {...register("address")} placeholder="Address" />
          {errors.address && <div className="text-xs text-red-600 mt-1">{errors.address.message}</div>}

          <div className="flex gap-2">
            <input className="input" type="number" step="0.000001" {...register("lat", { valueAsNumber: true })} placeholder="Lat" />
            <input className="input" type="number" step="0.000001" {...register("lng", { valueAsNumber: true })} placeholder="Lng" />
          </div>
          {(errors.lat || errors.lng) && (
            <div className="text-xs text-red-600 mt-1">Latitude/Longitude invalid</div>
          )}

          <select className="input" {...register("price_range")}>
            <option>budget</option><option>moderate</option><option>expensive</option>
          </select>

          <textarea className="input" {...register("description")} placeholder="Description" />
          <input className="input" {...register("cuisine_csv")} placeholder="Cuisines (comma-sep)" />
          <input className="input" {...register("phone")} placeholder="Phone" />
          <input className="input" {...register("website")} placeholder="Website URL" />
          <input className="input" {...register("facebook")} placeholder="Facebook URL" />
          <input className="input" {...register("instagram")} placeholder="Instagram URL" />
          <input className="input" {...register("opening_hours")} placeholder="Opening hours" />
          <input className="input" type="number" step="0.1" {...register("rating", { valueAsNumber: true })} placeholder="Rating" />

          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={isSubmitting}>
              {editing ? "Save" : "Create"}
            </button>
            {editing && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditing(null);
                  reset();
                  setAutoSlug(true);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// small helper so RHF watch doesn't explode if not used
function watchSafe(registerFn: any, name: string) {
  try { return (registerFn as any)._f?.name ? undefined : ""; } catch { return ""; }
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
