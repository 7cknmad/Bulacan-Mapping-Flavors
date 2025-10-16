// src/pages/admin/AdminDashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  listMunicipalities, listDishes, listRestaurants,
  createDish, updateDish, deleteDish,
  createRestaurant, updateRestaurant, deleteRestaurant,
  listRestaurantsForDish, linkDishRestaurant, unlinkDishRestaurant,
  setDishCuration, setRestaurantCuration,
  getAnalyticsSummary, getPerMunicipalityCounts,
  type Municipality, type Dish, type Restaurant,
  coerceStringArray, slugify} from "../../utils/adminApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from "recharts";
/* -------------------- toasts + confirm (no extra deps) -------------------- */
const ToastCtx = React.createContext<(msg: string) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);
const ConfirmCtx = React.createContext<(msg: string) => Promise<boolean>>(() => Promise.resolve(false));
export const useConfirm = () => React.useContext(ConfirmCtx);

function Toaster({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<{ id: number, msg: string }[]>([]);
  const push = (msg: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg }]);
    setTimeout(() => setList((l) => l.filter(t => t.id !== id)), 2400);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-[70]">
        {list.map(t => (
          <div key={t.id} className="px-3 py-2 rounded-md bg-neutral-900 text-white shadow">
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ msg: string, res?: (v:boolean)=>void } | null>(null);
  const confirm = (msg: string) => new Promise<boolean>(r => setState({ msg, res: r }));
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm">
            <div className="mb-4 text-sm">{state.msg}</div>
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-1.5 rounded border" onClick={()=>{ state.res?.(false); setState(null); }}>Cancel</button>
              <button className="px-3 py-1.5 rounded bg-neutral-900 text-white" onClick={()=>{ state.res?.(true); setState(null); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

/* -------------------- tiny helpers -------------------- */
const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Prevent scroll containers killing ResponsiveContainer */
function ChartShell({ children, height = 420 }: { children: React.ReactNode; height?: number }) {
  const [k, setK] = useState(0);
  useEffect(() => { const id = setTimeout(() => setK(1), 60); return () => clearTimeout(id); }, []);
  return (
    <div className="bg-white rounded-xl border p-3">
      <div style={{ height }}>
        <ResponsiveContainer key={k} width="100%" height="100%" debounce={150}>
          {children as any}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button className="text-sm text-neutral-500 hover:text-neutral-800" onClick={onClose}>Close</button>
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
   Analytics
   ====================================================== */
function AnalyticsTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [stacked, setStacked] = useState(false);

  const countsQ = useQuery({ queryKey: ["admin:analytics:per-muni"], queryFn: getPerMunicipalityCounts, staleTime: 60_000 });
  const summaryQ = useQuery({ queryKey: ["admin:analytics:summary"], queryFn: getAnalyticsSummary, staleTime: 60_000 });
  const counts = countsQ.data ?? [];
  const summary = summaryQ.data ?? { dishes: 0, restaurants: 0, municipalities: 0 };

  const palette = ["#0f172a", "#475569", "#a3a3a3", "#64748b", "#1e293b", "#737373", "#525252"];

  const ChartEl = useMemo(() => {
    const chartData = counts.map((r: any) => ({ municipality_name: r.municipality_name, dishes: r.dish_count, restaurants: r.restaurant_count }));
    if (chartType === "bar") {
      return (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="municipality_name" hide />
          <YAxis />
          <Tooltip />
          <Legend />
          {stacked ? (
            <>
              <Bar dataKey="dishes" stackId="a" fill={palette[0]} name="Dishes" />
              <Bar dataKey="restaurants" stackId="a" fill={palette[1]} name="Restaurants" />
            </>
          ) : (
            <>
              <Bar dataKey="dishes" fill={palette[0]} name="Dishes" />
              <Bar dataKey="restaurants" fill={palette[1]} name="Restaurants" />
            </>
          )}
        </BarChart>
      );
    }
    if (chartType === "line") {
      return (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="municipality_name" hide />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="dishes" stroke={palette[0]} name="Dishes" dot={false} />
          <Line type="monotone" dataKey="restaurants" stroke={palette[1]} name="Restaurants" dot={false} />
        </LineChart>
      );
    }
    if (chartType === "pie") {
      return (
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie data={chartData} dataKey="dishes" nameKey="municipality_name" outerRadius={90} label>
            {chartData.map((_: any, i: number) => <Cell key={i} fill={palette[i % palette.length]} />)}
          </Pie>
          <Pie data={chartData} dataKey="restaurants" nameKey="municipality_name" innerRadius={105} outerRadius={140}>
            {chartData.map((_: any, i: number) => <Cell key={i} fill={palette[(i + 2) % palette.length]} />)}
          </Pie>
        </PieChart>
      );
    }
    return null;
  }, [counts, chartType, stacked]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-neutral-500">Dishes</div>
          <div className="text-2xl font-semibold">{summary.dishes}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-neutral-500">Municipalities</div>
          <div className="text-2xl font-semibold">{summary.municipalities}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-neutral-500">Restaurants</div>
          <div className="text-2xl font-semibold">{summary.restaurants}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Per-municipality totals</h4>
        <div className="flex gap-1">
          {["bar","line","pie"].map((t) => (
            <button key={t} onClick={() => setChartType(t as any)} className={cx("px-3 py-1 rounded border text-sm", chartType===t?"bg-neutral-900 text-white":"bg-white")}>{t}</button>
          ))}
          {chartType === "bar" && (
            <button className={cx("px-3 py-1 rounded border text-sm", stacked && "bg-neutral-900 text-white")} onClick={() => setStacked(s => !s)} title="Toggle stacked bars">
              {stacked ? "Unstack" : "Stack"}
            </button>
          )}
        </div>
      </div>

      {(countsQ.isLoading || summaryQ.isLoading) ? (
        <div className="h-[440px] rounded-xl bg-neutral-100 animate-pulse" />
      ) : (
        <ChartShell height={440}>{ChartEl}</ChartShell>
      )}
    </div>
  );
}

/* ======================================================
   Dishes CRUD + validation
   ====================================================== */
type DishFormState = Partial<Dish> & { autoSlug?: boolean };
const emptyDish: DishFormState = { name: "", slug: "", category: "food", municipality_id: 0, autoSlug: true, rating: null, popularity: null };

function useDishValidation(form: DishFormState, all: Dish[]) {
  const errors: Record<string, string | undefined> = {};
  if (!form.name) errors.name = "Name is required.";
  if (!form.slug) errors.slug = "Slug is required.";
  if (!form.municipality_id) errors.municipality_id = "Select a municipality.";
  if (form.rating != null) {
    const r = Number(form.rating);
    if (Number.isNaN(r)) errors.rating = "Rating must be a number.";
    else if (r < 1 || r > 5) errors.rating = "Rating must be between 1 and 5.";
  }
  if (form.popularity != null) {
    const p = Number(form.popularity);
    if (Number.isNaN(p)) errors.popularity = "Popularity must be a number.";
    else if (p < 0 || p > 100) errors.popularity = "Popularity must be 0–100.";
  }
  const duplicate = all.find(d => d.slug === form.slug && d.id !== form.id);
  if (duplicate) errors.slug = "Slug already exists.";
  const valid = Object.values(errors).every(v => !v);
  return { errors, valid };
}

function DishesTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<DishFormState>(emptyDish);
  const [serverError, setServerError] = useState<string | null>(null);

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const dishesQ = useQuery({ queryKey: ["dishes", q], queryFn: () => listDishes({ q }), keepPreviousData: true });
  const allDishes = dishesQ.data ?? [];
  const { errors, valid } = useDishValidation(form, allDishes);

  const createM = useMutation({
    mutationFn: (payload: Partial<Dish>) => createDish(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setForm(emptyDish); setServerError(null); toast("Dish created."); },
    onError: (e: any) => setServerError(e?.message || "Create failed."),
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: Partial<Dish> }) => updateDish(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setEditOpen(false); setServerError(null); toast("Dish saved."); },
    onError: (e: any) => setServerError(e?.message || "Update failed."),
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteDish(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); toast("Dish deleted."); },
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
    if (!valid) return;
    createM.mutate({
      name: String(form.name),
      slug: String(form.slug),
      municipality_id: Number(form.municipality_id),
      category: (form.category as any) ?? "food",
      description: form.description ?? null,
      image_url: form.image_url ?? null,
      flavor_profile: Array.isArray(form.flavor_profile) ? form.flavor_profile : coerceStringArray(form.flavor_profile) ?? [],
      ingredients: Array.isArray(form.ingredients) ? form.ingredients : coerceStringArray(form.ingredients) ?? [],
      rating: form.rating == null ? null : clamp(Number(form.rating), 1, 5),
      popularity: form.popularity == null ? null : clamp(Number(form.popularity), 0, 100),
    });
  }

  function openEdit(d: Dish) {
    setForm({
      id: d.id,
      name: d.name,
      slug: d.slug,
      municipality_id: d.municipality_id ?? 0,
      category: (d.category as any) ?? "food",
      description: d.description ?? "",
      image_url: d.image_url ?? "",
      flavor_profile: coerceStringArray(d.flavor_profile) ?? [],
      ingredients: coerceStringArray(d.ingredients) ?? [],
      rating: d.rating ?? null,
      popularity: d.popularity ?? null,
      autoSlug: false,
    });
    setEditOpen(true);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Quick create panel */}
      <form onSubmit={onQuickCreate} className="bg-white border rounded-2xl p-4 lg:col-span-1">
        <h3 className="font-semibold mb-3">Create Dish/Delicacy</h3>
        <Field label="Name" error={errors.name}><input className="w-full border rounded px-3 py-2" value={form.name ?? ""} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="flex items-center gap-2 mb-2">
          <input id="autoslug" type="checkbox" className="rounded" checked={!!form.autoSlug} onChange={(e) => setForm(f => ({ ...f, autoSlug: e.target.checked }))} />
          <label htmlFor="autoslug" className="text-xs text-neutral-600">Auto-slug from name</label>
        </div>
        <Field label="Slug" error={errors.slug}><input className="w-full border rounded px-3 py-2" value={form.slug ?? ""} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} /></Field>
        <Field label="Municipality" error={errors.municipality_id}>
          <select className="w-full border rounded px-3 py-2" value={form.municipality_id ?? 0} onChange={(e) => setForm(f => ({ ...f, municipality_id: Number(e.target.value) }))}>
            <option value={0} disabled>Choose…</option>
            {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Category"><select className="w-full border rounded px-3 py-2" value={form.category as any} onChange={(e) => setForm(f => ({ ...f, category: e.target.value as any }))}>
          <option value="food">Food</option>
          <option value="delicacy">Delicacy</option>
          <option value="drink">Drink</option>
        </select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rating (1–5)"><input type="number" min={1} max={5} step="1" className="w-full border rounded px-3 py-2" value={form.rating ?? ""} onChange={(e) => setForm(f => ({ ...f, rating: e.target.value === "" ? null : clamp(Number(e.target.value), 1, 5) }))} /></Field>
          <Field label="Popularity (0–100)"><input type="number" min={0} max={100} className="w-full border rounded px-3 py-2" value={form.popularity ?? ""} onChange={(e) => setForm(f => ({ ...f, popularity: e.target.value === "" ? null : clamp(Number(e.target.value), 0, 100) }))} /></Field>
        </div>
        <div className="flex justify-end mt-3"><button className="px-3 py-2 rounded bg-neutral-900 text-white">Create</button></div>
      </form>

      {/* List */}
      <div className="lg:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <input className="border rounded px-3 py-2 w-full md:w-72" placeholder="Search dishes…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="ml-auto px-3 py-2 rounded border" onClick={() => { setForm(emptyDish); setEditOpen(true); }}>+ New (modal)</button>
        </div>
        {!dishesQ.data && dishesQ.isLoading && (
          <div className="grid md:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse" />)}
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          {(dishesQ.data ?? []).map(d => (
            <div key={d.id} className="border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="font-semibold">{d.name}</div>
                {d.is_signature ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white">Signature</span> : null}
                {d.panel_rank ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-900 text-white">Top {d.panel_rank}</span> : null}
              </div>
              <div className="text-xs text-neutral-500">{d.slug}</div>
              <div className="mt-2 flex gap-2">
                <button className="text-xs px-2 py-1 rounded border" onClick={() => openEdit(d)}>Edit</button>
                <button className="text-xs px-2 py-1 rounded border text-red-600" onClick={async () => { if (await confirm(`Delete ${d.name}?`)) deleteM.mutate(d.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit/New modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={form.id ? "Edit Dish" : "New Dish"}>
        <DishEdit form={form} setForm={setForm} onSave={(payload) => {
          if (form.id) updateM.mutate({ id: form.id, payload }); else createM.mutate(payload);
        }} />
        {serverError && <p className="text-sm text-red-600 mt-2">{serverError}</p>}
      </Modal>
    </div>
  );
}

function DishEdit({
  form, setForm, onSave
}: {
  form: DishFormState;
  setForm: React.Dispatch<React.SetStateAction<DishFormState>>;
  onSave: (payload: Partial<Dish>) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Name">
          <input className="w-full border rounded px-3 py-2" value={form.name ?? ""} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Slug">
          <input className="w-full border rounded px-3 py-2" value={form.slug ?? ""} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} />
        </Field>
        <Field label="Municipality">
          <select className="w-full border rounded px-3 py-2" value={form.municipality_id ?? 0} onChange={(e) => setForm(f => ({ ...f, municipality_id: Number(e.target.value) }))}>
            <option value={0} disabled>Choose…</option>
            {/* muni options injected in parent modal state */}
          </select>
        </Field>
        <Field label="Category">
          <select className="w-full border rounded px-3 py-2" value={form.category as any} onChange={(e) => setForm(f => ({ ...f, category: e.target.value as any }))}>
            <option value="food">Food</option>
            <option value="delicacy">Delicacy</option>
            <option value="drink">Drink</option>
          </select>
        </Field>
        <Field label="Image URL">
          <input className="w-full border rounded px-3 py-2" value={form.image_url ?? ""} onChange={(e) => setForm(f => ({ ...f, image_url: e.target.value }))} />
        </Field>
        <Field label="Rating (1–5)">
          <input type="number" min={1} max={5} step="1" className="w-full border rounded px-3 py-2"
                 value={form.rating ?? ""} onChange={(e) => setForm(f => ({ ...f, rating: e.target.value === "" ? null : clamp(Number(e.target.value), 1, 5) }))} />
        </Field>
        <Field label="Popularity (0–100)">
          <input type="number" min={0} max={100} className="w-full border rounded px-3 py-2"
                 value={form.popularity ?? ""} onChange={(e) => setForm(f => ({ ...f, popularity: e.target.value === "" ? null : clamp(Number(e.target.value), 0, 100) }))} />
        </Field>
        <Field label="Flavor profile (comma separated)">
          <input className="w-full border rounded px-3 py-2" value={(form.flavor_profile as any)?.join?.(", ") ?? String(form.flavor_profile ?? "")} onChange={(e) => setForm(f => ({ ...f, flavor_profile: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))} />
        </Field>
        <Field label="Ingredients (comma separated)">
          <input className="w-full border rounded px-3 py-2" value={(form.ingredients as any)?.join?.(", ") ?? String(form.ingredients ?? "")} onChange={(e) => setForm(f => ({ ...f, ingredients: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="px-3 py-2 rounded border" onClick={() => onSave({
          name: String(form.name),
          slug: String(form.slug),
          municipality_id: Number(form.municipality_id),
          category: (form.category as any) ?? "food",
          image_url: form.image_url ?? null,
          flavor_profile: Array.isArray(form.flavor_profile) ? form.flavor_profile : coerceStringArray(form.flavor_profile) ?? [],
          ingredients: Array.isArray(form.ingredients) ? form.ingredients : coerceStringArray(form.ingredients) ?? [],
          rating: form.rating == null ? null : clamp(Number(form.rating), 1, 5),
          popularity: form.popularity == null ? null : clamp(Number(form.popularity), 0, 100),
        })}>Save</button>
      </div>
    </>
  );
}

/* ======================================================
   Restaurants CRUD + validation
   ====================================================== */
type RestaurantFormState = Partial<Restaurant> & { autoSlug?: boolean };
const emptyRest: RestaurantFormState = { name: "", slug: "", municipality_id: 0, address: "", lat: 0, lng: 0, autoSlug: true, rating: null };

function useRestValidation(form: RestaurantFormState, all: Restaurant[]) {
  const errors: Record<string, string | undefined> = {};
  if (!form.name) errors.name = "Name is required.";
  if (!form.slug) errors.slug = "Slug is required.";
  if (!form.municipality_id) errors.municipality_id = "Select a municipality.";
  if (!form.address) errors.address = "Address is required.";
  if (form.rating != null) {
    const r = Number(form.rating);
    if (Number.isNaN(r)) errors.rating = "Rating must be a number.";
    else if (r < 1 || r > 5) errors.rating = "Rating must be between 1 and 5.";
  }
  if (form.lat == null || Number.isNaN(Number(form.lat))) errors.lat = "Latitude is required.";
  if (form.lng == null || Number.isNaN(Number(form.lng))) errors.lng = "Longitude is required.";
  const duplicate = all.find(r => r.slug === form.slug && r.id !== form.id);
  if (duplicate) errors.slug = "Slug already exists.";
  const valid = Object.values(errors).every(v => !v);
  return { errors, valid };
}

function RestaurantsTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<RestaurantFormState>(emptyRest);
  const [serverError, setServerError] = useState<string | null>(null);

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const restQ = useQuery({ queryKey: ["rests", q], queryFn: () => listRestaurants({ q }), keepPreviousData: true });
  const allRests = restQ.data ?? [];
  const { errors, valid } = useRestValidation(form, allRests);

  const createM = useMutation({
    mutationFn: (payload: Partial<Restaurant>) => createRestaurant(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rests"] }); setForm(emptyRest); setServerError(null); toast("Restaurant created."); },
    onError: (e: any) => setServerError(e?.message || "Create failed."),
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: Partial<Restaurant> }) => updateRestaurant(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rests"] }); setEditOpen(false); setServerError(null); toast("Restaurant saved."); },
    onError: (e: any) => setServerError(e?.message || "Update failed."),
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteRestaurant(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rests"] }); toast("Restaurant deleted."); },
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
    if (!valid) return;
    createM.mutate({
      name: String(form.name),
      slug: String(form.slug),
      municipality_id: Number(form.municipality_id),
      address: String(form.address),
      lat: Number(form.lat) || 0,
      lng: Number(form.lng) || 0,
      rating: form.rating == null ? null : clamp(Number(form.rating), 1, 5),
    });
  }

  function openEdit(r: Restaurant) {
    setForm({
      id: r.id,
      name: r.name,
      slug: r.slug,
      municipality_id: r.municipality_id,
      address: r.address ?? "",
      lat: r.lat ?? 0,
      lng: r.lng ?? 0,
      rating: r.rating ?? null,
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
        <Field label="Name" error={errors.name}><input className="w-full border rounded px-3 py-2" value={form.name ?? ""} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="flex items-center gap-2 mb-2">
          <input id="autoslug2" type="checkbox" className="rounded" checked={!!form.autoSlug} onChange={(e) => setForm(f => ({ ...f, autoSlug: e.target.checked }))} />
          <label htmlFor="autoslug2" className="text-xs text-neutral-600">Auto-slug from name</label>
        </div>
        <Field label="Slug" error={errors.slug}><input className="w-full border rounded px-3 py-2" value={form.slug ?? ""} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} /></Field>
        <Field label="Municipality" error={errors.municipality_id}>
          <select className="w-full border rounded px-3 py-2" value={form.municipality_id ?? 0} onChange={(e) => setForm(f => ({ ...f, municipality_id: Number(e.target.value) }))}>
            <option value={0} disabled>Choose…</option>
            {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Address" error={errors.address}><input className="w-full border rounded px-3 py-2" value={form.address ?? ""} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" error={errors.lat}><input className="w-full border rounded px-3 py-2" value={form.lat ?? ""} onChange={(e) => setForm(f => ({ ...f, lat: e.target.value }))} /></Field>
          <Field label="Longitude" error={errors.lng}><input className="w-full border rounded px-3 py-2" value={form.lng ?? ""} onChange={(e) => setForm(f => ({ ...f, lng: e.target.value }))} /></Field>
        </div>
        <Field label="Rating (1–5)"><input type="number" min={1} max={5} step="1" className="w-full border rounded px-3 py-2" value={form.rating ?? ""} onChange={(e) => setForm(f => ({ ...f, rating: e.target.value === "" ? null : clamp(Number(e.target.value), 1, 5) }))} /></Field>
        <div className="flex justify-end mt-3"><button className="px-3 py-2 rounded bg-neutral-900 text-white">Create</button></div>
      </form>

      {/* List */}
      <div className="lg:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <input className="border rounded px-3 py-2 w-full md:w-72" placeholder="Search restaurants…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="ml-auto px-3 py-2 rounded border" onClick={() => { setForm(emptyRest); setEditOpen(true); }}>+ New (modal)</button>
        </div>
        {!restQ.data && restQ.isLoading && (
          <div className="grid md:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse" />)}
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          {(restQ.data ?? []).map(r => (
            <div key={r.id} className="border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="font-semibold">{r.name}</div>
                {r.featured ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">Featured</span> : null}
                {r.featured_rank ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-900 text-white">Top {r.featured_rank}</span> : null}
              </div>
              <div className="text-xs text-neutral-500">{r.slug}</div>
              <div className="mt-2 flex gap-2">
                <button className="text-xs px-2 py-1 rounded border" onClick={() => openEdit(r)}>Edit</button>
                <button className="text-xs px-2 py-1 rounded border text-red-600" onClick={async () => { if (await confirm(`Delete ${r.name}?`)) deleteM.mutate(r.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit/New modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={form.id ? "Edit Restaurant" : "New Restaurant"}>
        <div className="space-y-3">
          <Field label="Name" error={errors.name}><input className="w-full border rounded px-3 py-2" value={form.name ?? ""} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="flex items-center gap-2 mb-2">
            <input id="autoslug3" type="checkbox" className="rounded" checked={!!form.autoSlug} onChange={(e) => setForm(f => ({ ...f, autoSlug: e.target.checked }))} />
            <label htmlFor="autoslug3" className="text-xs text-neutral-600">Auto-slug from name</label>
          </div>
          <Field label="Slug" error={errors.slug}><input className="w-full border rounded px-3 py-2" value={form.slug ?? ""} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} /></Field>
          <Field label="Municipality" error={errors.municipality_id}>
            <select className="w-full border rounded px-3 py-2" value={form.municipality_id ?? 0} onChange={(e) => setForm(f => ({ ...f, municipality_id: Number(e.target.value) }))}>
              <option value={0} disabled>Choose…</option>
              {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Address" error={errors.address}><input className="w-full border rounded px-3 py-2" value={form.address ?? ""} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" error={errors.lat}><input className="w-full border rounded px-3 py-2" value={form.lat ?? ""} onChange={(e) => setForm(f => ({ ...f, lat: e.target.value }))} /></Field>
            <Field label="Longitude" error={errors.lng}><input className="w-full border rounded px-3 py-2" value={form.lng ?? ""} onChange={(e) => setForm(f => ({ ...f, lng: e.target.value }))} /></Field>
          </div>
          <Field label="Rating (1–5)"><input type="number" min={1} max={5} step="1" className="w-full border rounded px-3 py-2" value={form.rating ?? ""} onChange={(e) => setForm(f => ({ ...f, rating: e.target.value === "" ? null : clamp(Number(e.target.value), 1, 5) }))} /></Field>

          <div className="flex justify-end gap-2 pt-2">
            <button className="px-3 py-2 rounded border" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="px-3 py-2 rounded bg-neutral-900 text-white" onClick={() => onQuickCreate(new Event("submit") as any)}>Save</button>
            <button className="px-3 py-2 rounded bg-neutral-900 text-white" onClick={() => {
              if (!valid) return; 
              const payload: Partial<Restaurant> = {
                name: String(form.name), slug: String(form.slug), municipality_id: Number(form.municipality_id),
                address: String(form.address), lat: Number(form.lat) || 0, lng: Number(form.lng) || 0,
                rating: form.rating == null ? null : clamp(Number(form.rating), 1, 5),
              };
              if (form.id) updateM.mutate({ id: form.id, payload }); else createM.mutate(payload);
            }}>Save</button>
          </div>
          {serverError && <p className="text-sm text-red-600 mt-2">{serverError}</p>}
        </div>
      </Modal>
    </div>
  );
}

/* ======================================================
   Curation Tab – enforce unique ranks per municipality
   ====================================================== */
function CurationTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [qDish, setQDish] = useState("");
  const [qRest, setQRest] = useState("");
  const [muniId, setMuniId] = useState<number | null>(null);
  const [category, setCategory] = useState<"all" | "food" | "delicacy" | "drink">("all");

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const dishesQ = useQuery({
    queryKey: ["dishes", qDish, muniId, category],
    queryFn: () => listDishes({ q: qDish, municipalityId: muniId ?? undefined, category: category === "all" ? undefined : category }),
    keepPreviousData: true,
  });
  const restsQ = useQuery({
    queryKey: ["rests", qRest, muniId],
    queryFn: () => listRestaurants({ q: qRest, municipalityId: muniId ?? undefined }),
  });

  const patchDishM = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: any }) => setDishCuration(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dishes"] }),
  });
  const patchRestM = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: any }) => setRestaurantCuration(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rests"] }),
  });

  async function setDishRank(d: Dish, rank: number | null) {
    const list = (dishesQ.data ?? []).filter(x => !muniId || x.municipality_id === muniId);
    const conflict = rank ? list.find(x => x.panel_rank === rank && x.id !== d.id) : null;
    if (conflict) {
      const ok = await confirm(`Replace "${conflict.name}" at TOP ${rank} with "${d.name}"?`);
      if (!ok) return;
      await patchDishM.mutateAsync({ id: conflict.id, payload: { panel_rank: null, is_signature: 0 as 0 } });
    }
    await qc.setQueryData(["dishes", qDish, muniId, category], (old:any)=> (old||[]).map((x:any)=> x.id===d.id?{...x,panel_rank:rank,is_signature:rank?1:0}:x));
    await patchDishM.mutateAsync({ id: d.id, payload: { panel_rank: rank, is_signature: rank ? 1 as 1 : 0 as 0 } });
  }
  async function setRestRank(r: Restaurant, rank: number | null) {
    const list = (restsQ.data ?? []).filter(x => !muniId || x.municipality_id === muniId);
    const conflict = rank ? list.find(x => x.featured_rank === rank && x.id !== r.id) : null;
    if (conflict) {
      const ok = await confirm(`Replace "${conflict.name}" at TOP ${rank} with "${r.name}"?`);
      if (!ok) return;
      await patchRestM.mutateAsync({ id: conflict.id, payload: { featured_rank: null, featured: 0 as 0 } });
    }
    await qc.setQueryData(["rests", qRest, muniId], (old:any)=> (old||[]).map((x:any)=> x.id===r.id?{...x,featured_rank:rank,featured:rank?1:0}:x));
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
            <option value="all">All</option>
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
              <div className="text-xs text-neutral-500">{d.category ?? "food"} · {(muniQ.data ?? []).find(m => m.id === d.municipality_id)?.name}</div>
              <div className="flex items-center gap-2 mt-2">
                {[1,2,3].map(rank => (
                  <button key={rank} className={cx("px-2 py-1 text-xs rounded border", d.panel_rank === rank && "bg-neutral-900 text-white")} onClick={() => setDishRank(d, d.panel_rank === rank ? null : rank)}>Top {rank}</button>
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
          <input className="border rounded px-3 py-2" placeholder="Search restaurants…" value={qRest} onChange={(e) => setQRest(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
          {(restsQ.data ?? []).map(r => (
            <div key={r.id} className="border rounded-xl p-3">
              <div className="font-semibold">{r.name}</div>
              <div className="text-xs text-neutral-500">{(muniQ.data ?? []).find(m => m.id === r.municipality_id)?.name}</div>
              <div className="flex items-center gap-2 mt-2">
                {[1,2,3].map(rank => (
                  <button key={rank} className={cx("px-2 py-1 text-xs rounded border", r.featured_rank === rank && "bg-neutral-900 text-white")} onClick={() => setRestRank(r, r.featured_rank === rank ? null : rank)}>Top {rank}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   Linking Tab – link restaurants to a selected dish; filters, search, linked-first
   ====================================================== */
function LinkingTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();

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
  });

  const linkM = useMutation({ mutationFn: ({ dish_id, restaurant_id }: { dish_id: number; restaurant_id: number }) => linkDishRestaurant({ dish_id, restaurant_id }), onSuccess: () => { linkedQ.refetch(); toast("Linked"); } });
  const unlinkM = useMutation({ mutationFn: ({ dish_id, restaurant_id }: { dish_id: number; restaurant_id: number }) => unlinkDishRestaurant({ dish_id, restaurant_id }), onSuccess: () => { linkedQ.refetch(); toast("Unlinked"); } });

  const linkedIds = new Set((linkedQ.data ?? []).map((r: any) => r.id ?? r.restaurant_id ?? r));
  const restaurantsRaw = (restsQ.data ?? []);
  const restaurants = React.useMemo(() => {
    const linked = new Set(linkedIds);
    const arr = [...restaurantsRaw];
    arr.sort((a:any,b:any)=>{
      const A = linked.has(a.id)?0:1; const B = linked.has(b.id)?0:1;
      if (A!==B) return A-B; return String(a.name).localeCompare(String(b.name));
    });
    return arr;
  }, [restaurantsRaw, linkedIds]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Pick a dish */}
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <input className="border rounded px-3 py-2 w-full" placeholder="Search dishes…" value={qDish} onChange={(e) => setQDish(e.target.value)} />
            <select className="border rounded px-2 py-1 text-sm" value={filterMuni ?? 0} onChange={(e) => setFilterMuni(Number(e.target.value) || null)}>
              <option value={0}>All muni</option>
              {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="max-h-[60vh] overflow-auto space-y-2">
            {(dishesQ.data ?? []).map(d => (
              <button key={d.id} className={cx("w-full text-left px-3 py-2 rounded-xl border", selDish?.id === d.id ? "bg-neutral-900 text-white" : "bg-white")} onClick={() => setSelDish(d)}>
                <div className="font-medium">{d.name}</div>
                <div className="text-xs opacity-70">{d.slug}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Restaurants to link */}
        <div className="bg-white border rounded-2xl p-4">
          {!selDish && <div className="text-sm text-neutral-500">Select a dish first.</div>}
          {selDish && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <input className="border rounded px-3 py-2 w-full" placeholder="Search restaurants…" value={qRest} onChange={(e) => setQRest(e.target.value)} />
              </div>
              <div className="max-h-[60vh] overflow-auto space-y-2">
                {restaurants.map(r => {
                  const isLinked = linkedIds.has(r.id);
                  return (
                    <div key={r.id} className={cx("border rounded-xl p-3 transition", isLinked ? "border-neutral-900 bg-neutral-50" : "hover:bg-neutral-50") }>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs opacity-70">{r.slug}</div>
                        </div>
                        <div className="flex gap-2">
                          {!isLinked ? (
                            <button className="text-xs px-2 py-1 rounded border" onClick={() => selDish && linkM.mutate({ dish_id: selDish.id, restaurant_id: r.id })}>Link</button>
                          ) : (
                            <button className="text-xs px-2 py-1 rounded border text-red-600" onClick={async () => { if (await confirm("Unlink?")) selDish && unlinkM.mutate({ dish_id: selDish.id, restaurant_id: r.id }); }}>Unlink</button>
                          )}
                        </div>
                      </div>
                      {isLinked && <div className="mt-1 inline-block text-[11px] px-1.5 py-0.5 rounded-full bg-neutral-900 text-white">Linked</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   Main Admin Dashboard Shell
   ====================================================== */
export default function AdminDashboard() {
  const [tab, setTab] = useState<"analytics" | "dishes" | "restaurants" | "curation" | "linking">("analytics");
  return (
    <Toaster>
      <ConfirmProvider>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
            <div className="text-sm text-neutral-500">Bulacan – Mapping Flavors (admin)</div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {([
              ["analytics","Analytics"],
              ["dishes","Dishes"],
              ["restaurants","Restaurants"],
              ["curation","Curation"],
              ["linking","Linking"],
            ] as const).map(([v,l]) => (
              <button key={v} className={cx("px-3 py-1.5 rounded border text-sm", tab===v?"bg-neutral-900 text-white":"bg-white")} onClick={()=>setTab(v as any)}>{l}</button>
            ))}
          </div>

          {tab === "analytics" && <AnalyticsTab />}
          {tab === "dishes" && <DishesTab />}
          {tab === "restaurants" && <RestaurantsTab />}
          {tab === "curation" && <CurationTab />}
          {tab === "linking" && <LinkingTab />}
        </div>
      </ConfirmProvider>
    </Toaster>
  );
}
