import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from 'react-router-dom';
import { StarIcon, Heart } from "lucide-react";
import { assetUrl } from "../../utils/assets";
import { fetchRestaurants } from "../../utils/api";
import VariantPreviewModal from "../VariantPreviewModal";
import { useFavorites } from "../../hooks/useFavorites";

type AnyDish = {
  id?: number | string;
  slug?: string;
  name: string;
  description?: string | null;
  image?: string | null;       // old mock
  image_url?: string | null;   // new API
  rating?: number | null;
  ingredients?: string[] | null;
  municipalityId?: string | number;   // old mock
  municipality_name?: string | null;  // new API
};

interface DishCardProps {
  dish: AnyDish;
  compact?: boolean;
  imageOverride?: string | null;
}

/**
 * Utility: sanitize a string to a filename-friendly slug
 * - lowercases, replaces spaces and invalid chars with hyphen
 */
function makeSlugFromValue(val?: string | number | null) {
  if (val === undefined || val === null) return "";
  return String(val)
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

const PLACEHOLDER = assetUrl("images/placeholders/dish.jpg");

/**
 * getImageSources
 * Priority:
 * 1) absolute image_url (http/https) -> use directly (no srcSet generation)
 * 2) imageOverride (explicit)
 * 3) local repo images folder: /images/dishes/<slug>.jpg (and .webp @2x variants in srcSet)
 * 4) dish.image (legacy) via assetUrl
 * 5) placeholder
 */
function getImageSources(dish: AnyDish, imageOverride?: string | null) {
  // 1) absolute remote
  if (dish.image_url && dish.image_url.startsWith("http")) {
    return {
      src: dish.image_url,
      srcSet: undefined,
      sizes: undefined,
      isExternal: true,
    };
  }

  // 2) explicit override
  if (imageOverride) {
    const src = imageOverride.startsWith("http") ? imageOverride : assetUrl(imageOverride);
    return { src, srcSet: undefined, sizes: undefined, isExternal: src.startsWith("http") };
  }

  // 3) local repo images folder based on slug/id/name
  const baseSlug = makeSlugFromValue(dish.slug ?? dish.id ?? dish.name);
  if (baseSlug) {
    const jpg = `/images/dishes/${baseSlug}.jpg`;
    const webp = `/images/dishes/${baseSlug}.webp`;
    const jpg2x = `/images/dishes/${baseSlug}@2x.jpg`;
    const webp2x = `/images/dishes/${baseSlug}@2x.webp`;

    // srcSet: prefer webp if available on the server — browsers will negotiate.
    // These files may not exist; if they don't the request will 404 and onError will fallback to PLACEHOLDER.
    const srcSet = `${webp} 1x, ${webp2x} 2x, ${jpg} 1x, ${jpg2x} 2x`;
    return {
      src: jpg,
      srcSet,
      sizes: "(max-width: 640px) 100vw, 320px",
      isExternal: false,
    };
  }

  // 4) legacy image field (may be relative)
  if (dish.image) {
    const src = dish.image.startsWith("http") ? dish.image : assetUrl(dish.image);
    return { src, srcSet: undefined, sizes: undefined, isExternal: src.startsWith("http") };
  }

  // 5) placeholder
  return { src: PLACEHOLDER, srcSet: undefined, sizes: undefined, isExternal: false };
}

const Stars: React.FC<{ rating: number; size?: number }> = ({ rating, size = 16 }) => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <StarIcon
        key={i}
        size={size}
        className={`${i < Math.floor(rating) ? "text-yellow-500 fill-yellow-500" : "text-neutral-300"} mr-0.5`}
        aria-hidden
      />
    ))}
  </>
);

