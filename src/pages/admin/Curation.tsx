import { useEffect, useState } from 'react';
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export default function Curation() {
  const [mId, setMId] = useState<number>(1);
  const [foods, setFoods] = useState<any[]>([]);
  const [delics, setDelics] = useState<any[]>([]);
  const [restos, setRestos] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [a,b,c] = await Promise.all([
        fetch(`${API}/api/dishes?municipalityId=${mId}&category=food&limit=100`).then(r=>r.json()),
        fetch(`${API}/api/dishes?municipalityId=${mId}&category=delicacy&limit=100`).then(r=>r.json()),
        fetch(`${API}/api/restaurants?municipalityId=${mId}&limit=100`).then(r=>r.json()),
      ]);
      setFoods(a); setDelics(b); setRestos(c);
    })();
  }, [mId]);

  const saveDish = async (id:number, is_signature:boolean, panel_rank:number|null) => {
    await fetch(`${API}/api/admin/dishes/${id}`, {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ is_signature, panel_rank })
    });
  };
  const saveResto = async (id:number, is_featured:boolean, panel_rank:number|null) => {
    await fetch(`${API}/api/admin/restaurants/${id}`, {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ is_featured, panel_rank })
    });
  };

  return (
    <div className="p-6 space-y-8">
      <h2 className="text-xl font-semibold">Curation — Top 3 per municipality</h2>

      <section>
        <h3 className="font-semibold mb-2">Top Dishes</h3>
        <List items={foods} onSave={(it:any, rank:number|null)=>saveDish(it.id, rank!=null, rank)} />
      </section>

      <section>
        <h3 className="font-semibold mb-2">Top Delicacies</h3>
        <List items={delics} onSave={(it:any, rank:number|null)=>saveDish(it.id, rank!=null, rank)} />
      </section>

      <section>
        <h3 className="font-semibold mb-2">Featured Restaurants</h3>
        <List items={restos} onSave={(it:any, rank:number|null)=>saveResto(it.id, rank!=null, rank)} />
      </section>
    </div>
  );
}

function List({ items, onSave }:{ items:any[], onSave:(it:any, rank:number|null)=>void }) {
  return (
    <div className="grid md:grid-cols-2 gap-2">
      {items.map(it => (
        <div key={it.id} className="p-3 border rounded flex items-center justify-between">
          <div className="min-w-0">
            <div className="font-medium truncate">{it.name}</div>
            <div className="text-xs text-neutral-500 truncate">{it.slug}</div>
          </div>
          <div className="flex items-center gap-2">
            {[1,2,3].map(n => (
              <button
                key={n}
                className={`px-2 py-1 rounded text-sm ${it.panel_rank===n ? 'bg-primary-600 text-white' : 'bg-neutral-100'}`}
                onClick={()=>onSave(it, n)}
              >#{n}</button>
            ))}
            <button className="px-2 py-1 rounded text-sm bg-neutral-100" onClick={()=>onSave(it, null)}>Clear</button>
          </div>
        </div>
      ))}
    </div>
  );
}
