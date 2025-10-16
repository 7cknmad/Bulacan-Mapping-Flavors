import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
// Import everything as a loose namespace so this file works with either named or default exports
import * as API from "../../utils/adminApi"; // expects VITE_ADMIN_API_URL wiring

// -----------------------------------------------------
// Small utilities
// -----------------------------------------------------
const api = API as any; // tolerate different export shapes
const cx = (...cls: (string | false | null | undefined)[]) => cls.filter(Boolean).join(" ");
const slugify = (s: string) => s
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9\s-]/g, "")
  .replace(/\s+/g, "-")
  .replace(/-+/g, "-");

// Types (align with server JSON; keep fields minimal to avoid mismatch)
export type Municipality = { id: number; name: string; slug: string };
export type Dish = {
  id: number;
  name: string;
  slug: string;
  municipality_id?: number | null;
  category?: string | null;
  image_url?: string | null;
  flavor_profile?: string[] | null;
  ingredients?: string[] | null;
  rating?: number | null; // 1..5
  popularity?: number | null; // 0..100
  is_signature?: number | boolean | null; // 0/1 or boolean
  panel_rank?: number | null; // 1..3 unique per muni
};
export type Restaurant = {
  id: number;
  name: string;
  slug: string;
  municipality_id: number;
  kind?: string | null;
  address?: string | null;
  cuisine_types?: string[] | null;
  rating?: number | null; // 1..5
  lat?: number | null;
  lng?: number | null;
  image_url?: string | null;
  featured?: number | boolean | null;
  featured_rank?: number | null;
};

// -----------------------------------------------------
// Toasts + Confirm (no external deps)
// -----------------------------------------------------
const ToastCtx = React.createContext<(msg: string) => void>(() => {});
const ConfirmCtx = React.createContext<(msg: string) => Promise<boolean>>(() => Promise.resolve(false));

