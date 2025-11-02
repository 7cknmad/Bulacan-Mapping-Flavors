import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Filter as FilterIcon } from 'lucide-react';
import {
  fetchDishes,
  fetchMunicipalities,
  type Dish,
  type Municipality,
} from "../utils/api";
import { motion } from "framer-motion";
import DishCard from "../components/cards/DishCard";
import FiltersModal from "../components/FiltersModal";
import { FilterOptions } from "../utils/constants";

type Cat = "all" | "food" | "delicacy" | "drink";
type SortKey = "popularity" | "rating" | "name" | "price_low" | "price_high";
type ViewMode = "grid" | "list";
type PriceRange = "all" | "budget" | "mid" | "premium";
type DietaryOption = "vegetarian" | "vegan" | "halal" | "gluten_free";
type SpicyLevel = "not_spicy" | "mild" | "medium" | "hot" | "very_hot";

interface FilterOptions {
  priceRange: PriceRange;
  dietary: DietaryOption[];
  spicyLevel: SpicyLevel | "all";
}

const categoryTabs: { key: Cat; label: string }[] = [
  { key: "all", label: "All" },
  { key: "food", label: "Food" },
  { key: "delicacy", label: "Delicacies" },
  { key: "drink", label: "Drinks" },
];

const priceRangeOptions: { key: PriceRange; label: string; description: string }[] = [
  { key: "all", label: "All Prices", description: "Show all price ranges" },
  { key: "budget", label: "Budget", description: "Under ₱100" },
  { key: "mid", label: "Mid-Range", description: "₱100 - ₱300" },
  { key: "premium", label: "Premium", description: "Above ₱300" }
];

const dietaryOptions: { key: DietaryOption; label: string; icon: string }[] = [
  { key: "vegetarian", label: "Vegetarian", icon: "🥗" },
  { key: "vegan", label: "Vegan", icon: "🌱" },
  { key: "halal", label: "Halal", icon: "🌙" },
  { key: "gluten_free", label: "Gluten Free", icon: "🌾" }
];

const spicyLevelOptions: { key: SpicyLevel | "all"; label: string; icon: string }[] = [
  { key: "all", label: "Any Spice Level", icon: "🌶️" },
  { key: "not_spicy", label: "Not Spicy", icon: "😊" },
  { key: "mild", label: "Mild", icon: "🌶️" },
  { key: "medium", label: "Medium", icon: "🌶️🌶️" },
  { key: "hot", label: "Hot", icon: "🌶️🌶️🌶️" },
  { key: "very_hot", label: "Very Hot", icon: "🌶️🌶️🌶️🌶️" }
];

