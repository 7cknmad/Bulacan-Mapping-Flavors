import AsyncSelect from 'react-select/async';
import { useState } from 'react';
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export default function LinkDishRestaurant() {
  const [dish, setDish] = useState<any>(null);
  const [resto, setResto] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadDishes = async (input: string) => {
    const res = await fetch(`${API}/api/admin/search/dishes?q=${encodeURIComponent(input)}`, { credentials:'include' });
    const rows = await res.json(); return rows.map((r:any)=>({ value:r.id, label:`${r.name} (${r.category})` }));
  };
  const loadRestos = async (input: string) => {
    const res = await fetch(`${API}/api/admin/search/restaurants?q=${encodeURIComponent(input)}`, { credentials:'include' });
    const rows = await res.json(); return rows.map((r:any)=>({ value:r.id, label:r.name }));
  };

  const link = async () => {
    if (!dish || !resto) return;
    const res = await fetch(`${API}/api/admin/dish-restaurants`, {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ dish_id: dish.value, restaurant_id: resto.value })
    });
    setMsg(res.ok ? 'Linked!' : 'Failed');
  };

  return (
    <div className="p-6 space-y-3">
      <h2 className="text-xl font-semibold">Link Dish ↔ Restaurant</h2>
      <AsyncSelect cacheOptions defaultOptions loadOptions={loadDishes} onChange={setDish as any} placeholder="Search dish by name…" />
      <AsyncSelect cacheOptions defaultOptions loadOptions={loadRestos} onChange={setResto as any} placeholder="Search restaurant by name…" />
      <button className="btn btn-primary" onClick={link}>Link</button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
