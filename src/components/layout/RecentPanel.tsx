import { useEffect, useState, useRef } from 'react';
import { ArrowRightSquare, Clock, X as XIcon, Undo } from 'lucide-react';
import RestaurantCard from '../cards/RestaurantCard';
import DishCard from '../cards/DishCard';
import type { Restaurant, Dish } from '../../utils/api';
import { useRecentVisits } from '../../hooks/useRecentVisits.ts';

const LS_RECENT_DISHES = 'bulacan_recent_dishes_v1';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    return null;
  }
}

export default function RecentPanel() {
  const { recentVisits, removeVisit, clearVisits } = useRecentVisits();
  const [recentDishes, setRecentDishes] = useState<Dish[] | null>(null);
  const undoTimerRef = useRef<any | null>(null);
  const [undo, setUndo] = useState<any | null>(null);

  useEffect(() => {
    setRecentDishes(readJson<Dish[]>(LS_RECENT_DISHES) || []);
    const onClear = () => {
      clearVisits();
      setRecentDishes([]);
    };
    const onRefresh = () => {
      setRecentDishes(readJson<Dish[]>(LS_RECENT_DISHES) || []);
    };
    window.addEventListener('map:sidebarClear', onClear as EventListener);
    window.addEventListener('map:sidebarRefresh', onRefresh as EventListener);
    return () => {
      window.removeEventListener('map:sidebarClear', onClear as EventListener);
      window.removeEventListener('map:sidebarRefresh', onRefresh as EventListener);
    };
  }, [clearVisits]);

  const clearRecent = () => {
    if (!confirm('Clear recently viewed items?')) return;
    // keep a backup for undo
    const backup = {
      dishes: recentDishes || [],
    };
    localStorage.removeItem(LS_RECENT_DISHES);
    clearVisits();
    setRecentDishes([]);
    // show undo
    setUndo({ type: 'clear', payload: backup });
    scheduleUndoReset();
  };

  const scheduleUndoReset = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndo(null), 5000);
  };

  const removeRecentDish = (id: string | number) => {
    const backup = {
      dishes: recentDishes || [],
    };
    const next = (recentDishes || []).filter((d) => String(d.id) !== String(id));
    setRecentDishes(next);
    localStorage.setItem(LS_RECENT_DISHES, JSON.stringify(next));
    setUndo({ type: 'remove', payload: backup });
    scheduleUndoReset();
  };

  const handleUndo = () => {
    if (!undo) return;
    const payload = undo.payload;
    if (payload) {
      setRecentDishes(payload.dishes || []);
      localStorage.setItem(LS_RECENT_DISHES, JSON.stringify(payload.dishes || []));
    }
    setUndo(null);
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  // cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock size={18} />
          <div>
            <h3 className="text-base font-semibold">Recently viewed</h3>
            <p className="text-xs text-neutral-500">Quick access to restaurants and dishes you looked at</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-700">{recentVisits.length + (recentDishes?.length || 0)} items</span>
          <a href="/restaurants" className="btn btn-ghost btn-sm flex items-center gap-2">View all <ArrowRightSquare size={14} /></a>
          <button onClick={clearRecent} className="btn btn-ghost btn-sm text-primary-600" aria-label="Clear recently viewed items">Clear</button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Render recent restaurants from useRecentVisits */}
        {recentVisits.length > 0 && (
          <div className="space-y-2">
            {recentVisits.slice(0, 6).map((visit) => (
              <div key={`rr-${visit.id}`} className="flex items-center gap-3">
                <div className="flex-1">
                  <RestaurantCard 
                    restaurant={{
                      id: visit.id,
                      name: visit.name,
                      lat: visit.lat || undefined,
                      lng: visit.lng || undefined,
                      municipality_name: visit.municipalityName,
                      slug: `restaurant-${visit.id}`
                    } as Restaurant} 
                    compact 
                  />
                </div>
                <button
                  aria-label={`Remove ${visit.name} from recent`}
                  title={`Remove ${visit.name}`}
                  onClick={() => removeVisit(visit.id)}
                  className="btn btn-square btn-ghost btn-sm ml-2"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Render recent dishes */}
        {recentDishes && recentDishes.length > 0 ? (
          recentDishes.slice(0, 6).map((d) => (
            <div key={`rd-${d.id}`} className="flex items-center gap-3">
              <div className="flex-1">
                <DishCard dish={d as any} compact />
              </div>
              <button
                aria-label={`Remove ${d.name} from recent`}
                title={`Remove ${d.name}`}
                onClick={() => removeRecentDish(d.id)}
                className="btn btn-square btn-ghost btn-sm ml-2"
              >
                <XIcon size={14} />
              </button>
            </div>
          ))
        ) : null}

        {/* Empty state */}
        {recentVisits.length === 0 && (!recentDishes || recentDishes.length === 0) && (
          <div className="p-3 bg-neutral-50 rounded-md">
            <p className="text-sm text-neutral-600">You haven't viewed anything yet. Start exploring restaurants or dishes on the map.</p>
          </div>
        )}
      </div>

      {/* Undo snackbar */}
      {undo && (
        <div className="fixed left-6 bottom-6 bg-white shadow-md px-4 py-2 rounded-md flex items-center gap-3">
          <span className="text-sm">Recent items updated</span>
          <button onClick={handleUndo} className="btn btn-ghost btn-sm text-primary-600 flex items-center gap-2"><Undo size={14} />Undo</button>
        </div>
      )}
    </div>
  );
}
