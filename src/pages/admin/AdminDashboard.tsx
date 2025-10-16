import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminAuth, listMunicipalities, listDishesAdmin, createDish, updateDish, deleteDish,
  listRestaurantsAdmin, createRestaurant, updateRestaurant, deleteRestaurant,
  listRestaurantsForDish, linkDishRestaurant, unlinkDishRestaurant,
  curateDish, curateRestaurant, getAnalyticsSummary, type Dish, type Restaurant
} from "../../utils/adminApi";
import ProtectedRoute from "../../components/admin/ProtectedRoute";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const dishSchema = z.object({
  id: z.number().optional(),
  municipality_id: z.number(),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  category: z.enum(['food','delicacy','drink']).default('food'),
  flavor_profile: z.array(z.string()).optional().nullable(),
  ingredients: z.array(z.string()).optional().nullable(),
  rating: z.coerce.number().optional().nullable(),
  popularity: z.coerce.number().optional().nullable()
});
const restaurantSchema = z.object({
  id: z.number().optional(),
  municipality_id: z.number(),
  name: z.string().min(2),
  slug: z.string().min(2),
  kind: z.string().optional(),
  description: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  address: z.string().min(2),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  facebook: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  opening_hours: z.string().optional().nullable(),
  price_range: z.enum(['budget','moderate','expensive']).default('budget'),
  cuisine_types: z.array(z.string()).optional().nullable(),
  rating: z.coerce.number().optional().nullable(),
  lat: z.coerce.number(),
  lng: z.coerce.number()
});

