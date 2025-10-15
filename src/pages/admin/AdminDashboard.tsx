// src/pages/admin/AdminDashboard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  adminStats, adminData, list, adminAuth,
  type Municipality, type Dish, type Restaurant
} from "../../utils/adminApi";
import MunicipalitySelect from "../../components/admin/MunicipalitySelect";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid, Legend
} from "recharts";
import { useBeforeUnload, useNavigate } from "react-router-dom";

/* helpers */
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function useDebounced<T>(value: T, ms = 250) {
  const [deb, setDeb] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDeb(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return deb;
}
const COLORS = ["#2563eb", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6", "#a855f7"];

/* Schemas */
const DishSchema = z.object({
  id: z.number().optional(),
  municipality_id: z.number({ required_error: "Municipality is required" }),
  category_code: z.enum(["food", "delicacy", "drink"], { required_error: "Category is required" }),
  name: z.string().min(2, "Name is required"),
  slug: z.string().min(2, "Slug is required"),
  description: z.string().optional().nullable(),
  image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")).nullable(),
  flavor_profile_csv: z.string().optional().nullable(),
  ingredients_csv: z.string().optional().nullable(),
  popularity: z.number().min(0).max(100).default(0).optional(),
  rating: z.number().min(0).max(5).default(0).optional(),
});
type DishForm = z.infer<typeof DishSchema>;

const RestaurantSchema = z.object({
  id: z.number().optional(),
  municipality_id: z.number({ required_error: "Municipality is required" }),
  name: z.string().min(2, "Name is required"),
  slug: z.string().min(2, "Slug is required"),
  kind: z.enum(["restaurant","stall","store","dealer","market","home-based"]),
  address: z.string().min(3, "Address is required"),
  lat: z.number({ required_error: "Latitude is required" }),
  lng: z.number({ required_error: "Longitude is required" }),
  description: z.string().optional().nullable(),
  price_range: z.enum(["budget","moderate","expensive"]),
  cuisine_csv: z.string().optional().nullable(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  opening_hours: z.string().nullable().optional(),
  rating: z.number().min(0).max(5).default(0).optional(),
});
type RestaurantForm = z.infer<typeof RestaurantSchema>;

/* Small UI */
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <div className="text-sm text-neutral-700">{children}{required && <span className="text-red-600 ml-0.5">*</span>}</div>;
}
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div className="text-xs text-red-600 mt-1">{msg}</div>;
}
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
  return <input className="border rounded px-3 py-2 w-full" placeholder={placeholder} value={value} onChange={(e)=>onChange(e.target.value)} />;
}

