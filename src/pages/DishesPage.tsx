import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDishes,
  fetchMunicipalities,
  type Dish,
  type Municipality,
} from "../utils/api";
import DishCard from "../components/cards/DishCard";
import { motion } from "framer-motion";

type Cat = "all" | "food" | "delicacy" | "drink";
type SortKey = "popularity" | "rating" | "name";
type ViewMode = "grid" | "list";

const categoryTabs: { key: Cat; label: string }[] = [
  { key: "all", label: "All" },
  { key: "food", label: "Food" },
  { key: "delicacy", label: "Delicacies" },
  { key: "drink", label: "Drinks" },
];

export default function DishesPage() {
  const [params, setParams] = useSearchParams();
  const municipalityId = Number(params.get("municipalityId") || "");
  const initialCat = (params.get("category") as Cat) || "all";
  const initialQ = params.get("q") || "";
  const initialSort = (params.get("sort") as SortKey) || "popularity";
  const initialView = (params.get("view") as ViewMode) || "grid";

  const [cat, setCat] = useState<Cat>(initialCat);
  const [view, setView] = useState<ViewMode>(initialView);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [search, setSearch] = useState(initialQ);
  const [searchLive, setSearchLive] = useState(initialQ);

  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("view", view);
    next.set("sort", sort);
    if (cat === "all") next.delete("category"); else next.set("category", cat);
    if (searchLive) next.set("q", searchLive); else next.delete("q");
    if (municipalityId) next.set("municipalityId", String(municipalityId));
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, view, sort, searchLive, municipalityId]);

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
    queryFn: () =>
      fetchDishes({
        municipalityId: Number.isFinite(municipalityId) ? municipalityId : undefined,
        category: cat === "all" ? undefined : cat,
        q: searchLive || undefined,
      }),
    enabled: !!(Number.isFinite(municipalityId) || municipalityId === 0 || !params.get("municipalityId")),
    staleTime: 60_000,
  });

  const sorted = useMemo(() => {
    const rows = dishesQ.data ?? [];
    const clone = [...rows];
    switch (sort) {
      case "rating":
        clone.sort((a, b) => (Number(b.rating ?? 0) - Number(a.rating ?? 0)) || a.name.localeCompare(b.name));
        break;
      case "name":
        clone.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        clone.sort((a, b) => (Number(b.popularity ?? 0) - Number(a.popularity ?? 0)) || a.name.localeCompare(b.name));
    }
    return clone;
  }, [dishesQ.data, sort]);

  const total = sorted.length;

  return (
    <motion.div
      className="pt-16 pb-16 bg-neutral-50 min-h-screen"
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
        </div>

        {/* Controls Bar */}
        <div className="bg-white border rounded-lg shadow-sm p-3 md:p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Tabs */}
            <div className="flex shrink-0 rounded-md overflow-hidden border">
              {categoryTabs.map((t) => {
                const active = cat === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setCat(t.key)}
                    className={
                      "px-3 py-2 text-sm " +
                      (active
                        ? "bg-primary-600 text-white"
                        : "bg-white hover:bg-neutral-50 text-neutral-700")
                    }
                    aria-pressed={active}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[220px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes (name/description)…"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
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
              </select>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 rounded-md border overflow-hidden">
              <button
                onClick={() => setView("grid")}
                className={
                  "px-3 py-2 text-sm " +
                  (view === "grid" ? "bg-neutral-100" : "bg-white hover:bg-neutral-50")
                }
              >
                Grid
              </button>
              <button
                onClick={() => setView("list")}
                className={
                  "px-3 py-2 text-sm " +
                  (view === "list" ? "bg-neutral-100" : "bg-white hover:bg-neutral-50")
                }
              >
                List
              </button>
            </div>
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
  );
}