export default function AdminDashboard() {
  const qc = useQueryClient();

  const muniQ = useQuery({ queryKey: ['munis'], queryFn: listMunicipalities, staleTime: 300000 });
  const [muniId, setMuniId] = useState<number | null>(null);

  // cache muni selection
  useEffect(() => {
    const saved = localStorage.getItem('admin:muniId');
    if (saved) setMuniId(Number(saved));
  }, []);
  useEffect(() => {
    if (muniId != null) localStorage.setItem('admin:muniId', String(muniId));
  }, [muniId]);

  // Dishes
  const [dq, setDq] = useState('');
  const dishesQ = useQuery({
    queryKey: ['admin:dishes', muniId, dq],
    queryFn: () => listDishesAdmin({ municipalityId: muniId ?? undefined, q: dq || undefined }),
    enabled: true
  });

  // Restaurants
  const [rq, setRq] = useState('');
  const restsQ = useQuery({
    queryKey: ['admin:restaurants', muniId, rq],
    queryFn: () => listRestaurantsAdmin({ municipalityId: muniId ?? undefined, q: rq || undefined }),
    enabled: true
  });

  // Analytics
  const analyticsQ = useQuery({ queryKey: ['admin:analytics'], queryFn: getAnalyticsSummary, enabled: true });

  // Tabs
  const [tab, setTab] = useState<'analytics'|'dishes'|'restaurants'|'linking'|'curation'>('analytics');

  // Forms
  const dishForm = useForm<z.infer<typeof dishSchema>>({ resolver: zodResolver(dishSchema) });
  const restForm = useForm<z.infer<typeof restaurantSchema>>({ resolver: zodResolver(restaurantSchema) });

  // CRUD mutations
  const createDishM = useMutation({
    mutationFn: createDish,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin:dishes'] })
  });
  const updateDishM = useMutation({
    mutationFn: ({id, data}:{id:number; data:Partial<Dish>}) => updateDish(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin:dishes'] })
  });
  const deleteDishM = useMutation({
    mutationFn: (id:number) => deleteDish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin:dishes'] })
  });

  const createRestM = useMutation({
    mutationFn: createRestaurant,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin:restaurants'] })
  });
  const updateRestM = useMutation({
    mutationFn: ({id, data}:{id:number; data:Partial<Restaurant>}) => updateRestaurant(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin:restaurants'] })
  });
  const deleteRestM = useMutation({
    mutationFn: (id:number) => deleteRestaurant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin:restaurants'] })
  });

  // Linking
  const [linkDishId, setLinkDishId] = useState<number | null>(null);
  const dishRestsQ = useQuery({
    queryKey: ['admin:link:restaurantsForDish', linkDishId],
    queryFn: () => listRestaurantsForDish(linkDishId!),
    enabled: !!linkDishId
  });

  const onToggleLink = async (restaurant_id: number, checked: boolean) => {
    if (!linkDishId) return;
    if (checked) await linkDishRestaurant(linkDishId, restaurant_id);
    else await unlinkDishRestaurant(linkDishId, restaurant_id);
    qc.invalidateQueries({ queryKey: ['admin:link:restaurantsForDish', linkDishId] });
  };

  // Curation helpers
  const setDishRank = async (id:number, rank:number|null) => {
    await curateDish(id, { is_signature: rank ? 1 : 0, panel_rank: rank });
    qc.invalidateQueries({ queryKey: ['admin:dishes'] });
    qc.invalidateQueries({ queryKey: ['admin:analytics'] });
  };
  const setRestRank = async (id:number, rank:number|null) => {
    await curateRestaurant(id, { featured: rank ? 1 : 0, featured_rank: rank });
    qc.invalidateQueries({ queryKey: ['admin:restaurants'] });
    qc.invalidateQueries({ queryKey: ['admin:analytics'] });
  };

  return (
    <ProtectedRoute>
      <main className="container mx-auto py-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <button className="btn btn-outline" onClick={() => adminAuth.logout().then(()=>location.href = '#/admin/login')}>
            Logout
          </button>
        </header>

        {/* Tabs */}
        <div className="tabs mb-4">
          {(['analytics','dishes','restaurants','linking','curation'] as const).map(t => (
            <button key={t} className={`tab tab-bordered ${tab===t?'tab-active':''}`} onClick={()=>setTab(t)}>
              {t[0].toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        {/* Municipality filter */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-neutral-700">Municipality:</span>
          <select className="select select-bordered" value={muniId ?? ''} onChange={e=>setMuniId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">All</option>
            {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>)}
          </select>
        </div>

        {/* Analytics */}
        {tab === 'analytics' && (
          <section className="grid md:grid-cols-2 gap-6">
            <div className="card bg-white shadow p-4">
              <h3 className="font-medium mb-2">Dishes per Municipality</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={(analyticsQ.data?.dishCounts ?? []).map((d:any)=>({ name:d.name, count:Number(d.dish_count) }))}>
                    <XAxis dataKey="name" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card bg-white shadow p-4">
              <h3 className="font-medium mb-2">Restaurants per Municipality</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={(analyticsQ.data?.restaurantCounts ?? []).map((d:any)=>({ name:d.name, count:Number(d.restaurant_count) }))}>
                    <XAxis dataKey="name" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* Dishes */}
        {tab === 'dishes' && (
          <section className="grid md:grid-cols-2 gap-6">
            <div className="card bg-white shadow p-4">
              <div className="flex gap-2 mb-3">
                <input className="input input-bordered flex-1" placeholder="Search dishes…" value={dq} onChange={e=>setDq(e.target.value)} />
              </div>
              <div className="max-h-96 overflow-auto divide-y">
                {(dishesQ.data ?? []).map(d => (
                  <div key={d.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{d.name} <span className="text-xs text-neutral-500">({d.slug})</span></div>
                      <div className="text-xs text-neutral-500">{d.category} {d.is_signature ? `• Top ${d.panel_rank ?? ''}`:''}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-xs" onClick={() => dishForm.reset({ ...d })}>Edit</button>
                      <button className="btn btn-xs btn-error" onClick={() => confirm(`Delete ${d.name}?`) && deleteDishM.mutate(d.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card bg-white shadow p-4">
              <h3 className="font-medium mb-2">{dishForm.getValues('id') ? 'Edit Dish' : 'Create Dish'}</h3>
              <form className="grid gap-2" onSubmit={dishForm.handleSubmit((v)=>{
                if (v.id) updateDishM.mutate({ id: v.id, data: v });
                else createDishM.mutate(v);
                dishForm.reset({});
              })}>
                <select className="select select-bordered" {...dishForm.register('municipality_id', { valueAsNumber: true })}>
                  <option value="">Select municipality</option>
                  {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input className="input input-bordered" placeholder="Name" {...dishForm.register('name')} />
                <input className="input input-bordered" placeholder="Slug" {...dishForm.register('slug')} />
                <input className="input input-bordered" placeholder="Image URL" {...dishForm.register('image_url')} />
                <select className="select select-bordered" {...dishForm.register('category')}>
                  <option value="food">food</option>
                  <option value="delicacy">delicacy</option>
                  <option value="drink">drink</option>
                </select>
                <textarea className="textarea textarea-bordered" placeholder="Description" {...dishForm.register('description')} />
                <div className="flex gap-2">
                  <button className="btn btn-primary">Save</button>
                  <button type="button" className="btn" onClick={()=>dishForm.reset({})}>Clear</button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* Restaurants */}
        {tab === 'restaurants' && (
          <section className="grid md:grid-cols-2 gap-6">
            <div className="card bg-white shadow p-4">
              <div className="flex gap-2 mb-3">
                <input className="input input-bordered flex-1" placeholder="Search restaurants…" value={rq} onChange={e=>setRq(e.target.value)} />
              </div>
              <div className="max-h-96 overflow-auto divide-y">
                {(restsQ.data ?? []).map(r => (
                  <div key={r.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.name} <span className="text-xs text-neutral-500">({r.slug})</span></div>
                      <div className="text-xs text-neutral-500">{r.featured ? `Top ${r.featured_rank ?? ''}`:''}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-xs" onClick={() => restForm.reset({ ...r })}>Edit</button>
                      <button className="btn btn-xs btn-error" onClick={() => confirm(`Delete ${r.name}?`) && deleteRestM.mutate(r.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card bg-white shadow p-4">
              <h3 className="font-medium mb-2">{restForm.getValues('id') ? 'Edit Restaurant' : 'Create Restaurant'}</h3>
              <form className="grid gap-2" onSubmit={restForm.handleSubmit((v)=>{
                if (v.id) updateRestM.mutate({ id: v.id, data: v });
                else createRestM.mutate(v);
                restForm.reset({});
              })}>
                <select className="select select-bordered" {...restForm.register('municipality_id', { valueAsNumber: true })}>
                  <option value="">Select municipality</option>
                  {(muniQ.data ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input className="input input-bordered" placeholder="Name" {...restForm.register('name')} />
                <input className="input input-bordered" placeholder="Slug" {...restForm.register('slug')} />
                <input className="input input-bordered" placeholder="Image URL" {...restForm.register('image_url')} />
                <input className="input input-bordered" placeholder="Address" {...restForm.register('address')} />
                <input className="input input-bordered" placeholder="Lat" {...restForm.register('lat', { valueAsNumber: true })} />
                <input className="input input-bordered" placeholder="Lng" {...restForm.register('lng', { valueAsNumber: true })} />
                <div className="flex gap-2">
                  <button className="btn btn-primary">Save</button>
                  <button type="button" className="btn" onClick={()=>restForm.reset({})}>Clear</button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* Linking */}
        {tab === 'linking' && (
          <section className="grid md:grid-cols-2 gap-6">
            <div className="card bg-white shadow p-4">
              <h3 className="font-medium mb-2">Choose Dish</h3>
              <div className="max-h-96 overflow-auto divide-y">
                {(dishesQ.data ?? []).map(d => (
                  <div key={d.id} className={`py-2 cursor-pointer ${d.id===linkDishId?'bg-primary-50':''}`} onClick={()=>setLinkDishId(d.id)}>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-neutral-500">{d.category}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card bg-white shadow p-4">
              <h3 className="font-medium mb-2">Restaurants for this dish</h3>
              {!linkDishId && <div className="text-sm text-neutral-500">Select a dish on the left.</div>}
              {linkDishId && (
                <div className="max-h-96 overflow-auto space-y-2">
                  {(restsQ.data ?? []).map(r => {
                    const checked = (dishRestsQ.data ?? []).some(x => x.id === r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-2">
                        <input type="checkbox" checked={checked} onChange={e=>onToggleLink(r.id, e.target.checked)} />
                        <span>{r.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Curation */}
        {tab === 'curation' && (
          <section className="grid md:grid-cols-2 gap-6">
            <div className="card bg-white shadow p-4">
              <h3 className="font-medium mb-2">Top Dishes/Delicacies (per municipality)</h3>
              <div className="text-xs text-neutral-500 mb-2">Click a rank to set/unset.</div>
              <div className="max-h-96 overflow-auto divide-y">
                {(dishesQ.data ?? []).map(d => (
                  <div key={d.id} className="py-2 flex items-center justify-between">
                    <div>{d.name}</div>
                    <div className="flex gap-1">
                      {[1,2,3].map(r => (
                        <button key={r}
                          className={`btn btn-xs ${d.panel_rank===r?'btn-primary':'btn-outline'}`}
                          onClick={()=>setDishRank(d.id, d.panel_rank===r ? null : r)}>{r}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card bg-white shadow p-4">
              <h3 className="font-medium mb-2">Top Restaurants (per municipality)</h3>
              <div className="text-xs text-neutral-500 mb-2">Click a rank to set/unset.</div>
              <div className="max-h-96 overflow-auto divide-y">
                {(restsQ.data ?? []).map(r => (
                  <div key={r.id} className="py-2 flex items-center justify-between">
                    <div>{r.name}</div>
                    <div className="flex gap-1">
                      {[1,2,3].map(n => (
                        <button key={n}
                          className={`btn btn-xs ${r.featured_rank===n?'btn-primary':'btn-outline'}`}
                          onClick={()=>setRestRank(r.id, r.featured_rank===n ? null : n)}>{n}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </ProtectedRoute>
  );
}
