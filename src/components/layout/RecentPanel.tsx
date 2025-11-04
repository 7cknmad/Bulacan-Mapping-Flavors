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
      {/* Header with Stats */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <Clock size={20} className="text-primary-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-800">Recently viewed</h3>
            <p className="text-xs text-neutral-500">Quick access to places you've explored</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
            {recentVisits.length + (recentDishes?.length || 0)} items
          </span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between bg-neutral-50 rounded-lg p-2">
        <div className="flex gap-2">
          <a 
            href="/restaurants" 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md hover:bg-white transition-colors text-neutral-700 hover:text-primary-600"
          >
            <ArrowRightSquare size={16} />
            View All
          </a>
        </div>
        <button 
          onClick={clearRecent} 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md hover:bg-white transition-colors text-neutral-600 hover:text-red-600"
          aria-label="Clear recently viewed items"
        >
          <XIcon size={16} />
          Clear History
        </button>
      </div>

      <div className="space-y-3">
        {/* Recent Restaurants Section */}
        {recentVisits.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-neutral-500 px-1">Restaurants</h4>
            <div className="space-y-2 rounded-lg overflow-hidden">
              {recentVisits.slice(0, 6).map((visit) => (
                <div 
                  key={`rr-${visit.id}`} 
                  className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg transition-colors group relative"
                >
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
                    className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost rounded-full p-1.5 hover:bg-red-50 hover:text-red-600"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Dishes Section */}
        {recentDishes && recentDishes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-neutral-500 px-1">Dishes</h4>
            <div className="space-y-2 rounded-lg overflow-hidden">
              {recentDishes.slice(0, 6).map((d) => (
                <div 
                  key={`rd-${d.id}`} 
                  className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg transition-colors group relative"
                >
                  <div className="flex-1">
                    <DishCard dish={d as any} compact />
                  </div>
                  <button
                    aria-label={`Remove ${d.name} from recent`}
                    title={`Remove ${d.name}`}
                    onClick={() => removeRecentDish(d.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost rounded-full p-1.5 hover:bg-red-50 hover:text-red-600"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {recentVisits.length === 0 && (!recentDishes || recentDishes.length === 0) && (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
              <Clock size={24} className="text-neutral-400" />
            </div>
            <h3 className="text-neutral-600 font-medium mb-2">No Recent Activity</h3>
            <p className="text-neutral-500 text-sm mb-4 max-w-[240px] mx-auto">
              Start exploring restaurants and dishes on the map to see your history here.
            </p>
            <a 
              href="/map" 
              className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium bg-primary-50 px-4 py-2 rounded-full hover:bg-primary-100 transition-colors"
            >
              <ArrowRightSquare size={16} />
              Explore Map
            </a>
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
