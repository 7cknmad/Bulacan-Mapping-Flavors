// src/pages/admin/AdminDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import MunicipalitySelect from "../../components/admin/MunicipalitySelect";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { AdminAPI } from "../../utils/adminApi";

/* ------------------------- helpers ------------------------- */
const useAsync = <T,>(fn: () => Promise<T>, deps: any[] = []) => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(String(e?.message || e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, loading, refresh: () => fn().then(setData) };
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

/* ------------------------- validation ------------------------- */
const dishSchema = z.object({
  municipality_id: z.number({ required_error: "Municipality is required" }),
  category_code: z.enum(["food", "delicacy", "drink"]),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional().nullable(),
  flavor_profile: z.string().optional().nullable(), // comma-sep UI; converted on submit
  ingredients: z.string().optional().nullable(), // comma-sep UI; converted on submit
  image_url: z.string().url().optional().or(z.literal("")).nullable(),
  popularity: z.coerce.number().min(0).max(100).default(0),
  rating: z.coerce.number().min(0).max(5).default(0),
});
type DishInput = z.infer<typeof dishSchema>;

const restSchema = z.object({
  municipality_id: z.number({ required_error: "Municipality is required" }),
  name: z.string().min(2),
  slug: z.string().min(2),
  kind: z
    .enum(["restaurant", "stall", "store", "dealer", "market", "home-based"])
    .default("restaurant"),
  address: z.string().min(2),
  description: z.string().optional().nullable(),
  price_range: z.enum(["budget", "moderate", "expensive"]).default("moderate"),
  cuisine_types: z.string().optional().nullable(), // comma-sep UI; converted on submit
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  facebook: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  opening_hours: z.string().optional().nullable(),
  rating: z.coerce.number().min(0).max(5).default(0),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});
type RestInput = z.infer<typeof restSchema>;

/* ------------------------- main ------------------------- */
export default function AdminDashboard() {
  const [tab, setTab] = useState<
    "analytics" | "dishes" | "restaurants" | "curation"
  >("analytics");

  return (
    <div className="min-h-[70vh]">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <nav className="ml-auto flex gap-2">
            {(["analytics", "dishes", "restaurants", "curation"] as const).map(
              (k) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    tab === k
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-white hover:bg-neutral-50"
                  }`}
                >
                  {k[0].toUpperCase() + k.slice(1)}
                </button>
              )
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "dishes" && <DishesTab />}
        {tab === "restaurants" && <RestaurantsTab />}
        {tab === "curation" && <CurationTab />}
      </main>
    </div>
  );
}

/* ------------------------- Analytics ------------------------- */
function AnalyticsTab() {
  const [muniId, setMuniId] = useState<number | null>(null);

  // These endpoints must exist in your API; UI will handle 404 by showing error text.
  const { data: summary, error, loading } = useAsync(
    () => AdminAPI.summary(),
    []
  );
  const { data: topD } = useAsync(
    () => AdminAPI.topDishes(muniId ?? undefined),
    [muniId]
  );
  const { data: topR } = useAsync(
    () => AdminAPI.topRestaurants(muniId ?? undefined),
    [muniId]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4">
        <MunicipalitySelect value={muniId} onChange={setMuniId} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-4 text-sm text-neutral-500">Loading…</div>
        ) : error ? (
          <div className="col-span-4 text-sm text-red-600">{error}</div>
        ) : summary ? (
          <>
            <StatCard label="Municipalities" value={(summary as any).municipalities} />
            <StatCard label="Dishes" value={(summary as any).dishes} />
            <StatCard label="Delicacies" value={(summary as any).delicacies} />
            <StatCard label="Restaurants" value={(summary as any).restaurants} />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Top Dishes (by links & rank)">
          <BarWrap
            data={(topD as any[]) ?? []}
            x="name"
            bars={[{ key: "places", label: "Places" }]}
          />
        </ChartCard>
        <ChartCard title="Top Restaurants (by dishes & rank)">
          <BarWrap
            data={(topR as any[]) ?? []}
            x="name"
            bars={[{ key: "dishes", label: "Dishes" }]}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
function ChartCard({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="font-medium mb-3">{title}</div>
      {children}
    </div>
  );
}
function BarWrap({
  data,
  x,
  bars,
}: {
  data: any[];
  x: string;
  bars: { key: string; label: string }[];
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={x} hide />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.label} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------- Dishes ------------------------- */
function DishesTab() {
  const [muniId, setMuniId] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("");
  const [q, setQ] = useState("");

  const qs = useMemo(() => {
    const u = new URLSearchParams();
    if (muniId) u.set("municipalityId", String(muniId));
    if (category) u.set("category", category);
    if (q) u.set("q", q);
    return `?${u.toString()}`;
  }, [muniId, category, q]);

  const {
    data,
    error,
    loading,
    refresh,
  } = useAsync<any[]>(() => AdminAPI.dishesList(qs), [qs]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DishInput>({
    resolver: zodResolver(dishSchema),
    defaultValues: { popularity: 0, rating: 0 },
  });

  const dishMuniId = watch("municipality_id") ?? null;
  const nameVal = watch("name") || "";
  const slugVal = watch("slug") || "";

  // auto-fill slug once from name (if slug empty)
  useEffect(() => {
    const s =
      nameVal
        ?.toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-") ?? "";
    if (!slugVal && s) setValue("slug", s);
  }, [nameVal, slugVal, setValue]);

  const onCreate = async (payload: DishInput) => {
    const body = {
      ...payload,
      flavor_profile: payload.flavor_profile
        ? payload.flavor_profile
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      ingredients: payload.ingredients
        ? payload.ingredients
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    };
    await AdminAPI.createDish(body);
    reset();
    refresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="flex gap-3 items-end mb-3">
          <MunicipalitySelect
            value={muniId}
            onChange={setMuniId}
            className="w-56"
          />
          <label className="block">
            <div className="text-xs font-medium text-neutral-600 mb-1">
              Category
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="food">Food</option>
              <option value="delicacy">Delicacy</option>
              <option value="drink">Drink</option>
            </select>
          </label>
          <label className="block flex-1">
            <div className="text-xs font-medium text-neutral-600 mb-1">
              Search dishes
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Type to filter..."
            />
          </label>
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Cat</th>
                <th className="text-left px-3 py-2">Muni</th>
                <th className="text-left px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td className="px-3 py-3 text-red-600" colSpan={4}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && (data?.length ?? 0) === 0 && (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={4}>
                    No dishes
                  </td>
                </tr>
              )}
              {(data ?? []).map((d: any) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2">{d.name}</td>
                  <td className="px-3 py-2">{d.category}</td>
                  <td className="px-3 py-2">{d.municipality_id}</td>
                  <td className="px-3 py-2">
                    <button
                      className="text-amber-700 hover:underline mr-3"
                      onClick={async () => {
                        const name = prompt("Edit name", d.name);
                        if (!name) return;
                        await AdminAPI.updateDish(d.id, { name });
                        refresh();
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-600 hover:underline"
                      onClick={async () => {
                        if (!confirm(`Delete "${d.name}"?`)) return;
                        await AdminAPI.deleteDish(d.id);
                        refresh();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create form */}
      <div className="bg-white border rounded-lg p-4">
        <div className="text-xl font-semibold mb-3">Create Dish</div>
        <form onSubmit={handleSubmit(onCreate)} className="space-y-3">
          <MunicipalitySelect
            label="Municipality"
            value={dishMuniId}
            onChange={(id) => {
              if (id != null) setValue("municipality_id", id, { shouldDirty: true });
            }}
          />

          <label className="block">
            <div className="text-xs font-medium text-neutral-600 mb-1">Name</div>
            <input
              {...register("name")}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="e.g. Valenciana (SJDM)"
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
            )}
          </label>

          <label className="block">
            <div className="text-xs font-medium text-neutral-600 mb-1">Slug</div>
            <input
              {...register("slug")}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="auto-from-name"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-neutral-600 mb-1">
              Category
            </div>
            <select
              {...register("category_code")}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="food">Food</option>
              <option value="delicacy">Delicacy</option>
              <option value="drink">Drink</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-medium text-neutral-600 mb-1">
              Description
            </div>
            <textarea
              {...register("description")}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-neutral-600 mb-1">
              Flavor profile (comma-sep)
            </div>
            <input
              {...register("flavor_profile")}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-neutral-600 mb-1">
              Ingredients (comma-sep)
            </div>
            <input
              {...register("ingredients")}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-neutral-600 mb-1">
              Image URL
            </div>
            <input
              {...register("image_url")}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-medium text-neutral-600 mb-1">
                Popularity (0-100)
              </div>
              <input
                type="number"
                {...register("popularity", { valueAsNumber: true })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                defaultValue={0}
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-neutral-600 mb-1">
                Rating (0-5)
              </div>
              <input
                type="number"
                step="0.1"
                {...register("rating", { valueAsNumber: true })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                defaultValue={0}
              />
            </label>
          </div>

          <button
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-amber-600 text-white"
          >
            {isSubmitting ? "Creating…" : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------- Restaurants ------------------------- */
function RestaurantsTab() {
  const [muniId, setMuniId] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const qs = useMemo(() => {
    const u = new URLSearchParams();
    if (muniId) u.set("municipalityId", String(muniId));
    if (q) u.set("q", q);
    return `?${u.toString()}`;
  }, [muniId, q]);

  const {
    data,
    error,
    loading,
    refresh,
  } = useAsync<any[]>(() => AdminAPI.restaurantsList(qs), [qs]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<RestInput>({ resolver: zodResolver(restSchema) });

  const restMuniId = watch("municipality_id") ?? null;
  const restName = watch("name") || "";
  const restSlug = watch("slug") || "";

  useEffect(() => {
    const s =
      restName
        ?.toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-") ?? "";
    if (!restSlug && s) setValue("slug", s);
  }, [restName, restSlug, setValue]);

  const onCreate = async (payload: RestInput) => {
    const body = {
      ...payload,
      cuisine_types: payload.cuisine_types
        ? payload.cuisine_types
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    };
    await AdminAPI.createRestaurant(body);
    reset();
    refresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="flex gap-3 items-end mb-3">
          <MunicipalitySelect
            value={muniId}
            onChange={setMuniId}
            className="w-56"
          />
          <label className="block flex-1">
            <div className="text-xs font-medium text-neutral-600 mb-1">
              Search restaurants
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Type to filter..."
            />
          </label>
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Kind</th>
                <th className="text-left px-3 py-2">Muni</th>
                <th className="text-left px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td className="px-3 py-3 text-red-600" colSpan={4}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && (data?.length ?? 0) === 0 && (
                <tr>
                  <td className="px-3 py-3 text-neutral-500" colSpan={4}>
                    No restaurants
                  </td>
                </tr>
              )}
              {(data ?? []).map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.kind}</td>
                  <td className="px-3 py-2">{r.municipality_id ?? "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      className="text-amber-700 hover:underline mr-3"
                      onClick={async () => {
                        const name = prompt("Edit name", r.name);
                        if (!name) return;
                        await AdminAPI.updateRestaurant(r.id, { name });
                        refresh();
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-600 hover:underline"
                      onClick={async () => {
                        if (!confirm(`Delete "${r.name}"?`)) return;
                        await AdminAPI.deleteRestaurant(r.id);
                        refresh();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create form */}
      <div className="bg-white border rounded-lg p-4">
        <div className="text-xl font-semibold mb-3">Create Restaurant</div>
        <form onSubmit={handleSubmit(onCreate)} className="space-y-3">
          <MunicipalitySelect
            label="Municipality"
            value={restMuniId}
            onChange={(id) => {
              if (id != null) setValue("municipality_id", id, { shouldDirty: true });
            }}
          />

          <label className="block">
            <div className="text-xs font-medium mb-1">Name</div>
            <input
              {...register("name")}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium mb-1">Slug</div>
            <input
              {...register("slug")}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium mb-1">Kind</div>
            <select
              {...register("kind")}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="restaurant">Restaurant</option>
              <option value="stall">Stall</option>
              <option value="store">Store</option>
              <option value="dealer">Dealer</option>
              <option value="market">Market</option>
              <option value="home-based">Home-based</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-medium mb-1">Address</div>
            <input
              {...register("address")}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-medium mb-1">Latitude</div>
              <input
                type="number"
                step="any"
                {...register("lat", { valueAsNumber: true })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium mb-1">Longitude</div>
              <input
                type="number"
                step="any"
                {...register("lng", { valueAsNumber: true })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-xs font-medium mb-1">
              Cuisine types (comma-sep)
            </div>
            <input
              {...register("cuisine_types")}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-medium mb-1">Price range</div>
              <select
                {...register("price_range")}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="budget">Budget</option>
                <option value="moderate">Moderate</option>
                <option value="expensive">Expensive</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs font-medium mb-1">Rating (0–5)</div>
              <input
                type="number"
                step="0.1"
                {...register("rating", { valueAsNumber: true })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                defaultValue={0}
              />
            </label>
          </div>

          <button
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-amber-600 text-white"
          >
            {isSubmitting ? "Creating…" : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------- Curation (link dish<->restaurant) ------------------------- */
function CurationTab() {
  const [dishQuery, setDishQuery] = useState("");
  const [restQuery, setRestQuery] = useState("");
  const [filterMuni, setFilterMuni] = useState<number | null>(null);
  const [selectedDish, setSelectedDish] = useState<{
    id: number;
    name: string;
    slug: string;
    category?: string;
  } | null>(null);

  const { data: dishMatches } = useAsync<any[]>(
    () => AdminAPI.searchDishes(dishQuery),
    [dishQuery]
  );
  const { data: restMatches } = useAsync<any[]>(
    () => AdminAPI.searchRestaurants(restQuery),
    [restQuery]
  );

  const [linkedIds, setLinkedIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    setLinkedIds(new Set());
  }, [selectedDish?.id]);

  const toggleLink = async (restId: number, checked: boolean) => {
    if (!selectedDish) return;
    if (checked) {
      await AdminAPI.linkDishRestaurant(selectedDish.id, restId);
      setLinkedIds((prev) => new Set(prev).add(restId));
    } else {
      await AdminAPI.unlinkDishRestaurant(selectedDish.id, restId);
      setLinkedIds((prev) => {
        const n = new Set(prev);
        n.delete(restId);
        return n;
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border rounded-lg p-4">
        <div className="font-medium mb-2">Pick a dish</div>
        <input
          value={dishQuery}
          onChange={(e) => setDishQuery(e.target.value)}
          placeholder="Search dish by name…"
          className="w-full border rounded-md px-3 py-2 text-sm mb-3"
        />
        <div className="max-h-72 overflow-auto border rounded-md">
          {(dishMatches ?? []).map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDish(d)}
              className={`w-full text-left px-3 py-2 border-b hover:bg-neutral-50 ${
                selectedDish?.id === d.id ? "bg-amber-50" : ""
              }`}
            >
              <div className="font-medium">{d.name}</div>
              <div className="text-xs text-neutral-500">{d.category}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-end gap-3 mb-3">
          <div className="font-medium flex-1">
            {selectedDish ? (
              <>
                Link restaurants to:{" "}
                <span className="font-semibold">{selectedDish.name}</span>
              </>
            ) : (
              "Pick a dish first"
            )}
          </div>
          <MunicipalitySelect value={filterMuni} onChange={setFilterMuni} />
        </div>
        <input
          value={restQuery}
          onChange={(e) => setRestQuery(e.target.value)}
          placeholder="Search restaurant by name…"
          className="w-full border rounded-md px-3 py-2 text-sm mb-3"
        />
        <div className="max-h-80 overflow-auto border rounded-md">
          {(restMatches ?? [])
            .filter((r) => !filterMuni || r.municipality_id === filterMuni)
            .map((r) => {
              const checked = linkedIds.has(r.id);
              return (
                <label
                  key={r.id}
                  className="flex items-center gap-2 px-3 py-2 border-b"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleLink(r.id, e.target.checked)}
                    disabled={!selectedDish}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-neutral-500">{r.slug}</div>
                  </div>
                </label>
              );
            })}
        </div>
      </div>
    </div>
  );
}
