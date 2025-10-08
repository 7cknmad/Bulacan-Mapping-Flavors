// src/components/common/SearchBar.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDishes,
  fetchRestaurants,
  fetchMunicipalities,
  type Dish,
  type Restaurant,
  type Municipality,
} from "../../utils/api";
import { Search as SearchIcon, X as XIcon } from "lucide-react";

function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const MIN_QUERY = 2;

const SearchBar: React.FC = () => {
  const nav = useNavigate();
  const [term, setTerm] = useState("");
  const q = useDebounced(term.trim(), 300);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Live data
  const dishesQ = useQuery<Dish[]>({
    queryKey: ["search", "dishes", q],
    queryFn: () => fetchDishes({ q }),
    enabled: q.length >= MIN_QUERY,
    staleTime: 30_000,
  });

  const restosQ = useQuery<Restaurant[]>({
    queryKey: ["search", "restaurants", q],
    queryFn: () => fetchRestaurants({ q }),
    enabled: q.length >= MIN_QUERY,
    staleTime: 30_000,
  });

  const muniQ = useQuery<Municipality[]>({
    queryKey: ["search", "municipalities"],
    queryFn: fetchMunicipalities,
    staleTime: 5 * 60_000,
  });

  // Client-side filter for municipalities (no search endpoint)
  const muniMatches = useMemo(() => {
    if (q.length < MIN_QUERY) return [];
    const list = muniQ.data ?? [];
    const needle = q.toLowerCase();
    return list
      .filter((m) => m.name.toLowerCase().includes(needle))
      .slice(0, 5);
  }, [q, muniQ.data]);

  const hasResults =
    (dishesQ.data?.length ?? 0) > 0 ||
    (restosQ.data?.length ?? 0) > 0 ||
    muniMatches.length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q) return;
    // Default: go to dishes page search
    nav(`/dishes?q=${encodeURIComponent(q)}`);
    setOpen(false);
  };

  return (
    <div className="relative w-full max-w-xl" ref={wrapRef}>
      <form onSubmit={onSubmit} className="relative">
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
          placeholder="Search dishes, restaurants, municipalities…"
          className="w-full pl-9 pr-9 py-2 rounded-md border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        {term && (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-700"
            aria-label="Clear"
          >
            <XIcon size={16} />
          </button>
        )}
      </form>

      {/* Results popover */}
      {open && q.length >= MIN_QUERY && (
        <div className="absolute z-50 mt-2 w-full rounded-md border bg-white shadow-lg overflow-hidden">
          {/* Loading states */}
          {(dishesQ.isLoading || restosQ.isLoading || muniQ.isLoading) && (
            <div className="p-3 text-sm text-neutral-600">Searching…</div>
          )}

          {/* Results */}
          {!dishesQ.isLoading && !restosQ.isLoading && (
            <>
              {muniMatches.length > 0 && (
                <Section title="Municipalities">
                  {muniMatches.map((m) => (
                    <ResultRow
                      key={`muni-${m.id}`}
                      to={`/map?municipality=${encodeURIComponent(m.slug)}`}
                      title={m.name}
                      subtitle={m.province}
                      onClick={() => setOpen(false)}
                    />
                  ))}
                </Section>
              )}

              {(dishesQ.data?.length ?? 0) > 0 && (
                <Section title="Dishes">
                  {dishesQ.data!.slice(0, 6).map((d) => (
                    <ResultRow
                      key={`dish-${d.id}`}
                      to={`/dish/${encodeURIComponent(d.slug || String(d.id))}`}
                      title={d.name}
                      subtitle={`${d.municipality_name ?? ""} • ${d.category?.toUpperCase?.() ?? ""}`}
                      onClick={() => setOpen(false)}
                    />
                  ))}
                </Section>
              )}

              {(restosQ.data?.length ?? 0) > 0 && (
                <Section title="Restaurants">
                  {restosQ.data!.slice(0, 6).map((r) => (
                    <ResultRow
                      key={`resto-${r.id}`}
                      to={`/restaurant/${encodeURIComponent(r.slug || String(r.id))}`}
                      title={r.name}
                      subtitle={(r.address || "").split(",")[0] || ""}
                      onClick={() => setOpen(false)}
                    />
                  ))}
                </Section>
              )}

              {!hasResults && (
                <div className="p-3 text-sm text-neutral-500">No results for “{q}”.</div>
              )}

              {/* View all (dishes) */}
              {hasResults && (
                <div className="border-t">
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-primary-600 hover:bg-primary-50"
                    onClick={() => {
                      nav(`/dishes?q=${encodeURIComponent(q)}`);
                      setOpen(false);
                    }}
                  >
                    View all results for “{q}”
                  </button>
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
      <div className="px-3 pb-1 text-xs font-semibold text-neutral-500 uppercase">{title}</div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function ResultRow({
  to,
  title,
  subtitle,
  onClick,
}: {
  to: string;
  title: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      className="px-3 py-2 hover:bg-neutral-50 flex flex-col"
      onClick={onClick}
    >
      <span className="text-sm text-neutral-900">{title}</span>
      {subtitle && <span className="text-xs text-neutral-500">{subtitle}</span>}
    </Link>
  );
}

export default SearchBar;
