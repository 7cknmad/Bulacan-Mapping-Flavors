import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  fetchDishes,
  fetchMunicipalities,
  fetchRestaurants,
  type Dish,
  type Municipality,
  type Restaurant,
} from "../utils/api";
import {
  ArrowLeft as ArrowLeftIcon,
  Star as StarIcon,
  MapPin as MapPinIcon,
  Info as InfoIcon,
  BookOpen as BookOpenIcon,
  Utensils as UtensilsIcon,
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

export default function DishDetails() {
  // Accept either /dish/:slug or /dish/:id
  const params = useParams();
  const idOrSlug = (params.slug ?? params.id ?? "").toString();
  const isNumericId = /^\d+$/.test(idOrSlug);
  const [tab, setTab] =
    useState<"overview" | "history" | "ingredients" | "restaurants">("overview");

  // Load ONE dish (pref: exact slug via q=; fallback: by numeric id)
  const dishQ = useQuery<Dish>({
    queryKey: ["dish", idOrSlug],
    enabled: !!idOrSlug,
    queryFn: async () => {
      // 1) try match by slug using q=
      const byQuery = await fetchDishes({ q: idOrSlug });
      let d = byQuery.find((x) => x.slug === idOrSlug);

      // 2) fallback by numeric id
      if (!d && isNumericId) {
        const all = await fetchDishes();
        d = all.find((x) => String(x.id) === idOrSlug);
      }
      if (!d) throw new Error("Dish not found");
      return d;
    },
    staleTime: 60_000,
    retry: 0,
  });

  // Load municipalities to label origin
  const muniQ = useQuery<Municipality[]>({
    queryKey: ["municipalities"],
    queryFn: fetchMunicipalities,
    staleTime: 60_000,
  });

  const municipality = useMemo(
    () =>
      dishQ.data && muniQ.data
        ? muniQ.data.find((m) => m.id === dishQ.data!.municipality_id)
        : null,
    [dishQ.data, muniQ.data]
  );

  // Where to try this dish
  const placesQ = useQuery<Restaurant[]>({
    queryKey: ["where-to-try", dishQ.data?.id],
    enabled: !!dishQ.data?.id,
    queryFn: () => fetchRestaurants({ dishId: dishQ.data!.id }),
    staleTime: 60_000,
  });

  // Loading
  if (dishQ.isLoading) {
    return (
      <div className="pt-20 pb-16 bg-neutral-50 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="skeleton rounded h-10 w-40 mb-4" />
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="skeleton rounded h-64 md:h-96" />
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="skeleton rounded h-6 w-40 mb-3" />
            <div className="skeleton rounded h-4 w-3/4 mb-2" />
            <div className="skeleton rounded h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // Error / not found
  if (dishQ.error || !dishQ.data) {
    return (
      <div className="pt-24 pb-16 flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <h2 className="mb-2">Dish Not Found</h2>
          <p className="mb-6 text-neutral-600">
            We couldn’t locate that dish. It may have been removed or you followed an outdated link.
          </p>
          <Link
            to="/map"
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
          >
            Explore Other Dishes
          </Link>
        </div>
      </div>
    );
  }

  const dish = dishQ.data;
  const flavorList = toArray(dish.flavor_profile);
  const ingredientsList = toArray(dish.ingredients);
  const hero = dish.image_url || "https://via.placeholder.com/1600x900?text=Dish";

  return (
    <motion.div
      className="pt-20 pb-16 bg-neutral-50 min-h-screen"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="container mx-auto px-4">
        {/* Back */}
        <div className="mb-6">
          <Link
            to={municipality ? `/map?municipality=${municipality.slug}` : "/map"}
            className="flex items-center text-neutral-600 hover:text-primary-600 transition-colors"
          >
            <ArrowLeftIcon size={18} className="mr-2" />
            <span>Back to Map</span>
          </Link>
        </div>

        {/* Hero */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="relative h-64 md:h-96">
            <img src={hero} alt={dish.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
              <div className="p-6 w-full">
                <div className="flex items-center mb-2">
                  <div className="px-3 py-1 bg-primary-600 text-white text-xs font-medium rounded-full mr-2">
                    {municipality?.name ?? "Bulacan"}
                  </div>
                  <div className="flex items-center">
                    <StarIcon size={16} className="text-yellow-400 fill-yellow-400 mr-1" />
                    <span className="text-white text-sm font-medium">
                      {Number(dish.rating ?? 0).toFixed(1)}
                    </span>
                  </div>
                </div>
                <h1 className="text-white mb-2">{dish.name}</h1>
                {dish.description && (
                  <p className="text-white/90 max-w-2xl">{dish.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-neutral-200">
          <div className="flex overflow-x-auto hide-scrollbar">
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "overview"
                  ? "text-primary-600 border-b-2 border-primary-600"
                  : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("overview")}
            >
              <InfoIcon size={18} className="inline mr-2" />
              Overview
            </button>
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "history"
                  ? "text-primary-600 border-b-2 border-primary-600"
                  : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("history")}
            >
              <BookOpenIcon size={18} className="inline mr-2" />
              History & Notes
            </button>
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "ingredients"
                  ? "text-primary-600 border-b-2 border-primary-600"
                  : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("ingredients")}
            >
              <UtensilsIcon size={18} className="inline mr-2" />
              Ingredients
            </button>
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "restaurants"
                  ? "text-primary-600 border-b-2 border-primary-600"
                  : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("restaurants")}
            >
              <MapPinIcon size={18} className="inline mr-2" />
              Where to Try
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          {tab === "overview" && (
            <div>
              <h2 className="mb-4">About {dish.name}</h2>
              {dish.description ? (
                <p className="text-neutral-700 mb-6">{dish.description}</p>
              ) : (
                <p className="text-neutral-600 mb-6">No description yet.</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold mb-3">Origin</h3>
                  <div className="flex items-start mb-4">
                    <MapPinIcon size={20} className="mr-2 mt-1 text-primary-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{municipality?.name ?? "Bulacan"}</p>
                      <p className="text-sm text-neutral-600">
                        {municipality?.description || "A culinary stop in Bulacan province."}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">Quick Facts</h3>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <span className="font-medium">Category:</span>{" "}
                      {dish.category?.toUpperCase?.() || "—"}
                    </li>
                    <li>
                      <span className="font-medium">Popularity:</span>{" "}
                      {Number(dish.popularity ?? 0)}
                    </li>
                    {flavorList.length > 0 && (
                      <li>
                        <span className="font-medium">Flavor:</span>{" "}
                        {flavorList.join(", ")}
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div>
              <h2 className="mb-4">History & Notes</h2>
              <p className="text-neutral-700">
                {(dish as any).history || "We’ll add historical notes soon."}
              </p>
            </div>
          )}

          {tab === "ingredients" && (
            <div>
              <h2 className="mb-4">Ingredients</h2>
              {ingredientsList.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ingredientsList.map((ing, i) => (
                    <div key={i} className="bg-neutral-50 p-3 rounded-lg text-sm">
                      {ing}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-600">No ingredients listed yet.</p>
              )}
            </div>
          )}

          {tab === "restaurants" && (
            <div>
              <h2 className="mb-4">Where to Try {dish.name}</h2>
              {placesQ.isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="skeleton rounded h-28" />
                  <div className="skeleton rounded h-28" />
                  <div className="skeleton rounded h-28" />
                </div>
              ) : placesQ.error ? (
                <div className="text-red-600">Failed to load places.</div>
              ) : (placesQ.data?.length ?? 0) === 0 ? (
                <div className="text-neutral-500">No places linked yet.</div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {placesQ.data!.map((r) => (
                    <Link
                      key={r.id}
                      to={`/restaurant/${encodeURIComponent(r.slug || String(r.id))}`}
                      className="bg-white border rounded-xl overflow-hidden hover:shadow transition"
                    >
                      <div className="h-28 bg-neutral-100" />
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{r.name}</div>
                          <span className="text-xs px-2 py-1 rounded-full bg-neutral-100">
                            {r.kind}
                          </span>
                        </div>
                        <div className="text-sm text-neutral-600 line-clamp-2">{r.address}</div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {r.price_range} • ⭐ {Number(r.rating ?? 0).toFixed(1)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
