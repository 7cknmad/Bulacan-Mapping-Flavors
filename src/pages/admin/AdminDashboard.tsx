import React, { useMemo,useCallback, useState, useEffect } from "react";
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
  coerceStringArray, slugify,
  // ADD THESE NEW FUNCTIONS:
  getRestaurantFeaturedDishes,
  setRestaurantDishFeatured,
  addDishToRestaurant,
  getRestaurantDishDetails,
  getRestaurantDishLinks,
  getDishesWithRestaurants,
  getRestaurantsWithDishes,
  getUnlinkingData,
  unlinkDishFromRestaurants,
  unlinkRestaurantFromDishes,
  removeAllDishLinks,
  removeAllRestaurantLinks,
  bulkUnlinkDishesFromRestaurants,
  getLinkStats
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
  const [filters, setFilters] = useState({ municipality_id: 0, category_id: 0 });
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<any>({ 
    name: "", 
    slug: "", 
    municipality_id: 0, 
    category_id: 0,
    rating: null, 
    popularity: null, 
    description: "",
    flavor_profile: [],
    ingredients: [],
    history: "",
    image_url: "",
    autoSlug: true 
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  // Validation function
  const validateForm = (formData: any, isEdit: boolean = false) => {
    const errors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      errors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }
    
    if (!isEdit && (!formData.municipality_id || formData.municipality_id === 0)) {
      errors.municipality_id = "Municipality is required";
    }
    
    if (!formData.category_id || formData.category_id === 0) {
      errors.category_id = "Category is required";
    }
    
    if (formData.rating !== null && (formData.rating < 0 || formData.rating > 5)) {
      errors.rating = "Rating must be between 0 and 5";
    }
    
    if (formData.popularity !== null && (formData.popularity < 0 || formData.popularity > 100)) {
      errors.popularity = "Popularity must be between 0 and 100";
    }
    
    return errors;
  };

  const createM = useMutation({
    mutationFn: (payload: any) => createDish(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dishes"] });
      setForm({ 
        name: "", 
        slug: "", 
        municipality_id: 0, 
        category_id: 0,
        rating: null, 
        popularity: null, 
        description: "",
        flavor_profile: [],
        ingredients: [],
        history: "",
        image_url: "",
        autoSlug: true 
      });
      setServerError(null);
      setFieldErrors({});
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
      setFieldErrors({});
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
    const slug = form.autoSlug ? slugify(name) : form.slug;
    setForm((f: any) => ({ ...f, name, slug }));
    // Clear name error when user types
    if (fieldErrors.name) {
      setFieldErrors(prev => ({ ...prev, name: "" }));
    }
  }

  function applyFilters(newFilters: any) {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }

  function clearFilters() {
    setFilters({ municipality_id: 0, category_id: 0 });
    setQ("");
  }

const handleCreate = () => {
  const errors = validateForm(form);
  if (Object.keys(errors).length > 0) {
    setFieldErrors(errors);
    return;
  }
  
  const payload = {
    name: String(form.name).trim(), 
    slug: String(form.slug), 
    municipality_id: Number(form.municipality_id), 
    category_id: Number(form.category_id),
    rating: form.rating == null ? null : clamp(Number(form.rating), 0, 5), 
    popularity: form.popularity == null ? null : clamp(Number(form.popularity), 0, 100),
    description: form.description?.trim() || null,
    history: form.history?.trim() || null,
    image_url: form.image_url?.trim() || null,
    flavor_profile: coerceStringArray(form.flavor_profile),
    ingredients: coerceStringArray(form.ingredients)
  };
  
  console.log('🔄 Sending dish creation payload:', payload);
  
  createM.mutate(payload);
};

  const handleUpdate = () => {
    if (!form.id) return;
    
    const errors = validateForm(form, true);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    
    updateM.mutate({ 
      id: form.id, 
      payload: { 
        ...form, 
        name: form.name.trim(),
        description: form.description?.trim() || null,
        history: form.history?.trim() || null,
        image_url: form.image_url?.trim() || null,
        flavor_profile: coerceStringArray(form.flavor_profile), 
        ingredients: coerceStringArray(form.ingredients) 
      } 
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create Dish Form */}
      <Card title="Create Dish" className="lg:col-span-1">
        <div className="space-y-3">
          <Field label="Name" error={fieldErrors.name}>
            <Input 
              value={form.name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter dish name"
            />
          </Field>
          
          <Field label="Municipality" error={fieldErrors.municipality_id}>
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.municipality_id} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, municipality_id: Number(e.target.value) }));
                if (fieldErrors.municipality_id) {
                  setFieldErrors(prev => ({ ...prev, municipality_id: "" }));
                }
              }}
            >
              <option value={0}>Select Municipality…</option>
              {(muniQ.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Category" error={fieldErrors.category_id}>
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.category_id} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, category_id: Number(e.target.value) }));
                if (fieldErrors.category_id) {
                  setFieldErrors(prev => ({ ...prev, category_id: "" }));
                }
              }}
            >
              <option value={0}>Select Category…</option>
              {(categoriesQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Rating (0–5)" error={fieldErrors.rating}>
              <Input 
                type="number" 
                step="0.1" 
                min={0} 
                max={5} 
                value={form.rating ?? ""} 
                onChange={(e) => {
                  setForm((f: any) => ({ 
                    ...f, 
                    rating: e.target.value === "" ? null : Number(e.target.value) 
                  }));
                  if (fieldErrors.rating) {
                    setFieldErrors(prev => ({ ...prev, rating: "" }));
                  }
                }}
                placeholder="0-5"
              />
            </Field>
            <Field label="Popularity (0-100)" error={fieldErrors.popularity}>
              <Input 
                type="number" 
                min={0} 
                max={100} 
                value={form.popularity ?? ""} 
                onChange={(e) => {
                  setForm((f: any) => ({ 
                    ...f, 
                    popularity: e.target.value === "" ? null : Number(e.target.value) 
                  }));
                  if (fieldErrors.popularity) {
                    setFieldErrors(prev => ({ ...prev, popularity: "" }));
                  }
                }}
                placeholder="0-100"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea 
              className="w-full rounded-xl border px-3 py-2" 
              rows={3}
              value={form.description} 
              onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))}
              placeholder="Enter dish description"
            />
          </Field>

          <Field label="History">
            <textarea 
              className="w-full rounded-xl border px-3 py-2" 
              rows={2}
              value={form.history} 
              onChange={(e) => setForm((f: any) => ({ ...f, history: e.target.value }))}
              placeholder="Enter dish history"
            />
          </Field>

          <Field label="Image URL">
            <Input 
              value={form.image_url} 
              onChange={(e) => setForm((f: any) => ({ ...f, image_url: e.target.value }))}
              placeholder="Enter image URL"
            />
          </Field>

          <Field label="Flavor Profile (comma separated)">
            <Input 
              value={Array.isArray(form.flavor_profile) ? form.flavor_profile.join(", ") : (form.flavor_profile ?? "")} 
              onChange={(e) => setForm((f: any) => ({ ...f, flavor_profile: e.target.value }))}
              placeholder="sweet, spicy, salty, etc."
            />
          </Field>

          <Field label="Ingredients (comma separated)">
            <Input 
              value={Array.isArray(form.ingredients) ? form.ingredients.join(", ") : (form.ingredients ?? "")} 
              onChange={(e) => setForm((f: any) => ({ ...f, ingredients: e.target.value }))}
              placeholder="ingredient1, ingredient2, etc."
            />
          </Field>

          <div className="flex gap-2">
            <Button 
              variant="primary" 
              disabled={createM.isLoading} 
              onClick={handleCreate}
            >
              {createM.isLoading ? "Saving..." : "Create Dish"}
            </Button>
            <Button 
              variant="soft" 
              onClick={() => { 
                setForm({ 
                  name: "", slug: "", municipality_id: 0, category_id: 0,
                  rating: null, popularity: null, description: "", history: "", image_url: "",
                  flavor_profile: [], ingredients: [], autoSlug: true 
                }); 
                setServerError(null); 
                setFieldErrors({});
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
                value={filters.category_id}
                onChange={(e) => applyFilters({ category_id: Number(e.target.value) })}
              >
                <option value={0}>All Categories</option>
                {(categoriesQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.display_name}</option>
                ))}
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
            No dishes found. {q || filters.municipality_id || filters.category_id ? "Try changing your filters." : "Create your first dish!"}
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
                        {d.category} • {d.municipality_name || `Muni ID: ${d.municipality_id}`}
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
                          setFieldErrors({});
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
          <Field label="Name" error={fieldErrors.name}>
            <Input 
              value={form.name ?? ""} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, name: e.target.value }));
                if (fieldErrors.name) {
                  setFieldErrors(prev => ({ ...prev, name: "" }));
                }
              }} 
            />
          </Field>
          
          <Field label="Municipality" error={fieldErrors.municipality_id}>
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.municipality_id ?? 0} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, municipality_id: Number(e.target.value) }));
                if (fieldErrors.municipality_id) {
                  setFieldErrors(prev => ({ ...prev, municipality_id: "" }));
                }
              }}
            >
              <option value={0}>Select Municipality…</option>
              {(muniQ.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          
          <Field label="Category" error={fieldErrors.category_id}>
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.category_id ?? 0} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, category_id: Number(e.target.value) }));
                if (fieldErrors.category_id) {
                  setFieldErrors(prev => ({ ...prev, category_id: "" }));
                }
              }}
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
          
          <Field label="Rating (0–5)" error={fieldErrors.rating}>
            <Input 
              type="number" 
              min={0} 
              max={5} 
              step="0.1" 
              value={form.rating ?? ""} 
              onChange={(e) => {
                setForm((f: any) => ({ 
                  ...f, 
                  rating: e.target.value === "" ? null : clamp(Number(e.target.value), 0, 5) 
                }));
                if (fieldErrors.rating) {
                  setFieldErrors(prev => ({ ...prev, rating: "" }));
                }
              }} 
            />
          </Field>
          
          <Field label="Popularity (0-100)" error={fieldErrors.popularity}>
            <Input 
              type="number" 
              min={0} 
              max={100} 
              value={form.popularity ?? ""} 
              onChange={(e) => {
                setForm((f: any) => ({ 
                  ...f, 
                  popularity: e.target.value === "" ? null : clamp(Number(e.target.value), 0, 100) 
                }));
                if (fieldErrors.popularity) {
                  setFieldErrors(prev => ({ ...prev, popularity: "" }));
                }
              }} 
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
        </div>
        <div className="mt-4 flex gap-2">
          <Button 
            variant="primary" 
            onClick={handleUpdate}
          >
            {updateM.isLoading ? "Saving..." : "Save Changes"}
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
    autoSlug: true 
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  
  const restQ = useQuery({ 
    queryKey: ["rests", q, filters], 
    queryFn: () => listRestaurants({ q, ...filters }), 
    keepPreviousData: true 
  });

  // Validation function
  const validateForm = (formData: any, isEdit: boolean = false) => {
    const errors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      errors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }
    
    if (!isEdit && (!formData.municipality_id || formData.municipality_id === 0)) {
      errors.municipality_id = "Municipality is required";
    }
    
    if (!formData.address?.trim()) {
      errors.address = "Address is required";
    }
    
    if (formData.rating !== null && (formData.rating < 0 || formData.rating > 5)) {
      errors.rating = "Rating must be between 0 and 5";
    }
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Email is invalid";
    }
    
    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      errors.phone = "Phone number is invalid";
    }
    
    return errors;
  };

  const createM = useMutation({
    mutationFn: (payload: any) => createRestaurant(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rests"] });
      setForm({ 
        name: "", slug: "", municipality_id: 0, address: "", kind: "restaurant",
        phone: "", email: "", website: "", facebook: "", instagram: "", opening_hours: "",
        price_range: "moderate", cuisine_types: [], lat: null, lng: null, rating: null,
        autoSlug: true 
      });
      setServerError(null);
      setFieldErrors({});
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
      setFieldErrors({});
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
    const slug = form.autoSlug ? slugify(name) : form.slug;
    setForm((f: any) => ({ ...f, name, slug }));
    // Clear name error when user types
    if (fieldErrors.name) {
      setFieldErrors(prev => ({ ...prev, name: "" }));
    }
  }

  function applyFilters(newFilters: any) {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }

  function clearFilters() {
    setFilters({ municipality_id: 0, kind: "" });
    setQ("");
  }

  const handleCreate = () => {
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    
    createM.mutate({
      name: String(form.name).trim(), 
      slug: String(form.slug), 
      municipality_id: Number(form.municipality_id), 
      address: String(form.address).trim(),
      kind: form.kind,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      website: form.website?.trim() || null,
      facebook: form.facebook?.trim() || null,
      instagram: form.instagram?.trim() || null,
      opening_hours: form.opening_hours?.trim() || null,
      price_range: form.price_range,
      cuisine_types: coerceStringArray(form.cuisine_types),
      lat: form.lat === "" ? null : Number(form.lat), 
      lng: form.lng === "" ? null : Number(form.lng), 
      rating: form.rating == null ? null : clamp(Number(form.rating), 0, 5),
      description: form.description?.trim() || null,
      image_url: form.image_url?.trim() || null
    });
  };

  const handleUpdate = () => {
    if (!form.id) return;
    
    const errors = validateForm(form, true);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    
    updateM.mutate({ 
      id: form.id, 
      payload: { 
        ...form,
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        website: form.website?.trim() || null,
        facebook: form.facebook?.trim() || null,
        instagram: form.instagram?.trim() || null,
        opening_hours: form.opening_hours?.trim() || null,
        description: form.description?.trim() || null,
        image_url: form.image_url?.trim() || null,
        cuisine_types: coerceStringArray(form.cuisine_types),
        lat: form.lat === "" ? null : Number(form.lat),
        lng: form.lng === "" ? null : Number(form.lng)
      } 
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create Restaurant Form */}
      <Card title="Create Restaurant" className="lg:col-span-1">
        <div className="space-y-3">
          <Field label="Name" error={fieldErrors.name}>
            <Input 
              value={form.name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter restaurant name"
            />
          </Field>
          
          <Field label="Municipality" error={fieldErrors.municipality_id}>
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.municipality_id} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, municipality_id: Number(e.target.value) }));
                if (fieldErrors.municipality_id) {
                  setFieldErrors(prev => ({ ...prev, municipality_id: "" }));
                }
              }}
            >
              <option value={0}>Select Municipality…</option>
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

          <Field label="Address" error={fieldErrors.address}>
            <Input 
              value={form.address} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, address: e.target.value }));
                if (fieldErrors.address) {
                  setFieldErrors(prev => ({ ...prev, address: "" }));
                }
              }}
              placeholder="Enter full address"
            />
          </Field>
          
          <Field label="Phone" error={fieldErrors.phone}>
            <Input 
              value={form.phone} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, phone: e.target.value }));
                if (fieldErrors.phone) {
                  setFieldErrors(prev => ({ ...prev, phone: "" }));
                }
              }}
              placeholder="Phone number"
            />
          </Field>
          
          <Field label="Email" error={fieldErrors.email}>
            <Input 
              type="email" 
              value={form.email} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, email: e.target.value }));
                if (fieldErrors.email) {
                  setFieldErrors(prev => ({ ...prev, email: "" }));
                }
              }}
              placeholder="Email address"
            />
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
            <Field label="Latitude">
              <Input 
                type="number" 
                step="any" 
                value={form.lat ?? ""} 
                onChange={(e) => setForm((f: any) => ({ 
                  ...f, 
                  lat: e.target.value === "" ? null : Number(e.target.value) 
                }))} 
                placeholder="e.g., 14.123456"
              />
            </Field>
            <Field label="Longitude">
              <Input 
                type="number" 
                step="any" 
                value={form.lng ?? ""} 
                onChange={(e) => setForm((f: any) => ({ 
                  ...f, 
                  lng: e.target.value === "" ? null : Number(e.target.value) 
                }))} 
                placeholder="e.g., 121.123456"
              />
            </Field>
          </div>

          <Field label="Rating (0–5)" error={fieldErrors.rating}>
            <Input 
              type="number" 
              step="0.1" 
              min={0} 
              max={5} 
              value={form.rating ?? ""} 
              onChange={(e) => {
                setForm((f: any) => ({ 
                  ...f, 
                  rating: e.target.value === "" ? null : Number(e.target.value) 
                }));
                if (fieldErrors.rating) {
                  setFieldErrors(prev => ({ ...prev, rating: "" }));
                }
              }}
              placeholder="0-5"
            />
          </Field>

          <Field label="Opening Hours">
            <Input 
              value={form.opening_hours} 
              onChange={(e) => setForm((f: any) => ({ ...f, opening_hours: e.target.value }))}
              placeholder="e.g., 9AM-6PM Mon-Sat"
            />
          </Field>

          <Field label="Website">
            <Input 
              value={form.website} 
              onChange={(e) => setForm((f: any) => ({ ...f, website: e.target.value }))}
              placeholder="Website URL"
            />
          </Field>

          <Field label="Facebook">
            <Input 
              value={form.facebook} 
              onChange={(e) => setForm((f: any) => ({ ...f, facebook: e.target.value }))}
              placeholder="Facebook page URL"
            />
          </Field>

          <Field label="Instagram">
            <Input 
              value={form.instagram} 
              onChange={(e) => setForm((f: any) => ({ ...f, instagram: e.target.value }))}
              placeholder="Instagram handle"
            />
          </Field>

          <Field label="Cuisine Types (comma separated)">
            <Input 
              value={Array.isArray(form.cuisine_types) ? form.cuisine_types.join(", ") : (form.cuisine_types ?? "")} 
              onChange={(e) => setForm((f: any) => ({ ...f, cuisine_types: e.target.value }))}
              placeholder="Filipino, Asian, Western, etc."
            />
          </Field>

          <Field label="Description">
            <textarea 
              className="w-full rounded-xl border px-3 py-2" 
              rows={3}
              value={form.description} 
              onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))}
              placeholder="Enter restaurant description"
            />
          </Field>

          <Field label="Image URL">
            <Input 
              value={form.image_url} 
              onChange={(e) => setForm((f: any) => ({ ...f, image_url: e.target.value }))}
              placeholder="Enter image URL"
            />
          </Field>

          <div className="flex gap-2">
            <Button 
              variant="primary" 
              onClick={handleCreate}
            >
              {createM.isLoading ? "Saving..." : "Create Restaurant"}
            </Button>
            <Button 
              variant="soft" 
              onClick={() => { 
                setForm({ 
                  name: "", slug: "", municipality_id: 0, address: "", kind: "restaurant",
                  phone: "", email: "", website: "", facebook: "", instagram: "", opening_hours: "",
                  price_range: "moderate", cuisine_types: [], lat: null, lng: null, 
                  rating: null, description: "", image_url: "", autoSlug: true 
                }); 
                setServerError(null); 
                setFieldErrors({});
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
                        {r.kind} • {r.municipality_name || `Muni ID: ${r.municipality_id}`}
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
                          setFieldErrors({});
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
          <Field label="Name" error={fieldErrors.name}>
            <Input 
              value={form.name ?? ""} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, name: e.target.value }));
                if (fieldErrors.name) {
                  setFieldErrors(prev => ({ ...prev, name: "" }));
                }
              }} 
            />
          </Field>
          
          <Field label="Municipality" error={fieldErrors.municipality_id}>
            <select 
              className="w-full rounded-xl border px-3 py-2" 
              value={form.municipality_id ?? 0} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, municipality_id: Number(e.target.value) }));
                if (fieldErrors.municipality_id) {
                  setFieldErrors(prev => ({ ...prev, municipality_id: "" }));
                }
              }}
            >
              <option value={0}>Select Municipality…</option>
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
          
          <Field label="Address" error={fieldErrors.address}>
            <Input 
              value={form.address ?? ""} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, address: e.target.value }));
                if (fieldErrors.address) {
                  setFieldErrors(prev => ({ ...prev, address: "" }));
                }
              }} 
            />
          </Field>
          
          <Field label="Phone" error={fieldErrors.phone}>
            <Input 
              value={form.phone ?? ""} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, phone: e.target.value }));
                if (fieldErrors.phone) {
                  setFieldErrors(prev => ({ ...prev, phone: "" }));
                }
              }} 
            />
          </Field>
          
          <Field label="Email" error={fieldErrors.email}>
            <Input 
              type="email" 
              value={form.email ?? ""} 
              onChange={(e) => {
                setForm((f: any) => ({ ...f, email: e.target.value }));
                if (fieldErrors.email) {
                  setFieldErrors(prev => ({ ...prev, email: "" }));
                }
              }} 
            />
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
          
          <Field label="Latitude">
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
          
          <Field label="Longitude">
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
          
          <Field label="Rating (0–5)" error={fieldErrors.rating}>
            <Input 
              type="number" 
              step="0.1" 
              min={0} 
              max={5} 
              value={form.rating ?? ""} 
              onChange={(e) => {
                setForm((f: any) => ({ 
                  ...f, 
                  rating: e.target.value === "" ? null : clamp(Number(e.target.value), 0, 5) 
                }));
                if (fieldErrors.rating) {
                  setFieldErrors(prev => ({ ...prev, rating: "" }));
                }
              }} 
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
          
          <Field label="Image URL" className="md:col-span-1">
            <Input value={form.image_url ?? ""} onChange={(e) => setForm((f: any) => ({ ...f, image_url: e.target.value }))} />
          </Field>
        </div>

        <div className="mt-4 flex gap-2">
          <Button 
            variant="primary" 
            onClick={handleUpdate}
          >
            {updateM.isLoading ? "Saving..." : "Save Changes"}
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
  const [unlinkRestId, setUnlinkRestId] = useState<number | null>(null);
  const [unlinkDishSearch, setUnlinkDishSearch] = useState("");
  const [unlinkRestSearch, setUnlinkRestSearch] = useState("");
  const [selectedUnlinkDishes, setSelectedUnlinkDishes] = useState<Set<number>>(new Set());
  const [selectedUnlinkRests, setSelectedUnlinkRests] = useState<Set<number>>(new Set());
  const [bulkUnlinkLoading, setBulkUnlinkLoading] = useState(false);
  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });





