import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listMunicipalities, listDishes, listRestaurants,
  createDish, updateDish, deleteDish,
  createRestaurant, updateRestaurant, deleteRestaurant,
  linkedRestaurantsForDish, linkDishRestaurant, unlinkDishRestaurant,
  setDishCuration, setRestaurantCuration,
  getAnalyticsSummary, type Municipality, type Dish, type Restaurant
} from "../../utils/adminApi";

function Section({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="rounded border bg-white p-3">{children}</div>
    </section>
  );
}

export default function AdminDashboard() {
  const qc = useQueryClient();

  // shared filters
  const muniQ = useQuery({ queryKey: ["muni"], queryFn: listMunicipalities, staleTime: 300000 });
  const [muniId, setMuniId] = useState<number|undefined>(undefined);

  // ----- DISHES -----
  const [dishQStr, setDishQStr] = useState("");
  const dishesQ = useQuery({
    queryKey: ["dishes", { muniId, dishQStr }],
    queryFn: () => listDishes({ municipalityId: muniId, q: dishQStr }),
    staleTime: 30_000,
  });

  const [editingDish, setEditingDish] = useState<Partial<Dish> | null>(null);
  const dishCreate = useMutation({
    mutationFn: createDish,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dishes"] }),
  });
  const dishUpdate = useMutation({
    mutationFn: ({ id, data }: { id:number; data:Partial<Dish> }) => updateDish(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dishes"] }),
  });
  const dishDelete = useMutation({
    mutationFn: (id:number) => deleteDish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dishes"] }),
  });

  // ----- RESTAURANTS -----
  const [restQStr, setRestQStr] = useState("");
  const restaurantsQ = useQuery({
    queryKey: ["rests", { muniId, restQStr }],
    queryFn: () => listRestaurants({ municipalityId: muniId, q: restQStr }),
    staleTime: 30_000,
  });

  const [editingRest, setEditingRest] = useState<Partial<Restaurant> | null>(null);
  const restCreate = useMutation({
    mutationFn: createRestaurant,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rests"] }),
  });
  const restUpdate = useMutation({
    mutationFn: ({ id, data }: { id:number; data:Partial<Restaurant> }) => updateRestaurant(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rests"] }),
  });
  const restDelete = useMutation({
    mutationFn: (id:number) => deleteRestaurant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rests"] }),
  });

  // ----- LINKING (by dish) -----
  const [linkDishSel, setLinkDishSel] = useState<number|undefined>(undefined);
  const linkedRestsQ = useQuery({
    queryKey: ["linkedR", linkDishSel],
    queryFn: () => linkedRestaurantsForDish(linkDishSel!),
    enabled: !!linkDishSel,
  });
  const linkedSet = new Set((linkedRestsQ.data ?? []).map(r => r.id));
  const linkMut = useMutation({
    mutationFn: ({ dish_id, restaurant_id, mode }: { dish_id:number; restaurant_id:number; mode: "link"|"unlink" }) =>
      mode === "link"
        ? linkDishRestaurant(dish_id, restaurant_id)
        : unlinkDishRestaurant(dish_id, restaurant_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["linkedR"] }),
  });

  // ----- ANALYTICS -----
  const analyticsQ = useQuery({ queryKey:["an"], queryFn: getAnalyticsSummary, staleTime: 30_000 });

  /* ==================== CURATION ==================== */
  // local helpers to enforce max 3 in UI
  const curDishList = useMemo(
    () => (dishesQ.data ?? []).filter(d => (muniId ? d.municipality_id === muniId : true)),
    [dishesQ.data, muniId]
  );
  const curRestList = useMemo(
    () => (restaurantsQ.data ?? []).filter(r => (muniId ? r.municipality_id === muniId : true)),
    [restaurantsQ.data, muniId]
  );

  const curTopDishes = useMemo(
    () => curDishList.filter(d => (d.is_signature ?? 0) === 1).sort((a,b)=> (a.panel_rank??999) - (b.panel_rank??999)).slice(0,3),
    [curDishList]
  );
  const curTopRests = useMemo(
    () => curRestList.filter(r => (r.featured ?? 0) === 1).sort((a,b)=> (a.featured_rank??999) - (b.featured_rank??999)).slice(0,3),
    [curRestList]
  );

  const dishCuration = useMutation({
    mutationFn: ({ id, is_signature, panel_rank }: { id:number; is_signature:0|1|null; panel_rank:number|null }) =>
      setDishCuration(id, { is_signature, panel_rank }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dishes"] }),
  });

  const [restaurantCurationError, setRestaurantCurationError] = useState<string | null>(null);
  const restCuration = useMutation({
    mutationFn: async ({ id, featured, featured_rank }: { id:number; featured:0|1|null; featured_rank:number|null }) => {
      setRestaurantCurationError(null);
      return setRestaurantCuration(id, { featured, featured_rank });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rests"] }),
    onError: (err:any) => {
      const msg = String(err?.message || err);
      if (msg.includes("MISSING_COLUMNS")) {
        setRestaurantCurationError("Restaurant curation columns missing. Add 'featured' TINYINT and 'featured_rank' INT to restaurants table.");
      } else {
        setRestaurantCurationError("Failed to update restaurant curation.");
      }
    }
  });

  function nextFreeRank(taken: (number|null|undefined)[]) {
    for (let r=1; r<=3; r++) if (!taken.includes(r)) return r;
    return null;
  }

  /* ================================================== */

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard (no login)</h1>

      {/* GLOBAL FILTER */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm">Municipality:</label>
        <select
          className="border rounded px-2 py-1"
          value={muniId ?? ""}
          onChange={(e)=> setMuniId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All</option>
          {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
        </select>
      </div>

      {/* ANALYTICS */}
      <Section title="Analytics">
        {analyticsQ.isLoading ? <div>Loading…</div> : analyticsQ.isError ? <div className="text-red-600">Failed to load analytics</div> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded border p-3">
              <div className="text-sm text-neutral-500">Total dishes</div>
              <div className="text-2xl font-semibold">{analyticsQ.data!.counts.dishes}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-sm text-neutral-500">Total restaurants</div>
              <div className="text-2xl font-semibold">{analyticsQ.data!.counts.restaurants}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-sm text-neutral-500">Municipalities with data</div>
              <div className="text-2xl font-semibold">{(analyticsQ.data!.perMunicipality ?? []).filter(x => x.dishes || x.restaurants).length}</div>
            </div>
          </div>
        )}
      </Section>

      {/* CURATION */}
      <Section title="Curation (Top 3 per municipality)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dishes curation */}
          <div>
            <h3 className="font-semibold mb-2">Top Dishes</h3>
            <div className="text-xs text-neutral-500 mb-2">Pick up to three per selected municipality. Ranks must be 1,2,3.</div>

            <div className="max-h-80 overflow-auto border rounded">
              {curDishList.map(d => {
                const checked = (d.is_signature ?? 0) === 1;
                const taken = curTopDishes.map(x => x.panel_rank ?? null).filter(Boolean) as number[];
                const canAdd = checked || taken.length < 3;
                const currentRank = d.panel_rank ?? null;
                return (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2 border-b">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && !canAdd}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const r = currentRank ?? nextFreeRank(taken);
                          if (!r) return;
                          dishCuration.mutate({ id: d.id, is_signature: 1, panel_rank: r });
                        } else {
                          dishCuration.mutate({ id: d.id, is_signature: 0, panel_rank: null });
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-[11px] text-neutral-500">{d.slug}</div>
                    </div>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={currentRank ?? ""}
                      onChange={(e)=>{
                        const val = e.target.value ? Number(e.target.value) : null;
                        dishCuration.mutate({ id: d.id, is_signature: val ? 1 : 0, panel_rank: val });
                      }}
                    >
                      <option value="">—</option>
                      {[1,2,3].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Restaurants curation */}
          <div>
            <h3 className="font-semibold mb-2">Top Restaurants</h3>
            {restaurantCurationError && (
              <div className="mb-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                {restaurantCurationError}
              </div>
            )}
            <div className="text-xs text-neutral-500 mb-2">Pick up to three per selected municipality. Ranks must be 1,2,3.</div>
            <div className="max-h-80 overflow-auto border rounded">
              {curRestList.map(r => {
                const checked = (r.featured ?? 0) === 1;
                const taken = curTopRests.map(x => x.featured_rank ?? null).filter(Boolean) as number[];
                const canAdd = checked || taken.length < 3;
                const currentRank = r.featured_rank ?? null;
                return (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2 border-b">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && !canAdd}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const rank = currentRank ?? nextFreeRank(taken);
                          if (!rank) return;
                          restCuration.mutate({ id: r.id, featured: 1, featured_rank: rank });
                        } else {
                          restCuration.mutate({ id: r.id, featured: 0, featured_rank: null });
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[11px] text-neutral-500">{r.slug}</div>
                    </div>
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={currentRank ?? ""}
                      onChange={(e)=>{
                        const val = e.target.value ? Number(e.target.value) : null;
                        restCuration.mutate({ id: r.id, featured: val ? 1 : 0, featured_rank: val });
                      }}
                    >
                      <option value="">—</option>
                      {[1,2,3].map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* DISHES */}
      <Section title="Dishes (search & CRUD)">
        <div className="mb-2 flex gap-2">
          <input
            className="border rounded px-2 py-1 w-64"
            placeholder="Search dishes by name/slug…"
            value={dishQStr}
            onChange={(e)=> setDishQStr(e.target.value)}
          />
          <button className="px-3 py-1 rounded border" onClick={()=> setEditingDish({
            id: 0, name: "", slug: "", description: "", category: "food", municipality_id: muniId ?? null
          } as any)}>+ New Dish</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="max-h-96 overflow-auto border rounded">
            {(dishesQ.data ?? []).map(d => (
              <div key={d.id} className="flex items-center justify-between border-b px-3 py-2">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-neutral-500">
                    {d.slug} · {d.category} · muni {d.municipality_id ?? "-"}
                    {(d.is_signature ?? 0) === 1 ? <> · <span className="text-green-700">Top {d.panel_rank ?? "?"}</span></> : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="text-blue-600 text-sm" onClick={()=> setEditingDish(d)}>Edit</button>
                  <button className="text-red-600 text-sm" onClick={()=>{
                    if (confirm(`Delete dish "${d.name}"?`)) dishDelete.mutate(d.id);
                  }}>Delete</button>
                </div>
              </div>
            ))}
          </div>

          {/* editor */}
          <div>
            {editingDish ? (
              <DishForm
                value={editingDish}
                municipalities={muniQ.data ?? []}
                onCancel={()=> setEditingDish(null)}
                onSave={(val)=>{
                  if (val.id && val.id > 0) dishUpdate.mutate({ id: val.id, data: val as any }, { onSuccess: ()=> setEditingDish(null) });
                  else dishCreate.mutate(val as any, { onSuccess: ()=> setEditingDish(null) });
                }}
              />
            ) : <div className="text-sm text-neutral-500">Select a dish to edit or click “New Dish”.</div>}
          </div>
        </div>
      </Section>

      {/* RESTAURANTS */}
      <Section title="Restaurants (search & CRUD)">
        <div className="mb-2 flex gap-2">
          <input
            className="border rounded px-2 py-1 w-64"
            placeholder="Search restaurants by name/slug…"
            value={restQStr}
            onChange={(e)=> setRestQStr(e.target.value)}
          />
          <button className="px-3 py-1 rounded border" onClick={()=> setEditingRest({
            id: 0, name: "", slug: "", address: "", lat: 0, lng: 0, municipality_id: muniId ?? null
          } as any)}>+ New Restaurant</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="max-h-96 overflow-auto border rounded">
            {(restaurantsQ.data ?? []).map(r => (
              <div key={r.id} className="flex items-center justify-between border-b px-3 py-2">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-neutral-500">
                    {r.slug} · muni {r.municipality_id ?? "-"} · lat {r.lat}, lng {r.lng}
                    {(r.featured ?? 0) === 1 ? <> · <span className="text-green-700">Top {r.featured_rank ?? "?"}</span></> : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="text-blue-600 text-sm" onClick={()=> setEditingRest(r)}>Edit</button>
                  <button className="text-red-600 text-sm" onClick={()=>{
                    if (confirm(`Delete restaurant "${r.name}"?`)) restDelete.mutate(r.id);
                  }}>Delete</button>
                </div>
              </div>
            ))}
          </div>

          {/* editor */}
          <div>
            {editingRest ? (
              <RestaurantForm
                value={editingRest}
                municipalities={muniQ.data ?? []}
                onCancel={()=> setEditingRest(null)}
                onSave={(val)=>{
                  if (val.id && val.id > 0) restUpdate.mutate({ id: val.id, data: val as any }, { onSuccess: ()=> setEditingRest(null) });
                  else restCreate.mutate(val as any, { onSuccess: ()=> setEditingRest(null) });
                }}
              />
            ) : <div className="text-sm text-neutral-500">Select a restaurant to edit or click “New Restaurant”.</div>}
          </div>
        </div>
      </Section>

      {/* LINKING */}
      <Section title="Linking: Dish → Restaurants">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm">Dish:</span>
          <select className="border rounded px-2 py-1"
            value={linkDishSel ?? ""}
            onChange={(e)=> setLinkDishSel(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Choose…</option>
            {(dishesQ.data ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <span className="text-xs text-neutral-500">Tip: filter Dish list above first.</span>
        </div>

        {!linkDishSel ? <div className="text-sm text-neutral-500">Pick a dish to start linking.</div> : (
          <div className="max-h-96 overflow-auto border rounded">
            {(restaurantsQ.data ?? []).map(r => {
              const checked = linkedSet.has(r.id);
              return (
                <label key={r.id} className="flex items-center justify-between px-3 py-2 border-b">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e)=>{
                        linkMut.mutate({ dish_id: linkDishSel!, restaurant_id: r.id, mode: e.target.checked ? "link" : "unlink" });
                      }}
                    />
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-neutral-500">{r.slug}</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ======= Forms ======= */
function DishForm({
  value, municipalities, onSave, onCancel
}: {
  value: Partial<Dish>;
  municipalities: Municipality[];
  onSave: (v: Partial<Dish>) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<Partial<Dish>>(value);
  return (
    <form className="space-y-2" onSubmit={(e)=>{ e.preventDefault(); onSave(v); }}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs">Name</label>
          <input className="border rounded px-2 py-1 w-full" value={v.name ?? ""} onChange={e=> setV(s => ({...s, name:e.target.value}))}/>
        </div>
        <div>
          <label className="text-xs">Slug</label>
          <input className="border rounded px-2 py-1 w-full" value={v.slug ?? ""} onChange={e=> setV(s => ({...s, slug:e.target.value}))}/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs">Municipality</label>
          <select className="border rounded px-2 py-1 w-full"
            value={v.municipality_id ?? ""}
            onChange={e=> setV(s=> ({...s, municipality_id: e.target.value ? Number(e.target.value) : null}))}>
            <option value="">—</option>
            {municipalities.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs">Category</label>
          <select className="border rounded px-2 py-1 w-full"
            value={v.category ?? "food"}
            onChange={e=> setV(s=> ({...s, category: e.target.value as any}))}>
            <option value="food">food</option>
            <option value="delicacy">delicacy</option>
            <option value="drink">drink</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs">Description</label>
        <textarea className="border rounded px-2 py-1 w-full" rows={3}
          value={v.description ?? ""} onChange={e=> setV(s=> ({...s, description:e.target.value}))}/>
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-1 rounded border bg-blue-600 text-white" type="submit">Save</button>
        <button className="px-3 py-1 rounded border" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function RestaurantForm({
  value, municipalities, onSave, onCancel
}: {
  value: Partial<Restaurant>;
  municipalities: Municipality[];
  onSave: (v: Partial<Restaurant>) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<Partial<Restaurant>>(value);
  return (
    <form className="space-y-2" onSubmit={(e)=>{ e.preventDefault(); onSave(v); }}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs">Name</label>
          <input className="border rounded px-2 py-1 w-full" value={v.name ?? ""} onChange={e=> setV(s => ({...s, name:e.target.value}))}/>
        </div>
        <div>
          <label className="text-xs">Slug</label>
          <input className="border rounded px-2 py-1 w-full" value={v.slug ?? ""} onChange={e=> setV(s => ({...s, slug:e.target.value}))}/>
        </div>
      </div>
      <div>
        <label className="text-xs">Address</label>
        <input className="border rounded px-2 py-1 w-full" value={v.address ?? ""} onChange={e=> setV(s => ({...s, address:e.target.value}))}/>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs">Municipality</label>
          <select className="border rounded px-2 py-1 w-full"
            value={v.municipality_id ?? ""}
            onChange={e=> setV(s=> ({...s, municipality_id: e.target.value ? Number(e.target.value) : null}))}>
            <option value="">—</option>
            {municipalities.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs">Lat</label>
            <input type="number" step="any" className="border rounded px-2 py-1 w-full" value={v.lat ?? 0} onChange={e=> setV(s => ({...s, lat:Number(e.target.value)}))}/>
          </div>
          <div>
            <label className="text-xs">Lng</label>
            <input type="number" step="any" className="border rounded px-2 py-1 w-full" value={v.lng ?? 0} onChange={e=> setV(s => ({...s, lng:Number(e.target.value)}))}/>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="px-3 py-1 rounded border bg-blue-600 text-white" type="submit">Save</button>
        <button className="px-3 py-1 rounded border" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
