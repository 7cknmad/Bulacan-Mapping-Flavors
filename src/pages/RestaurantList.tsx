import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  fetchRestaurants,
  fetchMunicipalities,
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
  const municipalityId = Number(params.get("municipalityId") || "");
  const dishId = Number(params.get("dishId") || "");
  const kind = (params.get("kind") || "") as Restaurant["kind"] | "";
  const initialQ = params.get("q") || "";

  const [view, setView] = useState<View>("grid");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [q, setQ] = useState(initialQ);
  const [sortBy, setSortBy] = useState<SortKey>("rating");

  // Keep URL in sync for q
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (q) next.set("q", q);
    else next.delete("q");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Context: municipality (optional)
  const muniQ = useQuery<Municipality[]>({
    queryKey: ["municipalities"],
    queryFn: fetchMunicipalities,
  });
  const muni = useMemo(
    () => muniQ.data?.find((m) => m.id === municipalityId) || null,
    [muniQ.data, municipalityId]
  );

  // Load places
  const restosQ = useQuery<Restaurant[]>({
    queryKey: ["restaurants", municipalityId || "all", dishId || "all", kind || "all", q || ""],
    queryFn: () =>
      fetchRestaurants({
        municipalityId: Number.isFinite(municipalityId) ? municipalityId : undefined,
        dishId: Number.isFinite(dishId) ? dishId : undefined,
        kind: kind || undefined,
        q: q || undefined,
      }),
    staleTime: 60_000,
  });

  // Client-side sort (API already sorts rating desc/name asc; this just lets users switch)
  const rows = useMemo(() => {
    const arr = restosQ.data ? [...restosQ.data] : [];
    if (sortBy === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "rating")
      arr.sort(
        (a, b) => (Number(b.rating ?? 0) - Number(a.rating ?? 0)) || a.name.localeCompare(b.name)
      );
    return arr;
  }, [restosQ.data, sortBy]);

  const count = rows.length;

  return (
    <motion.div
      className="pt-20 pb-16 bg-neutral-50 min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 mt-8 flex items-end justify-between gap-3">
          <div>
            <h1 className="mb-2">
              {dishId
                ? "Places serving this dish"
                : muni
                ? `Places in ${muni.name}`
                : "Places to try"}
            </h1>
            <p className="text-neutral-700 max-w-3xl">
              Restaurants, stalls, stores, dealers, and markets linked to our dishes.
            </p>
          </div>
          <Link
            to={muni ? `/map?municipality=${muni.slug}` : "/map"}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-neutral-50"
          >
            ← Back to Map
          </Link>
        </div>

        {/* Search / view / filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon size={18} className="text-neutral-500" />
              </div>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm pl-10 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Search places…"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button
                className={`p-2 rounded-md ${view === "grid" ? "bg-primary-100 text-primary-600" : "bg-neutral-100 text-neutral-600"}`}
                onClick={() => setView("grid")}
                aria-label="Grid view"
              >
                <GridIcon size={20} />
              </button>
              <button
                className={`p-2 rounded-md ${view === "list" ? "bg-primary-100 text-primary-600" : "bg-neutral-100 text-neutral-600"}`}
                onClick={() => setView("list")}
                aria-label="List view"
              >
                <ListIcon size={20} />
              </button>
            </div>
            <button
              className="flex items-center justify-center px-4 py-2 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors"
              onClick={() => setIsFilterOpen((s) => !s)}
            >
              <FilterIcon size={18} className="mr-2" />
              <span>Filters</span>
            </button>
          </div>

          {/* Sort */}
          <div className="flex items-center mt-4">
            <span className="text-sm text-neutral-600 mr-2 flex items-center">
              <SortAscIcon size={16} className="mr-1" /> Sort by:
            </span>
            <button
              className={`text-sm px-3 py-1 rounded-md mr-2 ${sortBy === "rating" ? "bg-primary-100 text-primary-600" : "bg-neutral-100 text-neutral-600"}`}
              onClick={() => setSortBy("rating")}
            >
              Rating
            </button>
            <button
              className={`text-sm px-3 py-1 rounded-md ${sortBy === "name" ? "bg-primary-100 text-primary-600" : "bg-neutral-100 text-neutral-600"}`}
              onClick={() => setSortBy("name")}
            >
              Name
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {isFilterOpen && (
          <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium mb-3 text-neutral-800">Kind</h4>
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
                        className={`px-2 py-1 rounded border ${
                          active ? "bg-primary-600 text-white border-primary-600" : "bg-white hover:bg-neutral-50"
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

        {/* Count */}
        <div className="mb-6">
          <p className="text-neutral-600">Showing {count} place{count === 1 ? "" : "s"}</p>
        </div>

        {/* Results */}
        {restosQ.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton rounded h-40" />
            ))}
          </div>
        ) : restosQ.error ? (
          <div className="text-red-600 p-6 bg-red-50 border border-red-200 rounded">
            {(restosQ.error as Error).message || "Error loading places."}
          </div>
        ) : count === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-neutral-500 mb-4">No places found.</p>
            <button
              onClick={() => setQ("")}
              className="inline-flex items-center px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
            >
              Reset Search
            </button>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rows.map((r) => {
              const cuisines = toArray((r as any).cuisine_types).join(", ");
              return (
                <Link
                  key={r.id}
                  to={`/restaurant/${encodeURIComponent(r.slug || String(r.id))}`}
                  className="bg-white border rounded-xl overflow-hidden hover:shadow transition"
                >
                  <div className="h-28 bg-neutral-100" />
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{r.name}</div>
                      <span className="text-xs px-2 py-1 rounded-full bg-neutral-100">{r.kind}</span>
                    </div>
                    <div className="text-sm text-neutral-600 line-clamp-2">{r.address}</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {r.price_range} • ⭐ {Number(r.rating ?? 0).toFixed(1)}
                      {cuisines && <> • {cuisines}</>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => {
              const cuisines = toArray((r as any).cuisine_types).join(", ");
              return (
                <div key={r.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-1/3">
                      <div className="w-full h-48 md:h-full bg-neutral-100" />
                    </div>
                    <div className="p-4 md:w-2/3">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg">{r.name}</h3>
                        <div className="text-sm text-neutral-700 font-medium">
                          ⭐ {Number(r.rating ?? 0).toFixed(1)}
                        </div>
                      </div>
                      <div className="flex items-center mb-2 text-neutral-600 text-sm flex-wrap gap-x-2">
                        <span>{r.price_range}</span>
                        <span>•</span>
                        <span>{cuisines || "Cuisine"}</span>
                        <span>•</span>
                        <span>{r.kind}</span>
                      </div>
                      <p className="text-neutral-700 mb-4 line-clamp-2">{r.address}</p>
                      <div className="flex justify-end">
                        <Link
                          to={`/restaurant/${encodeURIComponent(r.slug || String(r.id))}`}
                          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
