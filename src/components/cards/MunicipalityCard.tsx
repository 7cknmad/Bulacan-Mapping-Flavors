// src/components/cards/MunicipalityCard.tsx
import React, { useMemo, useState, useEffect } from "react";
import { X as XIcon, MapPin, Utensils, ExternalLink, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

type Dish = {
  id: number | string;
  slug?: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  category?: "food" | "delicacy" | "drink";
};
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

function cn(...xs: Array<string | false | undefined>) { return xs.filter(Boolean).join(" "); }
async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url); const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  try { return JSON.parse(txt) as T; } catch { throw new Error(`Bad JSON: ${txt.slice(0, 200)}`); }
}

const panelTransition = { type: "spring", stiffness: 260, damping: 26 };
const listVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } };

const MunicipalityCard: React.FC<MunicipalityCardProps> = ({ municipality, onClose }) => {
  const [foods, setFoods] = useState<Dish[] | null>(null);
  const [foodsErr, setFoodsErr] = useState<string | null>(null);
  const [delics, setDelics] = useState<Dish[] | null>(null);
  const [delicsErr, setDelicsErr] = useState<string | null>(null);
  const [restos, setRestos] = useState<Restaurant[] | null>(null);
  const [restosErr, setRestosErr] = useState<string | null>(null);

  const [latRaw, lngRaw] = municipality.coordinates as any;
  const latNum = Number(latRaw), lngNum = Number(lngRaw);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum);
  const gmapsHref = hasCoords ? `https://www.google.com/maps?q=${latNum},${lngNum}` : undefined;

  const navigate = useNavigate();
  const goToAll: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement> = (e) => {
    e.preventDefault(); e.stopPropagation();
    const url = `/dishes?municipalityId=${municipality.id}`;
    onClose?.(); setTimeout(() => navigate(url), 220);
  };

  // Fetch top “food”
  useEffect(() => {
    let cancel = false;
    (async () => {
      setFoodsErr(null); setFoods(null);
      try {
        const data = await getJSON<Dish[]>(
          `${API}/api/dishes?municipalityId=${municipality.id}&category=food&limit=3`
        );
        if (!cancel) setFoods(data);
      } catch (e:any) { if (!cancel) setFoodsErr(String(e?.message || e)); }
    })();
    return () => { cancel = true; };
  }, [municipality.id]);

  // Fetch top “delicacy”
  useEffect(() => {
    let cancel = false;
    (async () => {
      setDelicsErr(null); setDelics(null);
      try {
        const data = await getJSON<Dish[]>(
          `${API}/api/dishes?municipalityId=${municipality.id}&category=delicacy&limit=3`
        );
        if (!cancel) setDelics(data);
      } catch (e:any) { if (!cancel) setDelicsErr(String(e?.message || e)); }
    })();
    return () => { cancel = true; };
  }, [municipality.id]);

  // Featured restos (you can keep this or remove if not needed)
  useEffect(() => {
    let cancel = false;
    (async () => {
      setRestosErr(null); setRestos(null);
      try {
        const data = await getJSON<Restaurant[]>(
          `${API}/api/restaurants?municipalityId=${municipality.id}&limit=2`
        );
        if (!cancel) setRestos(data.slice(0, 2));
      } catch (e:any) { if (!cancel) setRestosErr(String(e?.message || e)); }
    })();
    return () => { cancel = true; };
  }, [municipality.id]);

  const desc = municipality.description ?? "";
  const shortDesc = useMemo(() => (desc.length > 220 ? `${desc.slice(0, 220)}…` : desc), [desc]);
  const heroSrc = municipality.image_url || `/images/municipalities/${municipality.slug}.jpg`;

  return (
    <motion.aside
      role="dialog" aria-modal="false" aria-labelledby="municipality-title"
      initial={{ x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 32, opacity: 0 }}
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

      {/* BODY — scrollable */}
      <div className="px-5 pt-4 pb-5 flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
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

        {/* Top Dishes */}
        <h3 className="text-sm font-semibold mb-2 text-neutral-800">Top Dishes</h3>
        <motion.div variants={listVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {foods === null && !foodsErr && (<><div className="skeleton rounded h-36" /><div className="skeleton rounded h-36" /><div className="skeleton rounded h-36" /></>)}
          {foodsErr && <div className="text-sm text-red-600">Failed to load dishes. {foodsErr}</div>}
          {foods && foods.length === 0 && <div className="text-sm text-neutral-600">None yet.</div>}
          {foods?.map((dish) => (
            <motion.div key={dish.id} variants={itemVariants}>
              <Link to={`/dish/${encodeURIComponent(String(dish.slug ?? dish.id))}`} className="relative h-36 rounded-xl overflow-hidden group block" title={dish.name}>
                <img src={dish.image_url || "https://via.placeholder.com/800x500"} alt={dish.name}
                     className="absolute inset-0 w-full h-full object-cover"
                     onError={(e) => ((e.currentTarget.src = "https://via.placeholder.com/800x500"))}/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:opacity-95" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="text-white font-semibold text-sm md:text-base truncate drop-shadow-sm">{dish.name}</div>
                  {dish.description && <div className="text-white/85 text-xs line-clamp-1">{dish.description}</div>}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Top Delicacies */}
        <h3 className="text-sm font-semibold mb-2 text-neutral-800">Top Delicacies</h3>
        <motion.div variants={listVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {delics === null && !delicsErr && (<><div className="skeleton rounded h-36" /><div className="skeleton rounded h-36" /><div className="skeleton rounded h-36" /></>)}
          {delicsErr && <div className="text-sm text-red-600">Failed to load delicacies. {delicsErr}</div>}
          {delics && delics.length === 0 && <div className="text-sm text-neutral-600">None yet.</div>}
          {delics?.map((dish) => (
            <motion.div key={dish.id} variants={itemVariants}>
              <Link to={`/dish/${encodeURIComponent(String(dish.slug ?? dish.id))}`} className="relative h-36 rounded-xl overflow-hidden group block" title={dish.name}>
                <img src={dish.image_url || "https://via.placeholder.com/800x500"} alt={dish.name}
                     className="absolute inset-0 w-full h-full object-cover"
                     onError={(e) => ((e.currentTarget.src = "https://via.placeholder.com/800x500"))}/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:opacity-95" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="text-white font-semibold text-sm md:text-base truncate drop-shadow-sm">{dish.name}</div>
                  {dish.description && <div className="text-white/85 text-xs line-clamp-1">{dish.description}</div>}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Featured Restaurants (keep compact) */}
        <h3 className="text-sm font-semibold mb-2 text-neutral-800 hidden sm:block">Featured Restaurants</h3>
        <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 gap-3">
          {restos === null && !restosErr && (<><div className="skeleton rounded h-20" /><div className="skeleton rounded h-20" /></>)}
          {restosErr && <div className="text-sm text-red-600">Failed to load restaurants. {restosErr}</div>}
          {restos && restos.length === 0 && <div className="text-sm text-neutral-600">No restaurants yet.</div>}
          {restos?.map((r) => (
            <Link key={r.id} to={`/restaurant/${encodeURIComponent(String(r.slug ?? r.id))}`}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition">
              <div className="w-12 h-12 rounded-md overflow-hidden bg-neutral-100 flex-shrink-0">
                <img src="https://via.placeholder.com/120" alt={r.name} className="w-full h-full object-cover"
                     onError={(e) => ((e.currentTarget.src = "https://via.placeholder.com/120"))}/>
              </div>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{r.name}</div>
                <div className="text-xs text-neutral-500 truncate">{r.address ?? ""}</div>
                <div className="text-[11px] text-neutral-500 mt-1">{(r.price_range ?? "").toString()} • ⭐ {Number(r.rating ?? 0).toFixed(1)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </motion.aside>
  );
};

export default MunicipalityCard;
