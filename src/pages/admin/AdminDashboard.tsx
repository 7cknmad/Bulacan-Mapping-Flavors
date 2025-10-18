import React, { useMemo, useState } from "react";
import { Card, Toolbar, Button, Input, KPI, Badge, ScrollArea } from "../admin/ui";
import {
  listMunicipalities, listDishes, listRestaurants,
  createDish, updateDish, deleteDish,
  createRestaurant, updateRestaurant, deleteRestaurant,
  listRestaurantsForDish, listDishesForRestaurant,
  linkDishRestaurant, unlinkDishRestaurant,
  setDishCuration, setRestaurantCuration, listDishCategories,
  getAnalyticsSummary, getPerMunicipalityCounts,
  type Municipality, type Dish, type Restaurant,
  coerceStringArray, slugify
} from "../../utils/adminApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from "recharts";
import { motion } from "framer-motion";
import {
  ArrowLeft as ArrowLeftIcon,
  Star as StarIcon,
  MapPin as MapPinIcon,
  Phone as PhoneIcon,
  Globe as GlobeIcon,
  Clock as ClockIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  Utensils as UtensilsIcon,
} from "lucide-react";

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
   Analytics (unchanged)
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
   Dishes (CRUD)
   ====================================================== */
function DishesTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ municipality_id: 0, category: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<any>({ 
    name: "", 
    slug: "", 
    category: "food", 
    municipality_id: 0, 
    category_id: 0,
    rating: null, 
    popularity: null, 
    description: "",
    flavor_profile: [],
    ingredients: [],
    history: "",
    image_url: "",
    is_signature: false,
    panel_rank: null,
    featured: false,
    featured_rank: null,
    autoSlug: true 
  });
  const [serverError, setServerError] = useState<string | null>(null);

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const categoriesQ = useQuery({ 
    queryKey: ["dish-categories"], 
    queryFn: listDishCategories, 
    staleTime: 300_000 
  });
  
  const dishesQ = useQuery({ 
    queryKey: ["dishes", q, filters], 
    queryFn: () => listDishes({ q, ...filters }), 
    keepPreviousData: true 
  });

  const createM = useMutation({
    mutationFn: (payload: any) => createDish(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dishes"] });
      setForm({ 
        name: "", 
        slug: "", 
        category: "food", 
        municipality_id: 0, 
        category_id: 0,
        rating: null, 
        popularity: null, 
        description: "",
        flavor_profile: [],
        ingredients: [],
        history: "",
        image_url: "",
        is_signature: false,
        panel_rank: null,
        featured: false,
        featured_rank: null,
        autoSlug: true 
      });
      setServerError(null);
      alert("Dish created.");
    },
    onError: (e: any) => setServerError(e?.message || "Create failed."),
  });

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateDish(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dishes"] });
      setEditOpen(false);
      setServerError(null);
      alert("Dish saved.");
    },
    onError: (e: any) => setServerError(e?.message || "Update failed."),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => deleteDish(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dishes"] });
      alert("Dish deleted.");
    },
    onError: (e: any) => setServerError(e?.message || "Delete failed."),
  });

  function setName(name: string) {
    setForm((f: any) => ({ ...f, name, slug: f.autoSlug ? slugify(name) : f.slug }));
  }

  function applyFilters(newFilters: any) {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }

  function clearFilters() {
    setFilters({ municipality_id: 0, category: "" });
    setQ("");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create Dish Form */}
      <Card title="Create Dish" className="lg:col-span-1">
        <div className="space-y-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setName(e.target.value)} />
          </Field>
          
          <div className="flex items-center gap-2 -mt-2">
            <input 
              id="autoslug" 
              type="checkbox" 
              checked={!!form.autoSlug} 
              onChange={(e) => setForm((f: any) => ({ ...f, autoSlug: e.target.checked }))} 
            />
            <label htmlFor="autoslug" className="text-sm text-neutral-500">Auto slug</label>
          </div>
          
          <Field label="Slug">
            <Input value={form.slug} onChange={(e) => setForm((f: any) => ({ ...f, slug: e.target.value }))} />
          </Field>
          
          <Field label="Municipality">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.municipality_id} 
              onChange={(e) => setForm((f: any) => ({ ...f, municipality_id: Number(e.target.value) }))}
            >
              <option value={0}>Select…</option>
              {(muniQ.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Category">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.category} 
              onChange={(e) => setForm((f: any) => ({ ...f, category: e.target.value }))}
            >
              <option value="food">Food</option>
              <option value="delicacy">Delicacy</option>
              <option value="drink">Drink</option>
            </select>
          </Field>

          <Field label="Category ID">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.category_id} 
              onChange={(e) => setForm((f: any) => ({ ...f, category_id: Number(e.target.value) }))}
            >
              <option value={0}>Select Category…</option>
              {(categoriesQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Rating (0–5)">
              <Input 
                type="number" 
                step="0.1" 
                min={0} 
                max={5} 
                value={form.rating ?? ""} 
                onChange={(e) => setForm((f: any) => ({ 
                  ...f, 
                  rating: e.target.value === "" ? null : Number(e.target.value) 
                }))} 
              />
            </Field>
            <Field label="Popularity (0–100)">
              <Input 
                type="number" 
                min={0} 
                max={100} 
                value={form.popularity ?? ""} 
                onChange={(e) => setForm((f: any) => ({ 
                  ...f, 
                  popularity: e.target.value === "" ? null : Number(e.target.value) 
                }))} 
              />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <input 
              id="is_signature" 
              type="checkbox" 
              checked={!!form.is_signature} 
              onChange={(e) => setForm((f: any) => ({ ...f, is_signature: e.target.checked }))} 
            />
            <label htmlFor="is_signature" className="text-sm">Signature Dish</label>
          </div>

          <div className="flex items-center gap-2">
            <input 
              id="featured" 
              type="checkbox" 
              checked={!!form.featured} 
              onChange={(e) => setForm((f: any) => ({ ...f, featured: e.target.checked }))} 
            />
            <label htmlFor="featured" className="text-sm">Featured</label>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="primary" 
              disabled={createM.isLoading} 
              onClick={() => {
                if (!form.name || !form.slug || !form.municipality_id) {
                  setServerError("Please fill in all required fields");
                  return;
                }
                createM.mutate({
                  name: String(form.name), 
                  slug: String(form.slug), 
                  municipality_id: Number(form.municipality_id), 
                  category: form.category,
                  category_id: Number(form.category_id),
                  rating: form.rating == null ? null : clamp(Number(form.rating), 0, 5), 
                  popularity: form.popularity == null ? null : clamp(Number(form.popularity), 0, 100),
                  is_signature: Boolean(form.is_signature),
                  featured: Boolean(form.featured)
                });
              }}
            >
              {createM.isLoading ? "Saving..." : "Save"}
            </Button>
            <Button 
              variant="soft" 
              onClick={() => { 
                setForm({ 
                  name: "", slug: "", category: "food", municipality_id: 0, category_id: 0,
                  rating: null, popularity: null, autoSlug: true, is_signature: false, featured: false 
                }); 
                setServerError(null); 
              }}
            >
              Reset
            </Button>
          </div>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        </div>
      </Card>

      {/* Dishes List with Filters */}
      <Card 
        className="lg:col-span-2" 
        toolbar={
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input 
                placeholder="Search dishes…" 
                value={q} 
                onChange={(e) => setQ(e.target.value)}
                className="flex-1"
              />
              <Button variant="soft" onClick={clearFilters}>Clear</Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select 
                className="rounded-xl border px-3 py-2 text-sm"
                value={filters.municipality_id}
                onChange={(e) => applyFilters({ municipality_id: Number(e.target.value) })}
              >
                <option value={0}>All Municipalities</option>
                {(muniQ.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              
              <select 
                className="rounded-xl border px-3 py-2 text-sm"
                value={filters.category}
                onChange={(e) => applyFilters({ category: e.target.value })}
              >
                <option value="">All Categories</option>
                <option value="food">Food</option>
                <option value="delicacy">Delicacy</option>
                <option value="drink">Drink</option>
              </select>
            </div>
          </div>
        }
      >
        {dishesQ.isLoading ? (
          <div className="grid md:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : dishesQ.data?.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            No dishes found. {q || filters.municipality_id || filters.category ? "Try changing your filters." : "Create your first dish!"}
          </div>
        ) : (
          <ScrollArea height={520}>
            <div className="grid md:grid-cols-2 gap-3 pr-1">
              {(dishesQ.data ?? []).map((d) => (
                <div key={d.id} className="border rounded-xl p-4 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2 mb-1">
                        {d.name}
                        {d.is_signature && <Badge variant="solid">Signature</Badge>}
                        {d.panel_rank && <Badge variant="solid">Top {d.panel_rank}</Badge>}
                        {d.featured && <Badge variant="outline">Featured</Badge>}
                      </div>
                      <div className="text-xs text-neutral-500 mb-2">
                        {d.slug} • {d.category} • {d.municipality_name || `Muni ID: ${d.municipality_id}`}
                      </div>
                      {d.description && (
                        <p className="text-sm text-neutral-600 line-clamp-2 mb-2">{d.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        {d.rating && <span>⭐ {d.rating}</span>}
                        {d.popularity && <span>🔥 {d.popularity}%</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button 
                        size="sm" 
                        onClick={() => { 
                          setServerError(null); 
                          setEditOpen(true); 
                          setForm({ ...d, autoSlug: false }); 
                        }}
                      >
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="danger" 
                        onClick={async () => { 
                          if (await confirmThen(`Delete ${d.name}?`)) 
                            deleteM.mutate(d.id); 
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>

      {/* Edit Dish Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Dish">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name">
            <Input value={form.name ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Slug">
            <Input value={form.slug ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, slug: e.target.value }))} />
          </Field>
          <Field label="Municipality">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.municipality_id ?? 0} 
              onChange={(e) => setForm((f: any) => ({ ...f, municipality_id: Number(e.target.value) }))}
            >
              <option value={0}>Select…</option>
              {(muniQ.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.category ?? "food"} 
              onChange={(e) => setForm((f: any) => ({ ...f, category: e.target.value }))}
            >
              <option value="food">Food</option>
              <option value="delicacy">Delicacy</option>
              <option value="drink">Drink</option>
            </select>
          </Field>
          <Field label="Category ID">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.category_id ?? 0} 
              onChange={(e) => setForm((f: any) => ({ ...f, category_id: Number(e.target.value) }))}
            >
              <option value={0}>Select Category…</option>
              {(categoriesQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Image URL">
            <Input value={form.image_url ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, image_url: e.target.value }))} />
          </Field>
          <Field label="Rating (0–5)">
            <Input 
              type="number" 
              min={0} 
              max={5} 
              step="0.1" 
              value={form.rating ?? ""} 
              onChange={(e) => setForm((f: any) => ({ 
                ...f, 
                rating: e.target.value === "" ? null : clamp(Number(e.target.value), 0, 5) 
              }))} 
            />
          </Field>
          <Field label="Popularity (0–100)">
            <Input 
              type="number" 
              min={0} 
              max={100} 
              value={form.popularity ?? ""} 
              onChange={(e) => setForm((f: any) => ({ 
                ...f, 
                popularity: e.target.value === "" ? null : clamp(Number(e.target.value), 0, 100) 
              }))} 
            />
          </Field>
          <Field label="Panel Rank">
            <Input 
              type="number" 
              min={0} 
              max={255} 
              value={form.panel_rank ?? ""} 
              onChange={(e) => setForm((f: any) => ({ 
                ...f, 
                panel_rank: e.target.value === "" ? null : Number(e.target.value) 
              }))} 
            />
          </Field>
          <Field label="Featured Rank">
            <Input 
              type="number" 
              min={0} 
              max={255} 
              value={form.featured_rank ?? ""} 
              onChange={(e) => setForm((f: any) => ({ 
                ...f, 
                featured_rank: e.target.value === "" ? null : Number(e.target.value) 
              }))} 
            />
          </Field>
          <Field label="Flavor profile (comma separated)">
            <Input 
              value={Array.isArray(form.flavor_profile) ? form.flavor_profile.join(", ") : (form.flavor_profile ?? "")} 
              onChange={(e) => setForm((f: any) => ({ ...f, flavor_profile: e.target.value }))} 
            />
          </Field>
          <Field label="Ingredients (comma separated)">
            <Input 
              value={Array.isArray(form.ingredients) ? form.ingredients.join(", ") : (form.ingredients ?? "")} 
              onChange={(e) => setForm((f: any) => ({ ...f, ingredients: e.target.value }))} 
            />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <textarea 
              className="w-full rounded-xl border px-3 py-2" 
              rows={3} 
              value={form.description ?? ""} 
              onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} 
            />
          </Field>
          <Field label="History" className="md:col-span-2">
            <textarea 
              className="w-full rounded-xl border px-3 py-2" 
              rows={3} 
              value={form.history ?? ""} 
              onChange={(e) => setForm((f: any) => ({ ...f, history: e.target.value }))} 
            />
          </Field>
          <div className="md:col-span-2 flex gap-4">
            <div className="flex items-center gap-2">
              <input 
                id="edit_is_signature" 
                type="checkbox" 
                checked={!!form.is_signature} 
                onChange={(e) => setForm((f: any) => ({ ...f, is_signature: e.target.checked }))} 
              />
              <label htmlFor="edit_is_signature" className="text-sm">Signature Dish</label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                id="edit_featured" 
                type="checkbox" 
                checked={!!form.featured} 
                onChange={(e) => setForm((f: any) => ({ ...f, featured: e.target.checked }))} 
              />
              <label htmlFor="edit_featured" className="text-sm">Featured</label>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button 
            variant="primary" 
            onClick={() => { 
              if (!form.id) return; 
              updateM.mutate({ 
                id: form.id, 
                payload: { 
                  ...form, 
                  flavor_profile: coerceStringArray(form.flavor_profile), 
                  ingredients: coerceStringArray(form.ingredients) 
                } 
              }); 
            }}
          >
            {updateM.isLoading ? "Saving..." : "Save"}
          </Button>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
        </div>
        {serverError && <p className="text-sm text-red-600 mt-2">{serverError}</p>}
      </Modal>
    </div>
  );
}
/* ======================================================
   Restaurants (CRUD)
   ====================================================== */
function RestaurantsTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ municipality_id: 0, kind: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<any>({ 
    name: "", 
    slug: "", 
    municipality_id: 0, 
    address: "", 
    kind: "restaurant",
    phone: "",
    email: "",
    website: "",
    facebook: "",
    instagram: "",
    opening_hours: "",
    price_range: "moderate",
    cuisine_types: [],
    lat: null, 
    lng: null, 
    rating: null, 
    is_featured: false,
    panel_rank: null,
    signature: false,
    signature_rank: null,
    featured: false,
    featured_rank: null,
    autoSlug: true 
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  
  const restQ = useQuery({ 
    queryKey: ["rests", q, filters], 
    queryFn: () => listRestaurants({ q, ...filters }), 
    keepPreviousData: true 
  });

  const createM = useMutation({
    mutationFn: (payload: any) => createRestaurant(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rests"] });
      setForm({ 
        name: "", slug: "", municipality_id: 0, address: "", kind: "restaurant",
        phone: "", email: "", website: "", facebook: "", instagram: "", opening_hours: "",
        price_range: "moderate", cuisine_types: [], lat: null, lng: null, rating: null,
        is_featured: false, panel_rank: null, signature: false, signature_rank: null,
        featured: false, featured_rank: null, autoSlug: true 
      });
      setServerError(null);
      alert("Restaurant created.");
    },
    onError: (e: any) => setServerError(e?.message || "Create failed."),
  });

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateRestaurant(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rests"] });
      setEditOpen(false);
      setServerError(null);
      alert("Restaurant saved.");
    },
    onError: (e: any) => setServerError(e?.message || "Update failed."),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => deleteRestaurant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rests"] });
      alert("Restaurant deleted.");
    },
    onError: (e: any) => setServerError(e?.message || "Delete failed."),
  });

  function setName(name: string) {
    setForm((f: any) => ({ ...f, name, slug: f.autoSlug ? slugify(name) : f.slug }));
  }

  function applyFilters(newFilters: any) {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }

  function clearFilters() {
    setFilters({ municipality_id: 0, kind: "" });
    setQ("");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create Restaurant Form */}
      <Card title="Create Restaurant" className="lg:col-span-1">
        <div className="space-y-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setName(e.target.value)} />
          </Field>
          
          <div className="flex items-center gap-2 -mt-2">
            <input 
              id="autoslug2" 
              type="checkbox" 
              checked={!!form.autoSlug} 
              onChange={(e) => setForm((f: any) => ({ ...f, autoSlug: e.target.checked }))} 
            />
            <label htmlFor="autoslug2" className="text-sm text-neutral-500">Auto slug</label>
          </div>
          
          <Field label="Slug">
            <Input value={form.slug} onChange={(e) => setForm((f: any) => ({ ...f, slug: e.target.value }))} />
          </Field>
          
          <Field label="Municipality">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.municipality_id} 
              onChange={(e) => setForm((f: any) => ({ ...f, municipality_id: Number(e.target.value) }))}
            >
              <option value={0}>Select…</option>
              {(muniQ.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Kind">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.kind} 
              onChange={(e) => setForm((f: any) => ({ ...f, kind: e.target.value }))}
            >
              <option value="restaurant">Restaurant</option>
              <option value="stall">Stall</option>
              <option value="store">Store</option>
              <option value="dealer">Dealer</option>
              <option value="market">Market</option>
              <option value="home-based">Home-based</option>
            </select>
          </Field>

          <Field label="Address">
            <Input value={form.address} onChange={(e) => setForm((f: any) => ({ ...f, address: e.target.value }))} />
          </Field>
          
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm((f: any) => ({ ...f, phone: e.target.value }))} />
          </Field>
          
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value }))} />
          </Field>
          
          <Field label="Price Range">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.price_range} 
              onChange={(e) => setForm((f: any) => ({ ...f, price_range: e.target.value }))}
            >
              <option value="budget">Budget</option>
              <option value="moderate">Moderate</option>
              <option value="expensive">Expensive</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Lat">
              <Input 
                type="number" 
                step="any" 
                value={form.lat ?? ""} 
                onChange={(e) => setForm((f: any) => ({ 
                  ...f, 
                  lat: e.target.value === "" ? null : Number(e.target.value) 
                }))} 
              />
            </Field>
            <Field label="Lng">
              <Input 
                type="number" 
                step="any" 
                value={form.lng ?? ""} 
                onChange={(e) => setForm((f: any) => ({ 
                  ...f, 
                  lng: e.target.value === "" ? null : Number(e.target.value) 
                }))} 
              />
            </Field>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="primary" 
              onClick={() => {
                if (!form.name || !form.slug || !form.municipality_id || !form.address) {
                  setServerError("Please fill in all required fields");
                  return;
                }
                createM.mutate({
                  name: String(form.name), 
                  slug: String(form.slug), 
                  municipality_id: Number(form.municipality_id), 
                  address: String(form.address),
                  kind: form.kind,
                  phone: form.phone,
                  email: form.email,
                  price_range: form.price_range,
                  lat: form.lat ? Number(form.lat) : null, 
                  lng: form.lng ? Number(form.lng) : null, 
                  rating: form.rating == null ? null : clamp(Number(form.rating), 0, 5)
                });
              }}
            >
              {createM.isLoading ? "Saving..." : "Save"}
            </Button>
            <Button 
              variant="soft" 
              onClick={() => { 
                setForm({ 
                  name: "", slug: "", municipality_id: 0, address: "", kind: "restaurant",
                  phone: "", email: "", price_range: "moderate", lat: null, lng: null, 
                  rating: null, autoSlug: true 
                }); 
                setServerError(null); 
              }}
            >
              Reset
            </Button>
          </div>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        </div>
      </Card>

      {/* Restaurants List with Filters */}
      <Card 
        title="Manage Restaurants" 
        className="lg:col-span-2" 
        toolbar={
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input 
                placeholder="SEARCH RESTAURANTS" 
                value={q} 
                onChange={(e) => setQ(e.target.value)}
                className="flex-1"
              />
              <Button variant="soft" onClick={clearFilters}>Clear</Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select 
                className="rounded-xl border px-3 py-2 text-sm"
                value={filters.municipality_id}
                onChange={(e) => applyFilters({ municipality_id: Number(e.target.value) })}
              >
                <option value={0}>All Municipalities</option>
                {(muniQ.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              
              <select 
                className="rounded-xl border px-3 py-2 text-sm"
                value={filters.kind}
                onChange={(e) => applyFilters({ kind: e.target.value })}
              >
                <option value="">All Types</option>
                <option value="restaurant">Restaurant</option>
                <option value="stall">Stall</option>
                <option value="store">Store</option>
                <option value="dealer">Dealer</option>
                <option value="market">Market</option>
                <option value="home-based">Home-based</option>
              </select>
            </div>
          </div>
        }
      >
        {restQ.isLoading ? (
          <div className="grid md:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : restQ.data?.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            No restaurants found. {q || filters.municipality_id || filters.kind ? "Try changing your filters." : "Create your first restaurant!"}
          </div>
        ) : (
          <ScrollArea height={520}>
            <div className="grid md:grid-cols-2 gap-3 pr-1">
              {(restQ.data ?? []).map((r) => (
                <div key={r.id} className="border rounded-xl p-4 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2 mb-1">
                        {r.name}
                        {r.featured && <Badge variant="solid">Featured</Badge>}
                        {r.featured_rank && <Badge variant="solid">Top {r.featured_rank}</Badge>}
                        {r.signature && <Badge variant="outline">Signature</Badge>}
                      </div>
                      <div className="text-xs text-neutral-500 mb-2">
                        {r.slug} • {r.kind} • {r.municipality_name || `Muni ID: ${r.municipality_id}`}
                      </div>
                      <div className="text-sm text-neutral-600 mb-2">{r.address}</div>
                      {r.description && (
                        <p className="text-sm text-neutral-600 line-clamp-2 mb-2">{r.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        {r.rating && <span>⭐ {r.rating}</span>}
                        {r.price_range && <span>💰 {r.price_range}</span>}
                        {r.phone && <span>📞 {r.phone}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button 
                        size="sm" 
                        onClick={() => { 
                          setServerError(null); 
                          setEditOpen(true); 
                          setForm({ ...r, autoSlug: false }); 
                        }}
                      >
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="danger" 
                        onClick={async () => { 
                          if (await confirmThen(`Delete ${r.name}?`)) 
                            deleteM.mutate(r.id); 
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>

      {/* Edit Restaurant Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Restaurant">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name">
            <Input value={form.name ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Slug">
            <Input value={form.slug ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, slug: e.target.value }))} />
          </Field>
          <Field label="Municipality">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.municipality_id ?? 0} 
              onChange={(e) => setForm((f: any) => ({ ...f, municipality_id: Number(e.target.value) }))}
            >
              <option value={0}>Select…</option>
              {(muniQ.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Kind">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.kind ?? "restaurant"} 
              onChange={(e) => setForm((f: any) => ({ ...f, kind: e.target.value }))}
            >
              <option value="restaurant">Restaurant</option>
              <option value="stall">Stall</option>
              <option value="store">Store</option>
              <option value="dealer">Dealer</option>
              <option value="market">Market</option>
              <option value="home-based">Home-based</option>
            </select>
          </Field>
          <Field label="Address">
            <Input value={form.address ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, address: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Website">
            <Input value={form.website ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, website: e.target.value }))} />
          </Field>
          <Field label="Facebook">
            <Input value={form.facebook ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, facebook: e.target.value }))} />
          </Field>
          <Field label="Instagram">
            <Input value={form.instagram ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, instagram: e.target.value }))} />
          </Field>
          <Field label="Opening Hours">
            <Input value={form.opening_hours ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, opening_hours: e.target.value }))} />
          </Field>
          <Field label="Price Range">
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.price_range ?? "moderate"} 
              onChange={(e) => setForm((f: any) => ({ ...f, price_range: e.target.value }))}
            >
              <option value="budget">Budget</option>
              <option value="moderate">Moderate</option>
              <option value="expensive">Expensive</option>
            </select>
          </Field>
          <Field label="Cuisine Types (comma separated)">
            <Input 
              value={Array.isArray(form.cuisine_types) ? form.cuisine_types.join(", ") : (form.cuisine_types ?? "")} 
              onChange={(e) => setForm((f: any) => ({ ...f, cuisine_types: e.target.value }))} 
            />
          </Field>
          <Field label="Lat">
            <Input 
              type="number" 
              step="any" 
              value={form.lat ?? ""} 
              onChange={(e) => setForm((f: any) => ({ 
                ...f, 
                lat: e.target.value === "" ? null : Number(e.target.value) 
              }))} 
            />
          </Field>
          <Field label="Lng">
            <Input 
              type="number" 
              step="any" 
              value={form.lng ?? ""} 
              onChange={(e) => setForm((f: any) => ({ 
                ...f, 
                lng: e.target.value === "" ? null : Number(e.target.value) 
              }))} 
            />
          </Field>
          <Field label="Rating (0–5)">
            <Input 
              type="number" 
              step="0.1" 
              min={0} 
              max={5} 
              value={form.rating ?? ""} 
              onChange={(e) => setForm((f: any) => ({ 
                ...f, 
                rating: e.target.value === "" ? null : clamp(Number(e.target.value), 0, 5) 
              }))} 
            />
          </Field>
          <Field label="Panel Rank">
            <Input 
              type="number" 
              min={0} 
              max={255} 
              value={form.panel_rank ?? ""} 
              onChange={(e) => setForm((f: any) => ({ 
                ...f, 
                panel_rank: e.target.value === "" ? null : Number(e.target.value) 
              }))} 
            />
          </Field>
          <Field label="Signature Rank">
            <Input 
              type="number" 
              min={0} 
              max={255} 
              value={form.signature_rank ?? ""} 
              onChange={(e) => setForm((f: any) => ({ 
                ...f, 
                signature_rank: e.target.value === "" ? null : Number(e.target.value) 
              }))} 
            />
          </Field>
          <Field label="Featured Rank">
            <Input 
              type="number" 
              min={0} 
              max={255} 
              value={form.featured_rank ?? ""} 
              onChange={(e) => setForm((f: any) => ({ 
                ...f, 
                featured_rank: e.target.value === "" ? null : Number(e.target.value) 
              }))} 
            />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <textarea 
              className="w-full rounded-xl border px-3 py-2" 
              rows={3} 
              value={form.description ?? ""} 
              onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} 
            />
          </Field>
          <Field label="Image URL" className="md:col-span-2">
            <Input value={form.image_url ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, image_url: e.target.value }))} />
          </Field>
          
          <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <input 
                id="edit_is_featured" 
                type="checkbox" 
                checked={!!form.is_featured} 
                onChange={(e) => setForm((f: any) => ({ ...f, is_featured: e.target.checked }))} 
              />
              <label htmlFor="edit_is_featured" className="text-sm">Is Featured</label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                id="edit_signature" 
                type="checkbox" 
                checked={!!form.signature} 
                onChange={(e) => setForm((f: any) => ({ ...f, signature: e.target.checked }))} 
              />
              <label htmlFor="edit_signature" className="text-sm">Signature</label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                id="edit_featured" 
                type="checkbox" 
                checked={!!form.featured} 
                onChange={(e) => setForm((f: any) => ({ ...f, featured: e.target.checked }))} 
              />
              <label htmlFor="edit_featured" className="text-sm">Featured</label>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button 
            variant="primary" 
            onClick={() => { 
              if (!form.id) return; 
              updateM.mutate({ 
                id: form.id, 
                payload: { 
                  ...form, 
                  cuisine_types: coerceStringArray(form.cuisine_types)
                } 
              }); 
            }}
          >
            {updateM.isLoading ? "Saving..." : "Save"}
          </Button>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
        </div>
        {serverError && <p className="text-sm text-red-600 mt-2">{serverError}</p>}
      </Modal>
    </div>
  );
}



/* ======================================================
   Curation (combined with linking)
   ====================================================== */
function CurationTab() {
  const qc = useQueryClient();
  
  // State for each panel
  const [dishMuniId, setDishMuniId] = useState<number | null>(null);
  const [dishCategory, setDishCategory] = useState<"food" | "delicacy" | "drink">("food");
  const [dishSearch, setDishSearch] = useState("");
  
  const [linkDishSearch, setLinkDishSearch] = useState("");
  const [linkRestSearch, setLinkRestSearch] = useState("");
  const [linkMuniId, setLinkMuniId] = useState<number | null>(null);
  const [selectedLinkDishes, setSelectedLinkDishes] = useState<Set<number>>(new Set());
  const [selectedLinkRests, setSelectedLinkRests] = useState<Set<number>>(new Set());
  
  const [restMuniId, setRestMuniId] = useState<number | null>(null);
  const [restSearch, setRestSearch] = useState("");
  
  const [featuredRestId, setFeaturedRestId] = useState<number | null>(null);
  const [featuredMuniId, setFeaturedMuniId] = useState<number | null>(null);

  const [bulkLoading, setBulkLoading] = useState(false);

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });

  // Queries for each panel
  const dishesQ = useQuery({
    queryKey: ["dishes", dishSearch, dishMuniId, dishCategory],
    queryFn: () =>
      listDishes({
        q: dishSearch,
        municipalityId: dishMuniId ?? undefined,
        category: dishCategory,
      }),
    keepPreviousData: true,
  });

  const linkDishesQ = useQuery({
    queryKey: ["link-dishes", linkDishSearch, linkMuniId],
    queryFn: () =>
      listDishes({
        q: linkDishSearch,
        municipalityId: linkMuniId ?? undefined,
      }),
    keepPreviousData: true,
  });

  const linkRestsQ = useQuery({
    queryKey: ["link-rests", linkRestSearch, linkMuniId],
    queryFn: () => listRestaurants({ 
      q: linkRestSearch, 
      municipalityId: linkMuniId ?? undefined 
    }),
    keepPreviousData: true,
  });

  const restsQ = useQuery({
    queryKey: ["rests", restSearch, restMuniId],
    queryFn: () => listRestaurants({ 
      q: restSearch, 
      municipalityId: restMuniId ?? undefined 
    }),
    keepPreviousData: true,
  });

  const featuredRestsQ = useQuery({
    queryKey: ["featured-rests", featuredMuniId],
    queryFn: () => listRestaurants({ 
      municipalityId: featuredMuniId ?? undefined 
    }),
    keepPreviousData: true,
  });

  // Get linked dishes for the selected restaurant
  const linkedDishesQ = useQuery({
    queryKey: ["dishes:for-restaurant", featuredRestId],
    enabled: !!featuredRestId,
    queryFn: async () => (featuredRestId ? await listDishesForRestaurant(featuredRestId) : []),
    staleTime: 60_000,
  });

  // Mutations
  const patchDishM_local = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => setDishCuration(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dishes"] });
      qc.invalidateQueries({ queryKey: ["dishes:for-restaurant", featuredRestId] });
    },
  });

  const patchRestM_local = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => setRestaurantCuration(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rests"] }),
  });

  const linkMut_local = useMutation({
    mutationFn: (vars: { dish_id: number; restaurant_id: number }) => linkDishRestaurant(vars),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dishes:for-restaurant", vars.restaurant_id] });
      qc.invalidateQueries({ queryKey: ["link-dishes"] });
      qc.invalidateQueries({ queryKey: ["link-rests"] });
    },
  });

  const unlinkMut_local = useMutation({
    mutationFn: (vars: { dish_id: number; restaurant_id: number }) => unlinkDishRestaurant(vars),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dishes:for-restaurant", vars.restaurant_id] });
      qc.invalidateQueries({ queryKey: ["link-dishes"] });
      qc.invalidateQueries({ queryKey: ["link-rests"] });
    },
  });

  const patchDish = patchDishM_local;
  const patchRest = patchRestM_local;
  const linkMut = linkMut_local;
  const unlinkMut = unlinkMut_local;

  // Dish Curation Functions
  async function setDishRank(d: Dish, rank: number | null) {
    const list = (dishesQ.data ?? []).filter((x: any) => 
      x.category === dishCategory && (!dishMuniId || x.municipality_id === dishMuniId)
    );
    const conflict = rank ? list.find((x: any) => x.panel_rank === rank && x.id !== d.id) : null;
    if (conflict) {
      const ok = await confirmThen(`Replace "${conflict.name}" at TOP ${rank} with "${d.name}"?`);
      if (!ok) return;
      await patchDish.mutateAsync({ id: conflict.id, payload: { panel_rank: null, is_signature: 0 } });
    }
    await patchDish.mutateAsync({ id: d.id, payload: { panel_rank: rank, is_signature: rank ? 1 : 0 } });
  }

  // Restaurant Curation Functions
  async function setRestRank(r: Restaurant, rank: number | null) {
    const list = (restsQ.data ?? []).filter((x: any) => !restMuniId || x.municipality_id === restMuniId);
    const conflict = rank ? list.find((x: any) => x.featured_rank === rank && x.id !== r.id) : null;
    if (conflict) {
      const ok = await confirmThen(`Replace "${conflict.name}" at TOP ${rank} with "${r.name}"?`);
      if (!ok) return;
      await patchRest.mutateAsync({ id: conflict.id, payload: { featured_rank: null, featured: 0 } });
    }
    await patchRest.mutateAsync({ id: r.id, payload: { featured_rank: rank, featured: rank ? 1 : 0 } });
  }

  // Linking Functions
  function toggleLinkDish(id: number) {
    setSelectedLinkDishes(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleLinkRest(id: number) {
    setSelectedLinkRests(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function handleBulkLink() {
    if (!selectedLinkDishes.size || !selectedLinkRests.size) {
      alert("Please select both dishes and restaurants to link.");
      return;
    }

    setBulkLoading(true);
    try {
      const linkPromises = [];
      for (const dishId of selectedLinkDishes) {
        for (const restId of selectedLinkRests) {
          linkPromises.push(linkMut.mutateAsync({ dish_id: dishId, restaurant_id: restId }));
        }
      }
      await Promise.all(linkPromises);
      setSelectedLinkDishes(new Set());
      setSelectedLinkRests(new Set());
      alert(`Successfully linked ${selectedLinkDishes.size} dishes to ${selectedLinkRests.size} restaurants!`);
    } catch (err: any) {
      console.error("Bulk link failed", err);
      alert("Bulk link failed: " + (err?.message || "unknown"));
    } finally {
      setBulkLoading(false);
    }
  }

  // FIXED: Featured Dishes Functions
  async function setDishAsFeatured(dishId: number, rank: number | null) {
    if (!featuredRestId) return;

    try {
      // For now, we'll use the global dish curation to set featured status
      // This means the dish will be featured globally, not just for this restaurant
      // If you need restaurant-specific featuring, you'll need to extend your backend
      
      // If setting a rank, check for conflicts within the same municipality
      const dish = (linkedDishesQ.data ?? []).find(d => d.id === dishId);
      if (!dish) return;

      if (rank) {
        const list = (linkedDishesQ.data ?? []).filter((d: any) => 
          d.municipality_id === dish.municipality_id
        );
        const conflict = list.find((d: any) => 
          d.featured_rank === rank && d.id !== dishId
        );
        
        if (conflict) {
          const ok = await confirmThen(
            `"${conflict.name}" is already featured at rank ${rank} in ${(muniQ.data ?? []).find(m => m.id === conflict.municipality_id)?.name}. Replace it with "${dish.name}"?`
          );
          if (!ok) return;
          
          // Remove featured rank from the conflicting dish
          await patchDish.mutateAsync({ 
            id: conflict.id, 
            payload: { featured_rank: null, featured: 0 } 
          });
        }
      }

      // Set featured rank for the selected dish
      await patchDish.mutateAsync({ 
        id: dishId, 
        payload: { 
          featured_rank: rank, 
          featured: rank ? 1 : 0 
        } 
      });

    } catch (err: any) {
      console.error("Set featured failed:", err);
      alert("Failed to set featured dish: " + (err?.message || "unknown"));
    }
  }

  async function handleRemoveDishFromRestaurant(dishId: number) {
    if (!featuredRestId) return;
    
    const ok = await confirmThen("Remove this dish from the restaurant?");
    if (!ok) return;
    
    try {
      await unlinkMut.mutateAsync({ dish_id: dishId, restaurant_id: featuredRestId });
    } catch (err: any) {
      console.error("Remove dish failed", err);
      alert("Failed to remove dish: " + (err?.message || "unknown"));
    }
  }

  return (
    <div className="space-y-6">
      {/* Panel 1: Dish Curation */}
      <Card title="Dish Curation" toolbar={
        <div className="flex gap-2 items-center">
          <select className="border rounded px-2 py-1 text-sm" value={dishMuniId ?? 0} onChange={(e) => setDishMuniId(Number(e.target.value) || null)}>
            <option value={0}>All municipalities</option>
            {(muniQ.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <select className="border rounded px-2 py-1 text-sm" value={dishCategory} onChange={(e) => setDishCategory(e.target.value as any)}>
            <option value="food">Food</option>
            <option value="delicacy">Delicacy</option>
            <option value="drink">Drink</option>
          </select>
        </div>
      }>
        <Input 
          className="mb-3" 
          placeholder="Search dishes…" 
          value={dishSearch} 
          onChange={(e) => setDishSearch(e.target.value)} 
        />
        
        <ScrollArea height={420}>
          <div className="grid sm:grid-cols-2 gap-3 pr-1">
            {(dishesQ.data ?? []).map(d => (
              <div key={d.id} className="border rounded-xl p-3 hover:shadow-sm transition">
                <div className="font-semibold">{d.name}</div>
                <div className="text-xs text-neutral-500">
                  {d.category} • {(muniQ.data ?? []).find(m => m.id === d.municipality_id)?.name}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="text-xs text-neutral-500 mr-2">Top Ranks:</div>
                  {[1,2,3].map(rank => (
                    <Button 
                      key={`panel-${d.id}-${rank}`} 
                      size="sm" 
                      variant={d.panel_rank === rank ? "primary" : "default"} 
                      onClick={() => setDishRank(d, d.panel_rank === rank ? null : rank)}
                    >
                      Top {rank}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Panel 2: Dish to Restaurant Linking */}
      <Card title="Dish to Restaurant Linking" toolbar={
        <div className="flex gap-2 items-center">
          <select className="border rounded px-2 py-1 text-sm" value={linkMuniId ?? 0} onChange={(e) => setLinkMuniId(Number(e.target.value) || null)}>
            <option value={0}>All municipalities</option>
            {(muniQ.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      }>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {/* Dishes Column */}
          <div>
            <div className="text-sm font-medium mb-2">Select Dishes</div>
            <Input 
              placeholder="Search dishes…" 
              value={linkDishSearch} 
              onChange={(e) => setLinkDishSearch(e.target.value)} 
              className="mb-2"
            />
            <ScrollArea height={200}>
              <div className="space-y-2 pr-2">
                {(linkDishesQ.data ?? []).map(d => (
                  <label key={d.id} className="flex items-center gap-2 p-2 border rounded hover:bg-neutral-50 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedLinkDishes.has(d.id)} 
                      onChange={() => toggleLinkDish(d.id)} 
                    />
                    <div>
                      <div className="font-medium text-sm">{d.name}</div>
                      <div className="text-xs text-neutral-500">{d.category}</div>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <div className="text-xs text-neutral-500 mt-1">
              Selected: {selectedLinkDishes.size} dishes
            </div>
          </div>

          {/* Restaurants Column */}
          <div>
            <div className="text-sm font-medium mb-2">Select Restaurants</div>
            <Input 
              placeholder="Search restaurants…" 
              value={linkRestSearch} 
              onChange={(e) => setLinkRestSearch(e.target.value)} 
              className="mb-2"
            />
            <ScrollArea height={200}>
              <div className="space-y-2 pr-2">
                {(linkRestsQ.data ?? []).map(r => (
                  <label key={r.id} className="flex items-center gap-2 p-2 border rounded hover:bg-neutral-50 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedLinkRests.has(r.id)} 
                      onChange={() => toggleLinkRest(r.id)} 
                    />
                    <div>
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-neutral-500">{r.address}</div>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <div className="text-xs text-neutral-500 mt-1">
              Selected: {selectedLinkRests.size} restaurants
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t pt-4">
          <Button 
            variant="primary" 
            onClick={handleBulkLink} 
            disabled={bulkLoading || !selectedLinkDishes.size || !selectedLinkRests.size}
          >
            Link Selected ({selectedLinkDishes.size} dishes × {selectedLinkRests.size} restaurants)
          </Button>
          <div className="text-sm text-neutral-600">
            This will link every selected dish to every selected restaurant
          </div>
        </div>
      </Card>

      {/* Panel 3: Restaurant Curation */}
      <Card title="Restaurant Curation (Per Municipality)" toolbar={
        <div className="flex gap-2">
          <select className="border rounded px-2 py-1 text-sm" value={restMuniId ?? 0} onChange={(e) => setRestMuniId(Number(e.target.value) || null)}>
            <option value={0}>All municipalities</option>
            {(muniQ.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      }>
        <Input 
          className="mb-3" 
          placeholder="Search restaurants…" 
          value={restSearch} 
          onChange={(e) => setRestSearch(e.target.value)} 
        />
        <ScrollArea height={420}>
          <div className="grid sm:grid-cols-2 gap-3 pr-1">
            {(restsQ.data ?? []).map((r) => (
              <div key={r.id} className="border rounded-xl p-3 hover:shadow-sm transition">
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-neutral-500">
                  {(muniQ.data ?? []).find((m) => m.id === (r.municipality_id ?? 0))?.name}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {[1, 2, 3].map((rank) => (
                    <Button 
                      key={`rest-${r.id}-${rank}`} 
                      size="sm" 
                      variant={(r as any).featured_rank === rank ? "primary" : "default"} 
                      onClick={() => setRestRank(r, (r as any).featured_rank === rank ? null : rank)}
                    >
                      Top {rank}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Panel 4: Restaurant Dish Featured Curation - FIXED */}
      <Card title="Restaurant Dish Featured Curation" toolbar={
        <div className="flex gap-2 items-center">
          <select className="border rounded px-2 py-1 text-sm" value={featuredMuniId ?? 0} onChange={(e) => setFeaturedMuniId(Number(e.target.value) || null)}>
            <option value={0}>All municipalities</option>
            {(muniQ.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <select className="border rounded px-2 py-1 text-sm" value={featuredRestId ?? 0} onChange={(e) => setFeaturedRestId(Number(e.target.value) || null)}>
            <option value={0}>Select restaurant…</option>
            {(featuredRestsQ.data ?? []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      }>
        {!featuredRestId ? (
          <div className="text-center py-8 text-neutral-500">
            Select a restaurant to manage featured dishes
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-neutral-600 mb-4">
              Managing featured dishes for: <strong>{(featuredRestsQ.data ?? []).find(r => r.id === featuredRestId)?.name}</strong>
            </div>

            {/* Linked Dishes for this Restaurant */}
            <div>
              <div className="text-sm font-medium mb-2">Dishes Available at this Restaurant:</div>
              {linkedDishesQ.isLoading ? (
                <div className="text-sm text-neutral-500">Loading dishes…</div>
              ) : (linkedDishesQ.data ?? []).length === 0 ? (
                <div className="text-sm text-neutral-500">
                  No dishes linked to this restaurant. Use the "Dish to Restaurant Linking" panel to add dishes first.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {(linkedDishesQ.data ?? []).map(d => (
                    <div key={d.id} className="border rounded-lg p-3 hover:shadow-sm transition">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-semibold">{d.name}</div>
                          <div className="text-xs text-neutral-500">
                            {d.category} • {(muniQ.data ?? []).find(m => m.id === d.municipality_id)?.name}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="danger"
                          onClick={() => handleRemoveDishFromRestaurant(d.id)}
                          disabled={unlinkMut.isLoading}
                        >
                          Remove
                        </Button>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xs text-neutral-500">Featured Rank:</div>
                        {[1, 2, 3].map(rank => (
                          <Button 
                            key={`featured-${d.id}-${rank}`} 
                            size="sm" 
                            variant={(d as any).featured_rank === rank ? "primary" : "default"} 
                            onClick={() => setDishAsFeatured(d.id, (d as any).featured_rank === rank ? null : rank)}
                            disabled={patchDish.isLoading}
                          >
                            {rank}
                          </Button>
                        ))}
                        {(d as any).featured_rank && (
                          <span className="text-xs text-green-600 font-medium">
                            Currently featured at rank {(d as any).featured_rank}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs text-neutral-500 border-t pt-3">
              💡 <strong>Note:</strong> Featured dishes are set globally (across all restaurants). 
              If you feature a dish here, it will be featured everywhere it appears.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ======================================================
   Main Admin Dashboard with tabs (UI-polished)
   ====================================================== */
export default function AdminDashboard() {
  const [tab, setTab] = useState<"analytics" | "dishes" | "restaurants" | "curation">("analytics");

  return (
    <div className="space-y-6">
      <Toolbar
        left={<div><h2 className="text-2xl font-bold">Admin Dashboard</h2><div className="text-sm text-neutral-500">Bulacan – Mapping Flavors</div></div>}
        right={
          <div className="flex gap-2">
            {(["analytics","dishes","restaurants","curation"] as const).map((t)=> (
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
    </div>
  );
}