const linkedDishesForUnlink = useQuery({
  queryKey: ["dishes:for-restaurant", unlinkRestId],
  enabled: !!unlinkRestId,
  queryFn: async () => {
    if (!unlinkRestId) return [];
    return await getDishesForRestaurant(unlinkRestId);
  },
});


const allRestaurantDishLinks = useQuery({
  queryKey: ["all-restaurant-dish-links", linkMuniId],
  queryFn: () => getRestaurantDishLinks({ 
    municipalityId: linkMuniId ?? undefined,
    limit: 5000 
  }),
  staleTime: 30000,
});

const unlinkingDataQuery = useQuery({
  queryKey: ["unlinking-data"],
  queryFn: () => getUnlinkingData(),
  staleTime: 30000,
});


const unlinkDishesQ = useQuery({
  queryKey: ["unlink-dishes", unlinkDishSearch],
  queryFn: () => listDishes({ q: unlinkDishSearch }),
  keepPreviousData: true,
});

const unlinkRestsQ = useQuery({
  queryKey: ["unlink-rests", unlinkRestSearch],
  queryFn: () => listRestaurants({ q: unlinkRestSearch }),
  keepPreviousData: true,
});
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
  queryFn: async () => (featuredRestId ? await getRestaurantFeaturedDishes(featuredRestId) : []),
  staleTime: 60_000,
});

