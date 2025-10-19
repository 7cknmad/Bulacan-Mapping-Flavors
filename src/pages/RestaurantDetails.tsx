import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft as ArrowLeftIcon,
  Star as StarIcon,
  MapPin as MapPinIcon,
  Phone as PhoneIcon,
  Globe as GlobeIcon,
  Clock as ClockIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  Utensils as UtensilsIcon,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { fetchRestaurants, type Restaurant, type Dish, API } from "../utils/api";
import DishCard from "../components/cards/DishCard";

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

/** Basic fetch helper with readable errors */
async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "omit" });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0, 200)}`);
  try {
    return JSON.parse(txt) as T;
  } catch {
    throw new Error(`Bad JSON from ${url}: ${txt.slice(0, 200)}`);
  }
}

export default function RestaurantDetails() {
  // Accept either /restaurant/:slug or /restaurant/:id
  const params = useParams();
  const idOrSlug = (params.slug ?? params.id ?? "").toString();
  const isNumericId = /^\d+$/.test(idOrSlug);
  const [tab, setTab] = useState<"overview" | "menu" | "info">("overview");

  /** 1) Load the restaurant by slug (exact) or numeric id (fallback) */
  const restaurantQ = useQuery<Restaurant>({
    queryKey: ["restaurant", idOrSlug],
    enabled: !!idOrSlug,
    queryFn: async () => {
      // Try search by q= and exact-match slug
      const byQ = await fetchRestaurants({ q: idOrSlug });
      let r = byQ.find((x) => x.slug === idOrSlug);

      // If param looks like an id, fallback by id
      if (!r && isNumericId) {
        const all = await fetchRestaurants();
        r = all.find((x) => String(x.id) === idOrSlug);
      }
      if (!r) throw new Error("Restaurant not found");
      return r;
    },
    staleTime: 60_000,
    retry: 0,
  });

  /** 2) Load dishes linked to this restaurant via link table */
const dishesQ = useQuery<Dish[]>({
  queryKey: ["restaurant-dishes", restaurantQ.data?.id],
  enabled: !!restaurantQ.data?.id,
  queryFn: async () => {
    const rid = restaurantQ.data!.id;
    try {
      const dishes = await getJSON<any[]>(`${API}/api/restaurants/${rid}/featured-dishes`);
      
      return dishes.map(dish => ({
        id: dish.dish_id || dish.id,
        name: dish.dish_name || dish.name,
        description: dish.restaurant_specific_description || dish.original_description || dish.description,
        category: dish.category,
        image_url: dish.image_url,
        municipality_id: dish.municipality_id,
        slug: dish.slug || `dish-${dish.dish_id || dish.id}`,
        rating: dish.rating,
        popularity: dish.popularity,
        featured: dish.is_featured === 1 || dish.is_featured === true,
        featured_rank: dish.featured_rank,
        restaurant_specific_price: dish.restaurant_specific_price,
        availability: dish.availability
      } as Dish & any));
    } catch (error) {
      console.error('Failed to fetch restaurant dishes:', error);
      return [];
    }
  },
  staleTime: 60_000,
});

  /** Featured dishes: only include dishes marked featured or with featured_rank.
      Sort by featured_rank ascending (lower rank = higher priority), then popularity, rating, name. */
  const featuredDishes = useMemo(() => {
    const all = dishesQ.data ?? [];
    const list = all.filter((d: any) => Boolean(d.featured) || d.featured_rank != null);
    list.sort((a: Dish & any, b: Dish & any) => {
      const ar = a.featured_rank == null ? 999 : Number(a.featured_rank);
      const br = b.featured_rank == null ? 999 : Number(b.featured_rank);
      if (ar !== br) return ar - br; // ascending: rank 1 first
      // fallback ordering within same rank: popularity, rating, name
      const popDiff = Number(b.popularity ?? 0) - Number(a.popularity ?? 0);
      if (popDiff !== 0) return popDiff;
      const ratingDiff = Number(b.rating ?? 0) - Number(a.rating ?? 0);
      if (ratingDiff !== 0) return ratingDiff;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [dishesQ.data]);

  /** Render states */
  if (restaurantQ.isLoading) {
    return (
      <div className="pt-20 pb-16 bg-neutral-50 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="skeleton rounded h-10 w-40 mb-4" />
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="skeleton rounded h-64 md:h-80" />
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="skeleton rounded h-6 w-48 mb-3" />
            <div className="skeleton rounded h-4 w-3/4 mb-2" />
            <div className="skeleton rounded h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }
  if (restaurantQ.error || !restaurantQ.data) {
    return (
      <div className="pt-24 pb-16 flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <h2 className="mb-2">Restaurant Not Found</h2>
          <p className="mb-6 text-neutral-600">
            We couldn’t locate that place. It may have been removed or you followed an outdated link.
          </p>
          <Link
            to="/restaurants"
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
          >
            Browse Restaurants
          </Link>
        </div>
      </div>
    );
  }

  const r = restaurantQ.data;
  const cuisines = toArray((r as any).cuisine_types);
  const coords: [number, number] = [Number(r.lat) || 14.84, Number(r.lng) || 120.81];
  const rating = Number(r.rating ?? 0);
  const hero =
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1600&auto=format&fit=crop";

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
            to="/restaurants"
            className="flex items-center text-neutral-600 hover:text-primary-600 transition-colors"
          >
            <ArrowLeftIcon size={18} className="mr-2" />
            <span>Back to Restaurants</span>
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="relative h-64 md:h-80">
            <img src={hero} alt={r.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
              <div className="p-6 w-full">
                <div className="flex items-center mb-2 gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                    {r.kind}
                  </span>
                  {r.price_range && (
                    <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                      {r.price_range}
                    </span>
                  )}
                  {cuisines.length > 0 && (
                    <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                      {cuisines.join(", ")}
                    </span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1 text-white">
                    <StarIcon size={16} className="text-yellow-400 fill-yellow-400" />
                    <span className="font-medium">{rating.toFixed(1)}</span>
                  </span>
                </div>
                <h1 className="text-white mb-1">{r.name}</h1>
                {r.address && (
                  <div className="text-white/90 text-sm flex items-center gap-1">
                    <MapPinIcon size={16} /> {r.address}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact strip */}
          <div className="p-4 flex flex-wrap gap-4 text-sm">
            {r.phone && (
              <a href={`tel:${r.phone}`} className="inline-flex items-center gap-2 text-neutral-700 hover:text-primary-600">
                <PhoneIcon size={16} /> {r.phone}
              </a>
            )}
            {r.website && (
              <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-neutral-700 hover:text-primary-600">
                <GlobeIcon size={16} /> Website
              </a>
            )}
            {r.facebook && (
              <a href={r.facebook} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-neutral-700 hover:text-primary-600">
                <FacebookIcon size={16} /> Facebook
              </a>
            )}
            {r.instagram && (
              <a href={r.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-neutral-700 hover:text-primary-600">
                <InstagramIcon size={16} /> Instagram
              </a>
            )}
            {r.opening_hours && (
              <span className="inline-flex items-center gap-2 text-neutral-700">
                <ClockIcon size={16} /> {r.opening_hours}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-neutral-200">
          <div className="flex overflow-x-auto hide-scrollbar">
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "overview" ? "text-primary-600 border-b-2 border-primary-600" : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("overview")}
            >
              Overview
            </button>
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "menu" ? "text-primary-600 border-b-2 border-primary-600" : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("menu")}
            >
              Menu
            </button>
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "info" ? "text-primary-600 border-b-2 border-primary-600" : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("info")}
            >
              Info
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
{/* OVERVIEW: show featured dishes only */}
{tab === "overview" && (
  <div>
    <h2 className="mb-3">About {r.name}</h2>
    <p className="text-neutral-700 mb-6">{r.description || "No description yet."}</p>

    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <UtensilsIcon size={18} /> Featured Dishes
      </h3>
      <button onClick={() => setTab("menu")} className="text-sm text-primary-600 hover:text-primary-700">
        View Full Menu →
      </button>
    </div>

    {dishesQ.isLoading ? (
      <div className="skeleton rounded h-40 mb-8" />
    ) : dishesQ.error ? (
      <div className="text-red-600 mb-4">Failed to load dishes for this place.</div>
    ) : featuredDishes.length === 0 ? (
      <div className="text-neutral-500">
        No featured dishes yet. Check back later for their special offerings.
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        {featuredDishes.slice(0, 4).map((fd) => (
          <Link
            key={fd.id}
            to={`/dish/${fd.id}`}
            className="flex border border-neutral-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
          >
            <img
              src={fd.image_url || "https://via.placeholder.com/160"}
              alt={fd.name}
              className="w-24 h-24 object-cover rounded-md mr-4 bg-neutral-100"
              onError={(e) => ((e.currentTarget.src = "https://via.placeholder.com/160"))}
            />
            <div className="flex-1">
              <h3 className="font-medium text-lg mb-1">{fd.name}</h3>
              <p className="text-sm text-neutral-600 mb-2 line-clamp-2">
                {fd.description || ""}
              </p>
              <div className="text-xs text-neutral-500 mb-1">
                ⭐ {Number(fd.rating ?? 0).toFixed(1)} • {fd.category?.toUpperCase?.()}
              </div>
              {/* Show price if available */}
              {fd.restaurant_specific_price && (
                <div className="text-sm font-medium text-green-600">
                  ₱ {fd.restaurant_specific_price}
                </div>
              )}
              {/* Show featured badge if applicable */}
              {fd.featured && (
                <span className="inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full mt-1">
                  Featured
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    )}
  </div>
)}
          {/* MENU: all linked dishes */}
          {tab === "menu" && (
            <div>
              <h2 className="mb-4">Menu</h2>
              <p className="text-neutral-700 mb-6">
                Dishes we’ve linked to this place. We’ll add prices and photos per item later.
              </p>
              {dishesQ.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="skeleton rounded h-24" />
                  <div className="skeleton rounded h-24" />
                </div>
              ) : dishesQ.error ? (
                <div className="text-red-600">Failed to load dishes.</div>
              ) : (dishesQ.data?.length ?? 0) === 0 ? (
                <div className="text-neutral-500">No menu items yet.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {dishesQ.data!.map((d) => (
                    <Link
                      key={d.id}
                      to={`/dish/${d.id}`}
                      className="flex border-b border-neutral-200 pb-4 mb-4"
                    >
                      <img
                        src={d.image_url || "https://via.placeholder.com/160"}
                        alt={d.name}
                        className="w-24 h-24 object-cover rounded-md mr-4 bg-neutral-100"
                        onError={(e) => ((e.currentTarget.src = "https://via.placeholder.com/160"))}
                      />
                      <div>
                        <h3 className="font-medium text-lg mb-1">{d.name}</h3>
                        <p className="text-sm text-neutral-600 mb-2 line-clamp-2">
                          {d.description || ""}
                        </p>
                        <div className="text-xs text-neutral-500">
                          ⭐ {Number(d.rating ?? 0).toFixed(1)} • {d.category?.toUpperCase?.()}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* INFO: details + MAP */}
          {tab === "info" && (
            <div>
              <h2 className="mb-4">Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Opening Hours</h3>
                  <div className="flex items-center text-neutral-700">
                    <ClockIcon size={18} className="mr-2" />
                    <span>{r.opening_hours || "—"}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-3">Contact</h3>
                  <ul className="space-y-3 text-neutral-700">
                    <li className="flex items-start">
                      <MapPinIcon size={20} className="mr-2 mt-0.5 text-neutral-500" />
                      <span>{r.address || "—"}</span>
                    </li>
                    {r.phone && (
                      <li className="flex items-center">
                        <PhoneIcon size={20} className="mr-2 text-neutral-500" />
                        <a href={`tel:${r.phone}`} className="hover:underline">
                          {r.phone}
                        </a>
                      </li>
                    )}
                    {r.website && (
                      <li className="flex items-center">
                        <GlobeIcon size={20} className="mr-2 text-neutral-500" />
                        <a href={r.website} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                          {r.website}
                        </a>
                      </li>
                    )}
                  </ul>

                  <h3 className="text-lg font-semibold mt-6 mb-3">Details</h3>
                  <ul className="space-y-2 text-sm text-neutral-700">
                    <li><span className="font-medium">Kind:</span> {r.kind}</li>
                    <li><span className="font-medium">Price range:</span> {r.price_range || "—"}</li>
                    <li><span className="font-medium">Cuisine:</span> {toArray((r as any).cuisine_types).join(", ") || "—"}</li>
                    <li><span className="font-medium">Rating:</span> {Number(r.rating ?? 0).toFixed(1)}</li>
                  </ul>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-3">Location</h3>
                <div className="h-64 rounded-lg overflow-hidden">
                  <MapContainer center={coords} zoom={15} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={coords}>
                      <Popup>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-sm">{r.address}</div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}