export default function DishesPage() {
  const [params, setParams] = useSearchParams();
  const municipalityId = Number(params.get("municipalityId") || "");
  const initialCat = (params.get("category") as Cat) || "all";
  const initialQ = params.get("q") || "";
  const initialSort = (params.get("sort") as SortKey) || "popularity";
  const initialView = (params.get("view") as ViewMode) || "grid";
  
  const initialFilters: FilterOptions = {
    priceRange: (params.get("price") as FilterOptions["priceRange"]) || "all",
    dietary: (params.get("dietary")?.split(",").filter(Boolean) || []) as FilterOptions["dietary"],
    spicyLevel: (params.get("spicyLevel") as FilterOptions["spicyLevel"]) || "all"
  };

  const [cat, setCat] = useState<Cat>(initialCat);
  const [view, setView] = useState<ViewMode>(initialView);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [search, setSearch] = useState(initialQ);
  const [searchLive, setSearchLive] = useState(initialQ);
  const [filters, setFilters] = useState<FilterOptions>(initialFilters);
  const [searchConfig, setSearchConfig] = useState({
    includeIngredients: true,
    includeDescription: true,
    includeMunicipality: true
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("view", view);
    next.set("sort", sort);
    if (cat === "all") next.delete("category"); else next.set("category", cat);
    if (searchLive) next.set("q", searchLive); else next.delete("q");
    if (municipalityId) next.set("municipalityId", String(municipalityId));
    
    // Sync filters with URL params
    if (filters.priceRange !== 'all') next.set('price', filters.priceRange);
    else next.delete('price');
    
    if (filters.dietary.length > 0) next.set('dietary', filters.dietary.join(','));
    else next.delete('dietary');
    
    if (filters.spicyLevel !== 'all') next.set('spicyLevel', filters.spicyLevel);
    else next.delete('spicyLevel');

    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, view, sort, searchLive, municipalityId, filters]);

  useEffect(() => {
    const t = setTimeout(() => setSearchLive(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const munisQ = useQuery<Municipality[]>({
    queryKey: ["municipalities"],
    queryFn: fetchMunicipalities,
  });

  const muni = useMemo(
    () => munisQ.data?.find((m) => m.id === municipalityId) || null,
    [munisQ.data, municipalityId]
  );

  const dishesQ = useQuery<Dish[]>({
    queryKey: ["dishes", municipalityId || "all", cat, searchLive || ""],
    queryFn: async () => {
      const params = {
        municipalityId: municipalityId || undefined,
        category: cat === "all" ? undefined : cat,
        q: searchLive || undefined
      };
      
      console.log('[DishesPage] Fetching dishes with params:', params);
      
      const data = await fetchDishes(params);
      
      if (!data || data.length === 0) {
        console.log('[DishesPage] No dishes found for params:', params);
      } else {
        console.log('[DishesPage] Found', data.length, 'dishes');
      }
      
      // Sort dishes by signature/featured status first
      return data.sort((a, b) => {
        // First by signature status
        if (a.signature && !b.signature) return -1;
        if (!a.signature && b.signature) return 1;
        
        // Then by panel rank
        const aRank = Number(a.panel_rank ?? 999);
        const bRank = Number(b.panel_rank ?? 999);
        if (aRank !== bRank) return aRank - bRank;
        
        // Then by popularity
        const aPop = Number(a.popularity ?? 0);
        const bPop = Number(b.popularity ?? 0);
        if (bPop !== aPop) return bPop - aPop;
        
        // Finally by average rating
        return Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0);
      });
    },
    enabled: true,
    staleTime: 60_000,
  });

  

  const filtered = useMemo(() => {
    const rows = dishesQ.data ?? [];
    return rows.filter(dish => {
      // Apply price range filter
      if (filters.priceRange !== 'all') {
        const price = Number(dish.price ?? 0);
        switch (filters.priceRange) {
          case 'budget':
            if (price > 100) return false;
            break;
          case 'mid':
            if (price <= 100 || price > 300) return false;
            break;
          case 'premium':
            if (price <= 300) return false;
            break;
        }
      }

      // Apply dietary filters
      if (filters.dietary.length > 0) {
        const dishDietary = dish.dietary_info || [];
        if (!filters.dietary.every(diet => dishDietary.includes(diet))) {
          return false;
        }
      }

      // Apply spicy level filter
      if (filters.spicyLevel !== 'all') {
        if (dish.spicy_level !== filters.spicyLevel) {
          return false;
        }
      }

      return true;
    });
  }, [dishesQ.data, filters]);

  const sorted = useMemo(() => {
    const clone = [...filtered];
    const getAvg = (d: typeof filtered[number]) => Number(d.avg_rating ?? d.rating ?? 0);
    const getTotal = (d: typeof filtered[number]) => Number(d.total_ratings ?? 0);
    const getPrice = (d: typeof filtered[number]) => Number(d.price ?? 0);

    switch (sort) {
      case "rating":
        // Prefer avg_rating where available, then rating; break ties with total_ratings, popularity, then name
        clone.sort((a, b) => {
          const ra = getAvg(a);
          const rb = getAvg(b);
          if (rb !== ra) return rb - ra;
          const ta = getTotal(a);
          const tb = getTotal(b);
          if (tb !== ta) return tb - ta;
          const pa = Number(a.popularity ?? 0);
          const pb = Number(b.popularity ?? 0);
          if (pb !== pa) return pb - pa;
          return a.name.localeCompare(b.name);
        });
        break;
      case "name":
        clone.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "price_low":
        clone.sort((a, b) => {
          const pa = getPrice(a);
          const pb = getPrice(b);
          if (pa !== pb) return pa - pb;
          return a.name.localeCompare(b.name);
        });
        break;
      case "price_high":
        clone.sort((a, b) => {
          const pa = getPrice(a);
          const pb = getPrice(b);
          if (pa !== pb) return pb - pa;
          return a.name.localeCompare(b.name);
        });
        break;
      default:
        // Popularity: primarily by popularity, then by rating & total_ratings
        clone.sort((a, b) => {
          const pa = Number(a.popularity ?? 0);
          const pb = Number(b.popularity ?? 0);
          if (pb !== pa) return pb - pa;
          const ra = getAvg(a);
          const rb = getAvg(b);
          if (rb !== ra) return rb - ra;
          const ta = getTotal(a);
          const tb = getTotal(b);
          if (tb !== ta) return tb - ta;
          return a.name.localeCompare(b.name);
        });
    }
    return clone;
  }, [filtered, sort]);

  const total = sorted.length;

  return (
    <>
      <FiltersModal
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
      />

      <motion.div
        className="pt-16 pb-16 bg-neutral-50 min-h-screen relative z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22 }}
      >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-4 mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mb-1">
              {muni ? `Dishes of ${muni.name}` : "Dishes of Bulacan"}
            </h1>
            <p className="text-neutral-600">
              Browse all <span className="font-medium">foods, delicacies & drinks</span>{" "}
              saved in {muni ? muni.name : "Bulacan"}. Click any card for details later.
            </p>
          </div>
          <Link
            to={muni ? `/map?municipality=${muni.slug}` : "/map"}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-neutral-50"
            title="Back to Map"
          >
            ← Back to Map
          </Link>
          <Link
            to={muni ? `/dishes/top?municipalityId=${muni.id}` : "/dishes/top"}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-neutral-50"
            title="Top dishes"
          >
            ⭐ Top dishes
          </Link>
        </div>

        {/* Controls Bar */}
        <div className="bg-white border rounded-lg shadow-sm p-3 md:p-4 mb-4">
          <div className="flex flex-col gap-4">
            {/* Top Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Tabs */}
              <div className="flex shrink-0 rounded-md overflow-hidden border">
                {categoryTabs.map((t) => {
                  const active = cat === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setCat(t.key)}
                      className={`px-3 py-2 text-sm ${
                        active
                          ? "bg-primary-600 text-white"
                          : "bg-white hover:bg-neutral-50 text-neutral-700"
                      }`}
                      aria-pressed={active}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Search with Advanced Options */}
              <div className="flex-1 min-w-[220px] relative">
                <div className="relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search dishes (name/description)…"
                    className="w-full rounded-md border pl-3 pr-24 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={() => setIsFiltersOpen(true)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <FilterIcon size={14} />
                    Filters
                    {(filters.dietary.length > 0 || filters.priceRange !== 'all' || filters.spicyLevel !== 'all') && (
                      <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                    )}
                  </button>
                </div>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-600">Sort</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-md border px-2 py-2 text-sm"
                >
                  <option value="popularity">Popularity</option>
                  <option value="rating">Rating</option>
                  <option value="name">Name A–Z</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                </select>
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-1 rounded-md border overflow-hidden">
                <button
                  onClick={() => setView("grid")}
                  className={`px-3 py-2 text-sm ${
                    view === "grid" ? "bg-neutral-100" : "bg-white hover:bg-neutral-50"
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`px-3 py-2 text-sm ${
                    view === "list" ? "bg-neutral-100" : "bg-white hover:bg-neutral-50"
                  }`}
                >
                  List
                </button>
              </div>
            </div>

            {/* Active Filters */}
            {(filters.dietary.length > 0 || filters.priceRange !== 'all' || filters.spicyLevel !== 'all') && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                <span className="text-sm text-neutral-600">Active Filters:</span>
                {filters.priceRange !== 'all' && (
                  <span className="px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-sm flex items-center gap-1">
                    {priceRangeOptions.find(o => o.key === filters.priceRange)?.label}
                    <button
                      onClick={() => setFilters(f => ({ ...f, priceRange: 'all' }))}
                      className="ml-1 hover:text-primary-900"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.dietary.map(diet => (
                  <span key={diet} className="px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-sm flex items-center gap-1">
                    {dietaryOptions.find(o => o.key === diet)?.icon}
                    {dietaryOptions.find(o => o.key === diet)?.label}
                    <button
                      onClick={() => setFilters(f => ({
                        ...f,
                        dietary: f.dietary.filter(d => d !== diet)
                      }))}
                      className="ml-1 hover:text-primary-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {filters.spicyLevel !== 'all' && (
                  <span className="px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-sm flex items-center gap-1">
                    {spicyLevelOptions.find(o => o.key === filters.spicyLevel)?.icon}
                    {spicyLevelOptions.find(o => o.key === filters.spicyLevel)?.label}
                    <button
                      onClick={() => setFilters(f => ({ ...f, spicyLevel: 'all' }))}
                      className="ml-1 hover:text-primary-900"
                    >
                      ×
                    </button>
                  </span>
                )}
                <button
                  onClick={() => setFilters({
                    priceRange: 'all',
                    dietary: [],
                    spicyLevel: 'all'
                  })}
                  className="text-sm text-neutral-600 hover:text-neutral-900"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-neutral-600">
            {dishesQ.isLoading
              ? "Loading…"
              : dishesQ.error
              ? "Failed to load dishes."
              : `${total} item${total === 1 ? "" : "s"} found`}
          </div>
          {muni && (
            <div className="text-sm text-neutral-500">
              Municipality ID: <span className="font-mono">{muni.id}</span>
            </div>
          )}
        </div>

        {/* Results */}
        {dishesQ.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton rounded h-40" />
            ))}
          </div>
        ) : dishesQ.error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700">
            {(dishesQ.error as Error).message || "Error loading dishes."}
          </div>
        ) : total === 0 ? (
          <div className="p-10 text-center text-neutral-500 bg-white border rounded-lg">
            No dishes found{muni ? ` for ${muni.name}` : ""}.
          </div>
        ) : view === "grid" ? (
          <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {sorted.map((dish) => (
              <motion.div key={dish.id} layout>
                <DishCard dish={dish} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="divide-y rounded-lg bg-white border"
          >
            {sorted.map((d) => (
              <motion.div key={d.id} layout>
                <Link
                  to={`/dish/${d.id}`}
                  className="flex items-center gap-4 p-3 hover:bg-neutral-50"
                >
                  <img
                    src={d.image_url || "https://via.placeholder.com/96"}
                    alt={d.name}
                    className="w-20 h-16 rounded object-cover bg-neutral-100"
                    onError={(e) => ((e.currentTarget.src = "https://via.placeholder.com/96"))}
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.name}</div>
                    <div className="text-xs text-neutral-500 truncate">
                      {d.category ? d.category.toUpperCase() : ""} • ⭐{" "}
                      {Number(d.rating ?? 0).toFixed(1)} • Pop {Number(d.popularity ?? 0)}
                    </div>
                    {d.description && (
                      <div className="text-sm text-neutral-600 line-clamp-2">
                        {d.description}
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
    </>
  );
}
