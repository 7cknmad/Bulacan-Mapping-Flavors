// src/pages/admin/AdminDashboard.tsx — upgraded (v1)
// Follows your existing src/utils/adminApi.ts exactly. No server changes.

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  listMunicipalities,
  listDishes,
  listRestaurants,
  createDish,
  updateDish,
  deleteDish,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getAnalyticsSummary,
  getPerMunicipalityCounts,
  listRestaurantsForDish,
  linkDishRestaurant,
  unlinkDishRestaurant,
  setDishCuration,
  setRestaurantCuration,
  slugify,
  type Dish,
  type Restaurant,
  type Municipality,
} from "../../utils/adminApi";

/* ----------------------------------------------------------------------------
   UI helpers: toaster + confirm + modal
---------------------------------------------------------------------------- */
const ToastCtx = React.createContext<(msg: string) => void>(() => {});
const useToast = () => React.useContext(ToastCtx);
function Toaster({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  const push = (msg: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, msg }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2200);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed right-4 bottom-4 z-[70] space-y-2">
        {items.map((t) => (
          <div key={t.id} className="bg-neutral-900 text-white shadow rounded-md px-3 py-2 text-sm">{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

const ConfirmCtx = React.createContext<(msg: string) => Promise<boolean>>(
  () => Promise.resolve(false)
);
const useConfirm = () => React.useContext(ConfirmCtx);
function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ msg: string; r?: (v: boolean) => void } | null>(null);
  const confirm = (msg: string) => new Promise<boolean>((r) => setState({ msg, r }));
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={() => { state.r?.(false); setState(null); }}>
          <div className="bg-white rounded-xl p-4 w-full max-w-sm" onClick={(e)=>e.stopPropagation()}>
            <div className="text-sm mb-4">{state.msg}</div>
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-1.5 rounded border" onClick={() => { state.r?.(false); setState(null); }}>Cancel</button>
              <button className="px-3 py-1.5 rounded bg-neutral-900 text-white" onClick={() => { state.r?.(true); setState(null); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[75] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl" onClick={(e)=>e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button className="text-sm" onClick={onClose}>✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
const clamp = (n: any, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n))));

/* ----------------------------------------------------------------------------
   1) Analytics – responsive, chart picker (bar/line/pie), stacked toggle
---------------------------------------------------------------------------- */
function ChartShell({ children, height = 420 }: { children: React.ReactNode; height?: number }) {
  const [k, setK] = useState(0);
  React.useEffect(() => { const id = setTimeout(() => setK(1), 60); return () => clearTimeout(id); }, []);
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

function AnalyticsTab() {
  const summaryQ = useQuery({ queryKey: ["analytics:summary"], queryFn: getAnalyticsSummary, staleTime: 120_000 });
  const perMuniQ = useQuery({ queryKey: ["analytics:per-muni"], queryFn: getPerMunicipalityCounts, staleTime: 120_000 });

  const [type, setType] = useState<"bar" | "line" | "pie">("bar");
  const [stacked, setStacked] = useState(false);

  const cards = [
    { label: "Dishes", value: summaryQ.data?.dishes ?? 0 },
    { label: "Restaurants", value: summaryQ.data?.restaurants ?? 0 },
    { label: "Municipalities", value: summaryQ.data?.municipalities ?? 0 },
  ];

  const rows = (perMuniQ.data ?? []).map((r) => ({
    name: r.municipality_name,
    dishes: r.dishes,
    restaurants: r.restaurants,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border p-4">
            <div className="text-xs text-neutral-500">{c.label}</div>
            <div className="text-3xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="font-semibold mr-auto">Per-municipality totals</div>
        {["bar", "line", "pie"].map((t) => (
          <button key={t} className={cx("px-3 py-1.5 rounded border text-sm", type === t ? "bg-neutral-900 text-white" : "bg-white")} onClick={() => setType(t as any)}>
            {t}
          </button>
        ))}
        {type === "bar" && (
          <button className={cx("px-3 py-1.5 rounded border text-sm", stacked && "bg-neutral-900 text-white")} onClick={() => setStacked((s) => !s)}>
            {stacked ? "Unstack" : "Stack"}
          </button>
        )}
      </div>

      {summaryQ.isLoading || perMuniQ.isLoading ? (
        <div className="h-[440px] bg-neutral-100 animate-pulse rounded-xl" />
      ) : type === "pie" ? (
        <ChartShell height={440}>
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={rows} dataKey="dishes" nameKey="name" outerRadius={110} />
            <Pie data={rows} dataKey="restaurants" nameKey="name" innerRadius={120} outerRadius={160} />
          </PieChart>
        </ChartShell>
      ) : type === "line" ? (
        <ChartShell height={440}>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" hide />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="dishes" />
            <Line type="monotone" dataKey="restaurants" />
          </LineChart>
        </ChartShell>
      ) : (
        <ChartShell height={440}>
          <BarChart data={rows}>
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
        </ChartShell>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   2 & 3) Dishes & Restaurants – strict validation, helpful errors, modal create/edit
---------------------------------------------------------------------------- */
function FieldError({ msg }: { msg?: string }) { if (!msg) return null; return <div className="text-xs text-red-600 mt-1">{msg}</div>; }

function useSlugFromName(initial = "") {
  const [slug, setSlug] = useState(initial);
  const [manual, setManual] = useState(false);
  const setFromName = (name: string) => { if (!manual) setSlug(slugify(name)); };
  const setUserSlug = (s: string) => { setSlug(s); setManual(true); };
  return { slug, setFromName, setUserSlug };
}

function DishesTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [q, setQ] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Partial<Dish>>({ name: "", slug: "", municipality_id: 0, category: "food" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const dishesQ = useQuery({ queryKey: ["dishes", q], queryFn: () => listDishes({ q }), staleTime: 30_000 });

  const createM = useMutation({
    mutationFn: (p: Partial<Dish>) => createDish(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setEditOpen(false); toast("Dish created"); },
    onError: (e: any) => toast(e?.message ?? "Create failed"),
  });
  const updateM = useMutation({
    mutationFn: ({ id, p }: { id: number; p: Partial<Dish> }) => updateDish(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setEditOpen(false); toast("Dish saved"); },
    onError: (e: any) => toast(e?.message ?? "Save failed"),
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteDish(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); toast("Dish deleted"); },
  });

  const validate = (f: Partial<Dish>) => {
    const errs: Record<string, string> = {};
    if (!f.name) errs.name = "Name is required";
    if (!f.slug) errs.slug = "Slug is required";
    if (!f.municipality_id) errs.municipality_id = "Municipality is required";
    if (f.rating != null) {
      const r = clamp(f.rating, 1, 5);
      if (Number.isNaN(r) || r < 1 || r > 5) errs.rating = "Rating must be 1–5";
    }
    if (f.popularity != null) {
      const p = clamp(f.popularity, 0, 100);
      if (Number.isNaN(p) || p < 0 || p > 100) errs.popularity = "Popularity must be 0–100";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openCreate = () => { setForm({ name: "", slug: "", municipality_id: 0, category: "food", rating: null, popularity: null }); setErrors({}); setEditOpen(true); };
  const openEdit = (d: Dish) => { setForm({ ...d }); setErrors({}); setEditOpen(true); };

  const onSave = () => {
    const f = { ...form } as Partial<Dish>;
    if (!validate(f)) return;
    if (f.id) updateM.mutate({ id: f.id, p: f }); else createM.mutate(f);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <input className="px-3 py-2 rounded-xl border w-full md:w-72" placeholder="Search dishes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="ml-auto px-3 py-2 rounded-xl border" onClick={openCreate}>+ New Dish</button>
      </div>

      {dishesQ.isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => (<div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />))}</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(dishesQ.data ?? []).map((d) => (
            <div key={d.id} className="border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{d.name}</div>
                {d.is_signature ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white">Signature</span> : null}
                {d.panel_rank ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-900 text-white">Top {d.panel_rank}</span> : null}
              </div>
              <div className="text-xs text-neutral-500">{d.slug}</div>
              <div className="mt-2 flex gap-2">
                <button className="px-3 py-1.5 rounded border" onClick={() => openEdit(d)}>Edit</button>
                <button className="px-3 py-1.5 rounded border text-red-600" onClick={async () => { if (await useConfirm()("Delete this dish?")) deleteM.mutate(d.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={form.id ? "Edit Dish" : "New Dish"}>
        <div className="space-y-3">
          <label className="block text-sm">Name
            <input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f?.slug ? f.slug : slugify(e.target.value) }))} />
            <FieldError msg={errors.name} />
          </label>
          <label className="block text-sm">Slug
            <input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.slug ?? ""} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            <FieldError msg={errors.slug} />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm">Municipality
              <select className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.municipality_id ?? 0} onChange={(e) => setForm((f) => ({ ...f, municipality_id: Number(e.target.value) }))}>
                <option value={0} disabled>Choose…</option>
                {(muniQ.data ?? []).map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
              </select>
              <FieldError msg={errors.municipality_id} />
            </label>
            <label className="block text-sm">Category
              <select className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.category ?? "food"} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                <option value="food">Food</option>
                <option value="delicacy">Delicacy</option>
                <option value="drink">Drink</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm">Rating (1–5)
              <input type="number" min={1} max={5} step={1} className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.rating ?? ""} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value === "" ? null : clamp(e.target.value, 1, 5) }))} />
              <FieldError msg={errors.rating} />
            </label>
            <label className="block text-sm">Popularity (0–100)
              <input type="number" min={0} max={100} step={1} className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.popularity ?? ""} onChange={(e) => setForm((f) => ({ ...f, popularity: e.target.value === "" ? null : clamp(e.target.value, 0, 100) }))} />
              <FieldError msg={errors.popularity} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-3 py-2 rounded-xl border" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="px-3 py-2 rounded-xl bg-neutral-900 text-white" onClick={onSave}>Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RestaurantsTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [q, setQ] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Partial<Restaurant>>({ name: "", slug: "", municipality_id: 0, address: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const restsQ = useQuery({ queryKey: ["restaurants", q], queryFn: () => listRestaurants({ q }), staleTime: 30_000 });

  const createM = useMutation({ mutationFn: (p: Partial<Restaurant>) => createRestaurant(p), onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurants"] }); setEditOpen(false); toast("Restaurant created"); } });
  const updateM = useMutation({ mutationFn: ({ id, p }: { id: number; p: Partial<Restaurant> }) => updateRestaurant(id, p), onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurants"] }); setEditOpen(false); toast("Restaurant saved"); } });
  const deleteM = useMutation({ mutationFn: (id: number) => deleteRestaurant(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurants"] }); toast("Restaurant deleted"); } });

  const validate = (f: Partial<Restaurant>) => {
    const errs: Record<string, string> = {};
    if (!f.name) errs.name = "Name is required";
    if (!f.slug) errs.slug = "Slug is required";
    if (!f.municipality_id) errs.municipality_id = "Municipality is required";
    if (f.rating != null) {
      const r = clamp(f.rating, 1, 5);
      if (Number.isNaN(r) || r < 1 || r > 5) errs.rating = "Rating must be 1–5";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openCreate = () => { setForm({ name: "", slug: "", municipality_id: 0, address: "", rating: null }); setErrors({}); setEditOpen(true); };
  const openEdit = (r: Restaurant) => { setForm({ ...r }); setErrors({}); setEditOpen(true); };

  const onSave = () => {
    const f = { ...form } as Partial<Restaurant>;
    if (!validate(f)) return;
    if (f.id) updateM.mutate({ id: f.id, p: f }); else createM.mutate(f);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <input className="px-3 py-2 rounded-xl border w-full md:w-72" placeholder="Search restaurants…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="ml-auto px-3 py-2 rounded-xl border" onClick={openCreate}>+ New Restaurant</button>
      </div>

      {restsQ.isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => (<div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />))}</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(restsQ.data ?? []).map((r) => (
            <div key={r.id} className="border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{r.name}</div>
                {r.featured ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">Featured</span> : null}
                {r.featured_rank ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-900 text-white">Top {r.featured_rank}</span> : null}
              </div>
              <div className="text-xs text-neutral-500">{r.slug}</div>
              <div className="mt-2 flex gap-2">
                <button className="px-3 py-1.5 rounded border" onClick={() => openEdit(r)}>Edit</button>
                <button className="px-3 py-1.5 rounded border text-red-600" onClick={async () => { if (await useConfirm()("Delete this restaurant?")) deleteM.mutate(r.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={form.id ? "Edit Restaurant" : "New Restaurant"}>
        <div className="space-y-3">
          <label className="block text-sm">Name
            <input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f?.slug ? f.slug : slugify(e.target.value) }))} />
            <FieldError msg={errors.name} />
          </label>
          <label className="block text-sm">Slug
            <input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.slug ?? ""} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            <FieldError msg={errors.slug} />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm">Municipality
              <select className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.municipality_id ?? 0} onChange={(e) => setForm((f) => ({ ...f, municipality_id: Number(e.target.value) }))}>
                <option value={0} disabled>Choose…</option>
                {(muniQ.data ?? []).map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
              </select>
              <FieldError msg={errors.municipality_id} />
            </label>
            <label className="block text-sm">Rating (1–5)
              <input type="number" min={1} max={5} step={1} className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.rating ?? ""} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value === "" ? null : clamp(e.target.value, 1, 5) }))} />
              <FieldError msg={errors.rating} />
            </label>
          </div>
          <label className="block text-sm">Address
            <input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm">Latitude
              <input className="mt-1 w-full px-3 py-2 rounded-xl border" value={(form as any).lat ?? ""} onChange={(e) => setForm((f) => ({ ...f, lat: (e.target.value as any) }))} />
            </label>
            <label className="block text-sm">Longitude
              <input className="mt-1 w-full px-3 py-2 rounded-xl border" value={(form as any).lng ?? ""} onChange={(e) => setForm((f) => ({ ...f, lng: (e.target.value as any) }))} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-3 py-2 rounded-xl border" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="px-3 py-2 rounded-xl bg-neutral-900 text-white" onClick={onSave}>Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   4) Curation – uniqueness + badges + realtime updates
---------------------------------------------------------------------------- */
function CurationTab() {
  const qc = useQueryClient();
  const toast = useToast();

  const [muni, setMuni] = useState<number | "all">("all");
  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const dishesQ = useQuery({ queryKey: ["dishes", muni], queryFn: () => listDishes({ municipalityId: muni === "all" ? undefined : muni as number }) });
  const restsQ = useQuery({ queryKey: ["restaurants", muni], queryFn: () => listRestaurants({ municipalityId: muni === "all" ? undefined : muni as number }) });

  const ensureUniqueRank = async<T extends { id: number }>(items: T[], key: keyof any, rank: number, targetId: number, clear: (id: number) => Promise<any>) => {
    const conflict = items.find((x: any) => x[key] === rank && x.id !== targetId);
    if (conflict) {
      const ok = await useConfirm()(`Replace "${(conflict as any).name}" at Top ${rank}?`);
      if (!ok) return false;
      await clear(conflict.id);
    }
    return true;
  };

  const setDishRank = async (d: Dish, rank: number | null) => {
    const items = (dishesQ.data ?? []) as Dish[];
    if (rank && !(await ensureUniqueRank(items, "panel_rank", rank, d.id, (id) => setDishCuration(id, { panel_rank: null, is_signature: 0 })))) return;
    await qc.setQueryData(["dishes", muni], (old: any) => (old ?? []).map((x: Dish) => x.id === d.id ? { ...x, panel_rank: rank, is_signature: rank ? 1 : 0 } : x));
    await setDishCuration(d.id, { panel_rank: rank, is_signature: rank ? 1 : 0 });
    qc.invalidateQueries({ queryKey: ["dishes"] });
    toast("Dish rank updated");
  };

  const setRestRank = async (r: Restaurant, rank: number | null) => {
    const items = (restsQ.data ?? []) as Restaurant[];
    if (rank && !(await ensureUniqueRank(items, "featured_rank", rank, r.id, (id) => setRestaurantCuration(id, { featured_rank: null, featured: 0 })))) return;
    await qc.setQueryData(["restaurants", muni], (old: any) => (old ?? []).map((x: Restaurant) => x.id === r.id ? { ...x, featured_rank: rank, featured: rank ? 1 : 0 } : x));
    await setRestaurantCuration(r.id, { featured_rank: rank, featured: rank ? 1 : 0 });
    qc.invalidateQueries({ queryKey: ["restaurants"] });
    toast("Restaurant rank updated");
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold">Top Dishes</h3>
          <select className="ml-auto border rounded px-2 py-1 text-sm" value={muni} onChange={(e) => setMuni(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">All municipalities</option>
            {(muniQ.data ?? []).map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
          {(dishesQ.data ?? []).map((d) => (
            <div key={d.id} className="border rounded-xl p-3">
              <div className="font-medium">{d.name}</div>
              <div className="mt-2 flex items-center gap-2">
                {[1,2,3].map((rank) => (
                  <button key={rank} className={cx("px-2 py-1 text-xs rounded border", d.panel_rank === rank && "bg-neutral-900 text-white")} onClick={() => setDishRank(d, d.panel_rank === rank ? null : rank)}>Top {rank}</button>
                ))}
                <button className="px-2 py-1 text-xs rounded border" onClick={() => setDishRank(d, null)}>Clear</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold">Top Restaurants</h3>
          <select className="ml-auto border rounded px-2 py-1 text-sm" value={muni} onChange={(e) => setMuni(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">All municipalities</option>
            {(muniQ.data ?? []).map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
          {(restsQ.data ?? []).map((r) => (
            <div key={r.id} className="border rounded-xl p-3">
              <div className="font-medium">{r.name}</div>
              <div className="mt-2 flex items-center gap-2">
                {[1,2,3].map((rank) => (
                  <button key={rank} className={cx("px-2 py-1 text-xs rounded border", (r as any).featured_rank === rank && "bg-neutral-900 text-white")} onClick={() => setRestRank(r, (r as any).featured_rank === rank ? null : rank)}>Top {rank}</button>
                ))}
                <button className="px-2 py-1 text-xs rounded border" onClick={() => setRestRank(r, null)}>Clear</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   5) Linking – search, filters, selected highlight, linked-first
---------------------------------------------------------------------------- */
function LinkingTab() {
  const toast = useToast();
  const confirm = useConfirm();

  const [qDish, setQDish] = useState("");
  const [qRest, setQRest] = useState("");
  const [selDish, setSelDish] = useState<Dish | null>(null);
  const [filterMuni, setFilterMuni] = useState<number | null>(null);

  const muniQ = useQuery({ queryKey: ["munis"], queryFn: listMunicipalities, staleTime: 300_000 });
  const dishesQ = useQuery({ queryKey: ["dishes", qDish], queryFn: () => listDishes({ q: qDish }) });
  const restsQ = useQuery({ queryKey: ["rests", qRest, filterMuni], queryFn: () => listRestaurants({ q: qRest, municipalityId: filterMuni ?? undefined }) });

  const linkedQ = useQuery({
    queryKey: ["linked-rests", selDish?.id],
    enabled: !!selDish,
    retry: false,
    queryFn: () => (selDish ? listRestaurantsForDish(selDish.id) : Promise.resolve([])),
  });

  
  const linkM = useMutation({
    mutationFn: ({ dish_id, restaurant_id }: { dish_id: number; restaurant_id: number }) => linkDishRestaurant(dish_id, restaurant_id),
    onSuccess: () => linkedQ.refetch()
  });
  const unlinkM = useMutation({
    mutationFn: ({ dish_id, restaurant_id }: { dish_id: number; restaurant_id: number }) => unlinkDishRestaurant(dish_id, restaurant_id),
    onSuccess: () => linkedQ.refetch()
  });

  const linkedIds = new Set((linkedQ.data ?? []).map((r: any) => r.id ?? r.restaurant_id ?? r));
  const restaurantsRaw = restsQ.data ?? [];
  const restaurants = useMemo(() => {
    const arr = [...restaurantsRaw];
    arr.sort((a: any, b: any) => {
      const A = linkedIds.has(a.id) ? 0 : 1;
      const B = linkedIds.has(b.id) ? 0 : 1;
      if (A !== B) return A - B;
      return String(a.name).localeCompare(String(b.name));
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
              {(muniQ.data ?? []).map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </div>
          <div className="max-h-[60vh] overflow-auto space-y-2">
            {(dishesQ.data ?? []).map((d) => (
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
                {restaurants.map((r) => {
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
                            <button onClick={() => linkM.mutate({ dish_id: selDish!.id, restaurant_id: r.id })} disabled={linkM.isPending} className="px-3 py-1.5 rounded border">Link</button>
                          ) : (
                            <button className="px-3 py-1.5 rounded border text-red-600" onClick={async () => { if (await useConfirm()("Unlink?")) unlinkM.mutate({ dish_id: selDish!.id, restaurant_id: r.id }); }} disabled={unlinkM.isPending}>Unlink</button>
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

/* ----------------------------------------------------------------------------
   Main shell with tabs
---------------------------------------------------------------------------- */
export default function AdminDashboard() {
  const [tab, setTab] = useState<"analytics" | "dishes" | "restaurants" | "curation" | "linking">("analytics");
  return (
    <Toaster>
      <ConfirmProvider>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-4"><h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1><div className="text-sm text-neutral-500">Bulacan – Mapping Flavors</div></div>
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              ["analytics","Analytics"],
              ["dishes","Dishes"],
              ["restaurants","Restaurants"],
              ["curation","Curation"],
              ["linking","Linking"],
            ] as const).map(([v, l]) => (
              <button key={v} className={cx("px-3 py-1.5 rounded border text-sm", tab === v ? "bg-neutral-900 text-white" : "bg-white")} onClick={() => setTab(v as any)}>
                {l}
              </button>
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
