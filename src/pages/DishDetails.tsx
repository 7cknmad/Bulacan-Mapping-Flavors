import { useMemo, useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  fetchDishes,
  fetchDishBySlug,
  fetchMunicipalities,
  fetchRestaurants,
  fetchReviews,
  calculateAverageRating,
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
  User as UserIcon,
} from "lucide-react";
import RatingForm from "../components/RatingForm";
import { useAuth } from "../hooks/useAuth";
import StarRating from "../components/StarRating";
import RatingDisplay from "../components/RatingDisplay";
import ConfirmModal from "../components/ConfirmModal";
import { updateReview, deleteReview } from "../utils/api";
import { useToast } from "../components/ToastProvider";

/** Safely coerce DB JSON columns into arrays */
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
  const params = useParams<{ slug?: string; id?: string }>();
  const idOrSlug = (params.slug ?? params.id ?? "").toString();
  const isNumericId = /^\d+$/.test(idOrSlug);
  const [tab, setTab] =
    useState<"overview" | "history" | "ingredients" | "restaurants" | "reviews">(
      "overview"
    );

  const dishQ = useQuery<Dish>({
    queryKey: ["dish", idOrSlug],
    enabled: !!idOrSlug,
    queryFn: () => fetchDishBySlug(idOrSlug),
    staleTime: 60_000,
    retry: 0,
  });

    // Increment popularity when dish is viewed
    useEffect(() => {
      if (dishQ.data?.id) {
        // Use the correct API base URL
        import("../utils/apiConfig").then(({ API }) => {
          fetch(`${API}/dishes/${dishQ.data.id}/view`, { method: 'POST' }).catch(() => {});
        });
      }
    }, [dishQ.data?.id]);

  // Reviews for this dish (run after dishQ is available)
  const reviewsQ = useQuery<any[]>({
    queryKey: ["dish-reviews", dishQ.data?.id],
    enabled: !!dishQ.data?.id,
    queryFn: () => (dishQ.data ? fetchReviews(dishQ.data.id, "dish") : Promise.resolve([])),
    staleTime: 30_000,
  });

  const { user } = useAuth();
  const addToast = useToast();

  const myReview = user && reviewsQ.data?.find((r: any) => Number(r.user_id) === Number(user.id));

  const qc = useQueryClient();

  const muniQ = useQuery<Municipality[]>({
    queryKey: ["municipalities"],
    queryFn: fetchMunicipalities,
    staleTime: 60_000,
  });

  const municipality = useMemo(
    () => (dishQ.data && muniQ.data ? muniQ.data.find((m: Municipality) => m.id === dishQ.data!.municipality_id) : null),
    [dishQ.data, muniQ.data]
  );

  const placesQ = useQuery<Restaurant[]>({
    queryKey: ["where-to-try", dishQ.data?.id],
    enabled: !!dishQ.data?.id,
    queryFn: () => fetchRestaurants({ dishId: dishQ.data!.id }),
    staleTime: 60_000,
  });

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

  // Use the database's weighted rating
  const avgRating = Number(dish.avg_rating ?? dish.rating ?? 0);

  return (
    <motion.div
      className="pt-20 pb-16 bg-neutral-50 min-h-screen"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="container mx-auto px-4">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <Link to="/" className="text-neutral-600 hover:text-primary-600 transition-colors">
                Home
              </Link>
            </li>
            <li className="text-neutral-400">/</li>
            <li>
              <Link 
                to={municipality ? `/map?municipality=${municipality.slug}` : "/map"}
                className="text-neutral-600 hover:text-primary-600 transition-colors"
              >
                {municipality?.name ?? "Map Explorer"}
              </Link>
            </li>
            {municipality && (
              <>
                <li className="text-neutral-400">/</li>
                <li>
                  <Link 
                    to={`/map?municipality=${municipality.slug}`}
                    className="text-neutral-600 hover:text-primary-600 transition-colors"
                  >
                    Dishes
                  </Link>
                </li>
              </>
            )}
            <li className="text-neutral-400">/</li>
            <li className="text-primary-600 font-medium truncate max-w-[200px]">
              {dish.name}
            </li>
          </ol>
          <div className="mt-2">
            <Link
              to={municipality ? `/map?municipality=${municipality.slug}` : "/map"}
              className="flex items-center text-neutral-600 hover:text-primary-600 transition-colors"
            >
              <ArrowLeftIcon size={18} className="mr-2" />
              <span>Back to Map</span>
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="relative h-72 md:h-96">
            {/* Hero Image with Loading State */}
            <div className="absolute inset-0 bg-neutral-200 animate-pulse">
              <img 
                src={hero} 
                alt={dish.name} 
                className="w-full h-full object-cover transition-opacity duration-300"
                onLoad={(e) => (e.target as HTMLElement).parentElement?.classList.remove('animate-pulse')}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = "https://via.placeholder.com/1600x900?text=Dish";
                }}
              />
            </div>
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              {/* Content Container */}
              <div className="absolute inset-0 flex flex-col justify-end p-6">
                {/* Top Badges Row */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Municipality Badge */}
                    <span className="px-3 py-1 bg-primary-600/90 text-white text-xs font-medium rounded-full">
                      {municipality?.name ?? "Bulacan"}
                    </span>
                    
                    {/* Category Badge */}
                    {dish.category && (
                      <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                        {dish.category.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Rating Badge (consistent, accurate) */}
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-white/90 rounded-full">
                      <RatingDisplay 
                        rating={avgRating}
                        totalRatings={reviewsQ.data?.length || dish.total_ratings || 0}
                        size={16}
                        className="text-neutral-900"
                      />
                    </span>
                  </div>
                </div>

                {/* Title and Description */}
                <div className="space-y-3">
                  <h1 className="text-3xl md:text-4xl font-bold text-white">
                    {dish.name}
                  </h1>
                  
                  {dish.description && (
                    <p className="text-white/90 text-lg max-w-3xl">
                      {dish.description}
                    </p>
                  )}

                  {/* Quick Info */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-white/90 mt-2">
                    {flavorList.length > 0 && (
                      <div className="text-sm flex items-center gap-2">
                        <span className="text-primary-400">Flavors:</span>
                        <span>{flavorList.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
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
              <InfoIcon size={18} className="inline mr-2" />
              Overview
            </button>
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "history" ? "text-primary-600 border-b-2 border-primary-600" : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("history")}
            >
              <BookOpenIcon size={18} className="inline mr-2" />
              History & Notes
            </button>
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "ingredients" ? "text-primary-600 border-b-2 border-primary-600" : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("ingredients")}
            >
              <UtensilsIcon size={18} className="inline mr-2" />
              Ingredients
            </button>
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "restaurants" ? "text-primary-600 border-b-2 border-primary-600" : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("restaurants")}
            >
              <MapPinIcon size={18} className="inline mr-2" />
              Where to Try
            </button>
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "reviews" ? "text-primary-600 border-b-2 border-primary-600" : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("reviews")}
            >
              <StarIcon size={18} className="inline mr-2" />
              Reviews
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          {tab === "overview" && (
            <div>
              <h2 className="mb-4">About {dish.name}</h2>
              {dish.description ? <p className="text-neutral-700 mb-6">{dish.description}</p> : <p className="text-neutral-600 mb-6">No description yet.</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold mb-3">Origin</h3>
                  <div className="flex items-start mb-4">
                    <MapPinIcon size={20} className="mr-2 mt-1 text-primary-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{municipality?.name ?? "Bulacan"}</p>
                      <p className="text-sm text-neutral-600">{municipality?.description || "A culinary stop in Bulacan province."}</p>
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
              <p className="text-neutral-700">{(dish as any).history || "We’ll add historical notes soon."}</p>
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
              <div className="flex items-center justify-between mb-6">
                <h2 className="flex items-center gap-2">
                  <MapPinIcon size={20} className="text-primary-600" />
                  Where to Try {dish.name}
                </h2>
                <Link 
                  to="/restaurants"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  View All Places →
                </Link>
              </div>
              
              {placesQ.isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                      <div className="h-48 bg-gray-200" />
                      <div className="p-4">
                        <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : placesQ.error ? (
                <div className="text-center py-8 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-600 font-medium mb-2">Unable to load places</p>
                  <button
                    onClick={() => placesQ.refetch()}
                    className="text-sm text-red-600 hover:text-red-700 underline"
                  >
                    Try again
                  </button>
                </div>
              ) : (placesQ.data?.length ?? 0) === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                  <MapPinIcon size={32} className="mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-600 mb-2">No places are currently serving this dish</p>
                  <p className="text-sm text-gray-500">Check back later for updates</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {placesQ.data!.map((r: Restaurant) => (
                    <Link
                      key={r.id}
                      to={`/restaurant/${encodeURIComponent(r.slug || String(r.id))}`}
                      className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      <div className="aspect-video relative bg-gray-100 overflow-hidden">
                        <img
                          src={r.image_url || "https://via.placeholder.com/400x300?text=Restaurant"}
                          alt={r.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = "https://via.placeholder.com/400x300?text=Restaurant";
                          }}
                        />
                        {r.price_range && (
                          <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/70 text-white text-sm font-medium rounded-full">
                            {r.price_range}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors">
                            {r.name}
                          </h3>
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">
                            {r.kind || 'Restaurant'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <StarIcon size={16} className="text-yellow-400" />
                          <span className="font-medium">{Number(r.rating ?? 0).toFixed(1)}</span>
                          {r.total_ratings && (
                            <span className="text-gray-400">({r.total_ratings} reviews)</span>
                          )}
                        </div>

                        {r.address && (
                          <div className="text-sm text-gray-600 line-clamp-2 mb-2">
                            <MapPinIcon size={14} className="inline-block mr-1" />
                            {r.address}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 mt-3">
                          {r.cuisine_types?.slice(0, 3).map((cuisine: string, i: number) => (
                            <span 
                              key={i}
                              className="px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded-full"
                            >
                              {cuisine}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REVIEWS TAB */}
          {tab === "reviews" && (
            <div>
              <h2 className="mb-4 flex items-center">
                <StarIcon size={20} className="mr-2 text-yellow-400" /> Reviews
              </h2>
              
              {/* Review Form */}
              {user ? (
                <div className="mb-6">
                  <RatingForm
                    id={dish.id}
                    type="dish"
                  />
                </div>
              ) : (
                <div className="mb-6 p-4 bg-neutral-50 rounded-lg text-center">
                  <p className="text-neutral-600 mb-2">Please log in to leave a review</p>
                  <Link 
                    to="/auth"
                    className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <UserIcon size={16} className="mr-1.5" />
                    Sign in to Review
                  </Link>
                </div>
              )}              {/* Reviews List */}
              {reviewsQ.isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-neutral-200 rounded w-32 mb-2" />
                      <div className="h-4 bg-neutral-200 rounded w-full mb-1" />
                      <div className="h-4 bg-neutral-200 rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : reviewsQ.error ? (
                <div className="text-center py-8">
                  <div className="text-red-500 text-xl mb-4">
                    Failed to load reviews
                  </div>
                  <button
                    onClick={() => reviewsQ.refetch()}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors text-sm"
                  >
                    Try Again
                  </button>
                </div>
              ) : (reviewsQ.data?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-neutral-600">
                  <div className="mb-2">No reviews yet</div>
                  <div className="text-sm">Be the first to share your thoughts!</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviewsQ.data!.map((r: any) => (
                    <div key={r.id} className={`${r.id === myReview?.id ? 'bg-blue-50 border border-blue-100' : 'border-b'} p-4 rounded-lg mb-4`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{r.user_name || "User"}</span>
                          {r.id === myReview?.id && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Your Review</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <RatingDisplay rating={r.rating} showCount={false} size={14} className="text-yellow-500" />
                        <span className="text-xs text-neutral-500">
                          {new Date(r.created_at).toLocaleDateString()}
                          {r.updated_at !== r.created_at && 
                            ` · Edited ${new Date(r.updated_at).toLocaleDateString()}`
                          }
                        </span>
                      </div>
                      <div className="text-neutral-700">{r.comment}</div>
                    </div>
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