function Toaster({ children }: { children: React.ReactNode }) {
  const [list, setList] = React.useState<{ id: number; msg: string }[]>([]);
  const push = (msg: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 2400);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-[70]">
        {list.map((t) => (
          <div key={t.id} className="px-3 py-2 rounded-md bg-neutral-900 text-white shadow">
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => React.useContext(ToastCtx);

function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ msg: string; res?: (v: boolean) => void } | null>(null);
  const confirm = (msg: string) => new Promise<boolean>((resolve) => setState({ msg, res: resolve }));
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm">
            <div className="mb-4 text-sm">{state.msg}</div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1.5 rounded border"
                onClick={() => {
                  state.res?.(false);
                  setState(null);
                }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded bg-neutral-900 text-white"
                onClick={() => {
                  state.res?.(true);
                  setState(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => React.useContext(ConfirmCtx);

// -----------------------------------------------------
// Modal (headless, simple)
// -----------------------------------------------------
function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[75] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className={cx("bg-white rounded-2xl shadow-xl", wide ? "w-full max-w-4xl" : "w-full max-w-xl")} onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button className="text-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Chart Shell (recharts ResponsiveContainer must wrap ONE chart component)
// -----------------------------------------------------
function ChartShell({ children, height = 420 }: { children: React.ReactNode; height?: number }) {
  const [k, setK] = React.useState(0);
  React.useEffect(() => {
    const id = setTimeout(() => setK(1), 60);
    return () => clearTimeout(id);
  }, []);
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

// -----------------------------------------------------
// Shared validation
// -----------------------------------------------------
function clampInt(v: any, min: number, max: number) {
  const n = Number.isFinite(v) ? v : parseInt(String(v || 0), 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function validateDish(form: Partial<Dish>) {
  const errors: Record<string, string> = {};
  if (!form.name?.trim()) errors.name = "Name is required.";
  const rating = form.rating == null ? null : clampInt(form.rating, 1, 5);
  if (rating != null && (rating < 1 || rating > 5)) errors.rating = "Rating must be 1–5.";
  const pop = form.popularity == null ? null : clampInt(form.popularity, 0, 100);
  if (pop != null && (pop < 0 || pop > 100)) errors.popularity = "Popularity must be 0–100.";
  if (form.slug && !/^[a-z0-9-]+$/.test(form.slug)) errors.slug = "Slug: lowercase letters, numbers, and hyphens only.";
  return { valid: Object.keys(errors).length === 0, errors };
}

function validateRestaurant(form: Partial<Restaurant>) {
  const errors: Record<string, string> = {};
  if (!form.name?.trim()) errors.name = "Name is required.";
  const rating = form.rating == null ? null : clampInt(form.rating, 1, 5);
  if (rating != null && (rating < 1 || rating > 5)) errors.rating = "Rating must be 1–5.";
  if (form.slug && !/^[a-z0-9-]+$/.test(form.slug)) errors.slug = "Slug: lowercase letters, numbers, and hyphens only.";
  return { valid: Object.keys(errors).length === 0, errors };
}

// -----------------------------------------------------
// Analytics Tab
// -----------------------------------------------------
function AnalyticsTab() {
  const [chart, setChart] = React.useState<"bar" | "line" | "pie">("bar");
  const summaryQ = useQuery({ queryKey: ["admin","analytics","summary"], queryFn: () => api.getAnalyticsSummary?.() });
  const muniQ = useQuery({ queryKey: ["admin","analytics","per-muni"], queryFn: () => api.getAnalyticsPerMunicipality?.() });

  const loading = summaryQ.isLoading || muniQ.isLoading;
  const s = summaryQ.data || { dishes: 0, restaurants: 0, municipalities: 0 };
  const per = (muniQ.data || []) as Array<{ municipality: string; dishes: number; restaurants: number }>; 

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[{k:"dishes",v:s.dishes},{k:"restaurants",v:s.restaurants},{k:"municipalities",v:s.municipalities}].map((m)=> (
          <div key={m.k} className="bg-white rounded-xl border p-4">
            <div className="text-sm text-neutral-500 capitalize">{m.k}</div>
            <div className="text-3xl font-semibold">{m.v ?? (loading ? "…" : 0)}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Per-municipality totals</h4>
        <div className="flex gap-1">
          {(["bar","line","pie"] as const).map((t)=> (
            <button key={t} onClick={()=>setChart(t)} className={cx("px-3 py-1.5 rounded border text-sm", chart===t?"bg-neutral-900 text-white":"bg-white")}>{t}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[420px] rounded-xl bg-neutral-100 animate-pulse" />
      ) : per?.length ? (
        chart === "pie" ? (
          <ChartShell>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie dataKey="dishes" nameKey="municipality" data={per} outerRadius={120} />
            </PieChart>
          </ChartShell>
        ) : chart === "line" ? (
          <ChartShell>
            <LineChart data={per}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="municipality" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="dishes" />
              <Line type="monotone" dataKey="restaurants" />
            </LineChart>
          </ChartShell>
        ) : (
          <ChartShell>
            <BarChart data={per}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="municipality" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="dishes" />
              <Bar dataKey="restaurants" />
            </BarChart>
          </ChartShell>
        )
      ) : (
        <div className="text-sm text-neutral-500">No analytics yet.</div>
      )}
    </div>
  );
}

// -----------------------------------------------------
// Dishes Tab (search, filters, create/edit modal, delete w/ confirm, badges)
// -----------------------------------------------------
function DishesTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [q, setQ] = React.useState("");
  const [muni, setMuni] = React.useState<number | "all">("all");
  const [category, setCategory] = React.useState<string | "all">("all");
  const [editOpen, setEditOpen] = React.useState(false);
  const emptyDish: Partial<Dish> = { name: "", slug: "", rating: null, popularity: 0, municipality_id: null, category: "" };
  const [form, setForm] = React.useState<Partial<Dish>>(emptyDish);
  const [errors, setErrors] = React.useState<Record<string,string>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);

  const muniQ = useQuery({ queryKey: ["municipalities"], queryFn: () => api.getMunicipalities?.() });
  const dishesQ = useQuery({
    queryKey: ["dishes", { q, muni, category }],
    queryFn: () => api.getDishes?.({ q, municipalityId: muni === "all" ? undefined : muni, category: category === "all" ? undefined : category }),
  });

  const createM = useMutation({
    mutationFn: (payload: Partial<Dish>) => api.createDish?.(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setEditOpen(false); toast("Dish created"); },
    onError: (e: any) => setServerError(e?.message || "Create failed"),
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Dish> }) => api.updateDish?.(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setEditOpen(false); toast("Dish saved"); },
    onError: (e: any) => setServerError(e?.message || "Save failed"),
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => api.deleteDish?.(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); toast("Dish deleted"); },
  });

  const openCreate = () => { setServerError(null); setErrors({}); setForm({ ...emptyDish }); setEditOpen(true); };
  const openEdit = (d: Dish) => { setServerError(null); setErrors({}); setForm({ ...d }); setEditOpen(true); };

  const onSave = async () => {
    const f = { ...form, slug: form.slug || slugify(form.name || "") } as Partial<Dish>;
    const { valid, errors } = validateDish(f);
    setErrors(errors);
    if (!valid) return;
    if ((f.rating as any) != null) f.rating = clampInt(f.rating, 1, 5);
    if ((f.popularity as any) != null) f.popularity = clampInt(f.popularity, 0, 100);

    if ((f as any).id) updateM.mutate({ id: (f as any).id, payload: f });
    else createM.mutate(f);
  };

  const items = (dishesQ.data || []) as Dish[];
  const loading = dishesQ.isLoading;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dishes…"
          className="px-3 py-2 rounded-xl border w-full md:w-72"
        />
        <select className="px-3 py-2 rounded-xl border" value={muni} onChange={(e) => setMuni(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">All municipalities</option>
          {(muniQ.data || []).map((m: Municipality) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select className="px-3 py-2 rounded-xl border" value={category} onChange={(e) => setCategory(e.target.value as any)}>
          <option value="all">All categories</option>
          <option value="appetizer">Appetizer</option>
          <option value="main">Main</option>
          <option value="dessert">Dessert</option>
          <option value="drink">Drink</option>
          <option value="snack">Snack</option>
        </select>
        <div className="grow" />
        <button className="px-3 py-2 rounded-xl bg-neutral-900 text-white" onClick={openCreate}>+ New Dish</button>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((d) => (
            <div key={d.id} className="border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{d.name}</div>
                {d.is_signature ? (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white">Signature</span>
                ) : null}
                {d.panel_rank ? (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-900 text-white">Top {d.panel_rank}</span>
                ) : null}
              </div>
              <div className="text-xs text-neutral-500">{d.slug}</div>
              <div className="mt-2 flex gap-2">
                <button className="px-3 py-1.5 rounded border" onClick={() => openEdit(d)}>Edit</button>
                <button
                  className="px-3 py-1.5 rounded border text-red-600"
                  onClick={async () => {
                    if (await confirm(`Delete “${d.name}”?`)) deleteM.mutate(d.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={(form as any).id ? "Edit Dish" : "New Dish"}>
        <div className="space-y-3">
          {serverError && <div className="text-sm text-red-600">{serverError}</div>}
          <div>
            <label className="text-sm">Name</label>
            <input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))} />
            {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name}</div>}
          </div>
          <div>
            <label className="text-sm">Slug</label>
            <input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.slug || ""} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            {errors.slug && <div className="text-xs text-red-600 mt-1">{errors.slug}</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Municipality</label>
              <select className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.municipality_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, municipality_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">Unassigned</option>
                {(muniQ.data || []).map((m: Municipality) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm">Category</label>
              <select className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value || null }))}>
                <option value="">—</option>
                <option value="appetizer">Appetizer</option>
                <option value="main">Main</option>
                <option value="dessert">Dessert</option>
                <option value="drink">Drink</option>
                <option value="snack">Snack</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Rating (1–5)</label>
              <input type="number" min={1} max={5} step={1} className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.rating ?? ""} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value === "" ? null : clampInt(e.target.value,1,5) }))} />
              {errors.rating && <div className="text-xs text-red-600 mt-1">{errors.rating}</div>}
            </div>
            <div>
              <label className="text-sm">Popularity (0–100)</label>
              <input type="number" min={0} max={100} step={1} className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.popularity ?? 0} onChange={(e) => setForm((f) => ({ ...f, popularity: clampInt(e.target.value,0,100) }))} />
              {errors.popularity && <div className="text-xs text-red-600 mt-1">{errors.popularity}</div>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-3 py-2 rounded-xl border" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="px-3 py-2 rounded-xl bg-neutral-900 text-white" onClick={onSave}>
              {(form as any).id ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// -----------------------------------------------------
// Restaurants Tab (mirrors Dishes Tab)
// -----------------------------------------------------
function RestaurantsTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [q, setQ] = React.useState("");
  const [muni, setMuni] = React.useState<number | "all">("all");
  const [editOpen, setEditOpen] = React.useState(false);
  const emptyR: Partial<Restaurant> = { name: "", slug: "", municipality_id: 0, rating: null };
  const [form, setForm] = React.useState<Partial<Restaurant>>(emptyR);
  const [errors, setErrors] = React.useState<Record<string,string>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);

  const muniQ = useQuery({ queryKey: ["municipalities"], queryFn: () => api.getMunicipalities?.() });
  const restosQ = useQuery({
    queryKey: ["restaurants", { q, muni }],
    queryFn: () => api.getRestaurants?.({ q, municipalityId: muni === "all" ? undefined : muni }),
  });

  const createM = useMutation({
    mutationFn: (payload: Partial<Restaurant>) => api.createRestaurant?.(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurants"] }); setEditOpen(false); toast("Restaurant created"); },
    onError: (e: any) => setServerError(e?.message || "Create failed"),
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Restaurant> }) => api.updateRestaurant?.(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurants"] }); setEditOpen(false); toast("Restaurant saved"); },
    onError: (e: any) => setServerError(e?.message || "Save failed"),
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => api.deleteRestaurant?.(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurants"] }); toast("Restaurant deleted"); },
  });

  const openCreate = () => { setServerError(null); setErrors({}); setForm({ ...emptyR }); setEditOpen(true); };
  const openEdit = (r: Restaurant) => { setServerError(null); setErrors({}); setForm({ ...r }); setEditOpen(true); };

  const onSave = async () => {
    const f = { ...form, slug: form.slug || slugify(form.name || "") } as Partial<Restaurant>;
    const { valid, errors } = validateRestaurant(f);
    setErrors(errors);
    if (!valid) return;
    if ((f.rating as any) != null) f.rating = clampInt(f.rating, 1, 5);

    if ((f as any).id) updateM.mutate({ id: (f as any).id, payload: f });
    else createM.mutate(f);
  };

  const items = (restosQ.data || []) as Restaurant[];
  const loading = restosQ.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search restaurants…" className="px-3 py-2 rounded-xl border w-full md:w-72" />
        <select className="px-3 py-2 rounded-xl border" value={muni} onChange={(e) => setMuni(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">All municipalities</option>
          {(muniQ.data || []).map((m: Municipality) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <div className="grow" />
        <button className="px-3 py-2 rounded-xl bg-neutral-900 text-white" onClick={openCreate}>+ New Restaurant</button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((r) => (
            <div key={r.id} className="border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{r.name}</div>
                {r.featured ? (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">Featured</span>
                ) : null}
                {r.featured_rank ? (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-900 text-white">Top {r.featured_rank}</span>
                ) : null}
              </div>
              <div className="text-xs text-neutral-500">{r.slug}</div>
              <div className="mt-2 flex gap-2">
                <button className="px-3 py-1.5 rounded border" onClick={() => openEdit(r)}>Edit</button>
                <button className="px-3 py-1.5 rounded border text-red-600" onClick={async () => { if (await useConfirm()(`Delete “${r.name}”?`)) deleteM.mutate(r.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={(form as any).id ? "Edit Restaurant" : "New Restaurant"}>
        <div className="space-y-3">
          {serverError && <div className="text-sm text-red-600">{serverError}</div>}
          <div>
            <label className="text-sm">Name</label>
            <input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))} />
            {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name}</div>}
          </div>
          <div>
            <label className="text-sm">Slug</label>
            <input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.slug || ""} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            {errors.slug && <div className="text-xs text-red-600 mt-1">{errors.slug}</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Municipality</label>
              <select className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.municipality_id ?? 0} onChange={(e) => setForm((f) => ({ ...f, municipality_id: Number(e.target.value) }))}>
                <option value={0} disabled>Choose…</option>
                {(muniQ.data || []).map((m: Municipality) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm">Rating (1–5)</label>
              <input type="number" min={1} max={5} step={1} className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.rating ?? ""} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value === "" ? null : clampInt(e.target.value,1,5) }))} />
              {errors.rating && <div className="text-xs text-red-600 mt-1">{errors.rating}</div>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="px-3 py-2 rounded-xl border" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="px-3 py-2 rounded-xl bg-neutral-900 text-white" onClick={onSave}>
              {(form as any).id ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// -----------------------------------------------------
// Curation Tab – enforce unique ranks per municipality
// -----------------------------------------------------
function CurationTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [muni, setMuni] = React.useState<number | "all">("all");
  const muniQ = useQuery({ queryKey: ["municipalities"], queryFn: () => api.getMunicipalities?.() });
  const dishesQ = useQuery({ queryKey: ["dishes", { muni }], queryFn: () => api.getDishes?.({ municipalityId: muni === "all" ? undefined : muni }) });

  const patchM = useMutation({
    mutationFn: ({ id, panel_rank, is_signature }: { id: number; panel_rank: number | null; is_signature: number | boolean }) => api.setDishCuration?.({ id, panel_rank, is_signature }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); toast("Curation updated"); },
  });

  const items = (dishesQ.data || []) as Dish[];

  const ranksById = new Map<number, number>();
  items.forEach((d) => { if (d.panel_rank) ranksById.set(d.id, d.panel_rank); });

  const setRank = async (dish: Dish, rank: number | null) => {
    // Find conflicting dish
    const conflict = items.find((x) => x.id !== dish.id && x.panel_rank === rank && rank != null);
    if (conflict && !(await confirm(`Rank ${rank} already used by “${conflict.name}”. Replace it?`))) return;

    // optimistic UI
    await qc.setQueryData(["dishes", { muni }], (old: any) =>
      (old || []).map((x: Dish) => {
        if (conflict && x.id === conflict.id) return { ...x, panel_rank: null, is_signature: 0 };
        if (x.id === dish.id) return { ...x, panel_rank: rank, is_signature: rank ? 1 : 0 };
        return x;
      })
    );

    await patchM.mutateAsync({ id: dish.id, panel_rank: rank, is_signature: rank ? 1 : 0 });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <select className="px-3 py-2 rounded-xl border" value={muni} onChange={(e) => setMuni(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">All municipalities</option>
          {(muniQ.data || []).map((m: Municipality) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <div className="text-sm text-neutral-500">Assign unique Top 1–3 per municipality.</div>
      </div>

      {dishesQ.isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((d) => (
            <div key={d.id} className="border rounded-xl p-3">
              <div className="font-medium">{d.name}</div>
              <div className="mt-2 flex items-center gap-2">
                {[1,2,3].map((r) => (
                  <button key={r} className={cx("px-2 py-1 rounded border text-sm", d.panel_rank===r?"bg-neutral-900 text-white":"bg-white")} onClick={() => setRank(d, r)}>Top {r}</button>
                ))}
                <button className="px-2 py-1 rounded border text-sm" onClick={() => setRank(d, null)}>Clear</button>
              </div>
              {d.panel_rank ? (
                <div className="mt-2 text-xs text-neutral-600">Current: Top {d.panel_rank}</div>
              ) : (
                <div className="mt-2 text-xs text-neutral-400">Not ranked</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------
// Linking Tab – link restaurants to a selected dish; filters, search, linked-first
// -----------------------------------------------------
function LinkingTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [qDish, setQDish] = React.useState("");
  const [qRest, setQRest] = React.useState("");
  const [muni, setMuni] = React.useState<number | "all">("all");
  const [dishId, setDishId] = React.useState<number | null>(null);

  const muniQ = useQuery({ queryKey: ["municipalities"], queryFn: () => api.getMunicipalities?.() });
  const dishesQ = useQuery({ queryKey: ["dishes", { qDish, muni }], queryFn: () => api.getDishes?.({ q: qDish, municipalityId: muni === "all" ? undefined : muni }) });
  const restosQ = useQuery({ queryKey: ["restaurants", { qRest, muni }], queryFn: () => api.getRestaurants?.({ q: qRest, municipalityId: muni === "all" ? undefined : muni }) });

  const linksQ = useQuery({
    queryKey: ["links", { dishId }],
    enabled: !!dishId,
    queryFn: () => api.getLinksByDish?.(dishId), // expected to return [{ restaurant_id }] or array of ids
  });

  const linkM = useMutation({
    mutationFn: ({ dishId, restaurantId }: { dishId: number; restaurantId: number }) => api.linkDishRestaurant?.({ dishId, restaurantId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["links"] }); toast("Linked"); },
  });
  const unlinkM = useMutation({
    mutationFn: ({ dishId, restaurantId }: { dishId: number; restaurantId: number }) => api.unlinkDishRestaurant?.({ dishId, restaurantId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["links"] }); toast("Unlinked"); },
  });

  const restaurants = (restosQ.data || []) as Restaurant[];
  const linkedSet = React.useMemo(() => {
    const arr = (linksQ.data || []) as any[];
    const ids: number[] = Array.isArray(arr)
      ? (typeof arr[0] === "number" ? (arr as number[]) : arr.map((x) => x.restaurant_id))
      : [];
    return new Set(ids);
  }, [linksQ.data]);

  const sorted = React.useMemo(() => {
    const arr = [...restaurants];
    arr.sort((a, b) => {
      const A = linkedSet.has(a.id) ? 0 : 1;
      const B = linkedSet.has(b.id) ? 0 : 1;
      if (A !== B) return A - B; // linked first
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [restaurants, linkedSet]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Left: pick a dish */}
        <div className="lg:w-1/2 bg-white rounded-xl border p-3">
          <div className="flex items-center gap-2 mb-2">
            <input value={qDish} onChange={(e) => setQDish(e.target.value)} placeholder="Search dishes…" className="px-3 py-2 rounded-xl border w-full" />
            <select className="px-3 py-2 rounded-xl border" value={muni} onChange={(e) => setMuni(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">All muni</option>
              {(muniQ.data || []).map((m: Municipality) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="h-[360px] overflow-auto space-y-2">
            {(dishesQ.data || []).map((d: Dish) => (
              <button key={d.id} className={cx("w-full text-left px-3 py-2 rounded-xl border", dishId===d.id?"bg-neutral-900 text-white":"bg-white")} onClick={() => setDishId(d.id)}>
                <div className="font-medium">{d.name}</div>
                <div className="text-xs opacity-70">{d.slug}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: restaurants to link */}
        <div className="lg:w-1/2 bg-white rounded-xl border p-3">
          <div className="flex items-center gap-2 mb-2">
            <input value={qRest} onChange={(e) => setQRest(e.target.value)} placeholder="Search restaurants…" className="px-3 py-2 rounded-xl border w-full" />
          </div>
          <div className="h-[360px] overflow-auto space-y-2">
            {sorted.map((r) => {
              const isLinked = linkedSet.has(r.id);
              return (
                <div key={r.id} className={cx("border rounded-xl p-3 transition", isLinked ? "border-neutral-900 bg-neutral-50" : "hover:bg-neutral-50") }>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs opacity-70">{r.slug}</div>
                    </div>
                    <div className="flex gap-2">
                      {!dishId ? (
                        <span className="text-xs text-neutral-400">Pick a dish</span>
                      ) : isLinked ? (
                        <button className="px-3 py-1.5 rounded border" onClick={async () => { if (await confirm("Unlink?")) unlinkM.mutate({ dishId: dishId!, restaurantId: r.id }); }}>Unlink</button>
                      ) : (
                        <button className="px-3 py-1.5 rounded border" onClick={() => linkM.mutate({ dishId: dishId!, restaurantId: r.id })}>Link</button>
                      )}
                    </div>
                  </div>
                  {isLinked && <div className="mt-1 inline-block text-[11px] px-1.5 py-0.5 rounded-full bg-neutral-900 text-white">Linked</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Main Admin Dashboard Shell
// -----------------------------------------------------
export default function AdminDashboard() {
  const [tab, setTab] = React.useState<"analytics"|"dishes"|"restaurants"|"curation"|"linking">("analytics");
  return (
    <Toaster>
      <ConfirmProvider>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
            <div className="text-sm text-neutral-500">Bulacan – Mapping Flavors (admin)</div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {[
              ["analytics","Analytics"],
              ["dishes","Dishes"],
              ["restaurants","Restaurants"],
              ["curation","Curation"],
              ["linking","Linking"],
            ].map(([v,l]) => (
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
