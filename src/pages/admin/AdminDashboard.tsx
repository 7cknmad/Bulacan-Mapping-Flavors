// src/pages/admin/AdminDashboard.tsx
import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminHealth, analyticsSummary, listMunicipalities,
  listDishes, createDish, updateDish, deleteDish,
  listRestaurants, createRestaurant, updateRestaurant, deleteRestaurant,
  restaurantsForDish, linkDishRestaurant, unlinkDishRestaurant,
  curateDish, curateRestaurant,
  type Municipality, type Dish, type Restaurant
} from "../../utils/adminApi";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Badge({ children, tone='neutral' }:{children:React.ReactNode; tone?:'neutral'|'success'|'warn'}) {
  const cls = tone==='success'?'bg-green-50 text-green-700 border-green-200':
             tone==='warn'   ?'bg-amber-50 text-amber-700 border-amber-200':
                                'bg-neutral-50 text-neutral-700 border-neutral-200';
  return <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{children}</span>;
}

function BarRow({ label, n, max }:{label:string; n:number; max:number}) {
  const pct = max>0 ? Math.round((n/max)*100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 text-sm truncate">{label}</div>
      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#60a5fa,#34d399)' }} />
      </div>
      <div className="w-10 text-xs tabular-nums text-right">{n}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'analytics'|'dishes'|'restaurants'|'curation'|'linking'>('analytics');

  // filters, cached in state
  const [dishQ, setDishQ] = useState('');
  const [restQ, setRestQ] = useState('');
  const [dishMuni, setDishMuni] = useState<number|null>(null);
  const [restMuni, setRestMuni] = useState<number|null>(null);

  const health = useQuery({ queryKey:['admin:health'], queryFn: adminHealth, retry: false });
  const muni = useQuery({ queryKey:['admin:municipalities'], queryFn: listMunicipalities, staleTime: 5*60_000 });
  const analytics = useQuery({ queryKey:['admin:analytics'], queryFn: analyticsSummary, enabled: tab==='analytics', staleTime: 30_000 });

  const dishes = useQuery({
    queryKey:['admin:dishes', dishMuni, dishQ],
    queryFn: ()=>listDishes({ municipalityId:dishMuni||undefined, q:dishQ||undefined }),
    enabled: tab==='dishes' || tab==='curation' || tab==='linking',
    staleTime: 10_000
  });

  const restaurants = useQuery({
    queryKey:['admin:restaurants', restMuni, restQ],
    queryFn: ()=>listRestaurants({ municipalityId:restMuni||undefined, q:restQ||undefined }),
    enabled: tab==='restaurants' || tab==='curation' || tab==='linking',
    staleTime: 10_000
  });

  // ---- CRUD: Dishes
  const [editingDish, setEditingDish] = useState<Partial<Dish>&{category?:Dish['category']}>({ category: 'food' });
  const saveDish = useMutation({
    mutationFn: async (payload: Partial<Dish>&{category?:Dish['category']}) => {
      if (payload.id) return updateDish(payload.id, payload);
      return createDish(payload as any);
    },
    onSuccess: ()=> { qc.invalidateQueries({queryKey:['admin:dishes']}); setEditingDish({ category:'food' }); }
  });
  const delDish = useMutation({
    mutationFn: (id:number)=>deleteDish(id),
    onSuccess: ()=> qc.invalidateQueries({queryKey:['admin:dishes']})
  });

  // ---- CRUD: Restaurants
  const [editingRest, setEditingRest] = useState<Partial<Restaurant>>({ kind:'restaurant' });
  const saveRest = useMutation({
    mutationFn: async (payload: Partial<Restaurant>) => {
      if (payload.id) return updateRestaurant(payload.id, payload);
      return createRestaurant(payload as any);
    },
    onSuccess: ()=> { qc.invalidateQueries({queryKey:['admin:restaurants']}); setEditingRest({ kind:'restaurant' }); }
  });
  const delRest = useMutation({
    mutationFn: (id:number)=>deleteRestaurant(id),
    onSuccess: ()=> qc.invalidateQueries({queryKey:['admin:restaurants']})
  });

  // ---- Curation
  const setDishCur = useMutation({
    mutationFn: ({id, is_signature, panel_rank}:{id:number; is_signature?:0|1; panel_rank?:number|null}) =>
      curateDish(id, { is_signature, panel_rank }),
    onSuccess: ()=> qc.invalidateQueries({queryKey:['admin:dishes']})
  });
  const setRestCur = useMutation({
    mutationFn: ({id, featured, featured_rank}:{id:number; featured?:0|1; featured_rank?:number|null}) =>
      curateRestaurant(id, { featured, featured_rank }),
    onSuccess: ()=> qc.invalidateQueries({queryKey:['admin:restaurants']})
  });

  // ---- Linking (Dish → Restaurants)
  const [linkDishId, setLinkDishId] = useState<number|null>(null);
  const linkedForDish = useQuery({
    queryKey:['admin:linkedForDish', linkDishId],
    queryFn: ()=> restaurantsForDish(linkDishId!),
    enabled: tab==='linking' && !!linkDishId
  });
  const toggleLink = useMutation({
    mutationFn: async ({restaurant_id, linked}:{restaurant_id:number; linked:boolean}) => {
      if (!linkDishId) return;
      if (linked) return unlinkDishRestaurant(linkDishId, restaurant_id);
      return linkDishRestaurant(linkDishId, restaurant_id);
    },
    onSuccess: ()=> qc.invalidateQueries({queryKey:['admin:linkedForDish']})
  });

  // small helpers
  const muniName = (id:number|null|undefined) => {
    const m = (muni.data||[]).find(x=>x.id===id);
    return m ? `${m.name} (${m.slug})` : 'All municipalities';
  };
  const topBar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-xl font-semibold">Admin Dashboard</div>
      <div className="flex items-center gap-2 text-sm">
        {!health.isLoading && !health.isError && health.data?.ok ? (
          <Badge tone="success">Admin API: OK</Badge>
        ) : (
          <Badge tone="warn">Admin API unreachable</Badge>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {topBar}

      <div className="flex gap-2 text-sm">
        {(['analytics','dishes','restaurants','curation','linking'] as const).map(t => (
          <button key={t}
            onClick={()=>setTab(t)}
            className={`px-3 py-1.5 rounded border ${tab===t?'bg-neutral-900 text-white border-neutral-900':'bg-white hover:bg-neutral-50'}`}>
            {t[0].toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {tab==='analytics' && (
        <Section title="Analytics">
          {analytics.isLoading ? <div>Loading…</div> : analytics.isError ? <div className="text-red-600">Failed to load analytics.</div> : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg bg-neutral-50">
                  <div className="text-xs text-neutral-500">Total Dishes</div>
                  <div className="text-2xl font-semibold">{analytics.data!.counts.dishes}</div>
                </div>
                <div className="p-4 border rounded-lg bg-neutral-50">
                  <div className="text-xs text-neutral-500">Total Restaurants</div>
                  <div className="text-2xl font-semibold">{analytics.data!.counts.restaurants}</div>
                </div>
                <div className="p-4 border rounded-lg bg-neutral-50">
                  <div className="text-xs text-neutral-500">Municipalities</div>
                  <div className="text-2xl font-semibold">{analytics.data!.counts.municipalities}</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="font-medium">Dishes by municipality</div>
                  {(() => {
                    const rows = analytics.data!.perMunicipality.dishes;
                    const max = Math.max(1, ...rows.map(r=>r.count));
                    return rows.map(r => <BarRow key={r.id} label={r.name} n={r.count} max={max} />);
                  })()}
                </div>
                <div className="space-y-2">
                  <div className="font-medium">Restaurants by municipality</div>
                  {(() => {
                    const rows = analytics.data!.perMunicipality.restaurants;
                    const max = Math.max(1, ...rows.map(r=>r.count));
                    return rows.map(r => <BarRow key={r.id} label={r.name} n={r.count} max={max} />);
                  })()}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="font-medium mb-2">Top Dishes</div>
                  <ul className="space-y-1">
                    {analytics.data!.top.dishes.map((d:any, i:number)=>(
                      <li key={d.id} className="flex items-center gap-2">
                        <Badge>{i+1}</Badge>
                        <span className="font-medium">{d.name}</span>
                        {!!d.panel_rank && <Badge tone="success">rank: {d.panel_rank}</Badge>}
                        {!!d.is_signature && <Badge tone="success">signature</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-medium mb-2">Top Restaurants</div>
                  <ul className="space-y-1">
                    {analytics.data!.top.restaurants.map((r:any, i:number)=>(
                      <li key={r.id} className="flex items-center gap-2">
                        <Badge>{i+1}</Badge>
                        <span className="font-medium">{r.name}</span>
                        {!!r.featured_rank && <Badge tone="success">rank: {r.featured_rank}</Badge>}
                        {!!r.featured && <Badge tone="success">featured</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </Section>
      )}

      {tab==='dishes' && (
        <Section title="Dishes — Find or Create">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select className="border rounded px-2 py-1"
              value={dishMuni ?? ''}
              onChange={e=> setDishMuni(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All municipalities</option>
              {(muni.data||[]).map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
            </select>
            <input className="border rounded px-2 py-1 w-64" placeholder="Search dish…"
              value={dishQ} onChange={e=>setDishQ(e.target.value)} />
            <span className="text-xs text-neutral-500">Showing: {dishes.data?.length ?? 0}</span>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* list */}
            <div className="md:col-span-2 border rounded-lg max-h-[520px] overflow-auto">
              {dishes.isLoading ? <div className="p-4">Loading…</div> :
               dishes.isError ? <div className="p-4 text-red-600">Failed to load.</div> :
               (dishes.data||[]).map(d => (
                <div key={d.id} className="flex items-center justify-between border-b px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{d.slug}</div>
                    <div className="text-xs flex gap-2 mt-1">
                      {!!d.is_signature && <Badge tone="success">signature</Badge>}
                      {d.panel_rank!=null && <Badge tone="success">rank {d.panel_rank}</Badge>}
                      <Badge>{d.category}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-blue-600 hover:underline" onClick={()=>setEditingDish(d)}>Edit</button>
                    <button className="text-red-600 hover:underline" onClick={()=>{ if(confirm(`Delete "${d.name}"?`)) delDish.mutate(d.id); }}>Delete</button>
                  </div>
                </div>
               ))}
            </div>

            {/* form */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="font-medium">{editingDish.id ? `Editing: #${editingDish.id}` : 'Create dish'}</div>
              <label className="block text-sm">Municipality</label>
              <select className="border rounded px-2 py-1 w-full"
                value={editingDish.municipality_id ?? ''} onChange={e=>setEditingDish(v=>({...v, municipality_id: e.target.value?Number(e.target.value):undefined}))}>
                <option value="">Select…</option>
                {(muni.data||[]).map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
              </select>
              <label className="block text-sm">Category</label>
              <select className="border rounded px-2 py-1 w-full"
                value={editingDish.category ?? 'food'} onChange={e=>setEditingDish(v=>({...v, category: e.target.value as any}))}>
                <option value="food">food</option>
                <option value="delicacy">delicacy</option>
                <option value="drink">drink</option>
              </select>
              <input className="border rounded px-2 py-1 w-full" placeholder="Name"
                value={editingDish.name ?? ''} onChange={e=>setEditingDish(v=>({...v, name:e.target.value}))}/>
              <input className="border rounded px-2 py-1 w-full" placeholder="Slug (auto if empty)"
                value={editingDish.slug ?? ''} onChange={e=>setEditingDish(v=>({...v, slug:e.target.value}))}/>
              <textarea className="border rounded px-2 py-1 w-full" placeholder="Description"
                value={editingDish.description ?? ''} onChange={e=>setEditingDish(v=>({...v, description:e.target.value}))}/>
              <input className="border rounded px-2 py-1 w-full" placeholder="Image URL"
                value={editingDish.image_url ?? ''} onChange={e=>setEditingDish(v=>({...v, image_url:e.target.value}))}/>
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded px-2 py-1" placeholder="Popularity (0-100)"
                  value={editingDish.popularity ?? ''} onChange={e=>setEditingDish(v=>({...v, popularity:e.target.value?Number(e.target.value):null}))}/>
                <input className="border rounded px-2 py-1" placeholder="Rating (0-5)"
                  value={editingDish.rating ?? ''} onChange={e=>setEditingDish(v=>({...v, rating:e.target.value?Number(e.target.value):null}))}/>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={()=>saveDish.mutate(editingDish)}
                  className="px-3 py-1.5 rounded bg-neutral-900 text-white">
                  {editingDish.id ? 'Save changes' : 'Create'}
                </button>
                {editingDish.id && (
                  <button onClick={()=>setEditingDish({ category:'food' })}
                    className="px-3 py-1.5 rounded border">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </Section>
      )}

      {tab==='restaurants' && (
        <Section title="Restaurants — Find or Create">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select className="border rounded px-2 py-1"
              value={restMuni ?? ''}
              onChange={e=> setRestMuni(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All municipalities</option>
              {(muni.data||[]).map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
            </select>
            <input className="border rounded px-2 py-1 w-64" placeholder="Search restaurant…"
              value={restQ} onChange={e=>setRestQ(e.target.value)} />
            <span className="text-xs text-neutral-500">Showing: {restaurants.data?.length ?? 0}</span>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 border rounded-lg max-h-[520px] overflow-auto">
              {restaurants.isLoading ? <div className="p-4">Loading…</div> :
               restaurants.isError ? <div className="p-4 text-red-600">Failed to load.</div> :
               (restaurants.data||[]).map(r => (
                <div key={r.id} className="flex items-center justify-between border-b px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{r.slug}</div>
                    <div className="text-xs flex gap-2 mt-1">
                      {!!r.featured && <Badge tone="success">featured</Badge>}
                      {r.featured_rank!=null && <Badge tone="success">rank {r.featured_rank}</Badge>}
                      <Badge>{r.kind||'restaurant'}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-blue-600 hover:underline" onClick={()=>setEditingRest(r)}>Edit</button>
                    <button className="text-red-600 hover:underline" onClick={()=>{ if(confirm(`Delete "${r.name}"?`)) delRest.mutate(r.id); }}>Delete</button>
                  </div>
                </div>
               ))}
            </div>

            <div className="border rounded-lg p-3 space-y-2">
              <div className="font-medium">{editingRest.id ? `Editing: #${editingRest.id}` : 'Create restaurant'}</div>
              <label className="block text-sm">Municipality</label>
              <select className="border rounded px-2 py-1 w-full"
                value={editingRest.municipality_id ?? ''} onChange={e=>setEditingRest(v=>({...v, municipality_id: e.target.value?Number(e.target.value):undefined}))}>
                <option value="">Select…</option>
                {(muni.data||[]).map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
              </select>
              <input className="border rounded px-2 py-1 w-full" placeholder="Name"
                value={editingRest.name ?? ''} onChange={e=>setEditingRest(v=>({...v, name:e.target.value}))}/>
              <input className="border rounded px-2 py-1 w-full" placeholder="Slug (auto if empty)"
                value={editingRest.slug ?? ''} onChange={e=>setEditingRest(v=>({...v, slug:e.target.value}))}/>
              <input className="border rounded px-2 py-1 w-full" placeholder="Kind (restaurant, stall, market…)"
                value={editingRest.kind ?? ''} onChange={e=>setEditingRest(v=>({...v, kind:e.target.value}))}/>
              <textarea className="border rounded px-2 py-1 w-full" placeholder="Description"
                value={editingRest.description ?? ''} onChange={e=>setEditingRest(v=>({...v, description:e.target.value}))}/>
              <input className="border rounded px-2 py-1 w-full" placeholder="Address"
                value={editingRest.address ?? ''} onChange={e=>setEditingRest(v=>({...v, address:e.target.value}))}/>
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded px-2 py-1" placeholder="Latitude"
                  value={editingRest.lat ?? ''} onChange={e=>setEditingRest(v=>({...v, lat:e.target.value?Number(e.target.value):undefined}))}/>
                <input className="border rounded px-2 py-1" placeholder="Longitude"
                  value={editingRest.lng ?? ''} onChange={e=>setEditingRest(v=>({...v, lng:e.target.value?Number(e.target.value):undefined}))}/>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={()=>saveRest.mutate(editingRest)}
                  className="px-3 py-1.5 rounded bg-neutral-900 text-white">
                  {editingRest.id ? 'Save changes' : 'Create'}
                </button>
                {editingRest.id && (
                  <button onClick={()=>setEditingRest({ kind:'restaurant' })}
                    className="px-3 py-1.5 rounded border">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </Section>
      )}

      {tab==='curation' && (
        <Section title="Curation — Top 3 & Flags">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="font-medium">Dishes / Delicacies</div>
                <span className="text-xs text-neutral-500">Filter: {muniName(dishMuni)}</span>
                <select className="border rounded px-2 py-1 ml-auto"
                  value={dishMuni ?? ''} onChange={e=>setDishMuni(e.target.value?Number(e.target.value):null)}>
                  <option value="">All</option>
                  {(muni.data||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="border rounded-lg max-h-[520px] overflow-auto">
                {(dishes.data||[]).map(d=>(
                  <div key={d.id} className="flex items-center justify-between border-b px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.name}</div>
                      <div className="text-[11px] text-neutral-500">{d.category}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select className="border rounded px-2 py-1 text-sm"
                        value={d.panel_rank ?? ''} onChange={e=>setDishCur.mutate({id:d.id, panel_rank: e.target.value?Number(e.target.value):null})}>
                        <option value="">rank: –</option>
                        {[1,2,3].map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                      <label className="text-sm flex items-center gap-1">
                        <input type="checkbox" checked={!!d.is_signature} onChange={e=>setDishCur.mutate({id:d.id, is_signature: e.target.checked?1:0})}/>
                        signature
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="font-medium">Restaurants</div>
                <span className="text-xs text-neutral-500">Filter: {muniName(restMuni)}</span>
                <select className="border rounded px-2 py-1 ml-auto"
                  value={restMuni ?? ''} onChange={e=>setRestMuni(e.target.value?Number(e.target.value):null)}>
                  <option value="">All</option>
                  {(muni.data||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="border rounded-lg max-h-[520px] overflow-auto">
                {(restaurants.data||[]).map(r=>(
                  <div key={r.id} className="flex items-center justify-between border-b px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-[11px] text-neutral-500">{r.kind || 'restaurant'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select className="border rounded px-2 py-1 text-sm"
                        value={r.featured_rank ?? ''} onChange={e=>setRestCur.mutate({id:r.id, featured_rank: e.target.value?Number(e.target.value):null})}>
                        <option value="">rank: –</option>
                        {[1,2,3].map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                      <label className="text-sm flex items-center gap-1">
                        <input type="checkbox" checked={!!r.featured} onChange={e=>setRestCur.mutate({id:r.id, featured: e.target.checked?1:0})}/>
                        featured
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      {tab==='linking' && (
        <Section title="Linking — Dish ⇄ Restaurants">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="font-medium">Pick a dish</div>
              <div className="border rounded max-h-80 overflow-auto">
                {(dishes.data||[]).map(d=>(
                  <button key={d.id} onClick={()=>setLinkDishId(d.id)}
                    className={`block w-full text-left px-3 py-2 border-b hover:bg-neutral-50 ${linkDishId===d.id?'bg-neutral-100':''}`}>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-[11px] text-neutral-500">{d.category}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium">Restaurants {linkDishId ? <span className="text-xs text-neutral-500">linked to dish #{linkDishId}</span>:null}</div>
              {!linkDishId ? <div className="text-sm text-neutral-500">Select a dish first.</div> : (
                <div className="border rounded max-h-96 overflow-auto">
                  {(restaurants.data||[]).map(r=>{
                    const linked = (linkedForDish.data||[]).some(x=>x.id===r.id);
                    return (
                      <label key={r.id} className="flex items-center justify-between px-3 py-2 border-b hover:bg-neutral-50">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.name}</div>
                          <div className="text-[11px] text-neutral-500">{r.kind || 'restaurant'}</div>
                        </div>
                        <input type="checkbox" checked={linked} onChange={()=>toggleLink.mutate({restaurant_id:r.id, linked})}/>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