const isDishLinkedToRestaurant = (dishId: number, restaurantId: number) => {
  if (!allRestaurantDishLinks.data) return false;
  
  return allRestaurantDishLinks.data.some((link: any) => 
    link.dish_id === dishId && link.restaurant_id === restaurantId
  );
};
const getRestaurantsForDish = (dishId: number) => {
  if (!allRestaurantDishLinks.data) return [];
  
  const restaurants = allRestaurantDishLinks.data
    .filter((link: any) => link.dish_id === dishId)
    .map((link: any) => link.restaurant_id);
  
  return Array.from(new Set(restaurants)); // Remove duplicates
};

const getDishesForRestaurant = (restaurantId: number) => {
  if (!allRestaurantDishLinks.data) return [];
  
  const dishes = allRestaurantDishLinks.data
    .filter((link: any) => link.restaurant_id === restaurantId)
    .map((link: any) => link.dish_id);
  
  return Array.from(new Set(dishes)); // Remove duplicates
};
const bulkUnlinkMutation = useMutation({
  mutationFn: ({ dishIds, restaurantIds }: { dishIds: number[]; restaurantIds: number[] }) =>
    bulkUnlinkDishesFromRestaurants(dishIds, restaurantIds),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["all-restaurant-dish-links"] });
    qc.invalidateQueries({ queryKey: ["dishes:for-restaurant"] });
    qc.invalidateQueries({ queryKey: ["unlinking-data"] });
  },
});

