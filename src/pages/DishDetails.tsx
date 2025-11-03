import { useMemo, useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  fetchDishes,
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
import ConfirmModal from "../components/ConfirmModal";
import { updateReview, deleteReview } from "../utils/api";
import { useToast } from "../components/ToastProvider";
import EditReviewForm from "../components/EditReviewForm";

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
    useState<"overview" | "history" | "ingredients" | "restaurants" | "reviews" | "edit-review">(
      "overview"
    );

  const dishQ = useQuery<Dish>({
    queryKey: ["dish", idOrSlug],
    enabled: !!idOrSlug,
    queryFn: async () => {
      // Try: exact slug match via q=
      const byQuery = await fetchDishes({ q: idOrSlug });
      let d = byQuery.find((x) => x.slug === idOrSlug);

      // Fallback: numeric id lookup (last resort)
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

    // Increment popularity when dish is viewed
    useEffect(() => {
      if (dishQ.data?.id) {
        fetch(`/api/dishes/${dishQ.data.id}/view`, { method: 'POST' }).catch(() => {});
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

  // Debug user authentication
  useEffect(() => {
    if (user) {
      console.log('Authenticated user:', { 
        id: user.id, 
        email: user.email,
        role: user.role 
      });
    } else {
      console.log('No authenticated user');
    }
  }, [user]);

  // Cache the last user review so it's not lost during refetch
  const [cachedReview, setCachedReview] = useState<any>(null);
  // Always use cachedReview while loading, and update cache only when a new review is found
  const myReview = useMemo(() => {
    if (!user?.id) return null;
    if (reviewsQ.isLoading) return cachedReview;
    if (!reviewsQ.data) return cachedReview;
    const review = reviewsQ.data.find((r: any) => {
      const reviewUserId = r.user_id ? Number(r.user_id) : null;
      const currentUserId = Number(user.id);
      return reviewUserId === currentUserId;
    });
    return review?.id ? review : cachedReview;
  }, [user, reviewsQ.data, reviewsQ.isLoading, cachedReview]);

  // Update cachedReview only when a new review is found
  useEffect(() => {
    if (reviewsQ.data && user?.id) {
      const review = reviewsQ.data.find((r: any) => Number(r.user_id) === Number(user.id));
      if (review?.id && (!cachedReview || cachedReview.id !== review.id)) {
        setCachedReview(review);
      }
    }
  }, [reviewsQ.data, user?.id]);

  const [reviewToDelete, setReviewToDelete] = useState<any>(null);

  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      await deleteReview(reviewId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dish-reviews", dishQ.data?.id] });
      addToast("Review deleted successfully", "success");
      setReviewToDelete(null);
    },
    onError: () => {
      addToast("Failed to delete review", "error");
    }
  });

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
                    <span className="px-3 py-1.5 bg-white/90 text-neutral-900 rounded-full flex items-center gap-1.5 font-medium">
                      <StarIcon size={16} className="text-yellow-500 fill-yellow-500" />
                      <span>{avgRating.toFixed(1)}</span>
                      <span className="text-xs text-neutral-600 ml-1">({(reviewsQ.data?.length || dish.total_ratings || 0)})</span>
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
            {tab === "edit-review" && (
              <button
                className="px-6 py-3 font-medium text-sm whitespace-nowrap text-primary-600 border-b-2 border-primary-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit Review
              </button>
            )}
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
                  {placesQ.data!.map((r: Restaurant) => (
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
                        <div className="text-xs text-neutral-500 mt-1">{r.price_range} • ⭐ {Number(r.rating ?? 0).toFixed(1)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EDIT REVIEW TAB */}
          {tab === "edit-review" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit Your Review
                </h2>
                <button
                  onClick={() => setTab('reviews')}
                  className="text-sm text-neutral-600 hover:text-neutral-900"
                >
                  ← Back to Reviews
                </button>
              </div>
              {myReview ? (
                <EditReviewForm
                  review={myReview}
                  onCancel={() => {
                    setTab('reviews');
                    qc.invalidateQueries({ queryKey: ["dish-reviews", dish.id] });
                  }}
                  onSave={() => {
                    setTab('reviews');
                    addToast('Your review has been updated successfully', 'success');
                    qc.invalidateQueries({ queryKey: ["dish-reviews", dish.id] });
                  }}
                />
              ) : (
                <div className="text-neutral-600">Review not found.</div>
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
                    key={`review-form-${myReview?.id || 'new'}-${reviewsQ.dataUpdatedAt}`}
                    id={dish.id}
                    type="dish"
                    currentReview={myReview}
                    onDeleteReview={() => {
                      // Optimistically remove the review locally first
                      qc.setQueryData(['dish-reviews', dish.id], (old: any[] | undefined) => 
                        old?.filter(r => r.id !== myReview?.id) || []
                      );
                      // Then invalidate to get fresh data
                      qc.invalidateQueries({ queryKey: ["dish-reviews", dish.id] });
                      qc.invalidateQueries({ queryKey: ["dish", dish.id] });
                    }}
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
                          {user && Number(r.user_id) === Number(user.id) && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Your Review</span>
                          )}
                        </div>
                        {(() => {
                          // Ensure both user and review user ID exist and can be compared
                          const canManageReview = user?.id && r.user_id && Number(r.user_id) === Number(user.id);
                          return canManageReview ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setTab('edit-review')}
                                className="text-sm px-3 py-1.5 text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors duration-150 flex items-center gap-1"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                                Edit
                              </button>
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex items-center text-yellow-500">
                          {[...Array(r.rating)].map((_, i) => <StarIcon key={i} size={14} className="fill-yellow-400" />)}
                        </span>
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

      {/* Delete Review Confirmation Modal */}
      {reviewToDelete && (
        <ConfirmModal
          title="Delete Review"
          message="Are you sure you want to delete this review? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          open={!!reviewToDelete}
          onConfirm={() => deleteMutation.mutate(reviewToDelete.id)}
          onCancel={() => setReviewToDelete(null)}
        />
      )}
    </motion.div>
  );
}
