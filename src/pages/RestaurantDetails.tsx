import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft as ArrowLeftIcon, Star as StarIcon, MapPin as MapPinIcon, Phone as PhoneIcon, Globe as GlobeIcon, Clock as ClockIcon, Facebook as FacebookIcon, Instagram as InstagramIcon, Utensils as UtensilsIcon, User as UserIcon } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fetchRestaurants, fetchReviews, postReview, updateReview, deleteReview, Variant, fetchRestaurantVariants, fetchDishes, calculateAverageRating } from "../utils/api";
import { API } from "../utils/apiConfig";
import { useAuth } from '../hooks/useAuth';
import { useRecentVisits } from '../hooks/useRecentVisits.ts';
import { useToast } from '../components/ToastProvider';
import RatingForm from '../components/RatingForm';
import StarRating from '../components/StarRating';
import RatingDisplay from '../components/RatingDisplay';
import ConfirmModal from '../components/ConfirmModal';
import EditReviewForm from '../components/EditReviewForm';
import type { Dish, Restaurant, Review } from "../utils/api";

// Extend Dish type for local use to include extra properties
type RestaurantDish = Dish & {
  restaurant_specific_price?: number | string;
  featured?: boolean;
  featured_rank?: number;
};

type SearchDish = { id: number; name: string; description?: string | null; image_url?: string | null; rating?: number | null; slug?: string };

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