const unlinkSingleMutation = useMutation({
  mutationFn: (vars: { dish_id: number; restaurant_id: number }) => unlinkDishRestaurant(vars),
  onSuccess: (_, vars) => {
    qc.invalidateQueries({ queryKey: ["dishes:for-restaurant", vars.restaurant_id] });
    qc.invalidateQueries({ queryKey: ["link-dishes"] });
    qc.invalidateQueries({ queryKey: ["link-rests"] });
    qc.invalidateQueries({ queryKey: ["restaurant-dish-links"] }); // Add this for the new endpoints
  },
});

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
    qc.invalidateQueries({ queryKey: ["all-restaurant-dish-links"] }); // Add this
  },
});

const unlinkMut_local = useMutation({
  mutationFn: (vars: { dish_id: number; restaurant_id: number }) => unlinkDishRestaurant(vars),
  onSuccess: (_, vars) => {
    qc.invalidateQueries({ queryKey: ["dishes:for-restaurant", vars.restaurant_id] });
    qc.invalidateQueries({ queryKey: ["link-dishes"] });
    qc.invalidateQueries({ queryKey: ["link-rests"] });
    qc.invalidateQueries({ queryKey: ["all-restaurant-dish-links"] }); // Add this
  },
});

  const patchDish = patchDishM_local;
  const patchRest = patchRestM_local;
  const linkMut = linkMut_local;
  const unlinkMut = unlinkMut_local;


const filteredLinkDishes = useMemo(() => {
  const allDishes = linkDishesQ.data ?? [];
  
  if (!selectedLinkRests.size) {
    return allDishes;
  }
  
  return allDishes.filter(dish => {
    // Show dish if it's NOT linked to ALL the selected restaurants
    return !Array.from(selectedLinkRests).every(restId => 
      isDishLinkedToRestaurant(dish.id, restId)
    );
  });
}, [linkDishesQ.data, selectedLinkRests, allRestaurantDishLinks.data]);

