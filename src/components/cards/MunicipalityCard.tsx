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
    <motion.div variants={listVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
      {dishes === null && !error && (<><div className="skeleton rounded-xl h-44" /><div className="skeleton rounded-xl h-44" /><div className="skeleton rounded-xl h-44" /></>)}
      {error && <div className="text-sm text-red-600">Failed to load dishes. {error}</div>}
      {dishes && dishes.length === 0 && <div className="text-sm text-neutral-600">None yet.</div>}
      {dishes?.map((dish) => (
        <motion.div
          key={dish.id}
          variants={itemVariants}
          onMouseEnter={() => onHighlightPlace?.({ type: 'dish', id: dish.id })}
          onMouseLeave={() => onHighlightPlace?.(null)}
        >
          <Link to={`/dish/${encodeURIComponent(String(dish.slug ?? dish.id))}`} className="group block" title={dish.name}>
            <div className="relative h-44 rounded-2xl overflow-hidden shadow-lg bg-white border border-neutral-200 transition-transform group-hover:-translate-y-1 group-hover:shadow-xl">
              <img
                src={dish.image_url?.startsWith("http") ? dish.image_url : assetUrl(dish.image_url || placeholder)}
                alt={dish.name}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = assetUrl(placeholder); }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:opacity-95 transition" />
              {/* Only show main card rating if needed; redundant rating removed */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="text-white font-bold text-base truncate drop-shadow-sm mb-1">{dish.name}</div>
                {dish.description && <div className="text-white/85 text-xs line-clamp-1 mb-1">{dish.description}</div>}
                {/* No ratings or scores in card body */}
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
import { X as XIcon, MapPin, Utensils, ExternalLink, ChevronRight, Landmark, Star, Info } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { assetUrl } from "../../utils/assets";

type Dish = {
  id: number | string;
  slug?: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  category?: "food" | "delicacy" | "drink";
  signature?: boolean;
  panel_rank?: number | null;
  popularity?: number | null;
  avg_rating?: number | null;
  total_ratings?: number | null;
  is_featured?: boolean;
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
  // New state for recommended/top dish and error
  const [recommendedDish, setRecommendedDish] = useState<Dish | null>(null);
  const [topRatedDish, setTopRatedDish] = useState<Dish | null>(null);
  const [dishSummaryErr, setDishSummaryErr] = useState<string | null>(null);

const API = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3002";
const safeOrigin = typeof window !== "undefined" ? window.location.origin : "";

function cn(...xs: Array<string | false | undefined>) { return xs.filter(Boolean).join(" "); }
async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt) as T;
}

const panelTransition: any = { type: "spring", stiffness: 260, damping: 26 };
  // Removed old foods/top/recommended logic
  const [delics, setDelics] = useState<Dish[] | null>(null);
  const [delicsErr, setDelicsErr] = useState<string | null>(null);
  const [restos, setRestos] = useState<Restaurant[] | null>(null);
  const [restosErr, setRestosErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dishes' | 'delicacies' | 'restaurants' | 'info'>('dishes');
  const [prevTab, setPrevTab] = useState<'dishes' | 'delicacies' | 'restaurants' | 'info'>('dishes');

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
  // Animate tab change
  function handleTabChange(tab: 'dishes' | 'delicacies' | 'restaurants' | 'info') {
    setPrevTab(activeTab);
    setActiveTab(tab);
  }

function sortAndSlice<T extends Dish | Restaurant>(
  list: T[], 
  { forDish }: { forDish: boolean }, 
  limit = 3
): T[] {
  if (!Array.isArray(list) || list.length === 0) return [];

  // Sort all items by the ranking criteria
  return [...list]
    .sort((a: any, b: any) => {
      // Primary sort: panel_rank (lower number = higher rank)
      const aRank = Number(a.panel_rank ?? 999);
      const bRank = Number(b.panel_rank ?? 999);
      if (aRank !== bRank) return aRank - bRank;
      
      // Secondary sort: signature/featured status
      const aFeatured = Number(a.signature ?? a.featured ?? 0);
      const bFeatured = Number(b.signature ?? b.featured ?? 0);
      if (bFeatured !== aFeatured) return bFeatured - aFeatured;
      
      // Tertiary sort: popularity/rating
      const aValue = forDish ? (a.popularity ?? 0) : (a.rating ?? 0);
      const bValue = forDish ? (b.popularity ?? 0) : (b.rating ?? 0);
      if (bValue !== aValue) return bValue - aValue;

      // Final sort: average rating as tiebreaker
      return Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0);
    })
    .slice(0, limit);
}

  // Removed old useEffect for foods/top/recommended

  useEffect(() => {
    let cancel = false;
    (async () => {
      setDelicsErr(null); setDelics(null);
      try {
        // Always use municipalityId for delicacies
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
      if (!municipality?.id || municipality.id < 0) {
        if (!cancel) setRestosErr("Invalid municipality ID");
        return;
      }
      try {
        // Always use municipalityId for restaurants
        let data: Restaurant[] = [];
        try {
          const primary = `${API}/api/restaurants?municipalityId=${municipality.id}&featured=1&limit=2`;
          data = await getJSON<Restaurant[]>(primary);
        } catch (primaryError) {
          const fallback = `${API}/api/restaurants?municipalityId=${municipality.id}`;
          data = await getJSON<Restaurant[]>(fallback);
        }
        if (!cancel) {
          const sortedData = sortAndSlice(data, { forDish: false }, 2);
          setRestos(sortedData);
        }
      } catch (e: any) { 
        console.error("Error fetching restaurants:", e);
        if (!cancel) {
          const errorMessage = e?.message || String(e);
          setRestosErr(`Unable to load restaurants. ${errorMessage}`);
        }
      }
    })();
    return () => { cancel = true; };
  }, [municipality?.id]);

  const desc = municipality.description ?? "";
  const shortDesc = useMemo(() => (desc.length > 220 ? `${desc.slice(0, 220)}…` : desc), [desc]);

  // Overlay for focus effect
  return (
    <>
      {/* Overlay */}
      <motion.div
        className="fixed inset-0 z-[998] bg-black/20 backdrop-blur-lg transition-opacity"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        aria-hidden="true"
      />
      {/* Main Panel */}
      <motion.aside
        role="dialog" aria-modal="false" aria-labelledby="municipality-title"
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={panelTransition}
        className={cn(
          "fixed inset-0 z-[999] flex items-center justify-center w-full"
        )}
        style={{ pointerEvents: 'auto' }}
      >
        <section className={cn(
          "w-full max-w-[96vw] sm:max-w-[900px] md:max-w-[1100px] lg:max-w-[1300px] xl:max-w-[1500px]",
          "min-h-[72vh] max-h-[92vh] mx-2 md:mx-4",
          "bg-white shadow-2xl border border-neutral-200 rounded-2xl flex flex-col overflow-hidden"
        )}>
        {/* Hero Section with Parallax Effect */}
          <header className="relative h-[280px] sm:h-[320px] md:h-[380px] lg:h-[420px] overflow-hidden">
            <motion.div 
              className="absolute inset-0 scale-110"
              initial={{ y: 0 }}
              whileInView={{ y: -20 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <img
                src={heroSrc}
                alt={municipality.name}
                onError={(e) => { e.currentTarget.src = assetUrl("images/placeholders/municipality.jpg"); }}
                className="w-full h-full object-cover"
                style={{ filter: 'brightness(0.9)' }}
              />
            </motion.div>
            
            {/* Enhanced gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            
            {/* Top bar with actions */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/40 to-transparent">
              {/* Municipality badge with animation */}
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 bg-white/90 rounded-full px-4 py-2 shadow-lg backdrop-blur-md"
              >
                <Landmark size={20} className="text-primary-700" />
                <span className="font-semibold text-primary-800 text-sm">Municipality</span>
              </motion.div>
              
              {/* Action buttons */}
              <div className="flex items-center gap-3">
                {safeOrigin && (
                  <motion.a
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    href={`${safeOrigin}/map?municipality=${municipality.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/90 hover:bg-white text-primary-700 shadow-lg backdrop-blur-md transition-all hover:scale-105"
                  >
                    <MapPin size={18} /> Share Location
                  </motion.a>
                )}
                <motion.button
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  onClick={onClose}
                  className="p-2 rounded-full bg-white/90 hover:bg-white text-neutral-800 shadow-lg backdrop-blur-md transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="Close panel"
                  title="Close"
                >
                  <XIcon size={20} />
                </motion.button>
              </div>
            </div>

            {/* Enhanced Banner content with animations */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="absolute bottom-0 left-0 right-0 p-8"
            >
              <div className="text-white/90 text-sm uppercase tracking-[0.18em] mb-2 font-medium">
                Culinary Heritage
              </div>
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                id="municipality-title" 
                className="text-white text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight drop-shadow-lg mb-3"
              >
                {municipality.name}
              </motion.h2>
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex flex-wrap items-center gap-3"
              >
                {hasCoords && (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/15 backdrop-blur-sm text-white text-sm">
                      <MapPin size={16} className="text-primary-300" />
                      <span>{latNum.toFixed(4)}, {lngNum.toFixed(4)}</span>
                    </span>
                    <a
                      href={gmapsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm transition-all hover:scale-105 shadow-lg"
                    >
                      Get Directions <ExternalLink size={16} />
                    </a>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </header>
          {/* Enhanced Tab Navigation */}
          <nav 
            className="flex border-b border-neutral-200 bg-gradient-to-b from-neutral-50 to-white px-6 pt-4 gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-primary-200 scrollbar-track-transparent" 
            aria-label="Municipality details tabs"
          >
            {[
              { id: 'dishes', icon: Utensils, label: 'Dishes' },
              { id: 'delicacies', icon: Star, label: 'Delicacies' },
              { id: 'restaurants', icon: Utensils, label: 'Restaurants' },
              { id: 'info', icon: Info, label: 'Info' }
            ].map((tab) => (
              <motion.button
                key={tab.id}
                className={cn(
                  "relative py-3 px-6 rounded-xl font-semibold text-base flex items-center gap-3 transition-all",
                  activeTab === tab.id 
                    ? "bg-primary-50 text-primary-700 shadow-sm" 
                    : "text-neutral-500 hover:text-primary-600 hover:bg-neutral-50",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                )}
                onClick={() => handleTabChange(tab.id as any)}
                aria-selected={activeTab === tab.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <tab.icon size={18} className={cn(
                  "transition-colors",
                  activeTab === tab.id ? "text-primary-600" : "text-neutral-400"
                )} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="active-tab"
                    className="absolute inset-0 bg-primary-100 rounded-xl -z-10"
                    initial={false}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </motion.button>
            ))}
          </nav>
          {/* Main Content Body */}
          <main className="px-6 pt-6 pb-6 flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
            <AnimatePresence mode="wait">
              {activeTab === 'dishes' && (
                <motion.div
                  key="dishes"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-primary-700 mb-2">Dishes in {municipality.name}</h2>
                      <p className="text-[15px] leading-relaxed text-neutral-800/95 max-w-prose mb-1">{shortDesc || "—"}</p>
                    </div>
                    <button
                      onClick={goToAll}
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 transition shadow-sm text-base font-semibold"
                    >
                      <Utensils size={18} /> Explore all dishes
                      <ChevronRight size={18} className="opacity-90" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Recommended Dish column */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 text-primary-700">Recommended Dish</h3>
                      {dishSummaryErr ? (
                        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                          <div className="text-sm text-red-600">{dishSummaryErr}</div>
                        </div>
                      ) : recommendedDish ? (
                        <DishGrid 
                          dishes={[recommendedDish]} 
                          error={null} 
                          placeholder="images/placeholders/dish.jpg" 
                          onHighlightPlace={onHighlightPlace} 
                        />
                      ) : (
                        <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
                          <div className="text-sm text-neutral-600">No recommended dish available yet.</div>
                        </div>
                      )}
                    </div>
                    {/* Top Rated Dish column */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 text-primary-700">Top Rated Dish</h3>
                      {dishSummaryErr ? (
                        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                          <div className="text-sm text-red-600">{dishSummaryErr}</div>
                        </div>
                      ) : topRatedDish ? (
                        <DishGrid 
                          dishes={[topRatedDish]} 
                          error={null} 
                          placeholder="images/placeholders/dish.jpg" 
                          onHighlightPlace={onHighlightPlace} 
                        />
                      ) : (
                        <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
                          <div className="text-sm text-neutral-600">No top rated dish available yet.</div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
              {activeTab === 'delicacies' && (
                <motion.div
                  key="delicacies"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Top Delicacies</h3>
                  <DishGrid dishes={delics} error={delicsErr} placeholder="images/placeholders/delicacy.jpg" onHighlightPlace={onHighlightPlace} />
                </motion.div>
              )}
              {activeTab === 'restaurants' && (
                <motion.div
                  key="restaurants"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-primary-700">Featured Restaurants</h3>
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('map:showRestaurants', {
                        detail: { municipalityId: municipality.id }
                      }))}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 transition-colors rounded-lg shadow-sm"
                    >
                      <MapPin size={18} />
                      Show All on Map
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {restos === null && !restosErr && (<><div className="skeleton rounded-xl h-44" /><div className="skeleton rounded-xl h-44" /><div className="skeleton rounded-xl h-44" /></>)}
                    {restosErr && <div className="text-sm text-red-600">Failed to load restaurants. {restosErr}</div>}
                    {restos && restos.length === 0 && <div className="text-sm text-neutral-600">No restaurants yet.</div>}
                    {restos?.map((r) => (
                      <div
                        key={r.id}
                        onMouseEnter={() => onHighlightPlace?.({ type: 'restaurant', id: r.id })}
                        onMouseLeave={() => onHighlightPlace?.(null)}
                      >
                        <Link to={`/restaurant/${encodeURIComponent(String(r.slug ?? r.id))}`} className="group block" title={r.name}>
                          <div className="relative h-44 rounded-2xl overflow-hidden shadow-lg bg-white border border-neutral-200 transition-transform group-hover:-translate-y-1 group-hover:shadow-xl">
                            <img
                              src={assetUrl("images/placeholders/restaurant-thumb.jpg")}
                              alt={r.name}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:opacity-95 transition" />
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <div className="text-white font-bold text-base truncate drop-shadow-sm mb-1">{r.name}</div>
                              {r.address && <div className="text-white/85 text-xs line-clamp-1 mb-1">{r.address}</div>}
                              <div className="text-white/80 text-xs flex items-center gap-2">
                                {r.price_range && <span>{r.price_range}</span>}
                                <span className="flex items-center gap-1"><Star size={14} className="inline-block text-yellow-300" /> {Number(r.rating ?? 0).toFixed(1)}</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
              {activeTab === 'info' && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">About {municipality.name}</h3>
                  <p className="text-[15px] leading-relaxed text-neutral-800/95 mb-5 max-w-prose">{desc || "—"}</p>
                  {/* Add more info, history, events, or fun facts here */}
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </section>
      </motion.aside>
    </>
  );
}
