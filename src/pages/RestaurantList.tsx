import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import InteractiveMap from "../components/map/InteractiveMap";
import RestaurantCard from "../components/cards/RestaurantCard";
import showToast from '../utils/toast';

// InteractiveMap is reused as a compact preview in the list view


import {
  fetchRestaurants,
  fetchMunicipalities,
  fetchDishes,
  type Restaurant,
  type Municipality,
} from "../utils/api";
import {
  Filter as FilterIcon,
  Search as SearchIcon,
  Grid as GridIcon,
  List as ListIcon,
  SortAsc as SortAscIcon,
} from "lucide-react";

/** Safely coerce DB JSON columns (which may arrive as strings) into arrays */
function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (v == null) return [];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

type View = "grid" | "list";
type SortKey = "rating" | "name";
const kinds: Array<Restaurant["kind"] | ""> = ["", "restaurant", "stall", "store", "dealer", "market", "home-based"];

export default function RestaurantList() {
  const [params, setParams] = useSearchParams();
  const municipalityIdParam = params.get("municipalityId");
  const municipalityId = municipalityIdParam ? Number(municipalityIdParam) : undefined;
  const dishIdParam = params.get("dishId");
  const dishId = dishIdParam ? Number(dishIdParam) : undefined;
  const kind = (params.get("kind") || "") as Restaurant["kind"] | "";
  const initialQ = params.get("q") || "";

  const [view, setView] = useState<View>("grid");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [q, setQ] = useState(initialQ);
  const [sortBy, setSortBy] = useState<SortKey>("rating");
  // Near-me state
  const [nearMeEnabled, setNearMeEnabled] = useState<boolean>(false);
  const [nearMeRadiusKm, setNearMeRadiusKm] = useState<number>(10); // default 10km
  const [userPosition, setUserPosition] = useState<{lat:number; lng:number} | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const navigate = useNavigate();
  // Dish suggestion state (searching for dish names to filter restaurants)
  const [dishSuggestions, setDishSuggestions] = useState<Array<{id:number; name:string}> | null>(null);
  const [activeDishFilter, setActiveDishFilter] = useState<{id:number; name?:string} | null>(null);

  // Keep URL in sync for q
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (q) next.set("q", q);
    else next.delete("q");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Restore last selected dish filter from localStorage if params contain dishId
  useEffect(() => {
    const pid = params.get('dishId');
    if (pid) {
      // Try to restore a friendly name from localStorage
      try {
        const stored = localStorage.getItem('lastDishFilter');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && String(parsed.id) === String(pid)) {
            setActiveDishFilter({ id: Number(parsed.id), name: parsed.name });
            return;
          }
        }
      } catch {}
      // Fallback: set id-only placeholder
      setActiveDishFilter({ id: Number(pid) });
    } else {
      setActiveDishFilter(null);
    }
  }, [params]);

  // Fetch dish suggestions when user types (debounced)
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
  const [announce, setAnnounce] = useState<string>('');
  const listboxId = 'dish-suggestions-listbox';
  const [showResults, setShowResults] = useState<boolean>(true);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState<boolean>(false);
  useEffect(() => {
    let mounted = true;
    if (!q || q.trim().length < 2) {
      setDishSuggestions(null);
      // keep results hidden while composing a very short query
      return;
    }
    // Debounce fetching suggestions; when the debounce completes we will
    // automatically reveal results so users see updated places as they type.
    const t = setTimeout(async () => {
      if (mounted) setIsFetchingSuggestions(true);
      try {
        const found = await fetchDishes({ q: q.trim() });
  if (!mounted) return;
  const items = (found || []).slice(0, 6).map(d => ({ id: d.id, name: d.name }));
  setDishSuggestions(items);
  setActiveSuggestion(items.length ? 0 : -1);
  setAnnounce(items.length ? `${items.length} suggestions` : 'no suggestions');
      } catch (err) {
        if (!mounted) return;
        setDishSuggestions([]);
        setActiveSuggestion(-1);
        setAnnounce('failed to fetch suggestions');
      } finally {
        if (mounted) {
          // Auto-show results after the debounce completes (success or error)
          setShowResults(true);
          setIsFetchingSuggestions(false);
        }
      }
    }, 250);
    return () => { mounted = false; clearTimeout(t); };
  }, [q]);

  // keyboard handling for suggestions
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dishSuggestions || dishSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion((s) => Math.min((dishSuggestions?.length || 0) - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion((s) => Math.max(0, s - 1));
    } else if (e.key === 'Escape') {
      setDishSuggestions(null);
      setActiveSuggestion(-1);
    } else if (e.key === 'Enter') {
      if (activeSuggestion >= 0 && dishSuggestions[activeSuggestion]) {
        const s = dishSuggestions[activeSuggestion];
        const next = new URLSearchParams(params);
        next.set('dishId', String(s.id));
        setParams(next);
        // persist selected dish filter name for badge display
        try { localStorage.setItem('lastDishFilter', JSON.stringify({ id: s.id, name: s.name })); } catch {}
        setActiveDishFilter({ id: s.id, name: s.name });
        setShowResults(true);
      } else {
        // Treat Enter as submit to show matching restaurants for q
        setShowResults(true);
      }
    }
  };

  // Announce active suggestion changes to screen readers
  useEffect(() => {
    if (!dishSuggestions) return;
    if (activeSuggestion >= 0 && dishSuggestions[activeSuggestion]) {
      setAnnounce(`Highlighted ${dishSuggestions[activeSuggestion].name}`);
    }
  }, [activeSuggestion, dishSuggestions]);

  // Context: municipality (optional)
  const muniQ = useQuery<Municipality[]>({
    queryKey: ["municipalities"],
    queryFn: fetchMunicipalities,
  });
  const muni = useMemo(
    () => muniQ.data?.find((m) => m.id === municipalityId) || null,
    [muniQ.data, municipalityId]
  );

  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(50);

  // Load places (paginated response)
  const restosQ = useQuery<{ rows: Restaurant[]; total: number }>({
    queryKey: ["restaurants", municipalityId || "all", dishId || "all", kind || "all", q || "", nearMeEnabled, userPosition?.lat, userPosition?.lng, nearMeRadiusKm, page, perPage],
    queryFn: async () => {
      const res = await fetchRestaurants({
        municipalityId: Number.isFinite(municipalityId) ? municipalityId : undefined,
        dishId: Number.isFinite(dishId) ? dishId : undefined,
        q: q || undefined,
        lat: nearMeEnabled && userPosition ? userPosition.lat : undefined,
        lng: nearMeEnabled && userPosition ? userPosition.lng : undefined,
        radiusKm: nearMeEnabled ? nearMeRadiusKm : undefined,
        page,
        perPage,
      });
      return res;
    },
    staleTime: 60_000,
  });

  const restosData = restosQ.data;
  const rows = useMemo(() => {
    const arr = restosData?.rows ? [...restosData.rows] : [];
    if (sortBy === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "rating")
      arr.sort(
        (a, b) => (Number(b.rating ?? 0) - Number(a.rating ?? 0)) || a.name.localeCompare(b.name)
      );
    return arr;
  }, [restosData?.rows, sortBy]);
  const total = restosData?.total ?? 0;

  // rows is computed from restosData above (server response .rows)

  // Server-side filtered rows (server will apply proximity when requested)
  const filteredRows = rows;

  const count = total;

  return (
    <motion.div
      className="pt-20 pb-16 bg-gray-50 min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
    >
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8 mt-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex-1">
            <h1 className="mb-3 text-2xl md:text-3xl font-bold text-gray-900">
              {dishId
                ? "Places serving this dish"
                : muni
                ? `Places in ${muni.name}`
                : "Places to try"}
            </h1>
            <p className="text-gray-600 text-base md:text-lg max-w-3xl">
              Restaurants, stalls, stores, dealers, and markets linked to our dishes.
            </p>
          </div>
          <Link
            to={muni ? `/map?municipality=${muni.slug}` : "/map"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50 transition-colors text-gray-700 font-medium"
          >
            ← Back to Map
          </Link>
        </div>

        {/* Search / view / filters */}
        <div className="bg-white p-5 rounded-xl shadow-sm mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <SearchIcon size={18} className="text-gray-500" />
              </div>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                ref={el => { inputRef.current = el; }}
                onKeyDown={onInputKeyDown}
                onFocus={() => setShowResults(false)}
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={activeSuggestion >= 0 && dishSuggestions ? `dish-suggestion-${dishSuggestions[activeSuggestion].id}` : undefined}
                className="w-full rounded-lg border-gray-300 px-4 py-2.5 text-sm pl-11 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow shadow-sm hover:shadow-md"
                placeholder="Search places…"
              />
              {/* small spinner inside the input while fetching suggestions */}
              {isFetchingSuggestions ? (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="animate-spin h-4 w-4 text-neutral-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                </div>
              ) : null}
              {q ? (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    className="text-neutral-500 hover:text-neutral-700"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQ(''); setShowResults(false); }}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                </div>
              ) : null}
              {dishSuggestions && dishSuggestions.length > 0 ? (
                <div id={listboxId} role="listbox" className="absolute z-20 mt-1 left-0 right-0 bg-white border rounded shadow-md max-h-64 overflow-auto">
                  {isFetchingSuggestions ? (
                    <div className="absolute top-2 right-2">
                      <svg className="animate-spin h-4 w-4 text-neutral-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    </div>
                  ) : null}
                  {dishSuggestions.map((s, i) => (
                    <button
                      id={`dish-suggestion-${s.id}`}
                      key={s.id}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set('dishId', String(s.id));
                        setParams(next);
                        // persist selected dish filter name for badge display
                        try { localStorage.setItem('lastDishFilter', JSON.stringify({ id: s.id, name: s.name })); } catch {}
                        setActiveDishFilter({ id: s.id, name: s.name });
                        setShowResults(true);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-neutral-50 ${i === activeSuggestion ? 'bg-neutral-100' : ''}`}
                      role="option"
                      aria-selected={i === activeSuggestion}
                    >{s.name}</button>
                  ))}
                </div>
              ) : null}
              {/* ARIA live region for screen readers */}
              <div aria-live="polite" className="sr-only">{announce}</div>
              {/* Active dish filter badge */}
              {activeDishFilter ? (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm">
                    Filter: {activeDishFilter.name ? activeDishFilter.name : `dish ${activeDishFilter.id}`}
                    <button onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); const next = new URLSearchParams(params); next.delete('dishId'); setParams(next); setActiveDishFilter(null); try{ localStorage.removeItem('lastDishFilter'); }catch{} }} className="ml-2 text-xs text-primary-600 underline">Clear</button>
                  </span>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`p-2.5 rounded-lg transition-colors ${view === "grid" ? "bg-primary-100 text-primary-600 shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                onClick={() => setView("grid")}
                aria-label="Grid view"
              >
                <GridIcon size={20} />
              </button>
              <button
                className={`p-2.5 rounded-lg transition-colors ${view === "list" ? "bg-primary-100 text-primary-600 shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                onClick={() => setView("list")}
                aria-label="List view"
              >
                <ListIcon size={20} />
              </button>
            </div>
            {/* Near-Me toggle */}
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input 
                  type="checkbox" 
                  checked={nearMeEnabled} 
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  onChange={async (e) => {
                  const want = e.target.checked;
                  setNearMeEnabled(want);
                  if (!want) {
                    setUserPosition(null);
                    setIsLocating(false);
                    return;
                  }
                  // request location
                  if (!navigator.geolocation) {
                    showToast('Geolocation is not supported by your browser', 'error');
                    setNearMeEnabled(false);
                    return;
                  }
                  setIsLocating(true);
                  navigator.geolocation.getCurrentPosition((pos) => {
                    setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setIsLocating(false);
                  }, (err) => {
                    console.warn('geolocation error', err);
                    showToast('Unable to retrieve your location', 'error');
                    setIsLocating(false);
                    setNearMeEnabled(false);
                  }, { enableHighAccuracy: true, timeout: 10000 });
                }} />
                Near me
              </label>
              {nearMeEnabled ? (
                <select 
                  value={nearMeRadiusKm} 
                  onChange={(e) => setNearMeRadiusKm(Number(e.target.value))} 
                  className="text-sm rounded-lg border-gray-300 px-3 py-2 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  {[1,3,5,10,20,50].map(n => <option key={n} value={n}>{n} km</option>)}
                </select>
              ) : null}
              {isLocating ? (
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Locating…
                </div>
              ) : null}
              {userPosition ? (
                <button
                  className="px-4 py-2 text-sm rounded-lg border border-primary-500 bg-primary-500 text-white shadow-sm hover:bg-primary-600 transition-colors font-medium"
                  onClick={() => navigate(`/map?lat=${userPosition.lat}&lng=${userPosition.lng}&radiusKm=${nearMeRadiusKm}`)}
                  aria-label="Open nearby results on the map"
                >
                  Open on map
                </button>
              ) : null}
            </div>
            <button
              className="flex items-center justify-center px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium shadow-sm"
              onClick={() => setIsFilterOpen((s) => !s)}
            >
              <FilterIcon size={18} className="mr-2" />
              <span>Filters</span>
            </button>
          </div>

          {/* Sort */}
          <div className="flex items-center mt-4 pt-4 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-700 mr-3 flex items-center">
              <SortAscIcon size={16} className="mr-2 text-gray-500" /> Sort by:
            </span>
            <div className="flex gap-2">
              <button
                className={`text-sm px-4 py-2 rounded-lg transition-colors font-medium ${
                  sortBy === "rating" 
                    ? "bg-primary-100 text-primary-600 shadow-sm" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => setSortBy("rating")}
              >
                Rating
              </button>
              <button
                className={`text-sm px-4 py-2 rounded-lg transition-colors font-medium ${
                  sortBy === "name" 
                    ? "bg-primary-100 text-primary-600 shadow-sm" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => setSortBy("name")}
              >
                Name
              </button>
            </div>
          </div>
        </div>

        {/* Filter panel */}
        {isFilterOpen && (
          <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h4 className="font-semibold mb-4 text-gray-900">Kind</h4>
                <div className="flex gap-2 flex-wrap">
                  {kinds.map((k) => {
                    const active = (kind || "") === k;
                    const next = new URLSearchParams(params);
                    if (k) next.set("kind", k);
                    else next.delete("kind");
                    return (
                      <Link
                        key={k || "all"}
                        to={`?${next.toString()}`}
                        className={`px-3 py-1.5 rounded-lg border transition-colors ${
                          active 
                            ? "bg-primary-500 text-white border-primary-500 shadow-sm" 
                            : "bg-white hover:bg-gray-50 border-gray-300 text-gray-700"
                        }`}
                      >
                        {k || "All"}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3 text-neutral-800">Minimum rating</h4>
                <div className="flex gap-2">
                  {[0, 3, 4, 4.5].map((r) => (
                    <button
                      key={r}
                      className="px-2 py-1 rounded border bg-white hover:bg-neutral-50 text-sm"
                      onClick={() => setSortBy("rating")}
                      title={`Show places ≥ ${r}`}
                    >
                      {r === 0 ? "Any" : `${r}+`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3 text-neutral-800">Quick tip</h4>
                <div className="text-sm text-neutral-600">
                  Use search for cuisine types (e.g., “Filipino”, “Seafood”).
                </div>
              </div>
            </div>
          </div>
        )}

          {/* Count + Results (hidden while user is typing) */}
        {!showResults ? (
          <div className="mb-6">
            <p className="text-neutral-600">Type a query and press Enter or pick a suggestion to show results.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-neutral-600">Showing {count} place{count === 1 ? "" : "s"}</p>
              {/* small Leaflet mini-map */}
              {(userPosition || (rows && rows.some(r => typeof (r as any).lat === 'number' && typeof (r as any).lng === 'number'))) && (
                <div className="ml-4 w-40 h-24 bg-white border rounded overflow-hidden">
                  <InteractiveMap compact restaurantMarkers={rows} userLocationOverride={userPosition ? [userPosition.lat, userPosition.lng] : null} />
                </div>
              )}
            </div>

            {restosQ.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-white rounded-xl shadow-sm border border-gray-200 h-64" />
                ))}
              </div>
            ) : restosQ.error ? (
              <div className="p-8 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-lg font-medium text-red-800 mb-2">Unable to Load Places</p>
                <p className="text-red-600">{(restosQ.error as Error).message || "Error loading places."}</p>
              </div>
            ) : count === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
                <p className="text-lg font-medium text-gray-900 mb-3">No Places Found</p>
                <p className="text-gray-600 mb-6">Try adjusting your search or filters to find what you're looking for.</p>
                <button
                  onClick={() => setQ("")}
                  className="inline-flex items-center px-6 py-2.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors font-medium shadow-sm"
                >
                  Reset Search
                </button>
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRows.map((r) => {
                  return (
                    <div key={r.id} className="relative group">
                      <RestaurantCard restaurant={r} />
                      {((r as any).lat && (r as any).lng) && (
                        <div className="mt-2 flex items-center justify-between">
                          {userPosition && (
                            <span className="text-xs text-primary-600">
                              {(((r as any).distance_km ?? (r as any).distance) >= 1 
                                ? `${(((r as any).distance_km ?? (r as any).distance)).toFixed(1)} km` 
                                : `${Math.round(((r as any).distance_km ?? (r as any).distance) * 1000)} m`)} away
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const restaurantData = {
                                id: r.id,
                                lat: r.lat,
                                lng: r.lng,
                                name: r.name,
                                kind: r.kind || 'restaurant',
                                address: r.address
                              };
                              navigate(`/map?highlight=restaurant&id=${r.id}&lat=${r.lat}&lng=${r.lng}&name=${encodeURIComponent(r.name)}&kind=${r.kind || 'restaurant'}${r.address ? `&address=${encodeURIComponent(r.address)}` : ''}`);
                              // Dispatch custom event to notify map
                              window.dispatchEvent(new CustomEvent('showRestaurant', { 
                                detail: restaurantData 
                              }));
                            }}
                            className="text-xs text-primary-600 hover:text-primary-700 underline"
                          >
                            Show on map
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRows.map((r) => (
                  <div key={r.id} className="relative group">
                    <RestaurantCard restaurant={r} compact />
                    {((r as any).lat && (r as any).lng) && (
                      <div className="mt-2 flex items-center justify-between">
                        {userPosition && (
                          <span className="text-sm text-primary-600">
                            {(((r as any).distance_km ?? (r as any).distance) >= 1 
                              ? `${(((r as any).distance_km ?? (r as any).distance)).toFixed(1)} km` 
                              : `${Math.round(((r as any).distance_km ?? (r as any).distance) * 1000)} m`)} away
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const restaurantData = {
                              id: r.id,
                              lat: r.lat,
                              lng: r.lng,
                              name: r.name,
                              kind: r.kind || 'restaurant',
                              address: r.address
                            };
                            navigate(`/map?highlight=restaurant&id=${r.id}&lat=${r.lat}&lng=${r.lng}&name=${encodeURIComponent(r.name)}&kind=${r.kind || 'restaurant'}${r.address ? `&address=${encodeURIComponent(r.address)}` : ''}`);
                            // Dispatch custom event to notify map
                            window.dispatchEvent(new CustomEvent('showRestaurant', { 
                              detail: restaurantData 
                            }));
                          }}
                          className="text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
                          </svg>
                          Show on map
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Pagination controls */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-6">
              <div className="text-sm font-medium text-gray-700">
                Showing {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} of {total}
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium flex items-center gap-3 text-gray-700">
                  Per page:
                  <select 
                    value={perPage} 
                    onChange={(e) => { const v = Number(e.target.value); setPerPage(v); setPage(1); }} 
                    className="text-sm rounded-lg border-gray-300 px-3 py-2 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors text-gray-700 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Prev
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-gray-700">Page</div>
                    <input 
                      type="number" 
                      min={1} 
                      value={page} 
                      onChange={(e) => { 
                        const v = Math.max(1, Number(e.target.value) || 1); 
                        setPage(v); 
                      }} 
                      className="w-16 text-sm rounded-lg border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:ring-primary-500" 
                    />
                  </div>
                  <button
                    className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors text-gray-700 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * perPage >= total}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