const filteredLinkRests = useMemo(() => {
  const allRests = linkRestsQ.data ?? [];
  
  if (!selectedLinkDishes.size) {
    return allRests;
  }
  
  return allRests.filter(rest => {
    // Show restaurant if it DOESN'T have ALL the selected dishes linked
    return !Array.from(selectedLinkDishes).every(dishId => 
      isDishLinkedToRestaurant(dishId, rest.id)
    );
  });
}, [linkRestsQ.data, selectedLinkDishes, allRestaurantDishLinks.data]);

// For Bulk Unlinking: When selecting dishes, only show restaurants that HAVE those dishes linked
const filteredUnlinkRests = useMemo(() => {
  const allRests = unlinkRestsQ.data ?? [];
  
  if (!selectedUnlinkDishes.size) {
    // Show restaurants that have ANY dishes linked
    return allRests.filter(rest => {
      const linkedDishes = getDishesForRestaurant(rest.id);
      return linkedDishes.length > 0;
    });
  }
  
  return allRests.filter(rest => {
    // Show restaurant if it HAS AT LEAST ONE of the selected dishes linked
    return Array.from(selectedUnlinkDishes).some(dishId => 
      isDishLinkedToRestaurant(dishId, rest.id)
    );
  });
}, [unlinkRestsQ.data, selectedUnlinkDishes, allRestaurantDishLinks.data]);

const filteredUnlinkDishes = useMemo(() => {
  const allDishes = unlinkDishesQ.data ?? [];
  
  if (!selectedUnlinkRests.size) {
    // Show dishes that are linked to ANY restaurant
    return allDishes.filter(dish => {
      const linkedRestaurants = getRestaurantsForDish(dish.id);
      return linkedRestaurants.length > 0;
    });
  }
  
  return allDishes.filter(dish => {
    // Show dish if it's linked to AT LEAST ONE selected restaurant
    return Array.from(selectedUnlinkRests).some(restId => 
      isDishLinkedToRestaurant(dish.id, restId)
    );
  });
}, [unlinkDishesQ.data, selectedUnlinkRests, allRestaurantDishLinks.data]);


