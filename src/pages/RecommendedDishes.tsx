import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTopDishes, fetchRestaurants, type Dish, type Restaurant, type Variant } from '../utils/api';
import VariantPreviewModal from '../components/VariantPreviewModal';

export default function RecommendedDishes() {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const muniId = qs.get('municipalityId');
  const muniNum = muniId ? Number(muniId) : 0;

  const { data: dishes, isLoading, error } = useQuery<Dish[]>({ queryKey: ['recommended-dishes', muniNum], queryFn: () => fetchTopDishes(muniNum) });

  const [expanded, setExpanded] = useState<Record<number, Restaurant[] | null>>({});
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedRestaurantSlug, setSelectedRestaurantSlug] = useState<string | undefined>(undefined);
  const [showVariantModal, setShowVariantModal] = useState(false);

  const loadPlaces = async (dishId: number) => {
    if (expanded[dishId]) {
      setExpanded((s) => ({ ...s, [dishId]: null }));
      return;
    }
    try {
      const res = await fetchRestaurants({ dishId });
      setExpanded((s) => ({ ...s, [dishId]: res?.rows ?? [] }));
    } catch (e) {
      console.error('Failed to load places for dish', e);
      setExpanded((s) => ({ ...s, [dishId]: [] }));
    }
  };

  if (isLoading) return <div className="p-6">Loading recommended dishes…</div>;
  if (error) return <div className="p-6 text-red-600">Failed to load recommended dishes.</div>;

  return (
    <div className="pt-20 pb-16 bg-neutral-50 min-h-screen">
      <div className="container mx-auto px-4">
        <h1 className="mb-6 text-2xl font-semibold">Recommended dishes{muniId ? ` — ${muniId}` : ''}</h1>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dishes?.map((d: Dish) => (
            <div key={d.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-start gap-4">
                <img src={d.image_url || 'https://via.placeholder.com/160'} alt={d.name} className="w-24 h-24 object-cover rounded-md bg-neutral-100" onError={(e)=>((e.currentTarget.src='https://via.placeholder.com/160'))} />
                <div className="flex-1">
                  <h3 className="font-medium text-lg">{d.name}</h3>
                  <div className="text-sm text-neutral-600">⭐ {Number((d as any).avg_rating ?? d.rating ?? 0).toFixed(1)}</div>
                  <p className="mt-2 text-sm text-neutral-700 line-clamp-2">{d.description}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <button className="px-3 py-1 bg-primary-600 text-white rounded" onClick={() => loadPlaces(d.id)}>Show where to try</button>
                    <Link to={`/dish/${d.id}`} className="text-sm text-primary-600 hover:underline">View dish →</Link>
                  </div>
                </div>
              </div>

              {expanded[d.id] !== undefined ? (
                <div className="mt-4">
                  {expanded[d.id] === null ? (
                    <div className="text-neutral-500 text-sm">Tap again to hide places</div>
                  ) : expanded[d.id]!.length === 0 ? (
                    <div className="text-neutral-500 text-sm">No places found.</div>
                  ) : (
                    <div className="space-y-3 mt-3">
                      {expanded[d.id]!.map((r) => (
                        <div key={r.id} className="p-3 border rounded bg-neutral-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{r.name}</div>
                              <div className="text-xs text-neutral-600">{r.address}</div>
                            </div>
                            <div className="text-sm text-neutral-700">⭐ {Number(r.rating ?? 0).toFixed(1)}</div>
                          </div>
                          {/* show variants if present */}
                          {Array.isArray((r as any).variants) && (r as any).variants.length > 0 ? (
                            <div className="mt-2 grid gap-2">
                              {(r as any).variants.map((v: Variant) => (
                                <button key={v.id} onClick={() => { setSelectedVariant(v); setSelectedRestaurantSlug(r.slug || String(r.id)); setShowVariantModal(true); }} className="w-full text-left flex items-center gap-3 p-2 border rounded bg-white hover:shadow-sm">
                                  {v.image_url ? (
                                    <img src={v.image_url} alt={v.name} className="w-12 h-12 object-cover rounded-md" onError={(e)=>((e.currentTarget.src='https://via.placeholder.com/48'))} />
                                  ) : (
                                    <div className="w-12 h-12 rounded-md bg-neutral-100 flex items-center justify-center text-xs text-neutral-500">No image</div>
                                  )}
                                  <div className="flex-1 text-sm">
                                    <div className="font-medium">{v.name}</div>
                                    <div className="text-xs text-neutral-500">{v.description}</div>
                                  </div>
                                  <div className="text-sm text-neutral-700">{v.price ? `₱${Number(v.price).toFixed(2)}` : ''}</div>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <VariantPreviewModal open={showVariantModal} onClose={() => setShowVariantModal(false)} variant={selectedVariant} restaurantSlug={selectedRestaurantSlug} />
      </div>
    </div>
  );
}
