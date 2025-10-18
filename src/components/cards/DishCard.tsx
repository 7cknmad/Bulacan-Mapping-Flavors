import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StarIcon } from "lucide-react";
import { assetUrl } from "../../utils/assets";

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
  const rating = typeof dish.rating === "number" ? dish.rating : 0;
  const ingredientsCount = Array.isArray(dish.ingredients) ? dish.ingredients.length : 0;
  const muniLabel = dish.municipality_name || "";

  // resolved image sources (memoized)
  const imgSources = useMemo(() => getImageSources(dish, imageOverride), [dish, imageOverride]);

  // local fallback state: if image fails to load, switch to placeholder
  const [srcFallback, setSrcFallback] = useState<string | null>(null);
  const handleImgError = useCallback(() => {
    if (srcFallback !== PLACEHOLDER) setSrcFallback(PLACEHOLDER);
  }, [srcFallback]);

  const renderedSrc = srcFallback ?? imgSources.src;
  const renderedSrcSet = srcFallback ? undefined : imgSources.srcSet;

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

            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
              {ingredientsCount} Ingredients
            </span>
          </div>
        </div>
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
  if ((p?.rating ?? 0) !== (n?.rating ?? 0)) return false;
  const prevIng = Array.isArray(p?.ingredients) ? p.ingredients.length : 0;
  const nextIng = Array.isArray(n?.ingredients) ? n.ingredients.length : 0;
  if (prevIng !== nextIng) return false;
  if ((prev as any).compact !== (next as any).compact) return false;
  return true;
}

export default React.memo(DishCardInner, areEqual);
