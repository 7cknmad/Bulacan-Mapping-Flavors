import { Search as SearchIcon, X as XIcon } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDishes, fetchRestaurants, fetchMunicipalities } from '../../utils/api';
import { Link, useNavigate } from 'react-router-dom';

// Reusable hook for debouncing values
function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const MIN_QUERY = 2;

interface SearchResult {
  type: 'municipality' | 'restaurant' | 'dish';
  id: string | number;
  name: string;
  subtitle?: string;
  slug?: string;
  coordinates?: [number, number]; // [lat, lng]
}

interface MapSearchProps {
  onSelectResult?: (result: SearchResult) => void;
  className?: string;
}

const MapSearch: React.FC<MapSearchProps> = ({ onSelectResult, className = '' }) => {
  const nav = useNavigate();
  const [term, setTerm] = useState('');
  const q = useDebounced(term.trim(), 300);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'municipalities' | 'restaurants'>('all');

  // Live data
  const dishesQ = useQuery({
    queryKey: ['search', 'dishes', q],
    queryFn: () => fetchDishes({ q }),
    enabled: q.length >= MIN_QUERY && (activeTab === 'all'),
    staleTime: 30_000,
  });

  const restosQ = useQuery({
    queryKey: ['search', 'restaurants', q],
    queryFn: () => fetchRestaurants({ q }),
    enabled: q.length >= MIN_QUERY && (activeTab === 'all' || activeTab === 'restaurants'),
    staleTime: 30_000,
  });

  const muniQ = useQuery({
    queryKey: ['search', 'municipalities'],
    queryFn: fetchMunicipalities,
    staleTime: 5 * 60_000,
  });

  // Client-side filter for municipalities
  const muniMatches = React.useMemo(() => {
    if (q.length < MIN_QUERY) return [];
    const list = muniQ.data ?? [];
    const needle = q.toLowerCase();
    return list
      .filter((m) => m.name.toLowerCase().includes(needle))
      .slice(0, 5);
  }, [q, muniQ.data]);

  const hasResults =
    (activeTab === 'all' && ((dishesQ.data?.length ?? 0) > 0 || (restosQ.data?.rows?.length ?? 0) > 0 || muniMatches.length > 0)) ||
    (activeTab === 'municipalities' && muniMatches.length > 0) ||
    (activeTab === 'restaurants' && (restosQ.data?.rows?.length ?? 0) > 0);

  // Close when clicking outside
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    onSelectResult?.(result);
    setOpen(false);
    setTerm('');
  };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <div className="relative">
        <SearchIcon
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
        />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search municipalities, restaurants..."
          className="w-full pl-9 pr-9 py-2 rounded-md border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white shadow-sm"
        />
        {term && (
          <button
            type="button"
            onClick={() => {
              setTerm('');
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-700"
            aria-label="Clear search"
          >
            <XIcon size={16} />
          </button>
        )}
      </div>

      {/* Results popover */}
      {open && q.length >= MIN_QUERY && (
        <div className="absolute z-50 mt-2 w-full rounded-md border bg-white shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="border-b flex text-sm">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 px-4 py-2 font-medium ${
                activeTab === 'all'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('municipalities')}
              className={`flex-1 px-4 py-2 font-medium ${
                activeTab === 'municipalities'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              Places
            </button>
            <button
              onClick={() => setActiveTab('restaurants')}
              className={`flex-1 px-4 py-2 font-medium ${
                activeTab === 'restaurants'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              Restaurants
            </button>
          </div>

          {/* Loading states */}
          {(dishesQ.isLoading || restosQ.isLoading || muniQ.isLoading) && (
            <div className="p-3 text-sm text-neutral-600">Searching…</div>
          )}

          {/* Results */}
          {!dishesQ.isLoading && !restosQ.isLoading && (
            <>
              {(activeTab === 'all' || activeTab === 'municipalities') && muniMatches.length > 0 && (
                <Section title="Municipalities">
                  {muniMatches.map((m) => (
                    <ResultRow
                      key={`muni-${m.id}`}
                      title={m.name}
                      subtitle={m.province || 'Bulacan'}
                      onClick={() => handleSelectResult({
                        type: 'municipality',
                        id: m.id,
                        name: m.name,
                        slug: m.slug,
                      })}
                    />
                  ))}
                </Section>
              )}

              {activeTab === 'all' && (dishesQ.data?.length ?? 0) > 0 && (
                <Section title="Dishes">
                  {dishesQ.data!.slice(0, 6).map((d) => (
                    <ResultRow
                      key={`dish-${d.id}`}
                      title={d.name}
                      subtitle={`${d.municipality_name ?? ""} • ${d.category?.toUpperCase?.() ?? ""}`}
                      onClick={() => {
                        nav(`/dish/${encodeURIComponent(d.slug || String(d.id))}`);
                        setOpen(false);
                      }}
                    />
                  ))}
                </Section>
              )}

              {(activeTab === 'all' || activeTab === 'restaurants') && (restosQ.data?.rows?.length ?? 0) > 0 && (
                <Section title="Restaurants">
                  {restosQ.data!.rows.slice(0, 6).map((r) => (
                    <ResultRow
                      key={`resto-${r.id}`}
                      title={r.name}
                      subtitle={(r.address || "").split(",")[0] || ""}
                      onClick={() => handleSelectResult({
                        type: 'restaurant',
                        id: r.id,
                        name: r.name,
                        coordinates: r.lat && r.lng ? [r.lat, r.lng] : undefined,
                      })}
                    />
                  ))}
                </Section>
              )}

              {!hasResults && (
                <div className="p-3 text-sm text-neutral-500">
                  No {activeTab === 'all' ? 'results' : activeTab} found for "{q}".
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <div className="px-3 pb-1 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function ResultRow({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 hover:bg-neutral-50 flex flex-col items-start text-left w-full"
    >
      <span className="text-sm text-neutral-900">{title}</span>
      {subtitle && <span className="text-xs text-neutral-500">{subtitle}</span>}
    </button>
  );
}

export default MapSearch;