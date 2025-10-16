// src/pages/admin/AdminDashboard.tsx (adapter follows your existing src/utils/adminApi.ts)
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import * as AdminAPI from "../../utils/adminApi"; // ← we will adapt to whatever names you already export

// ----------------------------------------------------------------------------------
// Adapter that ONLY calls your existing adminApi exports (no server hits here)
// – Works with common function names without forcing you to change adminApi.ts
// ----------------------------------------------------------------------------------
type AnyAPI = typeof AdminAPI & Record<string, any>;
const A = AdminAPI as AnyAPI;

const api = {
  // Lists
  municipalities: () => (A.listMunicipalities ?? A.getMunicipalities ?? A.fetchMunicipalities)?.(),
  dishes: (opts: any) => (A.listDishes ?? A.getDishes ?? A.fetchDishes)?.(opts ?? {}),
  restaurants: (opts: any) => (A.listRestaurants ?? A.getRestaurants ?? A.fetchRestaurants)?.(opts ?? {}),

  // Analytics
  analyticsSummary: () => (A.getAnalyticsSummary ?? A.analyticsSummary ?? A.getAdminAnalyticsSummary)?.(),
  analyticsPerMunicipality: () => (A.getPerMunicipalityCounts ?? A.analyticsPerMunicipality ?? A.getAnalyticsPerMunicipality)?.(),

  // Linking (dish ↔ restaurant)
  linkedRestaurantsForDish: (dishId: number) => (A.listRestaurantsForDish ?? A.getRestaurantsForDish ?? A.getDishRestaurants ?? A.getLinksByDish)?.(dishId),
  link: (dishId: number, restaurantId: number) => {
    const f = A.linkDishRestaurant ?? A.link;
    if (!f) throw new Error("adminApi.linkDishRestaurant is missing");
    try { return f({ dish_id: dishId, restaurant_id: restaurantId }); } catch {}
    try { return f({ dishId, restaurantId }); } catch {}
    return f(dishId, restaurantId);
  },
  unlink: (dishId: number, restaurantId: number) => {
    const f = A.unlinkDishRestaurant ?? A.unlink;
    if (!f) throw new Error("adminApi.unlinkDishRestaurant is missing");
    try { return f({ dish_id: dishId, restaurant_id: restaurantId }); } catch {}
    try { return f({ dishId, restaurantId }); } catch {}
    return f(dishId, restaurantId);
  },

  // Curation
  setDishCuration: (id: number, payload: any) => (A.setDishCuration ?? A.curateDish ?? A.updateDish)?.(id, payload),
  setRestaurantCuration: (id: number, payload: any) => (A.setRestaurantCuration ?? A.curateRestaurant ?? A.updateRestaurant)?.(id, payload),

  // Mutations
  createDish: (p: any) => (A.createDish ?? A.addDish)?.(p),
  updateDish: (id: number, p: any) => (A.updateDish ?? A.patchDish)?.(id, p),
  deleteDish: (id: number) => (A.deleteDish ?? A.removeDish)?.(id),

  createRestaurant: (p: any) => (A.createRestaurant ?? A.addRestaurant)?.(p),
  updateRestaurant: (id: number, p: any) => (A.updateRestaurant ?? A.patchRestaurant)?.(id, p),
  deleteRestaurant: (id: number) => (A.deleteRestaurant ?? A.removeRestaurant)?.(id),

  // helpers
  slugify: (A.slugify as (s: string)=>string) ?? ((s: string) => s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-")),
  coerceStringArray: (A.coerceStringArray as (x:any)=>string[]|null) ?? ((x:any)=> Array.isArray(x) ? x.map(String) : String(x||"").split(",").map(s=>s.trim()).filter(Boolean)),
};

// ----------------------------------------------------------------------------------
// UI Helpers: toasts, confirm, modal, chart shell
// ----------------------------------------------------------------------------------
const ToastCtx = React.createContext<(msg: string) => void>(() => {});
const ConfirmCtx = React.createContext<(msg: string) => Promise<boolean>>(() => Promise.resolve(false));
const useToast = () => React.useContext(ToastCtx);
const useConfirm = () => React.useContext(ConfirmCtx);

function Toaster({ children }: { children: React.ReactNode }) {
  const [list, setList] = React.useState<{ id: number; msg: string }[]>([]);
  const push = (msg: string) => { const id = Date.now() + Math.random(); setList(l => [...l, { id, msg }]); setTimeout(()=> setList(l => l.filter(t => t.id!==id)), 2400); };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-[70]">
        {list.map(t => <div key={t.id} className="px-3 py-2 rounded-md bg-neutral-900 text-white shadow">{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ msg: string; res?: (v: boolean) => void } | null>(null);
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

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
const clamp = (n: any, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n))));

function ChartShell({ children, height = 420 }: { children: React.ReactNode; height?: number }) {
  const [k, setK] = React.useState(0);
  React.useEffect(()=>{ const id = setTimeout(()=> setK(1), 60); return ()=> clearTimeout(id); },[]);
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
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[75] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl" onClick={(e)=>e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between"><h3 className="font-semibold">{title}</h3><button className="text-sm" onClick={onClose}>✕</button></div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------
// Analytics Tab – follows your adminApi's analytics functions
// ----------------------------------------------------------------------------------
function AnalyticsTab() {
  const [chart, setChart] = React.useState<"bar"|"line"|"pie">("bar");
  const [stacked, setStacked] = React.useState(false);

  const summaryQ = useQuery({ queryKey: ["analytics:summary"], queryFn: api.analyticsSummary });
  const perMuniQ = useQuery({ queryKey: ["analytics:per-muni"], queryFn: api.analyticsPerMunicipality });

  const s: any = summaryQ.data || {};
  const per: any[] = Array.isArray(perMuniQ.data) ? perMuniQ.data : [];

  const cards = [
    { label: "Dishes", value: s.dishes ?? s.dish_count ?? 0 },
    { label: "Restaurants", value: s.restaurants ?? s.restaurant_count ?? 0 },
    { label: "Municipalities", value: s.municipalities ?? s.municipality_count ?? 0 },
  ];

  const chartData = per.map((r: any) => ({
    name: r.municipality_name ?? r.municipality ?? r.name ?? r.slug,
    dishes: r.dishes ?? r.dish_count ?? 0,
    restaurants: r.restaurants ?? r.restaurant_count ?? 0,
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

      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Per-municipality totals</h4>
        <div className="flex gap-1">
          {["bar","line","pie"].map(t => (
            <button key={t} onClick={()=>setChart(t as any)} className={cx("px-3 py-1.5 rounded border text-sm", chart===t?"bg-neutral-900 text-white":"bg-white")}>{t}</button>
          ))}
          {chart === "bar" && (
            <button onClick={()=>setStacked(s=>!s)} className={cx("px-3 py-1.5 rounded border text-sm", stacked && "bg-neutral-900 text-white")}>{stacked?"Unstack":"Stack"}</button>
          )}
        </div>
      </div>

      {perMuniQ.isLoading || summaryQ.isLoading ? (
        <div className="h-[440px] rounded-xl bg-neutral-100 animate-pulse" />
      ) : chart === "pie" ? (
        <ChartShell height={440}>
          <PieChart>
            <Tooltip /><Legend />
            <Pie dataKey="dishes" nameKey="name" data={chartData} outerRadius={110} />
            <Pie dataKey="restaurants" nameKey="name" data={chartData} innerRadius={120} outerRadius={160} />
          </PieChart>
        </ChartShell>
      ) : chart === "line" ? (
        <ChartShell height={440}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" hide /><YAxis /><Tooltip /><Legend />
            <Line type="monotone" dataKey="dishes" />
            <Line type="monotone" dataKey="restaurants" />
          </LineChart>
        </ChartShell>
      ) : (
        <ChartShell height={440}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" hide /><YAxis /><Tooltip /><Legend />
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

// ----------------------------------------------------------------------------------
// Dishes Tab
// ----------------------------------------------------------------------------------
const emptyDish = { name: "", slug: "", municipality_id: 0, category: "food", rating: null as number | null, popularity: null as number | null };
function DishesTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [q, setQ] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [form, setForm] = React.useState<any>(emptyDish);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const muniQ = useQuery({ queryKey: ["municipalities"], queryFn: api.municipalities });
  const dishesQ = useQuery({ queryKey: ["dishes", q], queryFn: () => api.dishes({ q }) });

  const createM = useMutation({ mutationFn: (payload: any) => api.createDish(payload), onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setEditOpen(false); toast("Dish created"); }, onError: (e:any)=> setServerError(String(e.message||e)) });
  const updateM = useMutation({ mutationFn: ({ id, payload }: any) => api.updateDish(id, payload), onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); setEditOpen(false); toast("Dish saved"); }, onError: (e:any)=> setServerError(String(e.message||e)) });
  const deleteM = useMutation({ mutationFn: (id: number) => api.deleteDish(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["dishes"] }); toast("Dish deleted"); } });

  const setName = (name: string) => setForm((f:any)=> ({ ...f, name, slug: f.slug || api.slugify(name) }));
  const isValid = () => {
    const errs: Record<string,string> = {};
    if (!form.name) errs.name = "Name is required.";
    if (!form.slug) errs.slug = "Slug is required.";
    if (!form.municipality_id) errs.municipality_id = "Select a municipality.";
    if (form.rating != null) { const r = clamp(form.rating,1,5); if (r<1 || r>5) errs.rating = "Rating 1–5"; }
    if (form.popularity != null) { const p = clamp(form.popularity,0,100); if (p<0 || p>100) errs.popularity = "Popularity 0–100"; }
    (form as any)._errors = errs; return Object.keys(errs).length===0;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search dishes…" className="px-3 py-2 rounded-xl border w-full md:w-72" />
        <button className="ml-auto px-3 py-2 rounded-xl border" onClick={()=>{ setForm(emptyDish); setServerError(null); setEditOpen(true); }}>+ New Dish</button>
      </div>

      {dishesQ.isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({length:6}).map((_,i)=>(<div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse"/>))}</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(dishesQ.data || []).map((d:any)=> (
            <div key={d.id} className="border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{d.name}</div>
                {d.is_signature ? <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white">Signature</span> : null}
                {d.panel_rank ? <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-900 text-white">Top {d.panel_rank}</span> : null}
              </div>
              <div className="text-xs text-neutral-500">{d.slug}</div>
              <div className="mt-2 flex gap-2">
                <button className="px-3 py-1.5 rounded border" onClick={()=>{ setForm({ ...d }); setEditOpen(true); }}>Edit</button>
                <button className="px-3 py-1.5 rounded border text-red-600" onClick={async()=>{ if (await useConfirm()("Delete?")) deleteM.mutate(d.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title={(form as any).id?"Edit Dish":"New Dish"}>
        <div className="space-y-3">
          {serverError && <div className="text-sm text-red-600">{serverError}</div>}
          <label className="block text-sm">Name<input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.name||""} onChange={(e)=>setName(e.target.value)} /></label>
          <label className="block text-sm">Slug<input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.slug||""} onChange={(e)=>setForm((f:any)=>({...f,slug:e.target.value}))} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Municipality<select className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.municipality_id??0} onChange={(e)=>setForm((f:any)=>({...f,municipality_id:Number(e.target.value)}))}>
              <option value={0} disabled>Choose…</option>
              {(useQuery({queryKey:["municipalities"],queryFn:api.municipalities}).data||[]).map((m:any)=>(<option key={m.id} value={m.id}>{m.name}</option>))}
            </select></label>
            <label className="block text-sm">Category<select className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.category??"food"} onChange={(e)=>setForm((f:any)=>({...f,category:e.target.value}))}>
              <option value="food">Food</option><option value="delicacy">Delicacy</option><option value="drink">Drink</option>
            </select></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Rating (1–5)<input type="number" min={1} max={5} step={1} className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.rating??""} onChange={(e)=>setForm((f:any)=>({...f,rating:e.target.value===""?null:clamp(e.target.value,1,5)}))} /></label>
            <label className="block text-sm">Popularity (0–100)<input type="number" min={0} max={100} step={1} className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.popularity??""} onChange={(e)=>setForm((f:any)=>({...f,popularity:e.target.value===""?null:clamp(e.target.value,0,100)}))} /></label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setEditOpen(false)}>Cancel</button>
            <button className="px-3 py-2 rounded-xl bg-neutral-900 text-white" onClick={()=>{ if (!isValid()) return; const payload={...form}; if (form.id) updateM.mutate({ id: form.id, payload }); else createM.mutate(payload); }}>Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ----------------------------------------------------------------------------------
// Restaurants Tab (mirrors dishes)
// ----------------------------------------------------------------------------------
const emptyRest = { name: "", slug: "", municipality_id: 0, address: "", lat: 0, lng: 0, rating: null as number | null };
function RestaurantsTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [q, setQ] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [form, setForm] = React.useState<any>(emptyRest);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const muniQ = useQuery({ queryKey: ["municipalities"], queryFn: api.municipalities });
  const restsQ = useQuery({ queryKey: ["restaurants", q], queryFn: () => api.restaurants({ q }) });

  const createM = useMutation({ mutationFn: (p:any)=> api.createRestaurant(p), onSuccess:()=>{ qc.invalidateQueries({queryKey:["restaurants"]}); setEditOpen(false); toast("Restaurant created"); }, onError:(e:any)=> setServerError(String(e.message||e)) });
  const updateM = useMutation({ mutationFn: ({id,p}:{id:number,p:any})=> api.updateRestaurant(id,p), onSuccess:()=>{ qc.invalidateQueries({queryKey:["restaurants"]}); setEditOpen(false); toast("Restaurant saved"); }, onError:(e:any)=> setServerError(String(e.message||e)) });
  const deleteM = useMutation({ mutationFn: (id:number)=> api.deleteRestaurant(id), onSuccess:()=>{ qc.invalidateQueries({queryKey:["restaurants"]}); toast("Restaurant deleted"); } });

  const setName = (name: string) => setForm((f:any)=> ({ ...f, name, slug: f.slug || api.slugify(name) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search restaurants…" className="px-3 py-2 rounded-xl border w-full md:w-72" />
        <button className="ml-auto px-3 py-2 rounded-xl border" onClick={()=>{ setForm(emptyRest); setServerError(null); setEditOpen(true); }}>+ New Restaurant</button>
      </div>

      {restsQ.isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({length:6}).map((_,i)=>(<div key={i} className="h-24 rounded-xl bg-neutral-100 animate-pulse"/>))}</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(restsQ.data || []).map((r:any)=> (
            <div key={r.id} className="border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{r.name}</div>
                {r.featured ? <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">Featured</span> : null}
                {r.featured_rank ? <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-900 text-white">Top {r.featured_rank}</span> : null}
              </div>
              <div className="text-xs text-neutral-500">{r.slug}</div>
              <div className="mt-2 flex gap-2">
                <button className="px-3 py-1.5 rounded border" onClick={()=>{ setForm({ ...r }); setEditOpen(true); }}>Edit</button>
                <button className="px-3 py-1.5 rounded border text-red-600" onClick={async()=>{ if (await useConfirm()("Delete?")) deleteM.mutate(r.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title={(form as any).id?"Edit Restaurant":"New Restaurant"}>
        <div className="space-y-3">
          {serverError && <div className="text-sm text-red-600">{serverError}</div>}
          <label className="block text-sm">Name<input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.name||""} onChange={(e)=>setName(e.target.value)} /></label>
          <label className="block text-sm">Slug<input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.slug||""} onChange={(e)=>setForm((f:any)=>({...f,slug:e.target.value}))} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Municipality<select className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.municipality_id??0} onChange={(e)=>setForm((f:any)=>({...f,municipality_id:Number(e.target.value)}))}>
              <option value={0} disabled>Choose…</option>
              {(muniQ.data||[]).map((m:any)=>(<option key={m.id} value={m.id}>{m.name}</option>))}
            </select></label>
            <label className="block text-sm">Rating (1–5)<input type="number" min={1} max={5} step={1} className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.rating??""} onChange={(e)=>setForm((f:any)=>({...f,rating:e.target.value===""?null:clamp(e.target.value,1,5)}))} /></label>
          </div>
          <label className="block text-sm">Address<input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.address||""} onChange={(e)=>setForm((f:any)=>({...f,address:e.target.value}))} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Latitude<input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.lat??""} onChange={(e)=>setForm((f:any)=>({...f,lat:e.target.value}))} /></label>
            <label className="block text-sm">Longitude<input className="mt-1 w-full px-3 py-2 rounded-xl border" value={form.lng??""} onChange={(e)=>setForm((f:any)=>({...f,lng:e.target.value}))} /></label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setEditOpen(false)}>Cancel</button>
            <button className="px-3 py-2 rounded-xl bg-neutral-900 text-white" onClick={()=>{ const p={...form}; if (form.id) updateM.mutate({id:form.id,p}); else createM.mutate(p); }}>Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ----------------------------------------------------------------------------------
// Curation Tab – enforce unique ranks per municipality
// ----------------------------------------------------------------------------------
function CurationTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [muni, setMuni] = React.useState<number | "all">("all");
  const muniQ = useQuery({ queryKey: ["municipalities"], queryFn: api.municipalities });
  const dishesQ = useQuery({ queryKey: ["dishes", { muni }], queryFn: () => api.dishes({ municipalityId: muni === "all" ? undefined : muni }) });
  const restsQ = useQuery({ queryKey: ["restaurants", { muni }], queryFn: () => api.restaurants({ municipalityId: muni === "all" ? undefined : muni }) });

  const setDishRank = async (d: any, rank: number | null) => {
    const items = (dishesQ.data || []) as any[];
    const conflict = rank ? items.find(x => x.panel_rank === rank && x.id !== d.id) : null;
    if (conflict) {
      const ok = await useConfirm()(`Replace "${conflict.name}" with "${d.name}" at Top ${rank}?`);
      if (!ok) return;
      await api.setDishCuration(conflict.id, { panel_rank: null, is_signature: 0 });
    }
    await qc.setQueryData(["dishes", { muni }], (old:any)=> (old||[]).map((x:any)=> x.id===d.id?{...x,panel_rank:rank,is_signature:rank?1:0}:x));
    await api.setDishCuration(d.id, { panel_rank: rank, is_signature: rank ? 1 : 0 });
    qc.invalidateQueries({ queryKey: ["dishes"] });
  };

  const setRestRank = async (r: any, rank: number | null) => {
    const items = (restsQ.data || []) as any[];
    const conflict = rank ? items.find(x => x.featured_rank === rank && x.id !== r.id) : null;
    if (conflict) {
      const ok = await useConfirm()(`Replace "${conflict.name}" with "${r.name}" at Top ${rank}?`);
      if (!ok) return;
      await api.setRestaurantCuration(conflict.id, { featured_rank: null, featured: 0 });
    }
    await qc.setQueryData(["restaurants", { muni }], (old:any)=> (old||[]).map((x:any)=> x.id===r.id?{...x,featured_rank:rank,featured:rank?1:0}:x));
    await api.setRestaurantCuration(r.id, { featured_rank: rank, featured: rank ? 1 : 0 });
    qc.invalidateQueries({ queryKey: ["restaurants"] });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold">Top Dishes</h3>
          <select className="ml-auto border rounded px-2 py-1 text-sm" value={muni} onChange={(e)=> setMuni(e.target.value==="all"?"all":Number(e.target.value))}>
            <option value="all">All municipalities</option>
            {(muniQ.data||[]).map((m:any)=>(<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
          {(dishesQ.data||[]).map((d:any)=> (
            <div key={d.id} className="border rounded-xl p-3">
              <div className="font-medium">{d.name}</div>
              <div className="mt-2 flex items-center gap-2">
                {[1,2,3].map((rank)=> (
                  <button key={rank} className={cx("px-2 py-1 text-xs rounded border", d.panel_rank===rank && "bg-neutral-900 text-white")} onClick={()=> setDishRank(d, d.panel_rank===rank?null:rank)}>Top {rank}</button>
                ))}
                <button className="px-2 py-1 text-xs rounded border" onClick={()=> setDishRank(d, null)}>Clear</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold">Top Restaurants</h3>
          <select className="ml-auto border rounded px-2 py-1 text-sm" value={muni} onChange={(e)=> setMuni(e.target.value==="all"?"all":Number(e.target.value))}>
            <option value="all">All municipalities</option>
            {(muniQ.data||[]).map((m:any)=>(<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
          {(restsQ.data||[]).map((r:any)=> (
            <div key={r.id} className="border rounded-2xl p-3">
              <div className="font-medium">{r.name}</div>
              <div className="mt-2 flex items-center gap-2">
                {[1,2,3].map((rank)=> (
                  <button key={rank} className={cx("px-2 py-1 text-xs rounded border", r.featured_rank===rank && "bg-neutral-900 text-white")} onClick={()=> setRestRank(r, r.featured_rank===rank?null:rank)}>Top {rank}</button>
                ))}
                <button className="px-2 py-1 text-xs rounded border" onClick={()=> setRestRank(r, null)}>Clear</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------
// Linking Tab – honors your adminApi linking signatures
// ----------------------------------------------------------------------------------
function LinkingTab() {
  const [qDish, setQDish] = React.useState("");
  const [qRest, setQRest] = React.useState("");
  const [dishId, setDishId] = React.useState<number | null>(null);
  const [muni, setMuni] = React.useState<number | "all">("all");

  const muniQ = useQuery({ queryKey: ["municipalities"], queryFn: api.municipalities });
  const dishesQ = useQuery({ queryKey: ["dishes", { qDish, muni }], queryFn: () => api.dishes({ q: qDish, municipalityId: muni === "all" ? undefined : muni }) });
  const restsQ = useQuery({ queryKey: ["restaurants", { qRest, muni }], queryFn: () => api.restaurants({ q: qRest, municipalityId: muni === "all" ? undefined : muni }) });

  const linksQ = useQuery({ queryKey: ["links", dishId], enabled: !!dishId, queryFn: () => api.linkedRestaurantsForDish!(dishId!) });

  const linkM = useMutation({ mutationFn: ({ dishId, restaurantId }: { dishId: number; restaurantId: number }) => api.link(dishId, restaurantId), onSuccess: () => linksQ.refetch() });
  const unlinkM = useMutation({ mutationFn: ({ dishId, restaurantId }: { dishId: number; restaurantId: number }) => api.unlink(dishId, restaurantId), onSuccess: () => linksQ.refetch() });

  const linkedIds = new Set((linksQ.data || []).map((r:any)=> r.id ?? r.restaurant_id ?? r));
  const sorted = React.useMemo(()=>{
    const arr = [ ...(restsQ.data || []) ];
    arr.sort((a:any,b:any)=>{ const A=linkedIds.has(a.id)?0:1, B=linkedIds.has(b.id)?0:1; if (A!==B) return A-B; return String(a.name).localeCompare(String(b.name)); });
    return arr;
  }, [restsQ.data, linksQ.data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="lg:w-1/2 bg-white rounded-xl border p-3">
          <div className="flex items-center gap-2 mb-2">
            <input value={qDish} onChange={(e)=>setQDish(e.target.value)} placeholder="Search dishes…" className="px-3 py-2 rounded-xl border w-full" />
            <select className="px-3 py-2 rounded-xl border" value={muni} onChange={(e)=> setMuni(e.target.value==="all"?"all":Number(e.target.value))}>
              <option value="all">All muni</option>
              {(muniQ.data||[]).map((m:any)=>(<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </div>
          <div className="h-[360px] overflow-auto space-y-2">
            {(dishesQ.data||[]).map((d:any)=> (
              <button key={d.id} className={cx("w-full text-left px-3 py-2 rounded-xl border", dishId===d.id?"bg-neutral-900 text-white":"bg-white")} onClick={()=> setDishId(d.id)}>
                <div className="font-medium">{d.name}</div>
                <div className="text-xs opacity-70">{d.slug}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:w-1/2 bg-white rounded-xl border p-3">
          {!dishId ? <div className="text-sm text-neutral-500">Pick a dish.</div> : (
            <>
              <div className="flex items-center gap-2 mb-2"><input value={qRest} onChange={(e)=>setQRest(e.target.value)} placeholder="Search restaurants…" className="px-3 py-2 rounded-xl border w-full" /></div>
              <div className="h-[360px] overflow-auto space-y-2">
                {sorted.map((r:any)=>{
                  const isLinked = linkedIds.has(r.id);
                  return (
                    <div key={r.id} className={cx("border rounded-xl p-3 transition", isLinked?"border-neutral-900 bg-neutral-50":"hover:bg-neutral-50") }>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs opacity-70">{r.slug}</div>
                        </div>
                        <div className="flex gap-2">
                          {!isLinked ? (
                            <button className="px-3 py-1.5 rounded border" onClick={()=> linkM.mutate({ dishId: dishId!, restaurantId: r.id })}>Link</button>
                          ) : (
                            <button className="px-3 py-1.5 rounded border" onClick={()=> unlinkM.mutate({ dishId: dishId!, restaurantId: r.id })}>Unlink</button>
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

// ----------------------------------------------------------------------------------
// Main Shell
// ----------------------------------------------------------------------------------
export default function AdminDashboard() {
  const [tab, setTab] = React.useState<"analytics"|"dishes"|"restaurants"|"curation"|"linking">("analytics");
  return (
    <Toaster>
      <ConfirmProvider>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-4"><h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1><div className="text-sm text-neutral-500">Bulacan – Mapping Flavors (admin)</div></div>
          <div className="flex flex-wrap gap-2 mb-4">{([
            ["analytics","Analytics"],["dishes","Dishes"],["restaurants","Restaurants"],["curation","Curation"],["linking","Linking"],
          ] as const).map(([v,l])=> (<button key={v} className={cx("px-3 py-1.5 rounded border text-sm", tab===v?"bg-neutral-900 text-white":"bg-white")} onClick={()=> setTab(v as any)}>{l}</button>))}</div>
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
