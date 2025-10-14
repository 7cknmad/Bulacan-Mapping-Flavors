// src/pages/admin/AdminDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  adminStats, adminData, list,
  type Municipality, type Dish, type Restaurant
} from "../../utils/adminApi";
import MunicipalitySelect from "../../components/admin/MunicipalitySelect";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

/* ========== Helpers ========== */
const slugify = (s: string) =>
  s.toLowerCase()
   .trim()
   .replace(/['"]/g, "")
   .replace(/[^a-z0-9]+/g, "-")
   .replace(/^-+|-+$/g, "");

const COLORS = ["#2563eb", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6", "#a855f7"];

/* ========== Schemas ========== */
const DishSchema = z.object({
  id: z.number().optional(),
  municipality_id: z.number({ required_error: "Municipality is required" }),
  category_code: z.enum(["food", "delicacy", "drink"]),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional().nullable(),
  image_url: z.string().url().optional().or(z.literal("")).nullable(),
  flavor_profile_csv: z.string().optional().nullable(), // UI only
  ingredients_csv: z.string().optional().nullable(),    // UI only
  popularity: z.number().min(0).max(100).default(0).optional(),
  rating: z.number().min(0).max(5).default(0).optional(),
});
type DishForm = z.infer<typeof DishSchema>;

const RestaurantSchema = z.object({
  id: z.number().optional(),
  municipality_id: z.number({ required_error: "Municipality is required" }),
  name: z.string().min(2),
  slug: z.string().min(2),
  kind: z.enum(["restaurant","stall","store","dealer","market","home-based"]).default("restaurant"),
  address: z.string().min(3),
  lat: z.number(),
  lng: z.number(),
  description: z.string().optional().nullable(),
  price_range: z.enum(["budget","moderate","expensive"]).default("moderate"),
  cuisine_csv: z.string().optional().nullable(), // UI only
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  opening_hours: z.string().nullable().optional(),
  rating: z.number().min(0).max(5).default(0).optional(),
});
type RestaurantForm = z.infer<typeof RestaurantSchema>;

/* ========== Small UI bits ========== */
function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SearchBox({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="border rounded px-3 py-2 w-full"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ========== Main ========== */
export default function AdminDashboard() {
  const [tab, setTab] = useState<"analytics"|"dishes"|"restaurants"|"linking"|"curation">("analytics");
  const qc = useQueryClient();

  /* ---- Shared municipal data ---- */
  const muniQ = useQuery<Municipality[]>({
    queryKey: ["admin:municipalities:list"],
    queryFn: list.municipalities,
    staleTime: 5 * 60_000,
  });

  /* =========================
     ANALYTICS
  ========================== */
  const [analyticsMuniId, setAnalyticsMuniId] = useState<number | null>(null);

  const overviewQ = useQuery({
    queryKey: ["admin:stats:overview"],
    queryFn: adminStats.overview,
    staleTime: 60_000,
  });

  const topDishesQ = useQuery({
    queryKey: ["admin:stats:top-dishes", analyticsMuniId ?? undefined],
    queryFn: () => adminStats.topDishes(analyticsMuniId ?? undefined, undefined, 8),
    staleTime: 60_000,
  });

  const topRestaurantsQ = useQuery({
    queryKey: ["admin:stats:top-restaurants", analyticsMuniId ?? undefined],
    queryFn: () => adminStats.topRestaurants(analyticsMuniId ?? undefined, 8),
    staleTime: 60_000,
  });

  const invData = useMemo(() => {
    const o = overviewQ.data;
    if (!o) return [];
    return [
      { name: "Municipalities", value: o.municipalities ?? 0 },
      { name: "Dishes", value: o.dishes ?? 0 },
      { name: "Delicacies", value: o.delicacies ?? 0 },
      { name: "Restaurants", value: o.restaurants ?? 0 },
      { name: "Links", value: o.links ?? 0 },
    ];
  }, [overviewQ.data]);

  const pieData = useMemo(() => {
    const ds = topDishesQ.data ?? [];
    return ds.map((d) => ({ name: d.name, value: Math.max(1, d.places), id: d.id }));
  }, [topDishesQ.data]);

  /* =========================
     DISHES — CRUD + search
  ========================== */
  const [dishSearch, setDishSearch] = useState("");
  const dishSearchQ = useQuery({
    queryKey: ["admin:search:dishes", dishSearch],
    queryFn: () => dishSearch.trim().length >= 2 ? adminData.searchDishes(dishSearch.trim()) : Promise.resolve([]),
    staleTime: 5_000,
  });

  const dishForm = useForm<DishForm>({
    resolver: zodResolver(DishSchema),
    defaultValues: {
      name: "", slug: "", category_code: "food",
      municipality_id: undefined as unknown as number,
      description: "", image_url: "",
      flavor_profile_csv: "", ingredients_csv: "",
      popularity: 0, rating: 0
    },
  });

  function loadDish(d: { slug: string }) {
    list.dishBySlug(d.slug).then((full) => {
      if (!full) return;
      dishForm.reset({
        id: full.id,
        municipality_id: full.municipality_id,
        category_code: full.category,
        name: full.name,
        slug: full.slug,
        description: full.description ?? "",
        image_url: full.image_url ?? "",
        flavor_profile_csv: (full.flavor_profile ?? []).join(", "),
        ingredients_csv: (full.ingredients ?? []).join(", "),
        popularity: full.popularity ?? 0,
        rating: full.rating ?? 0,
      });
    });
  }

  function saveDish(values: DishForm) {
    const payload = {
      municipality_id: values.municipality_id,
      category_code: values.category_code,
      name: values.name,
      slug: values.slug,
      description: values.description || null,
      image_url: values.image_url || null,
      flavor_profile: (values.flavor_profile_csv || "").split(",").map(s=>s.trim()).filter(Boolean),
      ingredients: (values.ingredients_csv || "").split(",").map(s=>s.trim()).filter(Boolean),
      popularity: values.popularity ?? 0,
      rating: values.rating ?? 0,
    };
    const action = values.id ? adminData.updateDish(values.id, payload) : adminData.createDish(payload);
    action.then(() => {
      qc.invalidateQueries({ queryKey: ["admin:search:dishes"] });
      alert("Dish saved.");
    }).catch(e => alert(e.message));
  }

  function deleteDish() {
    const v = dishForm.getValues();
    if (!v.id) return;
    if (!confirm("Delete this dish?")) return;
    adminData.deleteDish(v.id).then(() => {
      dishForm.reset();
      setDishSearch("");
      qc.invalidateQueries({ queryKey: ["admin:search:dishes"] });
      alert("Dish deleted.");
    }).catch(e => alert(e.message));
  }

  /* =========================
     RESTAURANTS — CRUD + search
  ========================== */
  const [restSearch, setRestSearch] = useState("");
  const restSearchQ = useQuery({
    queryKey: ["admin:search:restaurants", restSearch],
    queryFn: () => restSearch.trim().length >= 2 ? adminData.searchRestaurants(restSearch.trim()) : Promise.resolve([]),
    staleTime: 5_000,
  });

  const restForm = useForm<RestaurantForm>({
    resolver: zodResolver(RestaurantSchema),
    defaultValues: {
      name: "", slug: "", municipality_id: undefined as unknown as number,
      kind: "restaurant", address: "", lat: 0, lng: 0,
      description: "", price_range: "moderate", cuisine_csv: "",
      phone: "", email: "", website: "", facebook: "", instagram: "", opening_hours: "",
      rating: 0
    },
  });

  function loadRestaurant(r: { slug: string }) {
    list.restaurantBySlug(r.slug).then((full) => {
      if (!full) return;
      restForm.reset({
        id: full.id,
        municipality_id: (full as any).municipality_id ?? undefined, // if not in type, backend still has it
        name: full.name,
        slug: full.slug,
        kind: full.kind,
        address: full.address,
        lat: full.lat,
        lng: full.lng,
        description: full.description ?? "",
        price_range: full.price_range,
        cuisine_csv: (full.cuisine_types ?? []).join(", "),
        phone: full.phone ?? "",
        email: (full as any).email ?? "",
        website: full.website ?? "",
        facebook: full.facebook ?? "",
        instagram: full.instagram ?? "",
        opening_hours: full.opening_hours ?? "",
        rating: full.rating ?? 0,
      } as any);
    });
  }

  function saveRestaurant(values: RestaurantForm) {
    const payload = {
      municipality_id: values.municipality_id,
      name: values.name,
      slug: values.slug,
      kind: values.kind,
      address: values.address,
      lat: values.lat,
      lng: values.lng,
      description: values.description || null,
      price_range: values.price_range,
      cuisine_types: (values.cuisine_csv || "").split(",").map(s=>s.trim()).filter(Boolean),
      phone: values.phone || null,
      email: values.email || null,
      website: values.website || null,
      facebook: values.facebook || null,
      instagram: values.instagram || null,
      opening_hours: values.opening_hours || null,
      rating: values.rating ?? 0,
    };
    const action = values.id ? adminData.updateRestaurant(values.id, payload) : adminData.createRestaurant(payload);
    action.then(() => {
      qc.invalidateQueries({ queryKey: ["admin:search:restaurants"] });
      alert("Restaurant saved.");
    }).catch(e => alert(e.message));
  }

  function deleteRestaurant() {
    const v = restForm.getValues();
    if (!v.id) return;
    if (!confirm("Delete this restaurant?")) return;
    adminData.deleteRestaurant(v.id).then(() => {
      restForm.reset();
      setRestSearch("");
      qc.invalidateQueries({ queryKey: ["admin:search:restaurants"] });
      alert("Restaurant deleted.");
    }).catch(e => alert(e.message));
  }

  /* =========================
     LINKING — dish ↔ restaurants
  ========================== */
  const [linkDish, setLinkDish] = useState<{ id: number; name: string; slug: string } | null>(null);
  const [linkMuniId, setLinkMuniId] = useState<number | null>(null);
  const linkedSetQ = useQuery({
    enabled: !!linkDish?.id,
    queryKey: ["admin:link:byDish", linkDish?.id],
    queryFn: () => list.restaurantsByDish(linkDish!.id),
  });
  const allRestoQ = useQuery({
    enabled: linkMuniId != null,
    queryKey: ["admin:link:restaurants", linkMuniId],
    queryFn: () => list.restaurants({ municipalityId: linkMuniId ?? undefined, limit: 200 }),
    staleTime: 30_000,
  });

  const linkedIds = useMemo(() => new Set((linkedSetQ.data ?? []).map(r => r.id)), [linkedSetQ.data]);

  function toggleLink(restaurantId: number) {
    if (!linkDish) return;
    const isLinked = linkedIds.has(restaurantId);
    const p = isLinked
      ? adminData.unlinkDishRestaurant(linkDish.id, restaurantId)
      : adminData.linkDishRestaurant(linkDish.id, restaurantId);
    p.then(() => {
      qc.invalidateQueries({ queryKey: ["admin:link:byDish", linkDish.id] });
    }).catch(e => alert(e.message));
  }

  /* =========================
     CURATION — top 3 per municipality
  ========================== */
  const [curateMuniId, setCurateMuniId] = useState<number | null>(null);

  const curatedDishesQ = useQuery({
    enabled: curateMuniId != null,
    queryKey: ["admin:curation:dishes:featured", curateMuniId],
    queryFn: () => list.dishesByMunicipality(curateMuniId!, "food,delicacy", true),
  });
  const allDishesQ = useQuery({
    enabled: curateMuniId != null,
    queryKey: ["admin:curation:dishes:all", curateMuniId],
    queryFn: () => list.dishesByMunicipality(curateMuniId!, "food,delicacy", false),
  });

  const curatedRestoQ = useQuery({
    enabled: curateMuniId != null,
    queryKey: ["admin:curation:resto:featured", curateMuniId],
    queryFn: () => list.restaurantsByMunicipality(curateMuniId!, true),
  });
  const allRestoForCurQ = useQuery({
    enabled: curateMuniId != null,
    queryKey: ["admin:curation:resto:all", curateMuniId],
    queryFn: () => list.restaurantsByMunicipality(curateMuniId!, false),
  });

  const [dishRanks, setDishRanks] = useState<Record<number, number>>({});
  const [restRanks, setRestRanks] = useState<Record<number, number>>({});

  useEffect(() => {
    // initialize ranks from featured data
    const d = curatedDishesQ.data ?? [];
    const ri: Record<number, number> = {};
    d.forEach(x => { if (x.panel_rank != null) ri[x.id] = x.panel_rank!; });
    setDishRanks(ri);

    const r = curatedRestoQ.data ?? [];
    const rr: Record<number, number> = {};
    r.forEach(x => { if (x.panel_rank != null) rr[x.id] = x.panel_rank!; });
    setRestRanks(rr);
  }, [curatedDishesQ.data, curatedRestoQ.data]);

  function toggleDishPick(id: number) {
    setDishRanks(prev => {
      const next = { ...prev };
      if (id in next) delete next[id]; else next[id] = Object.values(next).includes(1) ? 2 : 1;
      return next;
    });
  }
  function setDishRank(id: number, rank: number) {
    setDishRanks(prev => ({ ...prev, [id]: rank }));
  }
  function toggleRestPick(id: number) {
    setRestRanks(prev => {
      const next = { ...prev };
      if (id in next) delete next[id]; else next[id] = Object.values(next).includes(1) ? 2 : 1;
      return next;
    });
  }
  function setRestRank(id: number, rank: number) {
    setRestRanks(prev => ({ ...prev, [id]: rank }));
  }

  async function saveCuration() {
    if (!curateMuniId) return;
    // Dishes: set selected (signature=1, rank), clear others previously featured
    const featured = new Set(Object.keys(dishRanks).map(Number));
    const prev = new Set((curatedDishesQ.data ?? []).map(d => d.id));
    const toAddOrUpdate = Array.from(featured);
    const toRemove = Array.from(prev).filter(id => !featured.has(id));

    await Promise.all([
      ...toAddOrUpdate.map(id => adminData.updateDish(id, { is_signature: 1, panel_rank: dishRanks[id] ?? null })),
      ...toRemove.map(id => adminData.updateDish(id, { is_signature: 0, panel_rank: null })),
    ]);

    // Restaurants: same idea using is_featured
    const rFeatured = new Set(Object.keys(restRanks).map(Number));
    const rPrev = new Set((curatedRestoQ.data ?? []).map(r => r.id));
    const rAddUpd = Array.from(rFeatured);
    const rRem = Array.from(rPrev).filter(id => !rFeatured.has(id));

    await Promise.all([
      ...rAddUpd.map(id => adminData.updateRestaurant(id, { is_featured: 1, panel_rank: restRanks[id] ?? null })),
      ...rRem.map(id => adminData.updateRestaurant(id, { is_featured: 0, panel_rank: null })),
    ]);

    qc.invalidateQueries({ queryKey: ["admin:curation"] });
    alert("Curation saved.");
  }

  /* =========================
     RENDER
  ========================== */
  return (
    <main className="mx-auto max-w-7xl p-6">
      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          ["analytics","Analytics"],
          ["dishes","Dishes"],
          ["restaurants","Restaurants"],
          ["linking","Linking"],
          ["curation","Curation"],
        ].map(([k,label]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`px-3 py-2 rounded border ${tab===k ? "bg-primary-600 text-white border-primary-600" : "bg-white hover:bg-neutral-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ============ ANALYTICS ============ */}
      {tab==="analytics" && (
        <>
          <Section
            title="Overview"
            right={
              <div className="flex items-center gap-2">
                <div className="text-sm text-neutral-600">Municipality:</div>
                <MunicipalitySelect
                  value={analyticsMuniId}
                  onChange={(id)=> setAnalyticsMuniId(id)}
                  placeholder="All municipalities…"
                  allowAll
                />
              </div>
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { label: "Municipalities", val: overviewQ.data?.municipalities ?? 0 },
                { label: "Dishes", val: overviewQ.data?.dishes ?? 0 },
                { label: "Delicacies", val: overviewQ.data?.delicacies ?? 0 },
                { label: "Restaurants", val: overviewQ.data?.restaurants ?? 0 },
                { label: "Links", val: overviewQ.data?.links ?? 0 },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="text-sm text-neutral-500">{c.label}</div>
                  <div className="text-2xl font-semibold">{c.val}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="rounded-lg border p-4">
                <div className="font-medium mb-2">Inventory</div>
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={invData}>
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="font-medium mb-2">Top Dishes (by places)</div>
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} nameKey="name" dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={3}>
                        {pieData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </Section>
        </>
      )}

      {/* ============ DISHES ============ */}
      {tab==="dishes" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Find or create">
            <div className="mb-3">
              <SearchBox placeholder="Search dishes by name/slug (min 2 chars)…" value={dishSearch} onChange={setDishSearch} />
            </div>
            <div className="text-sm text-neutral-500 mb-2">Results</div>
            <div className="max-h-72 overflow-auto border rounded">
              {(dishSearchQ.data ?? []).map((d) => (
                <button
                  key={d.slug}
                  className="w-full text-left px-3 py-2 border-b hover:bg-neutral-50"
                  onClick={() => loadDish(d)}
                >
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-neutral-500">{d.slug} · {d.category}</div>
                </button>
              ))}
              {(dishSearchQ.data ?? []).length === 0 && (
                <div className="px-3 py-6 text-sm text-neutral-500">Start typing to search…</div>
              )}
            </div>
            <button
              className="mt-3 px-3 py-2 rounded bg-primary-600 text-white"
              onClick={() => dishForm.reset({
                name: "", slug: "", category_code: "food",
                municipality_id: undefined as unknown as number,
                description: "", image_url: "",
                flavor_profile_csv: "", ingredients_csv: "",
                popularity: 0, rating: 0
              })}
            >
              + New dish
            </button>
          </Section>

          <Section title="Dish details">
            <form
              className="grid grid-cols-1 gap-3"
              onSubmit={dishForm.handleSubmit(saveDish)}
            >
              <div className="text-sm text-neutral-500">Municipality</div>
              <MunicipalitySelect
                value={dishForm.watch("municipality_id") ?? null}
                onChange={(id) => dishForm.setValue("municipality_id", (id ?? undefined) as any, { shouldDirty: true })}
                placeholder="Select municipality…"
                allowAll={false}
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-neutral-600">Name</div>
                  <input className="mt-1 w-full border rounded px-3 py-2"
                    {...dishForm.register("name")}
                    onBlur={(e)=> {
                      const n = e.target.value;
                      if (!dishForm.getValues("slug")) dishForm.setValue("slug", slugify(n));
                    }}
                  />
                </label>
                <label className="block">
                  <div className="text-sm text-neutral-600">Slug</div>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("slug")} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-neutral-600">Category</div>
                  <select className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("category_code")}>
                    <option value="food">Food</option>
                    <option value="delicacy">Delicacy</option>
                    <option value="drink">Drink</option>
                  </select>
                </label>
                <label className="block">
                  <div className="text-sm text-neutral-600">Image URL</div>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("image_url")} />
                </label>
              </div>

              <label className="block">
                <div className="text-sm text-neutral-600">Description</div>
                <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} {...dishForm.register("description")} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-neutral-600">Flavor profile (comma sep)</div>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("flavor_profile_csv")} />
                </label>
                <label className="block">
                  <div className="text-sm text-neutral-600">Ingredients (comma sep)</div>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("ingredients_csv")} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-neutral-600">Popularity (0–100)</div>
                  <input type="number" className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("popularity", { valueAsNumber: true })} />
                </label>
                <label className="block">
                  <div className="text-sm text-neutral-600">Rating (0–5)</div>
                  <input type="number" step="0.1" className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("rating", { valueAsNumber: true })} />
                </label>
              </div>

              <div className="flex gap-2">
                <button className="px-3 py-2 rounded bg-primary-600 text-white" type="submit">Save dish</button>
                {dishForm.watch("id") && (
                  <button type="button" className="px-3 py-2 rounded border" onClick={deleteDish}>Delete</button>
                )}
              </div>
            </form>
          </Section>
        </div>
      )}

      {/* ============ RESTAURANTS ============ */}
      {tab==="restaurants" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Find or create">
            <div className="mb-3">
              <SearchBox placeholder="Search restaurants by name/slug (min 2 chars)…" value={restSearch} onChange={setRestSearch} />
            </div>
            <div className="text-sm text-neutral-500 mb-2">Results</div>
            <div className="max-h-72 overflow-auto border rounded">
              {(restSearchQ.data ?? []).map((r) => (
                <button
                  key={r.slug}
                  className="w-full text-left px-3 py-2 border-b hover:bg-neutral-50"
                  onClick={() => loadRestaurant(r)}
                >
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-neutral-500">{r.slug}</div>
                </button>
              ))}
              {(restSearchQ.data ?? []).length === 0 && (
                <div className="px-3 py-6 text-sm text-neutral-500">Start typing to search…</div>
              )}
            </div>
            <button
              className="mt-3 px-3 py-2 rounded bg-primary-600 text-white"
              onClick={() => restForm.reset({
                name: "", slug: "", municipality_id: undefined as unknown as number,
                kind: "restaurant", address: "", lat: 0, lng: 0,
                description: "", price_range: "moderate", cuisine_csv: "",
                phone: "", email: "", website: "", facebook: "", instagram: "", opening_hours: "",
                rating: 0
              })}
            >
              + New restaurant
            </button>
          </Section>

          <Section title="Restaurant details">
            <form className="grid grid-cols-1 gap-3" onSubmit={restForm.handleSubmit(saveRestaurant)}>
              <div className="text-sm text-neutral-500">Municipality</div>
              <MunicipalitySelect
                value={restForm.watch("municipality_id") ?? null}
                onChange={(id) => restForm.setValue("municipality_id", (id ?? undefined) as any, { shouldDirty: true })}
                placeholder="Select municipality…"
                allowAll={false}
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-neutral-600">Name</div>
                  <input className="mt-1 w-full border rounded px-3 py-2"
                    {...restForm.register("name")}
                    onBlur={(e)=> {
                      const n = e.target.value;
                      if (!restForm.getValues("slug")) restForm.setValue("slug", slugify(n));
                    }}
                  />
                </label>
                <label className="block">
                  <div className="text-sm text-neutral-600">Slug</div>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("slug")} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-neutral-600">Kind</div>
                  <select className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("kind")}>
                    <option value="restaurant">Restaurant</option>
                    <option value="stall">Stall</option>
                    <option value="store">Store</option>
                    <option value="dealer">Dealer</option>
                    <option value="market">Market</option>
                    <option value="home-based">Home-based</option>
                  </select>
                </label>
                <label className="block">
                  <div className="text-sm text-neutral-600">Price range</div>
                  <select className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("price_range")}>
                    <option value="budget">Budget</option>
                    <option value="moderate">Moderate</option>
                    <option value="expensive">Expensive</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <div className="text-sm text-neutral-600">Address</div>
                <input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("address")} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-neutral-600">Latitude</div>
                  <input type="number" step="0.000001" className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("lat", { valueAsNumber: true })} />
                </label>
                <label className="block">
                  <div className="text-sm text-neutral-600">Longitude</div>
                  <input type="number" step="0.000001" className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("lng", { valueAsNumber: true })} />
                </label>
              </div>

              <label className="block">
                <div className="text-sm text-neutral-600">Description</div>
                <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} {...restForm.register("description")} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-neutral-600">Cuisine types (comma sep)</div>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("cuisine_csv")} />
                </label>
                <label className="block">
                  <div className="text-sm text-neutral-600">Rating (0–5)</div>
                  <input type="number" step="0.1" className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("rating", { valueAsNumber: true })} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-sm text-neutral-600">Phone</div>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("phone")} />
                </label>
                <label className="block">
                  <div className="text-sm text-neutral-600">Website</div>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("website")} />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <div className="text-sm text-neutral-600">Facebook</div>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("facebook")} />
                </label>
                <label className="block">
                  <div className="text-sm text-neutral-600">Instagram</div>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("instagram")} />
                </label>
                <label className="block">
                  <div className="text-sm text-neutral-600">Opening hours</div>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("opening_hours")} />
                </label>
              </div>

              <div className="flex gap-2">
                <button className="px-3 py-2 rounded bg-primary-600 text-white" type="submit">Save restaurant</button>
                {restForm.watch("id") && (
                  <button type="button" className="px-3 py-2 rounded border" onClick={deleteRestaurant}>Delete</button>
                )}
              </div>
            </form>
          </Section>
        </div>
      )}

      {/* ============ LINKING ============ */}
      {tab==="linking" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Pick a dish">
            <div className="mb-3">
              <SearchBox placeholder="Search dish by name/slug (min 2 chars)…" value={dishSearch} onChange={setDishSearch} />
            </div>
            <div className="max-h-72 overflow-auto border rounded">
              {(dishSearchQ.data ?? []).map((d) => (
                <button
                  key={d.slug}
                  className={`w-full text-left px-3 py-2 border-b hover:bg-neutral-50 ${linkDish?.slug===d.slug ? "bg-primary-50" : ""}`}
                  onClick={() => setLinkDish({ id: (d as any).id, name: d.name, slug: d.slug })}
                >
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-neutral-500">{d.slug} · {d.category}</div>
                </button>
              ))}
            </div>
            {linkDish && (
              <div className="mt-3 text-sm">Selected dish: <span className="font-medium">{linkDish.name}</span></div>
            )}
          </Section>

          <Section
            title="Link restaurants"
            right={
              <div className="flex items-center gap-2">
                <div className="text-sm text-neutral-600">Filter by municipality:</div>
                <MunicipalitySelect value={linkMuniId} onChange={setLinkMuniId} placeholder="Choose municipality…" />
              </div>
            }
          >
            {!linkDish ? (
              <div className="text-neutral-500">Pick a dish on the left.</div>
            ) : linkMuniId == null ? (
              <div className="text-neutral-500">Pick a municipality to list restaurants.</div>
            ) : (
              <div className="max-h-[420px] overflow-auto border rounded">
                {(allRestoQ.data ?? []).map((r) => {
                  const checked = linkedIds.has(r.id);
                  return (
                    <label key={r.id} className="flex items-center justify-between px-3 py-2 border-b hover:bg-neutral-50">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-neutral-500">{r.slug}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLink(r.id)}
                      />
                    </label>
                  );
                })}
                {(allRestoQ.data ?? []).length === 0 && (
                  <div className="px-3 py-6 text-sm text-neutral-500">No restaurants in this municipality.</div>
                )}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ============ CURATION ============ */}
      {tab==="curation" && (
        <Section
          title="Panel picks (top 3 dishes & restaurants per municipality)"
          right={
            <div className="flex items-center gap-2">
              <div className="text-sm text-neutral-600">Municipality:</div>
              <MunicipalitySelect value={curateMuniId} onChange={setCurateMuniId} placeholder="Select municipality…" allowAll={false} />
              <button className="ml-2 px-3 py-2 rounded bg-primary-600 text-white" onClick={saveCuration} disabled={!curateMuniId}>Save</button>
            </div>
          }
        >
          {!curateMuniId ? (
            <div className="text-neutral-500">Select a municipality to curate.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Dishes */}
              <div>
                <div className="font-medium mb-2">Top dishes (Food + Delicacy) — choose up to 3, rank 1–3</div>
                <div className="max-h-[420px] overflow-auto border rounded">
                  {(allDishesQ.data ?? []).map(d => {
                    const picked = dishRanks[d.id] != null;
                    return (
                      <div key={d.id} className="flex items-center justify-between px-3 py-2 border-b hover:bg-neutral-50">
                        <div>
                          <div className="font-medium">{d.name}</div>
                          <div className="text-xs text-neutral-500">{d.slug} · {d.category}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={picked} onChange={()=>toggleDishPick(d.id)} />
                          <select
                            className="border rounded px-2 py-1"
                            value={dishRanks[d.id] ?? ""}
                            onChange={(e)=> setDishRank(d.id, Number(e.target.value))}
                            disabled={!picked}
                          >
                            <option value="">—</option>
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Restaurants */}
              <div>
                <div className="font-medium mb-2">Top restaurants — choose up to 3, rank 1–3</div>
                <div className="max-h-[420px] overflow-auto border rounded">
                  {(allRestoForCurQ.data ?? []).map(r => {
                    const picked = restRanks[r.id] != null;
                    return (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2 border-b hover:bg-neutral-50">
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-neutral-500">{r.slug}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={picked} onChange={()=>toggleRestPick(r.id)} />
                          <select
                            className="border rounded px-2 py-1"
                            value={restRanks[r.id] ?? ""}
                            onChange={(e)=> setRestRank(r.id, Number(e.target.value))}
                            disabled={!picked}
                          >
                            <option value="">—</option>
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Section>
      )}
    </main>
  );
}
