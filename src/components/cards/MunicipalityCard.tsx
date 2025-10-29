// src/components/cards/MunicipalityCard.tsx
import React, { useMemo, useState, useEffect } from "react";
// DishGrid: reusable grid for dishes/delicacies
function DishGrid({ dishes, error, placeholder, onHighlightPlace }: {
  dishes: Dish[] | null;
  error: string | null;
  placeholder: string;
  onHighlightPlace?: MunicipalityCardProps['onHighlightPlace'];
}) {
  const listVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
  const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } };
  return (
    <motion.div variants={listVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
      {dishes === null && !error && (<><div className="skeleton rounded h-36" /><div className="skeleton rounded h-36" /><div className="skeleton rounded h-36" /></>)}
      {error && <div className="text-sm text-red-600">Failed to load dishes. {error}</div>}
      {dishes && dishes.length === 0 && <div className="text-sm text-neutral-600">None yet.</div>}
      {dishes?.map((dish) => (
        <motion.div
          key={dish.id}
          variants={itemVariants}
          onMouseEnter={() => onHighlightPlace?.({ type: 'dish', id: dish.id })}
          onMouseLeave={() => onHighlightPlace?.(null)}
        >
          <Link to={`/dish/${encodeURIComponent(String(dish.slug ?? dish.id))}`} className="relative h-36 rounded-xl overflow-hidden group block" title={dish.name}>
            <img
              src={dish.image_url?.startsWith("http") ? dish.image_url : assetUrl(dish.image_url || placeholder)}
              alt={dish.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { e.currentTarget.src = assetUrl(placeholder); }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:opacity-95" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="text-white font-semibold text-sm md:text-base truncate drop-shadow-sm">{dish.name}</div>
              {dish.description && <div className="text-white/85 text-xs line-clamp-1">{dish.description}</div>}
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
import { X as XIcon, MapPin, Utensils, ExternalLink, ChevronRight, Landmark, Star, Info } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { assetUrl } from "../../utils/assets";

type Dish = {
  id: number | string;
  slug?: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  category?: "food" | "delicacy" | "drink";
  signature?: number | null;
  panel_rank?: number | null;
  popularity?: number | null;
};

type Restaurant = {
  id: number | string;
  slug?: string;
  name: string;
  address?: string | null;
  price_range?: string | null;
  rating?: number | null;
  featured?: number | null;
  panel_rank?: number | null;
};

type UIMunicipality = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  coordinates: [number, number];
};

interface MunicipalityCardProps {
  municipality: UIMunicipality;
  onClose: () => void;
  onHighlightPlace?: (place: { type: 'dish' | 'restaurant'; id: string | number; coordinates?: [number, number] } | null) => void;
}
export default function MunicipalityCard({ municipality, onClose, onHighlightPlace }: MunicipalityCardProps) {

const API = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001";
const safeOrigin = typeof window !== "undefined" ? window.location.origin : "";

function cn(...xs: Array<string | false | undefined>) { return xs.filter(Boolean).join(" "); }
async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt) as T;
}

const panelTransition: any = { type: "spring", stiffness: 260, damping: 26 };
  const [foods, setFoods] = useState<Dish[] | null>(null);
  const [foodsErr, setFoodsErr] = useState<string | null>(null);
  const [delics, setDelics] = useState<Dish[] | null>(null);
  const [delicsErr, setDelicsErr] = useState<string | null>(null);
  const [restos, setRestos] = useState<Restaurant[] | null>(null);
  const [restosErr, setRestosErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dishes' | 'delicacies' | 'restaurants' | 'info'>('dishes');

  const heroSrc = municipality.image_url
    ? (municipality.image_url.startsWith("http") ? municipality.image_url : assetUrl(municipality.image_url))
    : assetUrl(`images/municipalities/${municipality.slug}.jpg`);

  const [latRaw, lngRaw] = municipality.coordinates as any;
  const latNum = Number(latRaw), lngNum = Number(lngRaw);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum);
  const gmapsHref = hasCoords ? `https://www.google.com/maps?q=${latNum},${lngNum}` : undefined;

  const navigate = useNavigate();
  const goToAll: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement> = (e) => {
    e.preventDefault(); e.stopPropagation();
    const url = `/dishes?municipalityId=${municipality.id}`;
    onClose?.(); setTimeout(() => navigate(url), 200);
  };

function sortAndSlice<T extends Dish | Restaurant>(
  list: T[], 
  { forDish }: { forDish: boolean }, 
  limit = 3
): T[] {
  // First filter: only include items that are explicitly marked as featured/top
  const featuredItems = list.filter((item: any) => {
    const isFeatured = Number(item.signature ?? item.featured ?? 0) > 0;
    const hasPanelRank = Number(item.panel_rank ?? 0) > 0;
    return isFeatured || hasPanelRank;
  });

  // Then sort by your ranking system
  return featuredItems
    .sort((a: any, b: any) => {
      // Primary sort: panel_rank (lower number = higher rank)
      const aRank = Number(a.panel_rank ?? 999);
      const bRank = Number(b.panel_rank ?? 999);
      if (aRank !== bRank) return aRank - bRank;
      
      // Secondary sort: signature/featured status
      const aFeatured = Number(a.signature ?? a.featured ?? 0);
      const bFeatured = Number(b.signature ?? b.featured ?? 0);
      if (bFeatured !== aFeatured) return bFeatured - aFeatured;
      
      // Tertiary sort: popularity or rating
      return forDish
        ? Number(b.popularity ?? 0) - Number(a.popularity ?? 0)
        : Number(b.rating ?? 0) - Number(a.rating ?? 0);
    })
    .slice(0, limit);
}

  useEffect(() => {
    let cancel = false;
    (async () => {
      setFoodsErr(null); setFoods(null);
      try {
        const primary = `${API}/api/dishes?municipalityId=${municipality.id}&category=food&signature=1&limit=3`;
        const data = await getJSON<Dish[]>(primary).catch(async () => {
          const fallback = await getJSON<Dish[]>(`${API}/api/dishes?municipalityId=${municipality.id}&category=food`);
          return sortAndSlice(fallback, { forDish: true }, 3);
        });
        if (!cancel) setFoods(sortAndSlice(data, { forDish: true }, 3));
      } catch (e: any) { if (!cancel) setFoodsErr(String(e?.message || e)); }
    })();
    return () => { cancel = true; };
  }, [municipality.id]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setDelicsErr(null); setDelics(null);
      try {
        const primary = `${API}/api/dishes?municipalityId=${municipality.id}&category=delicacy&signature=1&limit=3`;
        const data = await getJSON<Dish[]>(primary).catch(async () => {
          const fallback = await getJSON<Dish[]>(`${API}/api/dishes?municipalityId=${municipality.id}&category=delicacy`);
          return sortAndSlice(fallback, { forDish: true }, 3);
        });
        if (!cancel) setDelics(sortAndSlice(data, { forDish: true }, 3));
      } catch (e: any) { if (!cancel) setDelicsErr(String(e?.message || e)); }
    })();
    return () => { cancel = true; };
  }, [municipality.id]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setRestosErr(null); setRestos(null);
      try {
        const primary = `${API}/api/restaurants?municipalityId=${municipality.id}&featured=1&limit=2`;
        const data = await getJSON<Restaurant[]>(primary).catch(async () => {
          const fallback = await getJSON<Restaurant[]>(`${API}/api/restaurants?municipalityId=${municipality.id}`);
          return sortAndSlice(fallback, { forDish: false }, 2);
        });
        if (!cancel) setRestos(sortAndSlice(data, { forDish: false }, 2));
      } catch (e: any) { if (!cancel) setRestosErr(String(e?.message || e)); }
    })();
    return () => { cancel = true; };
  }, [municipality.id]);

  const desc = municipality.description ?? "";
  const shortDesc = useMemo(() => (desc.length > 220 ? `${desc.slice(0, 220)}…` : desc), [desc]);

  // Overlay for focus effect
  // Panel: wider, overlays more of the map/content
  // Mobile: slide up from bottom
  // Centered floating panel with overlay
  return (
    <>
      <motion.div
        className="fixed inset-0 z-[998] bg-black/20 backdrop-blur-lg transition-opacity"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        aria-hidden="true"
      />
      <motion.aside
        role="dialog" aria-modal="false" aria-labelledby="municipality-title"
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={panelTransition}
        className={cn(
          "fixed inset-0 z-[999] flex items-center justify-center",
          "w-full",
        )}
        style={{ pointerEvents: 'auto' }}
      >
        <div className={cn(
          "w-full max-w-[96vw] sm:max-w-[900px] md:max-w-[1100px] lg:max-w-[1300px] xl:max-w-[1500px]",
          "min-h-[72vh] max-h-[92vh] mx-4",
          "bg-white shadow-2xl border border-neutral-200 rounded-2xl flex flex-col overflow-hidden"
        )}>

  {/* HERO */}
      <motion.div
        className="relative"
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <img
          src={heroSrc}
          alt={municipality.name}
          onError={(e) => { e.currentTarget.src = assetUrl("images/placeholders/municipality.jpg"); }}
          className="w-full h-52 md:h-64 lg:h-72 object-cover shadow-2xl"
          style={{ filter: 'drop-shadow(0 10px 40px rgba(0,0,0,0.18))' }}
        />
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        {/* Municipality badge/icon */}
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/80 rounded-full px-3 py-1 shadow backdrop-blur-md">
          <Landmark size={20} className="text-primary-700" />
          <span className="font-semibold text-primary-800 text-sm">Municipality</span>
        </div>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white text-neutral-800 shadow focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Close panel"
          title="Close"
        >
          <XIcon size={20} />
        </button>
        {/* Banner content */}
  <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="text-white/85 text-xs uppercase tracking-[0.18em] mb-2">Culinary Highlights</div>
          <h2 id="municipality-title" className="text-white text-[36px] md:text-4xl font-extrabold leading-tight drop-shadow-lg">
            {municipality.name}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/90">
            {hasCoords && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15">
                <MapPin size={15} /> {latNum.toFixed(4)}, {lngNum.toFixed(4)}
              </span>
            )}
            {hasCoords && (
              <a
                href={gmapsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 hover:bg-white/25 transition"
                title="Open in Google Maps"
              >
                Directions <ExternalLink size={15} />
              </a>
            )}
            {safeOrigin && (
              <a
                href={`${safeOrigin}/map?municipality=${municipality.slug}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 hover:bg-white/25 transition"
              >
                Share focus link
              </a>
            )}
          </div>
        </div>
      </motion.div>

      {/* TABS */}
  <nav className="flex border-b border-neutral-200 bg-neutral-50 px-6 pt-3 gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-primary-200 scrollbar-track-transparent" aria-label="Municipality details tabs">
        <button
          className={cn(
            "py-3 px-5 rounded-t-lg font-semibold text-base flex items-center gap-3 transition relative",
            activeTab === 'dishes' ? "bg-white border-x border-t border-primary-400 -mb-px text-primary-700 shadow-sm" : "text-neutral-500 hover:text-primary-600",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          )}
          onClick={() => setActiveTab('dishes')}
          aria-selected={activeTab === 'dishes'}
        >
          <Utensils size={18} /> Dishes
          {activeTab === 'dishes' && <span className="absolute left-0 right-0 -bottom-1 h-1 bg-primary-400 rounded-full" />}
        </button>
        <button
          className={cn(
            "py-3 px-5 rounded-t-lg font-semibold text-base flex items-center gap-3 transition relative",
            activeTab === 'delicacies' ? "bg-white border-x border-t border-primary-400 -mb-px text-primary-700 shadow-sm" : "text-neutral-500 hover:text-primary-600",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          )}
          onClick={() => setActiveTab('delicacies')}
          aria-selected={activeTab === 'delicacies'}
        >
          <Star size={18} /> Delicacies
          {activeTab === 'delicacies' && <span className="absolute left-0 right-0 -bottom-1 h-1 bg-primary-400 rounded-full" />}
        </button>
        <button
          className={cn(
            "py-3 px-5 rounded-t-lg font-semibold text-base flex items-center gap-3 transition relative",
            activeTab === 'restaurants' ? "bg-white border-x border-t border-primary-400 -mb-px text-primary-700 shadow-sm" : "text-neutral-500 hover:text-primary-600",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          )}
          onClick={() => setActiveTab('restaurants')}
          aria-selected={activeTab === 'restaurants'}
        >
          <Star size={18} /> Restaurants
          {activeTab === 'restaurants' && <span className="absolute left-0 right-0 -bottom-1 h-1 bg-primary-400 rounded-full" />}
        </button>
        <button
          className={cn(
            "py-3 px-5 rounded-t-lg font-semibold text-base flex items-center gap-3 transition relative",
            activeTab === 'info' ? "bg-white border-x border-t border-primary-400 -mb-px text-primary-700 shadow-sm" : "text-neutral-500 hover:text-primary-600",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          )}
          onClick={() => setActiveTab('info')}
          aria-selected={activeTab === 'info'}
        >
          <Info size={18} /> Info
          {activeTab === 'info' && <span className="absolute left-0 right-0 -bottom-1 h-1 bg-primary-400 rounded-full" />}
        </button>
      </nav>

      {/* BODY (independent scroll) */}
  <div className="px-6 pt-6 pb-6 flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
        {activeTab === 'dishes' && <>
          <p className="text-[15px] leading-relaxed text-neutral-800/95 mb-5 max-w-prose">{shortDesc || "—"}</p>
          <div className="mb-4">
            <button
              onClick={goToAll}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-primary-600 text-white hover:bg-primary-700 transition shadow-sm"
            >
              <Utensils size={18} /> Explore all dishes
              <ChevronRight size={18} className="opacity-90" />
            </button>
          </div>
          <h3 className="text-sm font-semibold mb-2 text-neutral-800">Top Dishes</h3>
          <DishGrid dishes={foods} error={foodsErr} placeholder="images/placeholders/dish.jpg" onHighlightPlace={onHighlightPlace} />
        </>}
        {activeTab === 'delicacies' && <>
          <h3 className="text-sm font-semibold mb-2 text-neutral-800">Top Delicacies</h3>
          <DishGrid dishes={delics} error={delicsErr} placeholder="images/placeholders/delicacy.jpg" onHighlightPlace={onHighlightPlace} />
        </>}
        {activeTab === 'restaurants' && <>
          <h3 className="text-sm font-semibold mb-2 text-neutral-800 hidden sm:block">Featured Restaurants</h3>
          <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 gap-3">
            {restos === null && !restosErr && (<><div className="skeleton rounded h-20" /><div className="skeleton rounded h-20" /></>)}
            {restosErr && <div className="text-sm text-red-600">Failed to load restaurants. {restosErr}</div>}
            {restos && restos.length === 0 && <div className="text-sm text-neutral-600">No restaurants yet.</div>}
            {restos?.map((r) => (
              <div
                key={r.id}
                onMouseEnter={() => onHighlightPlace?.({ type: 'restaurant', id: r.id })}
                onMouseLeave={() => onHighlightPlace?.(null)}
              >
                <Link to={`/restaurant/${encodeURIComponent(String(r.slug ?? r.id))}`} className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition">
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-neutral-100 flex-shrink-0">
                    <img
                      src={assetUrl("images/placeholders/restaurant-thumb.jpg")}
                      alt={r.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{r.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{r.address ?? ""}</div>
                    <div className="text-[11px] text-neutral-500 mt-1">
                      {(r.price_range ?? "").toString()} • ⭐ {Number(r.rating ?? 0).toFixed(1)}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </>}
        {activeTab === 'info' && <>
          <h3 className="text-sm font-semibold mb-2 text-neutral-800">About {municipality.name}</h3>
          <p className="text-[15px] leading-relaxed text-neutral-800/95 mb-5 max-w-prose">{desc || "—"}</p>
          {/* Add more info, history, events, or fun facts here */}
        </>}
      </div>
        </div>
    </motion.aside>
    </>
  );
}