function RestaurantDetails() {
  // Accept either /restaurant/:slug or /restaurant/:id
  const params = useParams();
  const idOrSlug = (params.slug ?? params.id ?? "").toString();
  const isNumericId = /^\d+$/.test(idOrSlug);
  type TabType = "overview" | "menu" | "info" | "reviews" | "edit-review";
  const [tab, setTab] = useState<TabType>("overview");
  const location = useLocation();

  // Load the restaurant by slug (exact) or numeric id (fallback)
  // Check if we have a valid id/slug
  const isValidRouteParam = idOrSlug && idOrSlug.length > 0;
  
  // Use navigate for programmatic navigation
  const navigate = useNavigate();

  // Query for restaurant details with robust error handling and validation
  const restaurantQ = useQuery<Restaurant>({
    queryKey: ["restaurant", idOrSlug],
    enabled: isValidRouteParam,
    queryFn: async () => {
      try {
        // Input validation
        if (!idOrSlug) {
          throw new Error("Invalid restaurant identifier");
        }

        // First try to find by exact slug match (most common case)
        const byQRes = await fetchRestaurants({ q: idOrSlug });
        const byQ = byQRes.rows || [];
        let r = byQ.find((x) => x.slug === idOrSlug);

        // If not found by slug but it's a valid numeric ID, try by ID
        if (!r && isNumericId) {
          const allRes = await fetchRestaurants();
          const all = allRes.rows || [];
          r = all.find((x) => String(x.id) === idOrSlug);
        }

        // Not found after trying both methods
        if (!r) {
          throw new Error(
            isNumericId 
              ? `Restaurant with ID ${idOrSlug} was not found`
              : `Restaurant "${idOrSlug}" was not found`
          );
        }

        // Found but on wrong URL - redirect to canonical URL
        if (r.slug && r.slug !== idOrSlug) {
          navigate(`/restaurant/${r.slug}`, { 
            replace: true, 
            state: { from: location.pathname } 
          });
        }

        // Basic data validation
        if (!r.name || !r.id) {
          throw new Error("Invalid restaurant data received");
        }

        // Update page title
        document.title = `${r.name} - Bulacan Food Map`;

        return r;
      } catch (error: any) {
        // Log for debugging but throw user-friendly error
        console.error('Restaurant fetch failed:', error);
        
        if (error.message.includes('404')) {
          throw new Error("Restaurant not found");
        }
        
        if (error.message.includes('network')) {
          throw new Error("Network error - please check your connection");
        }

        // Use custom message if available, otherwise generic
        throw new Error(error.message || "Failed to load restaurant details");
      }
    },
    staleTime: 60_000,
    retry: (failureCount, error: any) => {
      // Only retry network errors, up to 2 times
      return error.message.includes('network') && failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 30000),
  });

    // Increment popularity when restaurant is viewed
    useEffect(() => {
      if (restaurantQ.data?.id) {
        fetch(`/api/restaurants/${restaurantQ.data.id}/view`, { method: 'POST' }).catch(() => {});
      }
    }, [restaurantQ.data?.id]);
  // Reviews state (must be after restaurantQ)
  // Add to recent visits when viewing details
  const { addVisit } = useRecentVisits();
  useEffect(() => {
    if (restaurantQ.data) {
      addVisit({
        id: restaurantQ.data.id,
        name: restaurantQ.data.name,
        lat: restaurantQ.data.lat,
        lng: restaurantQ.data.lng,
        municipalityName: restaurantQ.data.municipality_name
      });
    }
  }, [restaurantQ.data, addVisit]);

  const queryClient = useQueryClient();
  const reviewsQ = useQuery<Review[]>({
    queryKey: ["restaurant-reviews", restaurantQ.data?.id],
    enabled: !!restaurantQ.data?.id,
    queryFn: () => restaurantQ.data ? fetchReviews(restaurantQ.data.id, 'restaurant') : Promise.resolve([]),
    staleTime: 30_000,
  });

  // Use central auth hook
  const { user } = useAuth();
  const addToast = useToast();
  const myReview = user && reviewsQ.data?.find(r => Number(r.user_id) === Number(user.id));

  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // initialize form when the user's review loads/changes
  useEffect(() => {
    if (myReview) {
      setReviewText(myReview.comment || "");
      setReviewRating(myReview.rating ?? 5);
    } else {
      setReviewText("");
      setReviewRating(5);
    }
  }, [myReview]);

  // Mutations
  const postReviewMutation = useMutation({
    mutationFn: (data: { rating: number; comment?: string }) =>
      restaurantQ.data ? postReview({ type: 'restaurant', id: restaurantQ.data.id, rating: data.rating, comment: data.comment }) : Promise.resolve(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-reviews", restaurantQ.data?.id] });
      queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    },
  });
  const updateReviewMutation = useMutation({
    mutationFn: (data: { reviewId: number; rating: number; comment?: string }) =>
      updateReview(data.reviewId, { rating: data.rating, comment: data.comment }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-reviews", restaurantQ.data?.id] });
      queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    },
  });
  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: number) => deleteReview(reviewId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-reviews", restaurantQ.data?.id] });
      queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    },
  });

  // handlers for editing/deleting current user's review (optimistic)
  const handleUpdate = () => {
    if (!myReview) return;
    const rid = restaurantQ.data!.id;
    const prevReviews = queryClient.getQueryData<any[]>(["restaurant-reviews", rid]) || [];
    const prevRestaurant = queryClient.getQueryData<any>(["restaurant", rid]);

    // optimistic update
    queryClient.setQueryData(["restaurant-reviews", rid], (old: any[] | undefined) => {
      return (old || []).map(r => r.id === myReview.id ? { ...r, rating: reviewRating, comment: reviewText, updated_at: new Date().toISOString() } : r);
    });
    if (prevRestaurant) {
      const arr = (prevReviews || []).map(r => r.id === myReview.id ? { ...r, rating: reviewRating } : r).map(r => r.rating || 0);
      const total = arr.length;
      const avg = total ? arr.reduce((a, b) => a + b, 0) / total : 0;
      queryClient.setQueryData(["restaurant", rid], { ...prevRestaurant, total_ratings: total, avg_rating: avg, rating: Number(avg).toFixed(1) });
    }

    updateReviewMutation.mutate({ reviewId: myReview.id, rating: reviewRating, comment: reviewText }, {
      onError: () => {
        queryClient.setQueryData(["restaurant-reviews", rid], prevReviews);
        if (prevRestaurant) queryClient.setQueryData(["restaurant", rid], prevRestaurant);
      }
    });
  };

  const handleDelete = () => {
    if (!myReview) return;
    setShowDeleteConfirm(true);
  };
  // (post toast handled inside shared RatingForm)

  /** 2) Load dishes linked to this restaurant via link table */
  const dishesQ = useQuery<RestaurantDish[]>({
    queryKey: ["restaurant-dishes", restaurantQ.data?.id],
    enabled: !!restaurantQ.data?.id,
    queryFn: async () => {
      const rid = restaurantQ.data!.id;
      try {
        // Validate restaurant ID
        if (!rid) throw new Error("Invalid restaurant ID");

        const dishes = await getJSON<any[]>(`${API}/api/restaurants/${rid}/featured-dishes`);
        
        // Validate response
        if (!Array.isArray(dishes)) {
          throw new Error("Invalid response format");
        }

        return dishes.map(dish => {
          // Basic validation for required fields
          if (!dish.id && !dish.dish_id) {
            console.warn('Dish missing ID:', dish);
            return null;
          }
          if (!dish.name && !dish.dish_name) {
            console.warn('Dish missing name:', dish);
            return null;
          }

          return {
            id: dish.dish_id || dish.id,
            name: dish.dish_name || dish.name,
            description: dish.restaurant_specific_description || dish.original_description || dish.description,
            category: dish.category,
            image_url: dish.image_url,
            municipality_id: dish.municipality_id,
            slug: dish.slug || `dish-${dish.dish_id || dish.id}`,
            rating: parseFloat(dish.rating) || 0,
            popularity: parseInt(dish.popularity) || 0,
            featured: dish.is_featured === 1 || dish.is_featured === true,
            featured_rank: parseInt(dish.featured_rank) || null,
            restaurant_specific_price: dish.restaurant_specific_price,
            availability: dish.availability
          };
        }).filter(Boolean); // Remove any null entries from validation
      } catch (error: any) {
        console.error('Failed to fetch restaurant dishes:', error);
        throw new Error(
          error.message === "Invalid response format"
            ? "Unable to load menu data"
            : "Failed to load restaurant dishes"
        );
      }
    },
    staleTime: 60_000,
    retry: (failureCount, error) => {
      // Only retry network errors or timeouts
      return (
        error.message.includes('network') || 
        error.message.includes('timeout')
      ) && failureCount < 2;
    },
  });

  // Variants offered by this restaurant (from /api/restaurants/:id/variants)
  const variantsQ = useQuery<Variant[]>({
    queryKey: ["restaurant-variants", restaurantQ.data?.id],
    enabled: !!restaurantQ.data?.id,
    queryFn: async () => fetchRestaurantVariants(restaurantQ.data!.id),
    staleTime: 60_000,
  });

  // Smooth-scroll to anchored variant if hash is present (e.g., #variant-123)
  useEffect(() => {
    if (!restaurantQ.data) return;
    const hash = location.hash || window.location.hash || "";
    if (!hash) return;
    // Allow the page to render then scroll
    const id = hash.replace(/^#/, "");
    const el = document.getElementById(id);
    if (el) {
      // small delay to allow layout; smooth behavior
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }, [restaurantQ.data, location.hash]);

  /** Featured dishes: only include dishes marked featured or with featured_rank.
      Sort by featured_rank ascending (lower rank = higher priority), then popularity, rating, name. */
  const featuredDishes = useMemo(() => {
    const all = dishesQ.data ?? [];
    const list = all.filter((d: RestaurantDish) => Boolean(d.featured) || d.featured_rank != null);
    list.sort((a: RestaurantDish, b: RestaurantDish) => {
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

  /** Dish search within Menu tab: search global dishes and indicate whether this restaurant offers them */
  const [dishSearch, setDishSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchDish[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  useEffect(() => {
    if (!dishSearch || dishSearch.trim().length < 2) {
      setSearchResults(null);
      setSearchError(null);
      setSearching(false);
      return;
    }
    let mounted = true;
    setSearching(true);
    setSearchError(null);
    const q = dishSearch.trim();
    const timer = setTimeout(async () => {
      try {
        const found = await fetchDishes({ q });
        if (!mounted) return;
  // Map results into lightweight SearchDish shape
  const mapped: SearchDish[] = (found || []).map(d => ({ id: d.id, name: d.name, description: d.description, image_url: d.image_url, rating: d.avg_rating ?? d.rating, slug: d.slug }));
  setSearchResults(mapped);
      } catch (err: any) {
        console.error('Dish search failed', err);
        setSearchError(String((err && err.message) || err));
        setSearchResults([]);
      } finally {
        if (mounted) setSearching(false);
      }
    }, 300);
    return () => { mounted = false; clearTimeout(timer); };
  }, [dishSearch]);

  /** Render states */
  // Error state for restaurant query
  if (restaurantQ.error) {
    return (
      <div className="min-h-screen bg-neutral-50 pt-20 pb-16">
        <div className="container mx-auto px-4">
          <nav className="mb-6">
            <ol className="flex items-center space-x-2 text-sm">
              <li>
                <Link to="/" className="text-neutral-600 hover:text-primary-600 transition-colors">
                  Home
                </Link>
              </li>
              <li className="text-neutral-400">/</li>
              <li>
                <Link to="/restaurants" className="text-neutral-600 hover:text-primary-600 transition-colors">
                  Restaurants
                </Link>
              </li>
            </ol>
          </nav>
          
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-red-500 text-xl mb-4">
              Restaurant Not Found
            </div>
            <p className="text-gray-600 mb-6">
              {restaurantQ.error instanceof Error ? restaurantQ.error.message : 'This restaurant could not be found or may have been removed'}
            </p>
            <Link
              to="/restaurants"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              <ArrowLeftIcon size={18} className="mr-2" />
              Browse All Restaurants
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state for restaurant query
  if (restaurantQ.isLoading) {
    return (
      <div className="pt-20 pb-16 bg-neutral-50 min-h-screen">
        <div className="container mx-auto px-4">
          {/* Breadcrumb skeleton */}
          <div className="mb-6">
            <div className="flex items-center space-x-2">
              <div className="h-4 bg-neutral-200 rounded w-16 animate-pulse" />
              <div className="text-neutral-400">/</div>
              <div className="h-4 bg-neutral-200 rounded w-24 animate-pulse" />
            </div>
          </div>

          {/* Hero section skeleton */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="h-64 md:h-80 bg-neutral-200 animate-pulse" />
            <div className="p-4">
              <div className="flex space-x-2 mb-4">
                <div className="h-6 bg-neutral-200 rounded w-20 animate-pulse" />
                <div className="h-6 bg-neutral-200 rounded w-24 animate-pulse" />
              </div>
              <div className="h-8 bg-neutral-200 rounded w-3/4 mb-2 animate-pulse" />
              <div className="h-6 bg-neutral-200 rounded w-1/2 animate-pulse" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="h-6 bg-neutral-200 rounded w-48 mb-4 animate-pulse" />
            <div className="space-y-4">
              <div className="h-4 bg-neutral-200 rounded w-full animate-pulse" />
              <div className="h-4 bg-neutral-200 rounded w-5/6 animate-pulse" />
              <div className="h-4 bg-neutral-200 rounded w-4/6 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }
        {/* Variants offered (if any) */}
        {variantsQ.isLoading ? null : (variantsQ.data && variantsQ.data.length > 0 ? (
          <section className="mt-6 bg-white border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Variants offered</h3>
            <div className="space-y-3">
              {variantsQ.data.map((v: any) => (
                <div key={v.id} id={`variant-${v.id}`} className="p-3 border rounded">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="font-medium">{v.name}</div>
                      {v.description ? <div className="text-sm text-neutral-600">{v.description}</div> : null}
                    </div>
                    {v.price ? <div className="text-sm text-neutral-700">₱{Number(v.price).toFixed(2)}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null)}
  const r = restaurantQ.data!;
  const cuisines = toArray((r as any).cuisine_types);
  const coords: [number, number] = [Number(r.lat) || 14.84, Number(r.lng) || 120.81];
  // Consistent average rating calculation
  const rating = reviewsQ.data ? calculateAverageRating(reviewsQ.data) : Number((r as any).avg_rating ?? r.rating ?? 0);
  // Use restaurant's hero image if available, fallback to category-based default
  const defaultHeroImages = {
    restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1600&auto=format&fit=crop",
    cafe: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?q=80&w=1600&auto=format&fit=crop",
    "fast-food": "https://images.unsplash.com/photo-1561758033-7e924f619b47?q=80&w=1600&auto=format&fit=crop",
    "food-stall": "https://images.unsplash.com/photo-1509315811345-672d83ef2fbc?q=80&w=1600&auto=format&fit=crop",
  };
  const hero = r.hero_image || defaultHeroImages[r.kind as keyof typeof defaultHeroImages] || defaultHeroImages.restaurant;
  
  // Define status badge based on restaurant data
  const getStatusBadge = () => {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hour * 100 + minutes;
    
    // Basic parsing of opening hours (assuming format like "10:00 AM - 9:00 PM")
    const hours = r.opening_hours?.match(/(\d+):(\d+)\s*(AM|PM)\s*-\s*(\d+):(\d+)\s*(AM|PM)/i);
    if (hours) {
      const [_, startHour, startMin, startAmPm, endHour, endMin, endAmPm] = hours;
      const openTime = (parseInt(startHour) + (startAmPm.toLowerCase() === 'pm' ? 12 : 0)) * 100 + parseInt(startMin);
      const closeTime = (parseInt(endHour) + (endAmPm.toLowerCase() === 'pm' ? 12 : 0)) * 100 + parseInt(endMin);
      
      const isOpen = currentTime >= openTime && currentTime <= closeTime;
      return isOpen ? (
        <span className="px-3 py-1 bg-green-500/90 text-white text-xs font-medium rounded-full">
          Open Now
        </span>
      ) : (
        <span className="px-3 py-1 bg-neutral-700/90 text-white text-xs font-medium rounded-full">
          Closed
        </span>
      );
    }
    return null;
  };

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
              <Link to="/restaurants" className="text-neutral-600 hover:text-primary-600 transition-colors">
                Restaurants
              </Link>
            </li>
            {restaurantQ.data && (
              <>
                <li className="text-neutral-400">/</li>
                <li className="text-primary-600 font-medium truncate max-w-[200px]">
                  {restaurantQ.data.name}
                </li>
              </>
            )}
          </ol>
          <div className="mt-2">
            <Link
              to="/restaurants"
              className="flex items-center text-neutral-600 hover:text-primary-600 transition-colors"
            >
              <ArrowLeftIcon size={18} className="mr-2" />
              <span>Back to Restaurants</span>
            </Link>
          </div>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="relative h-72 md:h-96">
            {/* Hero Image with Fallback */}
            <div className="absolute inset-0 bg-neutral-200 animate-pulse">
              <img 
                src={hero} 
                alt={r.name} 
                className="w-full h-full object-cover transition-opacity duration-300"
                onLoad={(e) => (e.target as HTMLElement).parentElement?.classList.remove('animate-pulse')}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = defaultHeroImages.restaurant;
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
                    {/* Status Badge */}
                    {getStatusBadge()}
                    
                    {/* Price Range */}
                    {r.price_range && (
                      <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
                        {r.price_range}
                      </span>
                    )}
                  </div>

                  {/* Rating Badge (consistent, accurate) */}
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-white/90 rounded-full">
                      <RatingDisplay 
                        rating={rating}
                        totalRatings={reviewsQ.data?.length}
                        size={16}
                        className="text-neutral-900"
                      />
                    </span>
                  </div>
                </div>

                {/* Restaurant Name and Info */}
                <div className="space-y-3">
                  <h1 className="text-3xl md:text-4xl font-bold text-white">
                    {r.name}
                  </h1>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-white/90">
                    {/* Type & Cuisine */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="capitalize">{r.kind}</span>
                      {cuisines.length > 0 && (
                        <>
                          <span className="text-white/60">•</span>
                          <span>{cuisines.join(", ")}</span>
                        </>
                      )}
                    </div>
                    
                    {/* Address */}
                    {r.address && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <MapPinIcon size={16} className="text-primary-400" />
                        <span>{r.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Contact Strip */}
          <div className="p-4 md:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b">
            {/* Contact Links */}
            <div className="flex flex-wrap gap-4 text-sm">
              {r.phone && (
                <a 
                  href={`tel:${r.phone}`} 
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-50 hover:bg-neutral-100 text-neutral-700 hover:text-primary-600 transition-colors"
                >
                  <PhoneIcon size={16} />
                  <span>{r.phone}</span>
                </a>
              )}
              {r.website && (
                <a 
                  href={r.website} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-50 hover:bg-neutral-100 text-neutral-700 hover:text-primary-600 transition-colors"
                >
                  <GlobeIcon size={16} />
                  <span>Website</span>
                </a>
              )}
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-2">
              {r.facebook && (
                <a 
                  href={r.facebook} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2 rounded-full bg-neutral-50 hover:bg-neutral-100 text-neutral-700 hover:text-blue-600 transition-colors"
                  title="Facebook Page"
                >
                  <FacebookIcon size={18} />
                </a>
              )}
              {r.instagram && (
                <a 
                  href={r.instagram} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2 rounded-full bg-neutral-50 hover:bg-neutral-100 text-neutral-700 hover:text-pink-600 transition-colors"
                  title="Instagram Profile"
                >
                  <InstagramIcon size={18} />
                </a>
              )}
            </div>
          </div>

          {/* Opening Hours Strip */}
          {r.opening_hours && (
            <div className="px-4 py-3 flex items-center gap-2 text-sm bg-neutral-50 text-neutral-700">
              <ClockIcon size={16} className="text-neutral-500" />
              <span>{r.opening_hours}</span>
            </div>
          )}
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
            <button
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${
                tab === "reviews" ? "text-primary-600 border-b-2 border-primary-600" : "text-neutral-600 hover:text-primary-600"
              }`}
              onClick={() => setTab("reviews")}
            >
              Reviews
            </button>
            {tab === "edit-review" && (
              <button
                className={`px-6 py-3 font-medium text-sm whitespace-nowrap text-primary-600 border-b-2 border-primary-600`}
              >
                Edit Review
              </button>
            )}
          </div>
        </div>

        {/* REVIEWS TAB */}
        {tab === "edit-review" ? (
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
                  queryClient.invalidateQueries({ queryKey: ["restaurant-reviews", r.id] });
                }}
                onSave={() => {
                  setTab('reviews');
                  addToast('Your review has been updated successfully', 'success');
                  queryClient.invalidateQueries({ queryKey: ["restaurant-reviews", r.id] });
                }}
              />
            ) : (
              <div className="text-neutral-600">Review not found.</div>
            )}
          </div>
        ) : tab === "reviews" && (
          <div className="bg-[#f7f4f0] rounded-xl p-6">
            <h2 className="mb-4 flex items-center text-2xl font-bold text-[#222]">
              <StarIcon size={22} className="mr-2 text-yellow-400" /> Reviews
            </h2>
            {/* Review Form or Login Prompt */}
            {user ? (
              <div className="mb-6">
                <RatingForm id={r.id} type="restaurant" />
              </div>
            ) : (
              <div className="mb-6 flex flex-col items-center justify-center bg-[#f5f2ef] rounded-lg py-6">
                <span className="text-neutral-600 mb-2">Please log in to leave a review</span>
                <Link 
                  to="/auth"
                  className="inline-flex items-center text-[#b88a44] hover:text-[#a97a2c] font-medium gap-2"
                  style={{ fontSize: '1rem' }}
                >
                  <UserIcon size={18} className="" />
                  Sign in to Review
                </Link>
              </div>
            )}

            {/* Reviews List */}
            <div className="space-y-2">
              {reviewsQ.isLoading ? (
                <div className="animate-pulse h-8 bg-neutral-200 rounded mb-2" />
              ) : reviewsQ.error ? (
                <div className="text-center py-8">
                  <div className="text-red-500 text-xl mb-4">Failed to load reviews</div>
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
                reviewsQ.data!.map((r, idx) => (
                  <div key={r.id} className={`rounded-lg px-4 py-3 border border-[#f0ece7] bg-white ${r.id === myReview?.id ? 'shadow-sm' : ''} ${idx !== reviewsQ.data!.length - 1 ? 'mb-2' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[1rem] text-[#222]">{r.user_name || "User"}</span>
                      {r.id === myReview?.id && (
                        <span className="ml-2 text-xs bg-[#f5f2ef] text-[#b88a44] px-2 py-0.5 rounded-full">Your Review</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <RatingDisplay rating={r.rating} showCount={false} size={16} className="text-yellow-500" />
                      <span className="text-xs text-neutral-500">
                        {new Date(r.created_at).toLocaleDateString()}
                        {r.updated_at !== r.created_at && ` · Edited ${new Date(r.updated_at).toLocaleDateString()}`}
                      </span>
                    </div>
                    <div className="text-neutral-700 text-[0.98rem]">{r.comment}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

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
                          ⭐ {Number((fd as any).avg_rating ?? fd.rating ?? 0).toFixed(1)} • {fd.category?.toUpperCase?.()}
                        </div>
                        {/* Show price if available */}
                        {fd.restaurant_specific_price ? (
                          <div className="text-sm font-medium text-green-600">
                            ₱ {fd.restaurant_specific_price}
                          </div>
                        ) : null}
                        {/* Show featured badge if applicable */}
                        {fd.featured ? (
                          <span className="inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full mt-1">
                            Featured
                          </span>
                        ) : null}
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
                Dishes we've linked to this place. We'll add prices and photos per item later.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Find a dish</label>
                <div className="flex items-center gap-2">
                  <input value={dishSearch} onChange={(e)=>setDishSearch(e.target.value)} placeholder="Search dishes by name..." className="flex-1 border rounded p-2" />
                  {searching ? <div className="text-sm text-neutral-500">Searching…</div> : null}
                </div>
                {searchError ? <div className="text-sm text-red-600 mt-2">{searchError}</div> : null}
                {searchResults ? (
                  <div className="mt-3 space-y-2">
                    {searchResults.length === 0 ? <div className="text-sm text-neutral-500">No matches.</div> : searchResults.map(sd => {
                      const offered = (dishesQ.data || []).some(d => Number(d.id) === Number(sd.id)) || (variantsQ.data || []).some(v => Number(v.dish_id) === Number(sd.id));
                      return (
                        <div key={sd.id} className="p-2 border rounded flex items-center justify-between">
                          <div>
                            <div className="font-medium">{sd.name}</div>
                            <div className="text-xs text-neutral-500">{sd.description}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            {offered ? <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">Offered here</span> : <span className="text-xs text-neutral-500">Not offered</span>}
                            <Link to={`/dish/${sd.id}`} className="text-sm text-primary-600 hover:underline">View</Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              {dishesQ.isLoading ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="flex animate-pulse">
                        <div className="w-24 h-24 bg-neutral-200 rounded-md mr-4" />
                        <div className="flex-1">
                          <div className="h-5 bg-neutral-200 rounded w-3/4 mb-2" />
                          <div className="h-4 bg-neutral-200 rounded w-full mb-2" />
                          <div className="h-4 bg-neutral-200 rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : dishesQ.error ? (
                <div className="text-center py-8">
                  <div className="text-red-500 text-xl mb-4">
                    {dishesQ.error instanceof Error 
                      ? dishesQ.error.message 
                      : 'Failed to load menu items'
                    }
                  </div>
                  <button
                    onClick={() => dishesQ.refetch()}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors text-sm"
                  >
                    Try Again
                  </button>
                </div>
              ) : (dishesQ.data?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-neutral-600">
                  <div className="mb-2">No menu items available yet</div>
                  <div className="text-sm">Check back later for updates to our menu</div>
                </div>
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
                    <CircleMarker
                      center={coords}
                      radius={8}
                      pathOptions={{ color: '#e53e3e', fillColor: '#e53e3e', fillOpacity: 0.9 }}
                    />
                  </MapContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Confirmation Modals */}
      {myReview && (
        <ConfirmModal
          open={showDeleteConfirm}
          title="Delete Your Review"
          message={
            <div className="space-y-2">
              <p>Are you sure you want to delete your review? This action cannot be undone.</p>
              <div className="bg-neutral-50 p-3 rounded mt-2 border">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex text-yellow-500">
                    {[...Array(myReview.rating)].map((_, i) => (
                      <StarIcon key={i} size={14} className="fill-yellow-400" />
                    ))}
                  </div>
                  <span className="text-sm text-neutral-500">
                    Posted on {new Date(myReview.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-neutral-600">{myReview.comment}</p>
              </div>
            </div>
          }
          confirmLabel="Delete Review"
          cancelLabel="Keep Review"
          variant="danger"
          onConfirm={() => {
            setShowDeleteConfirm(false);
            deleteReviewMutation.mutate(myReview.id);
            addToast('Your review has been deleted', 'success');
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </motion.div>
  );
}

export default RestaurantDetails;