const DishCardInner: React.FC<DishCardProps> = ({ dish, compact = false, imageOverride = null }) => {
  const href = `/dish/${encodeURIComponent((dish.slug ?? dish.id) as string)}`;
  const rating = typeof (dish as any).avg_rating === "number" ? Number((dish as any).avg_rating) : (typeof dish.rating === "number" ? dish.rating : 0);
  const ingredientsCount = Array.isArray(dish.ingredients) ? dish.ingredients.length : 0;
  const muniLabel = dish.municipality_name || "";

  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const dishId = Number(dish.id ?? dish.slug ?? 0);
  const favorited = isFavorite(dishId, 'dish');

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (favorited) {
      removeFavorite(dishId, 'dish');
    } else {
      addFavorite({
        id: dishId,
        type: 'dish',
        name: dish.name,
        image_url: dish.image_url || dish.image || undefined,
        municipality_name: dish.municipality_name || undefined
      });
    }
  }, [favorited, dishId, dish, addFavorite, removeFavorite]);

  // resolved image sources (memoized)
  const imgSources = useMemo(() => getImageSources(dish, imageOverride), [dish, imageOverride]);

  // local fallback state: if image fails to load, switch to placeholder
  const [srcFallback, setSrcFallback] = useState<string | null>(null);
  const handleImgError = useCallback(() => {
    if (srcFallback !== PLACEHOLDER) setSrcFallback(PLACEHOLDER);
  }, [srcFallback]);

  const renderedSrc = srcFallback ?? imgSources.src;
  const renderedSrcSet = srcFallback ? undefined : imgSources.srcSet;

  // where-to-try panel state
  const [places, setPlaces] = useState<any[] | null | undefined>(undefined);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [selectedRestaurantSlug, setSelectedRestaurantSlug] = useState<string | undefined>(undefined);
  const [showVariantModal, setShowVariantModal] = useState(false);

  const togglePlaces = async () => {
    // if already loaded, toggle hide
    if (places !== undefined) {
      setPlaces((p) => (p ? null : undefined));
      return;
    }
    setLoadingPlaces(true);
    setPlacesError(null);
    try {
      const dishId = Number(dish.id ?? dish.slug ?? 0);
      const res = await fetchRestaurants({ dishId });
      setPlaces(res?.rows ?? []);
    } catch (err: any) {
      console.error('Failed to fetch places for dish', err);
      setPlacesError(String((err && err.message) || err));
      setPlaces([]);
    } finally {
      setLoadingPlaces(false);
    }
  };
  const navigate = useNavigate();

  if (compact) {
    return (
      <Link to={href} className="block">
        <div className="flex items-center p-3 hover:bg-neutral-50 transition-colors rounded-lg gap-3">
          <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-neutral-100">
            <img
              src={renderedSrc}
              srcSet={renderedSrcSet}
              sizes={imgSources.sizes}
              alt={dish.name}
              loading="lazy"
              decoding="async"
              onError={handleImgError}
              className="w-full h-full object-cover"
            />
          </div>

                    <div className="flex-1 min-w-0">
            <h3 className="font-medium text-neutral-900 truncate">{dish.name}</h3>
            {muniLabel && <p className="text-xs text-neutral-500 truncate">{muniLabel}</p>}
            <div className="flex items-center mt-1">
              <Stars rating={rating} size={12} />
              <span className="text-xs text-neutral-500 ml-1">{rating.toFixed(1)}</span>
            </div>
          </div>

          <button
            onClick={handleFavoriteClick}
            className={`p-2 rounded-full hover:bg-neutral-100 transition-colors ${favorited ? 'text-red-500' : 'text-neutral-400'}`}
          >
            <Heart
              size={20}
              className={favorited ? 'fill-current' : ''}
            />
          </button>

        </div>
      </Link>
    );
  }

  return (
    <Link to={href} className="block">
      <article className="card group hover:scale-[1.02] transition-transform">
        <div className="relative">
          <div className="w-full aspect-[4/3] bg-neutral-100 overflow-hidden">
            <img
              src={renderedSrc}
              srcSet={renderedSrcSet}
              sizes={imgSources.sizes}
              alt={dish.name}
              loading="lazy"
              decoding="async"
              onError={handleImgError}
              className="w-full h-full object-cover object-center"
            />
          </div>

          <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-md text-xs font-medium flex items-center">
            <StarIcon size={14} className="text-yellow-500 fill-yellow-500 mr-1" />
            {rating.toFixed(1)}
          </div>

          <button
            onClick={handleFavoriteClick}
            className={`absolute top-2 left-2 p-2 rounded-full bg-white/90 transition-colors ${favorited ? 'text-red-500' : 'text-neutral-400 hover:text-neutral-600'}`}
          >
            <Heart
              size={20}
              className={favorited ? 'fill-current' : ''}
            />
          </button>

          {muniLabel && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <span className="text-white text-xs font-medium">{muniLabel}</span>
            </div>
          )}
        </div>

        <div className="p-4">
          <h3 className="font-medium text-lg mb-1 group-hover:text-primary-600 transition-colors">
            {dish.name}
          </h3>

          {dish.description && (
            <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{dish.description}</p>
          )}

          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Stars rating={rating} />
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePlaces(); }} className="text-sm px-3 py-1 bg-primary-600 text-white rounded">{places === undefined ? 'Show where to try' : places === null ? 'Hide places' : 'Hide places'}</button>
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">{ingredientsCount} Ingredients</span>
            </div>
          </div>
        </div>
        {/* inline places panel (compact) */}
        {places !== undefined && places ? (
          <div className="p-3 border-t bg-neutral-50">
            {loadingPlaces ? (
              <div className="text-sm text-neutral-500">Loading places…</div>
            ) : placesError ? (
              <div className="text-sm text-red-600">{placesError}</div>
            ) : places.length === 0 ? (
              <div className="text-sm text-neutral-500">No places found for this dish.</div>
            ) : (
              <div className="space-y-2">
                {places
                  .slice()
                  .sort((a,b) => (Number(b.avg_rating ?? b.rating ?? 0) - Number(a.avg_rating ?? a.rating ?? 0)))
                  .slice(0,3)
                  .map((r) => (
                   <div key={r.id} onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); navigate(`/restaurant/${encodeURIComponent(r.slug || String(r.id))}`); }} role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter') { e.preventDefault(); e.stopPropagation(); navigate(`/restaurant/${encodeURIComponent(r.slug || String(r.id))}`); } }} className="p-2 bg-white rounded border flex items-start gap-3 cursor-pointer">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-neutral-500">{r.address}</div>
                      {Array.isArray((r as any).variants) && (r as any).variants.length > 0 && (
                        <div className="mt-2 grid gap-2">
                          {(r as any).variants.map((v: any) => (
                            <button key={v.id} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedVariant(v); setSelectedRestaurantSlug(r.slug || String(r.id)); setShowVariantModal(true); }} className="w-full text-left flex items-center gap-3 p-2 border rounded bg-white hover:shadow-sm">
                              {v.image_url ? (
                                <img src={v.image_url} alt={v.name} className="w-10 h-10 object-cover rounded-md" onError={(e)=>((e.currentTarget.src='https://via.placeholder.com/40'))} />
                              ) : (
                                <div className="w-10 h-10 rounded-md bg-neutral-100 flex items-center justify-center text-xs text-neutral-500">No image</div>
                              )}
                              <div className="flex-1 text-sm">
                                <div className="font-medium">{v.name}</div>
                                <div className="text-xs text-neutral-500">{v.description}</div>
                              </div>
                              <div className="text-sm text-neutral-700">{v.price ? `₱${Number(v.price).toFixed(2)}` : ''}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-neutral-700">⭐ {Number(r.avg_rating ?? r.rating ?? 0).toFixed(1)}</div>
                  </div>
                ))}
                {/* view all places link */}
                <div>
                  <a href={`/restaurants?dishId=${encodeURIComponent(String(dish.id ?? dish.slug ?? ''))}`} onClick={(e)=>{e.preventDefault(); e.stopPropagation(); window.location.hash = `/restaurants?dishId=${encodeURIComponent(String(dish.id ?? dish.slug ?? ''))}`; window.location.reload(); }} className="text-sm text-primary-600 hover:underline">View all places offering this dish →</a>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <VariantPreviewModal open={showVariantModal} onClose={() => setShowVariantModal(false)} variant={selectedVariant} restaurantSlug={selectedRestaurantSlug} />
      </article>
    </Link>
  );
};

/**
 * Memoization comparator:
 * - shallow compares dish.id (or slug), dish.image_url / image, dish.rating, dish.ingredients length, and compact flag.
 * - This keeps re-renders minimal while still updating when key visible fields change.
 */
function areEqual(prev: Readonly<DishCardProps>, next: Readonly<DishCardProps>) {
  const p = prev.dish;
  const n = next.dish;
  const idPrev = p?.slug ?? p?.id ?? p?.name;
  const idNext = n?.slug ?? n?.id ?? n?.name;

  if (idPrev !== idNext) return false;
  if ((p?.image_url || p?.image) !== (n?.image_url || n?.image)) return false;
  const prevRating = (p as any)?.avg_rating ?? p?.rating ?? 0;
  const nextRating = (n as any)?.avg_rating ?? n?.rating ?? 0;
  if ((prevRating ?? 0) !== (nextRating ?? 0)) return false;
  const prevIng = Array.isArray(p?.ingredients) ? p.ingredients.length : 0;
  const nextIng = Array.isArray(n?.ingredients) ? n.ingredients.length : 0;
  if (prevIng !== nextIng) return false;
  if ((prev as any).compact !== (next as any).compact) return false;
  return true;
}

export default React.memo(DishCardInner, areEqual);