// Add these functions
function toggleUnlinkDish(id: number) {
  setSelectedUnlinkDishes(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
}

function toggleUnlinkRest(id: number) {
  setSelectedUnlinkRests(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
}

async function handleUnlinkSingle(dishId: number, restaurantId: number) {
  const dish = (unlinkDishesQ.data ?? []).find(d => d.id === dishId);
  const restaurant = (unlinkRestsQ.data ?? []).find(r => r.id === restaurantId);
  
  if (!dish || !restaurant) return;
  
  // Validate that the link actually exists using our improved function
  if (!isDishLinkedToRestaurant(dishId, restaurantId)) {
    alert(`"${dish.name}" is not linked to "${restaurant.name}"`);
    return;
  }
  
  const ok = await confirmThen(`Unlink "${dish.name}" from "${restaurant.name}"?`);
  if (!ok) return;
  
  try {
    await unlinkMut.mutateAsync({ dish_id: dishId, restaurant_id: restaurantId });
    // Refresh the links cache after successful unlinking
    allLinksQuery.refetch();
  } catch (err: any) {
    console.error("Unlink failed", err);
    alert("Failed to unlink: " + (err?.message || "unknown"));
  }
}

async function handleBulkUnlink() {
  if (!selectedUnlinkDishes.size || !selectedUnlinkRests.size) {
    alert("Please select both dishes and restaurants to unlink.");
    return;
  }

  const dishIds = Array.from(selectedUnlinkDishes);
  const restaurantIds = Array.from(selectedUnlinkRests);

  // Validate that at least some links exist
  const existingLinks = [];
  for (const dishId of dishIds) {
    for (const restId of restaurantIds) {
      if (isDishLinkedToRestaurant(dishId, restId)) {
        existingLinks.push(`${dishId}-${restId}`);
      }
    }
  }

  if (existingLinks.length === 0) {
    alert("None of the selected dish-restaurant combinations are currently linked.");
    return;
  }

  const ok = await confirmThen(
    `Unlink ${dishIds.length} dishes from ${restaurantIds.length} restaurants? This will remove ${existingLinks.length} links.`
  );
  if (!ok) return;

  setBulkUnlinkLoading(true);
  try {
    const result = await bulkUnlinkMutation.mutateAsync({
      dishIds,
      restaurantIds
    });

    setSelectedUnlinkDishes(new Set());
    setSelectedUnlinkRests(new Set());
    
    alert(`Successfully unlinked ${result.removed || result.unlinkedCount} dish-restaurant combinations!`);
  } catch (err: any) {
    console.error("Bulk unlink failed", err);
    alert("Bulk unlink failed: " + (err?.message || "unknown"));
  } finally {
    setBulkUnlinkLoading(false);
  }
}

// Unlink a dish from all restaurants
async function handleUnlinkDishFromAll(dishId: number) {
  const dish = (unlinkDishesQ.data ?? []).find(d => d.id === dishId);
  if (!dish) return;

  const linkedCount = getRestaurantsForDish(dishId).length;
  if (linkedCount === 0) {
    alert(`"${dish.name}" is not linked to any restaurants.`);
    return;
  }

  const ok = await confirmThen(
    `Remove "${dish.name}" from all ${linkedCount} restaurants?`
  );
  if (!ok) return;

  try {
    await removeAllDishLinks(dishId);
    // Refresh data
    allRestaurantDishLinks.refetch();
    unlinkingDataQuery.refetch();
    alert(`Successfully removed "${dish.name}" from all restaurants.`);
  } catch (err: any) {
    console.error("Failed to unlink dish from all restaurants:", err);
    alert("Failed to unlink dish: " + (err?.message || "unknown"));
  }
}

// Unlink a restaurant from all dishes
async function handleUnlinkRestaurantFromAll(restaurantId: number) {
  const restaurant = (unlinkRestsQ.data ?? []).find(r => r.id === restaurantId);
  if (!restaurant) return;

  const linkedCount = getDishesForRestaurant(restaurantId).length;
  if (linkedCount === 0) {
    alert(`"${restaurant.name}" has no dishes linked.`);
    return;
  }

  const ok = await confirmThen(
    `Remove all ${linkedCount} dishes from "${restaurant.name}"?`
  );
  if (!ok) return;

  try {
    await removeAllRestaurantLinks(restaurantId);
    // Refresh data
    allRestaurantDishLinks.refetch();
    unlinkingDataQuery.refetch();
    alert(`Successfully removed all dishes from "${restaurant.name}".`);
  } catch (err: any) {
    console.error("Failed to unlink restaurant from all dishes:", err);
    alert("Failed to unlink restaurant: " + (err?.message || "unknown"));
  }
}

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

  // Validate no duplicate links
  const duplicateLinks = [];
  for (const dishId of selectedLinkDishes) {
    for (const restId of selectedLinkRests) {
      if (isDishLinkedToRestaurant(dishId, restId)) {
        const dish = (linkDishesQ.data ?? []).find(d => d.id === dishId);
        const rest = (linkRestsQ.data ?? []).find(r => r.id === restId);
        duplicateLinks.push(`${dish?.name} ↔ ${rest?.name}`);
      }
    }
  }

  if (duplicateLinks.length > 0) {
    alert(`Some links already exist:\n${duplicateLinks.join('\n')}\n\nThese will be skipped.`);
  }

  setBulkLoading(true);
  try {
    const linkPromises = [];
    let successCount = 0;
    
    for (const dishId of selectedLinkDishes) {
      for (const restId of selectedLinkRests) {
        // Skip if already linked
        if (!isDishLinkedToRestaurant(dishId, restId)) {
          linkPromises.push(
            linkMut.mutateAsync({ dish_id: dishId, restaurant_id: restId })
              .then(() => successCount++)
              .catch(err => {
                console.error(`Failed to link dish ${dishId} to restaurant ${restId}:`, err);
              })
          );
        }
      }
    }

    await Promise.all(linkPromises);
    setSelectedLinkDishes(new Set());
    setSelectedLinkRests(new Set());
    
    const totalAttempted = selectedLinkDishes.size * selectedLinkRests.size;
    const skipped = totalAttempted - successCount;
    
    alert(`Successfully linked ${successCount} dish-restaurant combinations!${skipped > 0 ? ` (${skipped} already linked)` : ''}`);
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

function RestaurantSpecificDishCard({ dish, restaurantId, onUpdate }: { 
  dish: any; 
  restaurantId: number; 
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  
  // The dish object now comes from getRestaurantFeaturedDishes which has different field names
  const [form, setForm] = useState({
    featured_rank: dish.featured_rank || 0,
    restaurant_specific_description: dish.restaurant_specific_description || '',
    restaurant_specific_price: dish.restaurant_specific_price || '',
    availability: dish.availability || 'regular',
    is_featured: dish.is_featured === 1 || dish.is_featured === true // Handle both number and boolean
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => 
      setRestaurantDishFeatured(restaurantId, dish.dish_id || dish.id, payload), // Use dish_id from the API
    onSuccess: () => {
      onUpdate();
      setEditing(false);
    },
    onError: (error: any) => {
      console.error('Error updating dish feature:', error);
      alert('Failed to update dish: ' + error.message);
    }
  });

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const handleFeatureToggle = (featured: boolean) => {
    const updatedForm = {
      ...form,
      is_featured: featured,
      featured_rank: featured ? (form.featured_rank || 1) : null
    };
    
    updateMutation.mutate(updatedForm);
  };

  // Use dish_name from the API response, fallback to name
  const dishName = dish.dish_name || dish.name;
  const dishCategory = dish.category;
  const municipalityName = (muniQ.data ?? []).find(m => m.id === dish.municipality_id)?.name;

  return (
    <div className="border rounded-lg p-3 hover:shadow-sm transition bg-white">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="font-semibold">{dishName}</div>
          <div className="text-xs text-neutral-500">
            {dishCategory} • {municipalityName}
          </div>
          {dish.original_description && (
            <div className="text-xs text-neutral-600 mt-1">{dish.original_description}</div>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button 
            size="sm" 
            variant={form.is_featured ? "primary" : "default"}
            onClick={() => handleFeatureToggle(!form.is_featured)}
            disabled={updateMutation.isLoading}
          >
            {form.is_featured ? 'Featured' : 'Feature'}
          </Button>
          <Button 
            size="sm" 
            variant="soft"
            onClick={() => setEditing(!editing)}
            disabled={updateMutation.isLoading}
          >
            {editing ? 'Cancel' : 'Edit'}
          </Button>
        </div>
      </div>
      
      {form.is_featured && (
        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
          {editing ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-neutral-700">Featured Rank</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={form.featured_rank || ''}
                    onChange={(e) => setForm(f => ({ ...f, featured_rank: e.target.value ? Number(e.target.value) : null }))}
                    className="text-sm"
                    placeholder="1-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-700">Price (₱)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.restaurant_specific_price}
                    onChange={(e) => setForm(f => ({ ...f, restaurant_specific_price: e.target.value }))}
                    className="text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-neutral-700">Availability</label>
                <select
                  className="w-full border rounded p-1 text-sm"
                  value={form.availability}
                  onChange={(e) => setForm(f => ({ ...f, availability: e.target.value }))}
                >
                  <option value="regular">Regular</option>
                  <option value="seasonal">Seasonal</option>
                  <option value="preorder">Pre-order</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs font-medium text-neutral-700">Restaurant Description</label>
                <textarea
                  className="w-full border rounded p-2 text-sm"
                  rows={2}
                  value={form.restaurant_specific_description}
                  onChange={(e) => setForm(f => ({ ...f, restaurant_specific_description: e.target.value }))}
                  placeholder="How this restaurant prepares/serves this dish..."
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={updateMutation.isLoading}
                >
                  {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button 
                  size="sm" 
                  variant="soft"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              {form.restaurant_specific_description ? (
                <p className="text-neutral-700">{form.restaurant_specific_description}</p>
              ) : (
                <p className="text-neutral-500 italic">No restaurant-specific description</p>
              )}
              
              <div className="flex flex-wrap gap-3 text-xs text-neutral-600">
                {form.featured_rank > 0 && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Rank: #{form.featured_rank}</span>
                )}
                {form.restaurant_specific_price && (
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Price: ₱{form.restaurant_specific_price}</span>
                )}
                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">Availability: {form.availability}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {updateMutation.isError && (
        <div className="mt-2 text-xs text-red-600">
          Error: {updateMutation.error.message}
        </div>
      )}
    </div>
  );
}


function AvailableDishesSection({ restaurantId, featuredDishes, onDishAdded }: {
  restaurantId: number;
  featuredDishes: any[];
  onDishAdded: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedDishes, setSelectedDishes] = useState<Set<number>>(new Set());
  
  const allDishesQ = useQuery({
    queryKey: ['all-dishes', search],
    queryFn: () => listDishes({ q: search }),
    keepPreviousData: true,
  });

  const addDishMutation = useMutation({
    mutationFn: (dishId: number) => 
      addDishToRestaurant(restaurantId, dishId, {
        is_featured: false,
        availability: 'regular'
      }),
    onSuccess: () => {
      onDishAdded();
      setSelectedDishes(new Set());
    },
    onError: (error: any) => {
      console.error('Error adding dish:', error);
      alert('Failed to add dish: ' + error.message);
    }
  });

  // Filter out dishes that are already linked to this restaurant
  // Use dish_id from featuredDishes for comparison
  const availableDishes = (allDishesQ.data || []).filter(dish => 
    !featuredDishes.some(fd => (fd.dish_id || fd.id) === dish.id)
  );

  const toggleDishSelection = (dishId: number) => {
    setSelectedDishes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dishId)) {
        newSet.delete(dishId);
      } else {
        newSet.add(dishId);
      }
      return newSet;
    });
  };

  const handleAddDishes = async () => {
    if (selectedDishes.size === 0) return;
    
    try {
      const promises = Array.from(selectedDishes).map(dishId => 
        addDishMutation.mutateAsync(dishId)
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Error adding dishes:', error);
    }
  };

  return (
    <div className="border-t pt-4">
      <div className="text-sm font-medium mb-2">Add More Dishes to This Restaurant:</div>
      
      <Input 
        placeholder="Search dishes to add..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3"
      />

      {availableDishes.length > 0 ? (
        <>
          <ScrollArea height={200}>
            <div className="space-y-2 pr-2">
              {availableDishes.map(dish => (
                <label key={dish.id} className="flex items-center gap-2 p-2 border rounded hover:bg-neutral-50 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedDishes.has(dish.id)} 
                    onChange={() => toggleDishSelection(dish.id)} 
                    disabled={addDishMutation.isLoading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{dish.name}</div>
                    <div className="text-xs text-neutral-500">
                      {dish.category} • {(muniQ.data ?? []).find(m => m.id === dish.municipality_id)?.name}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>
          
          <div className="flex items-center gap-3 mt-3 pt-3 border-t">
            <Button 
              size="sm"
              onClick={handleAddDishes}
              disabled={addDishMutation.isLoading || selectedDishes.size === 0}
            >
              {addDishMutation.isLoading ? 'Adding...' : `Add ${selectedDishes.size} Dishes`}
            </Button>
            <div className="text-xs text-neutral-500">
              Selected {selectedDishes.size} dishes to add to restaurant
            </div>
          </div>

          {addDishMutation.isError && (
            <div className="text-xs text-red-600 mt-2">
              Error adding dishes: {addDishMutation.error.message}
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-neutral-500 text-center py-4">
          No more dishes available to add. All dishes are already linked to this restaurant.
        </div>
      )}
    </div>
  );
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
    {/* Dishes Column - For Linking */}
    <div>
      <div className="text-sm font-medium mb-2">Select Dishes to Link</div>
      <div className="text-xs text-neutral-500 mb-2">
  {selectedLinkRests.size > 0 
    ? `Only showing dishes NOT linked to the ${selectedLinkRests.size} selected restaurant(s)`
    : "Select restaurants to see which dishes can be linked"
  }
 </div>
      <Input 
        placeholder="Search dishes…" 
        value={linkDishSearch} 
        onChange={(e) => setLinkDishSearch(e.target.value)} 
        className="mb-2"
      />
      <ScrollArea height={200}>
        <div className="space-y-2 pr-2">
          {filteredLinkDishes.map(d => (
            <label key={d.id} className="flex items-center gap-2 p-2 border rounded hover:bg-neutral-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={selectedLinkDishes.has(d.id)} 
                onChange={() => toggleLinkDish(d.id)} 
              />
              <div>
                <div className="font-medium text-sm">{d.name}</div>
                <div className="text-xs text-neutral-500">{d.category}</div>
                {selectedLinkRests.size > 0 && (
                  <div className="text-xs text-green-600">
                    Can be linked to {selectedLinkRests.size} restaurant(s)
                  </div>
                )}
              </div>
            </label>
          ))}
          {filteredLinkDishes.length === 0 && (
            <div className="text-sm text-neutral-500 text-center py-4">
              {selectedLinkRests.size > 0 
                ? "All dishes are already linked to the selected restaurants"
                : "No dishes found"
              }
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="text-xs text-neutral-500 mt-1">
        Selected: {selectedLinkDishes.size} dishes • Showing: {filteredLinkDishes.length} available
      </div>
    </div>

    {/* Restaurants Column - For Linking */}
    <div>
      <div className="text-sm font-medium mb-2">Select Restaurants to Link To</div>
 <div className="text-xs text-neutral-500 mb-2">
  {selectedLinkDishes.size > 0 
    ? `Only showing restaurants that DON'T have the ${selectedLinkDishes.size} selected dish(es)`
    : "Select dishes to see which restaurants can link them"
  }
 </div>
      <Input 
        placeholder="Search restaurants…" 
        value={linkRestSearch} 
        onChange={(e) => setLinkRestSearch(e.target.value)} 
        className="mb-2"
      />
      <ScrollArea height={200}>
        <div className="space-y-2 pr-2">
          {filteredLinkRests.map(r => (
            <label key={r.id} className="flex items-center gap-2 p-2 border rounded hover:bg-neutral-50 cursor-pointer">
              <input 
                type="checkbox" 
                checked={selectedLinkRests.has(r.id)} 
                onChange={() => toggleLinkRest(r.id)} 
              />
              <div>
                <div className="font-medium text-sm">{r.name}</div>
                <div className="text-xs text-neutral-500">{r.address}</div>
                {selectedLinkDishes.size > 0 && (
                  <div className="text-xs text-green-600">
                    Can link {selectedLinkDishes.size} dish(es)
                  </div>
                )}
              </div>
            </label>
          ))}
          {filteredLinkRests.length === 0 && (
            <div className="text-sm text-neutral-500 text-center py-4">
              {selectedLinkDishes.size > 0
                ? "All restaurants already have the selected dishes linked"
                : "No restaurants found"
              }
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="text-xs text-neutral-500 mt-1">
        Selected: {selectedLinkRests.size} restaurants • Showing: {filteredLinkRests.length} available
      </div>
    </div>
  </div>

  <div className="flex items-center gap-3 border-t pt-4">
    <Button 
      variant="primary" 
      onClick={handleBulkLink} 
      disabled={bulkLoading || !selectedLinkDishes.size || !selectedLinkRests.size}
    >
      {bulkLoading ? 'Linking...' : `Link Selected (${selectedLinkDishes.size} × ${selectedLinkRests.size})`}
    </Button>
    <div className="text-sm text-neutral-600">
      Links every selected dish to every selected restaurant (skips existing links)
    </div>
  </div>
 </Card>
 <Card title="Bulk Unlink">
     {/* Bulk Unlinking */}
     <div className="grid md:grid-cols-2 gap-4 mb-4">
      <div>
        <div className="text-sm font-medium mb-2">Select Dishes to Unlink</div>
     <div className="text-xs text-neutral-500 mb-2">
      {selectedUnlinkRests.size > 0 
         ? `Only showing dishes linked to the ${selectedUnlinkRests.size} selected restaurant(s)`
         : "Select restaurants to see linked dishes"
      }
         </div>
        <Input 
          placeholder="Search dishes to unlink…" 
          value={unlinkDishSearch} 
          onChange={(e) => setUnlinkDishSearch(e.target.value)} 
          className="mb-2"
        />
        <ScrollArea height={150}>
          <div className="space-y-2 pr-2">
            {filteredUnlinkDishes.map(d => (
              <label key={d.id} className="flex items-center gap-2 p-2 border rounded hover:bg-neutral-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selectedUnlinkDishes.has(d.id)} 
                  onChange={() => toggleUnlinkDish(d.id)} 
                />
                <div>
                  <div className="font-medium text-sm">{d.name}</div>
                  <div className="text-xs text-neutral-500">{d.category}</div>
                  {selectedUnlinkRests.size > 0 && (
                    <div className="text-xs text-red-600">
                      Linked to {selectedUnlinkRests.size} restaurant(s)
                    </div>
                  )}
                </div>
              </label>
            ))}
            {filteredUnlinkDishes.length === 0 && (
              <div className="text-sm text-neutral-500 text-center py-4">
                {selectedUnlinkRests.size > 0
                  ? "No dishes linked to the selected restaurants"
                  : "No dishes found"
                }
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="text-xs text-neutral-500 mt-1">
          Selected: {selectedUnlinkDishes.size} dishes • Showing: {filteredUnlinkDishes.length} linked
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Select Restaurants to Unlink From</div>
             <div className="text-xs text-neutral-500 mb-2">
        {selectedUnlinkDishes.size > 0 
       ? `Only showing restaurants that HAVE the ${selectedUnlinkDishes.size} selected dish(es)`
        : "Select dishes to see which restaurants have them"
           }
              </div>
        <Input 
          placeholder="Search restaurants…" 
          value={unlinkRestSearch} 
          onChange={(e) => setUnlinkRestSearch(e.target.value)} 
          className="mb-2"
        />
        <ScrollArea height={150}>
          <div className="space-y-2 pr-2">
            {filteredUnlinkRests.map(r => (
              <label key={r.id} className="flex items-center gap-2 p-2 border rounded hover:bg-neutral-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selectedUnlinkRests.has(r.id)} 
                  onChange={() => toggleUnlinkRest(r.id)} 
                />
                <div>
                  <div className="font-medium text-sm">{r.name}</div>
                  <div className="text-xs text-neutral-500">{r.address}</div>
                  {selectedUnlinkDishes.size > 0 && (
                    <div className="text-xs text-red-600">
                      Has {selectedUnlinkDishes.size} selected dish(es)
                    </div>
                  )}
                </div>
              </label>
            ))}
            {filteredUnlinkRests.length === 0 && (
              <div className="text-sm text-neutral-500 text-center py-4">
                {selectedUnlinkDishes.size > 0
                  ? "No restaurants have the selected dishes linked"
                  : "No restaurants found"
                }
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="text-xs text-neutral-500 mt-1">
          Selected: {selectedUnlinkRests.size} restaurants • Showing: {filteredUnlinkRests.length} with links
        </div>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <Button 
        variant="danger" 
        onClick={handleBulkUnlink} 
        disabled={bulkUnlinkLoading || !selectedUnlinkDishes.size || !selectedUnlinkRests.size}
      >
        {bulkUnlinkLoading ? 'Unlinking...' : `Unlink Selected (${selectedUnlinkDishes.size} × ${selectedUnlinkRests.size})`}
      </Button>
      <div className="text-sm text-neutral-600">
        Unlinks every selected dish from every selected restaurant
      </div>
    </div>
</Card>

<Card title="Quick Actions">







                  <div className="my-7 border-green-500">
          {/* Add this section after your bulk unlinking section */}
                  <div className="grid md:grid-cols-2 gap-4">
                   {/* Quick Dish Unlinking */}
                  <div>
            <div className="text-xl font-medium mb-1">Unlink Dish from All Restaurants</div>
              <select 
        className="w-full border rounded px-3 py-2 text-sm mb-2"
        onChange={async (e) => {
          const dishId = Number(e.target.value);
          if (dishId) {
            await handleUnlinkDishFromAll(dishId);
            e.target.value = ''; // Reset selection
          }
        }}
      >
        <option value="">Select a dish to unlink from all restaurants...</option>
        {unlinkDishesQ.data?.filter(dish => getRestaurantsForDish(dish.id).length > 0)
          .map(dish => (
            <option key={dish.id} value={dish.id}>
              {dish.name} ({getRestaurantsForDish(dish.id).length} restaurants)
            </option>
          ))
        }
      </select>
    </div>
    <div>
      <div className="text-xl font-medium mb-1">Unlink Restaurant from All Dishes</div>
      <select 
        className="w-full border rounded px-3 py-2 text-sm mb-2"
        onChange={async (e) => {
          const restaurantId = Number(e.target.value);
          if (restaurantId) {
            await handleUnlinkRestaurantFromAll(restaurantId);
            e.target.value = ''; // Reset selection
          }
        }}
      >
        <option value="">Select a restaurant to unlink all dishes...</option>
        {unlinkRestsQ.data?.filter(rest => getDishesForRestaurant(rest.id).length > 0)
          .map(rest => (
            <option key={rest.id} value={rest.id}>
              {rest.name} ({getDishesForRestaurant(rest.id).length} dishes)
            </option>
          ))
        }
      </select>
    </div>
  </div>
{/* Add statistics section */}
<div className="border-t pt-4 mt-4">
  <h4 className="text-xl font-medium mb-3">Link Statistics</h4>
  {allRestaurantDishLinks.data && (
    <div className="grid grid-cols-3 gap-4 text-sm">
      <div className="text-center p-3 bg-blue-50 rounded border">
        <div className="font-semibold text-blue-800">
          {new Set(allRestaurantDishLinks.data.map((l: any) => l.dish_id)).size}
        </div>
        <div className="text-xs text-blue-600">Dishes with Links</div>
      </div>
      <div className="text-center p-3 bg-green-50 rounded border">
        <div className="font-semibold text-green-800">
          {new Set(allRestaurantDishLinks.data.map((l: any) => l.restaurant_id)).size}
        </div>
        <div className="text-xs text-green-600">Restaurants with Links</div>
      </div>
      <div className="text-center p-3 bg-purple-50 rounded border">
        <div className="font-semibold text-purple-800">
          {allRestaurantDishLinks.data.length}
        </div>
        <div className="text-xs text-purple-600">Total Links</div>
      </div>
    </div>
    )}
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
                                  {/* Panel 4: Restaurant Dish Featured Curation - RESTAURANT-SPECIFIC */}
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

      {/* Add the new API functions to your state and mutations */}
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
              <RestaurantSpecificDishCard 
                key={d.id}
                dish={d}
                restaurantId={featuredRestId}
                onUpdate={() => {
                  qc.invalidateQueries({ queryKey: ["dishes:for-restaurant", featuredRestId] });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Available Dishes Section */}
      <AvailableDishesSection 
        restaurantId={featuredRestId}
        featuredDishes={linkedDishesQ.data || []}
        onDishAdded={() => {
          qc.invalidateQueries({ queryKey: ["dishes:for-restaurant", featuredRestId] });
        }}
      />
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