/* Confirm navigation (HashRouter friendly) */
function useConfirmLeave(when: boolean) {
  useBeforeUnload(when, { message: "You have unsaved changes. Leave this page?" });
  const lastHash = useRef(window.location.hash);
  useEffect(() => {
    function onHashChange() {
      if (!when) { lastHash.current = window.location.hash; return; }
      const ok = confirm("You have unsaved changes. Leave this page?");
      if (!ok) setTimeout(() => { window.location.hash = lastHash.current || "#/"; }, 0);
      else lastHash.current = window.location.hash;
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [when]);
}

/* Main */
export default function AdminDashboard() {
  const [tab, setTab] = useState<"analytics"|"dishes"|"restaurants"|"linking"|"curation">("analytics");
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [adminName, setAdminName] = useState("Admin");
  useEffect(() => { adminAuth.me().then(r => r?.admin?.name && setAdminName(r.admin.name)).catch(()=>{}); }, []);
  function doLogout() { adminAuth.logout().finally(() => { qc.clear(); navigate("/admin/login"); }); }

  const muniQ = useQuery<Municipality[]>({
    queryKey: ["admin:municipalities:list"],
    queryFn: list.municipalities,
    staleTime: 5 * 60_000,
  });

  /* ANALYTICS */
  const [analyticsMuniId, setAnalyticsMuniId] = useState<number | null>(null);

  const overviewQ = useQuery({ queryKey: ["admin:stats:overview"], queryFn: adminStats.overview, staleTime: 60_000 });
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
      { name: "Municipalities", value: Number(o.municipalities || 0) },
      { name: "Dishes", value: Number(o.dishes || 0) },
      { name: "Delicacies", value: Number(o.delicacies || 0) },
      { name: "Restaurants", value: Number(o.restaurants || 0) },
      { name: "Links", value: Number(o.links || 0) },
    ];
  }, [overviewQ.data]);
  const hasInv = invData.some(d => d.value > 0);

  const pieData = useMemo(() => (topDishesQ.data ?? []).map(d => ({ name: d.name, value: Math.max(1, Number(d.places || 0)), id: d.id })), [topDishesQ.data]);
  const hasPie = (pieData?.length ?? 0) > 0;

  const topRestBar = useMemo(() => (topRestaurantsQ.data ?? []).map(r => ({ name: r.name, dishes: Math.max(1, Number(r.dishes || 0)) })), [topRestaurantsQ.data]);
  const hasRestBar = (topRestBar?.length ?? 0) > 0;

  /* DISHES — list + form (same as before) */
  const [dishMuniFilter, setDishMuniFilter] = useState<number | null>(null);
  const [dishSearch, setDishSearch] = useState("");
  const dishQDeb = useDebounced(dishSearch, 300);

  const dishesListQ = useQuery({
    queryKey: ["admin:list:dishes", { muni: dishMuniFilter, q: dishQDeb }],
    queryFn: () => list.dishes({ municipalityId: dishMuniFilter ?? undefined, q: dishQDeb.trim() || undefined, limit: 200 }),
    staleTime: 15_000,
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
  const [autoSlugDish, setAutoSlugDish] = useState(true);
  const [dishImagePreview, setDishImagePreview] = useState("");

  function loadDishById(id: number) {
    const full = (dishesListQ.data ?? []).find(d => d.id === id);
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
    setDishImagePreview(full.image_url ?? "");
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
      qc.invalidateQueries({ queryKey: ["admin:list:dishes"] });
      alert("Dish saved.");
      dishForm.reset({ ...values, id: values.id ?? -1 });
    }).catch(e => alert(e.message));
  }
  function deleteDish() {
    const v = dishForm.getValues();
    if (!v.id) return;
    if (!confirm(`Delete dish "${v.name}"?`)) return;
    adminData.deleteDish(v.id).then(() => {
      dishForm.reset();
      setDishImagePreview("");
      qc.invalidateQueries({ queryKey: ["admin:list:dishes"] });
      alert("Dish deleted.");
    }).catch(e => alert("Delete endpoint not available on API. Please add DELETE /api/admin/dishes/:id"));
  }
  async function uploadDishImage(file?: File | null) {
    if (!file) return;
    try {
      const { url } = await adminData.uploadImage(file);
      dishForm.setValue("image_url", url, { shouldDirty: true });
      setDishImagePreview(url);
    } catch (e: any) {
      alert(e.message || "Upload failed. Ensure /api/admin/upload-image returns {url}.");
    }
  }

  /* RESTAURANTS — list + form */
  const [restMuniFilter, setRestMuniFilter] = useState<number | null>(null);
  const [restSearch, setRestSearch] = useState("");
  const restQDeb = useDebounced(restSearch, 300);

  const restaurantsListQ = useQuery({
    queryKey: ["admin:list:restaurants", { muni: restMuniFilter, q: restQDeb }],
    queryFn: () => list.restaurants({ municipalityId: restMuniFilter ?? undefined, q: restQDeb.trim() || undefined, limit: 200 }),
    staleTime: 15_000,
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
  const [autoSlugRest, setAutoSlugRest] = useState(true);
  const [restImagePreview, setRestImagePreview] = useState("");

  function loadRestaurantById(id: number) {
    const full = (restaurantsListQ.data ?? []).find(r => r.id === id);
    if (!full) return;
    restForm.reset({
      id: full.id,
      municipality_id: (full as any).municipality_id ?? restMuniFilter ?? undefined as unknown as number,
      name: full.name, slug: full.slug, kind: full.kind,
      address: full.address, lat: full.lat, lng: full.lng,
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
    setRestImagePreview("");
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
      qc.invalidateQueries({ queryKey: ["admin:list:restaurants"] });
      alert("Restaurant saved.");
      restForm.reset({ ...values, id: values.id ?? -1 } as any);
    }).catch(e => alert(e.message));
  }
  function deleteRestaurant() {
    const v = restForm.getValues();
    if (!v.id) return;
    if (!confirm(`Delete restaurant "${v.name}"?`)) return;
    adminData.deleteRestaurant(v.id).then(() => {
      restForm.reset();
      setRestImagePreview("");
      qc.invalidateQueries({ queryKey: ["admin:list:restaurants"] });
      alert("Restaurant deleted.");
    }).catch(e => alert("Delete endpoint not available on API. Please add DELETE /api/admin/restaurants/:id"));
  }
  async function uploadRestaurantImage(file?: File | null) {
    if (!file) return;
    try {
      const { url } = await adminData.uploadImage(file);
      alert(`Uploaded. URL: ${url}\n(Add a hero_image_url column to restaurants to store this.)`);
      setRestImagePreview(url);
    } catch (e: any) {
      alert(e.message || "Upload failed. Ensure /api/admin/upload-image returns {url}.");
    }
  }

  /* LINKING */
  const [linkDish, setLinkDish] = useState<Dish | null>(null);
  const [linkMuniId, setLinkMuniId] = useState<number | null>(null);

  const linkedSetQ = useQuery({
    enabled: !!linkDish?.id,
    queryKey: ["admin:link:byDish", linkDish?.id],
    queryFn: () => list.restaurantsByDish(linkDish!.id),
  });
  const linkRestaurantsQ = useQuery({
    enabled: linkMuniId != null,
    queryKey: ["admin:link:restaurants", linkMuniId],
    queryFn: () => list.restaurants({ municipalityId: linkMuniId ?? undefined, limit: 200 }),
    staleTime: 30_000,
  });
  const linkedIds = useMemo(() => new Set((linkedSetQ.data ?? []).map(r => r.id)), [linkedSetQ.data]);
  function toggleLink(restaurantId: number) {
    if (!linkDish) return;
    const isLinked = linkedIds.has(restaurantId);
    const p = isLinked ? adminData.unlinkDishRestaurant(linkDish.id, restaurantId)
                       : adminData.linkDishRestaurant(linkDish.id, restaurantId);
    p.then(() => qc.invalidateQueries({ queryKey: ["admin:link:byDish", linkDish.id] }))
     .catch(e => alert(e.message));
  }

  /* CURATION */
  const [curateMuniId, setCurateMuniId] = useState<number | null>(null);
  const allDishesForCurQ = useQuery({ enabled: curateMuniId != null, queryKey: ["admin:curation:dishes:all", curateMuniId], queryFn: () => list.dishesByMunicipality(curateMuniId!) });
  const allRestoForCurQ = useQuery({ enabled: curateMuniId != null, queryKey: ["admin:curation:resto:all", curateMuniId], queryFn: () => list.restaurantsByMunicipality(curateMuniId!, false) });

  const dishFood = useMemo(() => (allDishesForCurQ.data ?? []).filter(d => d.category === "food"), [allDishesForCurQ.data]);
  const dishDelicacy = useMemo(() => (allDishesForCurQ.data ?? []).filter(d => d.category === "delicacy"), [allDishesForCurQ.data]);

  const [foodRanks, setFoodRanks] = useState<Record<number, number>>({});
  const [delicacyRanks, setDelicacyRanks] = useState<Record<number, number>>({});
  const [restRanks, setRestRanks] = useState<Record<number, number>>({});

  useEffect(() => {
    const f: Record<number, number> = {};
    dishFood.forEach(d => { if ((d as any).panel_rank != null && (d as any).is_signature) f[d.id] = (d as any).panel_rank; });
    setFoodRanks(f);
    const dl: Record<number, number> = {};
    dishDelicacy.forEach(d => { if ((d as any).panel_rank != null && (d as any).is_signature) dl[d.id] = (d as any).panel_rank; });
    setDelicacyRanks(dl);
  }, [dishFood, dishDelicacy]);

  useEffect(() => {
    const rr: Record<number, number> = {};
    (allRestoForCurQ.data ?? []).forEach(r => { if ((r as any).panel_rank != null && (r as any).is_featured) rr[r.id] = (r as any).panel_rank; });
    setRestRanks(rr);
  }, [allRestoForCurQ.data]);

  function togglePick(map: Record<number, number>, setMap: (m: Record<number, number>) => void, id: number) {
    setMap(prev => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = Object.values(next).includes(1) ? (Object.values(next).includes(2) ? 3 : 2) : 1;
      return next;
    });
  }
  function setRank(setter: (m: Record<number, number>) => void, id: number, rank: number) {
    setter(prev => ({ ...prev, [id]: rank }));
  }
  async function saveCuration() {
    if (!curateMuniId) return;
    const saveDishSet = async (idsToRank: Record<number, number>) => {
      const selected = new Set(Object.keys(idsToRank).map(Number));
      const allIds = new Set((allDishesForCurQ.data ?? []).map(d => d.id));
      const toAddUpd = Array.from(selected);
      const toRem = Array.from(allIds).filter(id => selected.has(id) === false && ((allDishesForCurQ.data ?? []).find(d => d.id===id) as any)?.is_signature);
      await Promise.all([
        ...toAddUpd.map(id => adminData.updateDish(id, { is_signature: 1, panel_rank: idsToRank[id] ?? null })),
        ...toRem.map(id => adminData.updateDish(id, { is_signature: 0, panel_rank: null })),
      ]);
    };
    const saveRestSet = async (idsToRank: Record<number, number>) => {
      const selected = new Set(Object.keys(idsToRank).map(Number));
      const allIds = new Set((allRestoForCurQ.data ?? []).map(r => r.id));
      const toAddUpd = Array.from(selected);
      const toRem = Array.from(allIds).filter(id => selected.has(id) === false && ((allRestoForCurQ.data ?? []).find(r => r.id===id) as any)?.is_featured);
      await Promise.all([
        ...toAddUpd.map(id => adminData.updateRestaurant(id, { is_featured: 1, panel_rank: idsToRank[id] ?? null })),
        ...toRem.map(id => adminData.updateRestaurant(id, { is_featured: 0, panel_rank: null })),
      ]);
    };
    await saveDishSet(foodRanks);
    await saveDishSet(delicacyRanks);
    await saveRestSet(restRanks);
    qc.invalidateQueries({ queryKey: ["admin:curation"] });
    alert("Curation saved.");
  }

  const isDirty =
    dishForm.formState.isDirty ||
    restForm.formState.isDirty ||
    Object.keys(foodRanks).length > 0 ||
    Object.keys(delicacyRanks).length > 0 ||
    Object.keys(restRanks).length > 0;
  useConfirmLeave(isDirty);

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="text-sm text-neutral-500">Signed in as <span className="font-medium">{adminName}</span></div>
        </div>
        <button onClick={doLogout} className="px-3 py-2 rounded border hover:bg-neutral-50">Logout</button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          ["analytics","Analytics"],
          ["dishes","Dishes"],
          ["restaurants","Restaurants"],
          ["linking","Linking"],
          ["curation","Curation"],
        ].map(([k,label]) => (
          <button key={k}
            onClick={() => { if (isDirty && !confirm("You have unsaved changes. Switch tabs anyway?")) return; setTab(k as any); }}
            className={`px-3 py-2 rounded border ${tab===k ? "bg-primary-600 text-white border-primary-600" : "bg-white hover:bg-neutral-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ANALYTICS */}
      {tab==="analytics" && (
        <Section
          title="Overview"
          right={
            <div className="flex items-center gap-2">
              <div className="text-sm text-neutral-600">Municipality:</div>
              <MunicipalitySelect value={analyticsMuniId} onChange={setAnalyticsMuniId} placeholder="All municipalities…" allowAll />
            </div>
          }
        >
          {overviewQ.isError && (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
              Analytics endpoint is not available yet. Showing empty charts.
            </div>
          )}
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
                {hasInv ? (
                  <ResponsiveContainer>
                    <BarChart data={invData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-neutral-400 text-sm">No data yet</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="font-medium mb-2">Top Dishes (by places)</div>
              <div className="h-64">
                {hasPie ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} nameKey="name" dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={3}>
                        {pieData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-neutral-400 text-sm">No data yet</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4 lg:col-span-2">
              <div className="font-medium mb-2">Top Restaurants (by dishes offered)</div>
              <div className="h-72">
                {hasRestBar ? (
                  <ResponsiveContainer>
                    <BarChart data={topRestBar}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={70}/>
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="dishes" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-neutral-400 text-sm">No data yet</div>
                )}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* DISHES */}
      {tab==="dishes" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section
            title="Find or Create"
            right={<div className="flex items-center gap-2"><div className="text-sm text-neutral-600">Municipality:</div><MunicipalitySelect value={dishMuniFilter} onChange={setDishMuniFilter} placeholder="All…" allowAll /></div>}
          >
            <div className="mb-3"><SearchBox placeholder="Search dishes by name/slug… (live)" value={dishSearch} onChange={setDishSearch} /></div>
            <div className="text-xs text-neutral-500 mb-2">Showing {dishesListQ.data?.length ?? 0} result(s){dishMuniFilter ? ` in ${(muniQ.data ?? []).find(m=>m.id===dishMuniFilter)?.name}`: ""}.</div>
            <div className="max-h-80 overflow-auto border rounded">
              {(dishesListQ.data ?? []).map((d) => (
                <button key={d.id} className="w-full text-left px-3 py-2 border-b hover:bg-neutral-50" onClick={() => loadDishById(d.id)}>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-neutral-500">{d.slug} · {d.category}</div>
                </button>
              ))}
              {(dishesListQ.data ?? []).length === 0 && <div className="px-3 py-6 text-sm text-neutral-500">No dishes found.</div>}
            </div>
            <button className="mt-3 px-3 py-2 rounded bg-primary-600 text-white" onClick={() => {
              dishForm.reset({
                name: "", slug: "", category_code: "food",
                municipality_id: dishMuniFilter ?? (undefined as unknown as number),
                description: "", image_url: "",
                flavor_profile_csv: "", ingredients_csv: "",
                popularity: 0, rating: 0
              });
              setDishImagePreview("");
            }}>+ New dish</button>
          </Section>

          <Section
            title="Dish details"
            right={
              <div className="flex items-center gap-4">
                {dishForm.watch("id")
                  ? <div className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-200">Editing: <strong>{dishForm.watch("name") || "Untitled"}</strong> ({dishForm.watch("slug")})</div>
                  : <div className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">Creating new dish</div>}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoSlugDish} onChange={e=>setAutoSlugDish(e.target.checked)} />Auto-slug</label>
              </div>
            }
          >
            <form className="grid grid-cols-1 gap-3" onSubmit={dishForm.handleSubmit(saveDish)}>
              <div>
                <Label required>Municipality</Label>
                <MunicipalitySelect
                  value={dishForm.watch("municipality_id") ?? null}
                  onChange={(id) => dishForm.setValue("municipality_id", (id ?? undefined) as any, { shouldDirty: true })}
                  placeholder="Select municipality…" allowAll={false}
                />
                <FieldError msg={dishForm.formState.errors.municipality_id?.message} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label required>Name</Label>
                  <input
                    className="mt-1 w-full border rounded px-3 py-2"
                    {...dishForm.register("name")}
                    onChange={(e)=>{ dishForm.register("name").onChange(e); if (autoSlugDish && !dishForm.getValues("id")) dishForm.setValue("slug", slugify(e.target.value), { shouldDirty: true }); }}
                    onBlur={(e)=>{ if (autoSlugDish && !dishForm.getValues("slug")) dishForm.setValue("slug", slugify(e.target.value), { shouldDirty: true }); }}
                  />
                  <FieldError msg={dishForm.formState.errors.name?.message} />
                </label>
                <label className="block">
                  <Label required>Slug</Label>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("slug")} />
                  <FieldError msg={dishForm.formState.errors.slug?.message} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label required>Category</Label>
                  <select className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("category_code")}>
                    <option value="food">Food</option>
                    <option value="delicacy">Delicacy</option>
                    <option value="drink">Drink</option>
                  </select>
                  <FieldError msg={dishForm.formState.errors.category_code?.message} />
                </label>
                <label className="block">
                  <Label>Image URL</Label>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("image_url")} onChange={(e)=> setDishImagePreview(e.target.value)} />
                  <FieldError msg={dishForm.formState.errors.image_url?.message as string} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Upload image</Label>
                  <div className="mt-1 flex items-center gap-2"><input type="file" accept="image/*" onChange={(e)=> uploadDishImage(e.target.files?.[0])} /></div>
                  <div className="mt-2">{dishImagePreview ? <img src={dishImagePreview} className="h-24 w-24 object-cover rounded border" /> : <div className="h-24 w-24 rounded border bg-neutral-50 flex items-center justify-center text-xs text-neutral-400">No image</div>}</div>
                </div>
                <label className="block">
                  <Label>Description</Label>
                  <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} {...dishForm.register("description")} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><Label>Flavor profile (comma sep)</Label><input className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("flavor_profile_csv")} /></label>
                <label className="block"><Label>Ingredients (comma sep)</Label><input className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("ingredients_csv")} /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><Label>Popularity (0–100)</Label><input type="number" className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("popularity", { valueAsNumber: true })} /></label>
                <label className="block"><Label>Rating (0–5)</Label><input type="number" step="0.1" className="mt-1 w-full border rounded px-3 py-2" {...dishForm.register("rating", { valueAsNumber: true })} /></label>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-2 rounded bg-primary-600 text-white" type="submit">Save dish</button>
                {dishForm.watch("id") && <button type="button" className="px-3 py-2 rounded border" onClick={deleteDish}>Delete</button>}
              </div>
            </form>
          </Section>
        </div>
      )}

      {/* RESTAURANTS */}
      {tab==="restaurants" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section
            title="Find or Create"
            right={<div className="flex items-center gap-2"><div className="text-sm text-neutral-600">Municipality:</div><MunicipalitySelect value={restMuniFilter} onChange={setRestMuniFilter} placeholder="All…" allowAll /></div>}
          >
            <div className="mb-3"><SearchBox placeholder="Search restaurants by name/slug… (live)" value={restSearch} onChange={setRestSearch} /></div>
            <div className="text-xs text-neutral-500 mb-2">Showing {restaurantsListQ.data?.length ?? 0} result(s){restMuniFilter ? ` in ${(muniQ.data ?? []).find(m=>m.id===restMuniFilter)?.name}`: ""}.</div>
            <div className="max-h-80 overflow-auto border rounded">
              {(restaurantsListQ.data ?? []).map((r) => (
                <button key={r.id} className="w-full text-left px-3 py-2 border-b hover:bg-neutral-50" onClick={() => loadRestaurantById(r.id)}>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-neutral-500">{r.slug}</div>
                </button>
              ))}
              {(restaurantsListQ.data ?? []).length === 0 && <div className="px-3 py-6 text-sm text-neutral-500">No restaurants found.</div>}
            </div>
            <button className="mt-3 px-3 py-2 rounded bg-primary-600 text-white" onClick={() => {
              restForm.reset({
                name: "", slug: "", municipality_id: restMuniFilter ?? (undefined as unknown as number),
                kind: "restaurant", address: "", lat: 0, lng: 0,
                description: "", price_range: "moderate", cuisine_csv: "",
                phone: "", email: "", website: "", facebook: "", instagram: "", opening_hours: "", rating: 0
              } as any);
              setRestImagePreview("");
            }}>+ New restaurant</button>
          </Section>

          <Section
            title="Restaurant details"
            right={
              <div className="flex items-center gap-4">
                {restForm.watch("id")
                  ? <div className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-200">Editing: <strong>{restForm.watch("name") || "Untitled"}</strong> ({restForm.watch("slug")})</div>
                  : <div className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">Creating new restaurant</div>}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoSlugRest} onChange={e=>setAutoSlugRest(e.target.checked)} />Auto-slug</label>
              </div>
            }
          >
            <form className="grid grid-cols-1 gap-3" onSubmit={restForm.handleSubmit(saveRestaurant)}>
              <div>
                <Label required>Municipality</Label>
                <MunicipalitySelect
                  value={restForm.watch("municipality_id") ?? null}
                  onChange={(id) => restForm.setValue("municipality_id", (id ?? undefined) as any, { shouldDirty: true })}
                  placeholder="Select municipality…" allowAll={false}
                />
                <FieldError msg={restForm.formState.errors.municipality_id?.message} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label required>Name</Label>
                  <input
                    className="mt-1 w-full border rounded px-3 py-2"
                    {...restForm.register("name")}
                    onChange={(e)=>{ restForm.register("name").onChange(e); if (autoSlugRest && !restForm.getValues("id")) restForm.setValue("slug", slugify(e.target.value), { shouldDirty: true }); }}
                    onBlur={(e)=>{ if (autoSlugRest && !restForm.getValues("slug")) restForm.setValue("slug", slugify(e.target.value), { shouldDirty: true }); }}
                  />
                  <FieldError msg={restForm.formState.errors.name?.message} />
                </label>
                <label className="block">
                  <Label required>Slug</Label>
                  <input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("slug")} />
                  <FieldError msg={restForm.formState.errors.slug?.message} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label required>Kind</Label>
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
                  <Label required>Price range</Label>
                  <select className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("price_range")}>
                    <option value="budget">Budget</option>
                    <option value="moderate">Moderate</option>
                    <option value="expensive">Expensive</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <Label required>Address</Label>
                <input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("address")} />
                <FieldError msg={restForm.formState.errors.address?.message} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><Label required>Latitude</Label><input type="number" step="0.000001" className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("lat", { valueAsNumber: true })} /><FieldError msg={restForm.formState.errors.lat?.message} /></label>
                <label className="block"><Label required>Longitude</Label><input type="number" step="0.000001" className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("lng", { valueAsNumber: true })} /><FieldError msg={restForm.formState.errors.lng?.message} /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label>Description</Label>
                  <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} {...restForm.register("description")} />
                </label>
                <div>
                  <Label>Upload image</Label>
                  <div className="mt-1 flex items-center gap-2"><input type="file" accept="image/*" onChange={(e)=> uploadRestaurantImage(e.target.files?.[0])} /></div>
                  <div className="mt-2">{restImagePreview ? <img src={restImagePreview} className="h-24 w-24 object-cover rounded border" /> : <div className="h-24 w-24 rounded border bg-neutral-50 flex items-center justify-center text-xs text-neutral-400">No image</div>}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><Label>Cuisine types (comma sep)</Label><input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("cuisine_csv")} /></label>
                <label className="block"><Label>Rating (0–5)</Label><input type="number" step="0.1" className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("rating", { valueAsNumber: true })} /></label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block"><Label>Phone</Label><input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("phone")} /></label>
                <label className="block"><Label>Website</Label><input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("website")} /></label>
                <label className="block"><Label>Opening hours</Label><input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("opening_hours")} /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><Label>Facebook</Label><input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("facebook")} /></label>
                <label className="block"><Label>Instagram</Label><input className="mt-1 w-full border rounded px-3 py-2" {...restForm.register("instagram")} /></label>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-2 rounded bg-primary-600 text-white" type="submit">Save restaurant</button>
                {restForm.watch("id") && <button type="button" className="px-3 py-2 rounded border" onClick={deleteRestaurant}>Delete</button>}
              </div>
            </form>
          </Section>
        </div>
      )}

      {/* LINKING */}
      {tab==="linking" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Pick a dish to link" right={<div className="flex items-center gap-2 text-sm text-neutral-600">{linkDish ? <>Linking for: <span className="font-medium">{linkDish.name}</span></> : "—"}</div>}>
            <div className="mb-3"><SearchBox placeholder="Quick search dish…" value={dishSearch} onChange={setDishSearch} /></div>
            <div className="max-h-80 overflow-auto border rounded">
              {(dishesListQ.data ?? []).map((d) => (
                <button key={d.id} className={`w-full text-left px-3 py-2 border-b hover:bg-neutral-50 ${linkDish?.id===d.id ? "bg-primary-50" : ""}`} onClick={() => setLinkDish(d)}>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-neutral-500">{d.slug} · {d.category}</div>
                </button>
              ))}
            </div>
          </Section>
          <Section title="Link restaurants" right={<div className="flex items-center gap-2"><div className="text-sm text-neutral-600">Filter by municipality:</div><MunicipalitySelect value={linkMuniId} onChange={setLinkMuniId} placeholder="Choose municipality…" /></div>}>
            {!linkDish ? (
              <div className="text-neutral-500">Pick a dish on the left.</div>
            ) : linkMuniId == null ? (
              <div className="text-neutral-500">Pick a municipality to list restaurants.</div>
            ) : (
              <div className="max-h-[420px] overflow-auto border rounded">
                {(useQuery({
                  enabled: linkMuniId != null,
                  queryKey: ["admin:link:restaurants", linkMuniId],
                  queryFn: () => list.restaurants({ municipalityId: linkMuniId ?? undefined, limit: 200 }),
                  staleTime: 30_000,
                }).data ?? []).map((r) => {
                  const checked = (new Set((useQuery({
                    enabled: !!linkDish?.id,
                    queryKey: ["admin:link:byDish", linkDish?.id],
                    queryFn: () => list.restaurantsByDish(linkDish!.id),
                  }).data ?? []).map(x => x.id))).has(r.id);
                  return (
                    <label key={r.id} className="flex items-center justify-between px-3 py-2 border-b hover:bg-neutral-50">
                      <div><div className="font-medium">{r.name}</div><div className="text-xs text-neutral-500">{r.slug}</div></div>
                      <input type="checkbox" checked={checked} onChange={() => toggleLink(r.id)} />
                    </label>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* CURATION */}
      {tab==="curation" && (
        <Section
          title="Panel picks per municipality"
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Food */}
              <div>
                <div className="font-medium mb-2">Top Dishes (Food) — choose up to 3, rank 1–3</div>
                <div className="max-h-[420px] overflow-auto border rounded">
                  {( (allDishesForCurQ.data ?? []).filter(d=>d.category==="food") ).map(d => {
                    const picked = (foodRanks[d.id] != null);
                    return (
                      <div key={d.id} className="flex items-center justify-between px-3 py-2 border-b hover:bg-neutral-50">
                        <div><div className="font-medium">{d.name}</div><div className="text-xs text-neutral-500">{d.slug}</div></div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={picked} onChange={()=> setFoodRanks(prev => ({ ...prev, ...(picked ? (delete prev[d.id], prev) : { [d.id]: (Object.values(prev).includes(1) ? (Object.values(prev).includes(2) ? 3 : 2) : 1) }) }))} />
                          <select className="border rounded px-2 py-1" value={foodRanks[d.id] ?? ""} onChange={(e)=> setFoodRanks(prev => ({ ...prev, [d.id]: Number(e.target.value) }))} disabled={!picked}>
                            <option value="">—</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delicacies */}
              <div>
                <div className="font-medium mb-2">Top Delicacies — choose up to 3, rank 1–3</div>
                <div className="max-h-[420px] overflow-auto border rounded">
                  {( (allDishesForCurQ.data ?? []).filter(d=>d.category==="delicacy") ).map(d => {
                    const picked = (delicacyRanks[d.id] != null);
                    return (
                      <div key={d.id} className="flex items-center justify-between px-3 py-2 border-b hover:bg-neutral-50">
                        <div><div className="font-medium">{d.name}</div><div className="text-xs text-neutral-500">{d.slug}</div></div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={picked} onChange={()=> setDelicacyRanks(prev => ({ ...prev, ...(picked ? (delete prev[d.id], prev) : { [d.id]: (Object.values(prev).includes(1) ? (Object.values(prev).includes(2) ? 3 : 2) : 1) }) }))} />
                          <select className="border rounded px-2 py-1" value={delicacyRanks[d.id] ?? ""} onChange={(e)=> setDelicacyRanks(prev => ({ ...prev, [d.id]: Number(e.target.value) }))} disabled={!picked}>
                            <option value="">—</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Restaurants */}
              <div>
                <div className="font-medium mb-2">Top Restaurants — choose up to 3, rank 1–3</div>
                <div className="max-h-[420px] overflow-auto border rounded">
                  {(allRestoForCurQ.data ?? []).map(r => {
                    const picked = (restRanks[r.id] != null);
                    return (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2 border-b hover:bg-neutral-50">
                        <div><div className="font-medium">{r.name}</div><div className="text-xs text-neutral-500">{r.slug}</div></div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={picked} onChange={()=> setRestRanks(prev => ({ ...prev, ...(picked ? (delete prev[r.id], prev) : { [r.id]: (Object.values(prev).includes(1) ? (Object.values(prev).includes(2) ? 3 : 2) : 1) }) }))} />
                          <select className="border rounded px-2 py-1" value={restRanks[r.id] ?? ""} onChange={(e)=> setRestRanks(prev => ({ ...prev, [r.id]: Number(e.target.value) }))} disabled={!picked}>
                            <option value="">—</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
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
