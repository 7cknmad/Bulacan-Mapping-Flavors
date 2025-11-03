import React, { useEffect, useState } from 'react';
import { Button } from './ui';
import { assetUrl } from '../../utils/assets';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3002';

async function getJSON(url: string) {
  const res = await fetch(url);
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt);
}

export default function RecommendationsPanel({ onClose }: { onClose: () => void }) {
  const [municipalities, setMunicipalities] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedMuni, setSelectedMuni] = useState<number | null>(null);
  const [dishes, setDishes] = useState<any[] | null>(null);
  const [currentRec, setCurrentRec] = useState<any | null>(null);
  const [selectedDish, setSelectedDish] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await getJSON(`${API}/api/municipalities`);
        if (canceled) return;
        // Transform data to include OSM IDs for dishes-summary endpoint
        const processed = (Array.isArray(data) ? data : (data?.rows ?? data)).map((m: any) => ({
          ...m,
          id: m.osm_relation_id || m.osm_id || m.id // Prefer OSM IDs
        }));
        setMunicipalities(processed);
      } catch (e: any) {
        if (!canceled) setError(String(e?.message || e));
      } finally { if (!canceled) setLoading(false); }
    })();
    return () => { canceled = true; };
  }, []);

  useEffect(() => {
    if (!selectedMuni) {
      setDishes(null); setCurrentRec(null); setSelectedDish(null); return;
    }
    let canceled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const ds = await getJSON(`${API}/api/dishes?municipalityId=${selectedMuni}&limit=200`);
        if (canceled) return;
        setDishes(Array.isArray(ds) ? ds : (ds?.rows ?? ds));
        const summary = await getJSON(`${API}/api/municipalities/${selectedMuni}/dishes-summary`);
        if (canceled) return;
        setCurrentRec(summary?.recommendedDish ?? null);
        setSelectedDish(summary?.recommendedDish?.id ?? null);
      } catch (e: any) {
        if (!canceled) setError(String(e?.message || e));
      } finally { if (!canceled) setLoading(false); }
    })();
    return () => { canceled = true; };
  }, [selectedMuni]);

  async function saveRecommendation() {
    if (!selectedMuni) return setError('Please pick a municipality');
    setSaving(true); setError(null);
    try {
      // If there's an existing recommended dish different from selected, clear it
      if (currentRec && currentRec.id && currentRec.id !== selectedDish) {
        await fetch(`${API}/admin/curate/dishes/${currentRec.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ panel_rank: 0 })
        });
      }

      if (selectedDish) {
        await fetch(`${API}/admin/curate/dishes/${selectedDish}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ panel_rank: 1 })
        });
      } else {
        // no dish selected => just ensure municipality cleared by clearing the previous dish (done above)
      }

      // notify other UI
      try { window.dispatchEvent(new CustomEvent('dish-curation-updated', { detail: { municipalityId: selectedMuni, dishId: selectedDish } })); } catch (e) {}

      // refresh local state
      const summary = await getJSON(`${API}/api/municipalities/${selectedMuni}/dishes-summary`);
      setCurrentRec(summary?.recommendedDish ?? null);
      setSelectedDish(summary?.recommendedDish?.id ?? null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Manage Recommendations</h3>
        <div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Municipality</label>
          <select className="w-full border rounded px-3 py-2" value={selectedMuni ?? ''} onChange={(e)=>setSelectedMuni(e.target.value?Number(e.target.value):null)}>
            <option value="">Select municipality</option>
            {(municipalities ?? []).map((m:any)=>(<option key={m.id ?? m.municipality_id} value={m.id ?? m.municipality_id}>{m.name ?? m.municipality_name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Current Recommended Dish</label>
          <div className="p-3 border rounded bg-neutral-50">
            {currentRec ? (
              <div className="flex items-center gap-3">
                <img src={currentRec.image_url ? (currentRec.image_url.startsWith('http') ? currentRec.image_url : assetUrl(currentRec.image_url)) : assetUrl('images/placeholders/dish.jpg')} alt={currentRec.name} className="w-14 h-14 object-cover rounded" />
                <div>
                  <div className="font-semibold">{currentRec.name}</div>
                  <div className="text-sm text-neutral-600">ID: {currentRec.id}</div>
                </div>
              </div>
            ) : (<div className="text-sm text-neutral-600">None</div>)}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium text-neutral-600 mb-1">Pick Dish to Recommend (leave empty to clear)</label>
        <select className="w-full border rounded px-3 py-2" value={selectedDish ?? ''} onChange={(e)=>setSelectedDish(e.target.value?Number(e.target.value):null)}>
          <option value="">-- Clear recommendation --</option>
          {(dishes ?? []).map((d:any)=> (<option key={d.id} value={d.id}>{d.name} {d.avg_rating?`· ${Number(d.avg_rating).toFixed(1)}⭐` : ''}</option>))}
        </select>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={saveRecommendation} disabled={saving}>{saving ? 'Saving...' : 'Save Recommendation'}</Button>
        <Button variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
