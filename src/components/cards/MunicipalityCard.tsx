// src/components/cards/MunicipalityCard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X as XIcon, MapPin, Utensils, ExternalLink, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

type Dish = { id: number | string; slug?: string; name: string; description?: string | null; image_url?: string | null; };
type Restaurant = { id: number | string; slug?: string; name: string; address?: string | null; price_range?: string | null; rating?: number | null; };

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
}

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const safeOrigin = typeof window !== "undefined" ? window.location.origin : "";

function cn(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url).catch((e) => { throw new Error(`Fetch failed: ${String(e)}`); });
  const txt = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  try { return JSON.parse(txt) as T; } catch { throw new Error(`Bad JSON: ${txt.slice(0, 200)}`); }
}

const panelTransition = { type: "spring", stiffness: 260, damping: 26 };
const listVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22 } }
};

const MunicipalityCard: React.FC<MunicipalityCardProps> = ({ municipality, onClose }) => {
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [dishesError, setDishesError] = useState<string | null>(null);
  const [restos, setRestos] = useState<Restaurant[] | null>(null);
  const [restosError, setRestosError] = useState<string | null>(null);

  // coords (coerce to numbers)
  const [latRaw, lngRaw] = municipality.coordinates as any;
  const latNum = Number(latRaw);
  const lngNum = Number(lngRaw);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum);
  const gmapsHref = hasCoords ? `https://www.google.com/maps?q=${latNum},${lngNum}` : undefined;

  // nav
  const navigate = useNavigate();
  const goToAll: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement> = (e) => {
    e.preventDefault(); e.stopPropagation();
    const url = `/dishes?municipalityId=${municipality.id}`;
    onClose?.(); // unmount panel (AnimatePresence will animate exit)
    setTimeout(() => navigate(url), 220);
  };

  // Data fetch
  useEffect(() => {
    let cancel = false;
    (async () => {
      setDishesError(null); setDishes(null);
      try {
        const urlA = `${API}/api/municipalities/${municipality.id}/dishes`;
        let ok = true; let data: Dish[] | null = null;
        try { data = await getJSON<Dish[]>(urlA); } catch { ok = false; }
        if (!ok || !data) data = await getJSON<Dish[]>(`${API}/api/dishes?municipalityId=${municipality.id}`);
        if (!cancel) setDishes((data || []).slice(0, 3));
      } catch (e: any) { if (!cancel) setDishesError(String(e?.message || e)); }
    })();
    return () => { cancel = true; };
  }, [municipality.id]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setRestosError(null); setRestos(null);
      try {
        const data = await getJSON<Restaurant[]>(`${API}/api/restaurants?municipalityId=${municipality.id}`);
        if (!cancel) setRestos((data || []).slice(0, 2)); // keep to 2 to avoid scroll
      } catch (e: any) { if (!cancel) setRestosError(String(e?.message || e)); }
    })();
    return () => { cancel = true; };
  }, [municipality.id]);

  // text
  const desc = municipality.description ?? "";
  const shortDesc = useMemo(() => (desc.length > 220 ? `${desc.slice(0, 220)}…` : desc), [desc]);

  // image helper
  const heroSrc = municipality.image_url || `/images/municipalities/${municipality.slug}.jpg`;

  return (
    <motion.aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="municipality-title"
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={panelTransition}
      className={cn(
        "fixed right-4 top-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] sm:w-[520px] md:w-[640px] lg:w-[760px] xl:w-[820px]",
        "bg-white z-[999] shadow-2xl border border-neutral-200 rounded-2xl",
        "flex flex-col overflow-hidden"
      )}
    >
      {/* HERO */}
      <div className="relative">
        <img
          src={heroSrc}
          alt={municipality.name}
          className="w-full h-56 md:h-64 lg:h-72 object-cover"
          onError={(e) => ((e.currentTarget.src = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop"))}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white text-neutral-800 shadow focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Close panel"
          title="Close"
        >
          <XIcon size={18} />
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="text-white/85 text-xs uppercase tracking-[0.18em] mb-1">Culinary Highlights</div>
          <h2 id="municipality-title" className="text-white text-[28px] md:text-3xl font-semibold leading-tight drop-shadow-sm">
            {municipality.name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/90">
            {hasCoords && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15">
                <MapPin size={14} /> {latNum.toFixed(4)}, {lngNum.toFixed(4)}
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
                Directions <ExternalLink size={14} />
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
      </div>

      {/* BODY — no scroll, compact */}
      <div className="px-5 pt-4 pb-5 flex-1 overflow-hidden">
        <p className="text-[15px] leading-relaxed text-neutral-800/95 mb-5 max-w-prose">
          {shortDesc || "—"}
        </p>

        {/* Explore all */}
        <div className="mb-4">
          <button
            onClick={goToAll}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-primary-600 text-white hover:bg-primary-700 transition shadow-sm"
          >
            <Utensils size={18} /> Explore all dishes
            <ChevronRight size={18} className="opacity-90" />
          </button>
        </div>

        {/* Top 3 Dishes — stagger in; shimmer while loading */}
        <h3 className="text-sm font-semibold mb-2 text-neutral-800">Top Signature Dishes</h3>
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4"
        >
          {dishes === null && !dishesError && (
            <>
              <div className="skeleton rounded h-36 md:h-40" />
              <div className="skeleton rounded h-36 md:h-40" />
              <div className="skeleton rounded h-36 md:h-40" />
            </>
          )}
          {dishesError && <div className="text-sm text-red-600">Failed to load dishes. {dishesError}</div>}
          {dishes && dishes.length === 0 && <div className="text-sm text-neutral-600">No dishes linked yet.</div>}

          {dishes?.map((dish) => (
            <motion.div key={dish.id} variants={itemVariants}>
              <Link
                to={`/dish/${encodeURIComponent(String(dish.slug ?? dish.id))}`}
                className="relative h-36 md:h-40 rounded-xl overflow-hidden group block"
                title={dish.name}
              >
                <img
                  src={dish.image_url || "https://via.placeholder.com/800x500"}
                  alt={dish.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => ((e.currentTarget.src = "https://via.placeholder.com/800x500"))}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity group-hover:opacity-95" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="text-white font-semibold text-sm md:text-base truncate drop-shadow-sm">
                    {dish.name}
                  </div>
                  {dish.description && (
                    <div className="text-white/85 text-xs line-clamp-1">{dish.description}</div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Featured Restaurants — compact (hidden on xs) */}
        <h3 className="text-sm font-semibold mb-2 text-neutral-800 hidden sm:block">Featured Restaurants</h3>
        <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 gap-3">
          {restos === null && !restosError && (
            <>
              <div className="skeleton rounded h-20" />
              <div className="skeleton rounded h-20" />
            </>
          )}
          {restosError && <div className="text-sm text-red-600">Failed to load restaurants. {restosError}</div>}
          {restos && restos.length === 0 && <div className="text-sm text-neutral-600">No restaurants yet.</div>}

          {restos?.map((r) => (
            <Link
              key={r.id}
              to={`/restaurant/${encodeURIComponent(String(r.slug ?? r.id))}`}
              className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition"
            >
              <div className="w-12 h-12 rounded-md overflow-hidden bg-neutral-100 flex-shrink-0">
                <img
                  src="https://via.placeholder.com/120"
                  alt={r.name}
                  className="w-full h-full object-cover"
                  onError={(e) => ((e.currentTarget.src = "https://via.placeholder.com/120"))}
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
          ))}
        </div>
      </div>
    </motion.aside>
  );
};

export default MunicipalityCard;
