// src/pages/admin/tabs/LinkingTab.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import MunicipalitySelect from "../../../components/admin/MunicipalitySelect";
import { AdminAPI, type Dish, type Restaurant } from "../../../utils/AdminAPI";
import { Check, Link as LinkIcon, Search } from "lucide-react";

export default function LinkingTab() {
  const [muniId, setMuniId] = useState<number | null>(null);
  const [dishQuery, setDishQuery] = useState("");
  const [restQuery, setRestQuery] = useState("");
  const [selectedDishId, setSelectedDishId] = useState<number | null>(null);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelectedDishId(null);
    setSelectedRestaurantIds(new Set());
  }, [muniId]);

  const dishesQ = useQuery({
    queryKey: ["admin:link:dishes", muniId, dishQuery],
    queryFn: () => AdminAPI.getDishes({ municipalityId: muniId ?? undefined, q: dishQuery }),
    enabled: muniId !== null,
    staleTime: 30_000,
  });

  const restaurantsQ = useQuery({
    queryKey: ["admin:link:restaurants", muniId, restQuery],
    queryFn: () => AdminAPI.getRestaurants({ municipalityId: muniId ?? undefined, q: restQuery }),
    enabled: muniId !== null,
    staleTime: 30_000,
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDishId || selectedRestaurantIds.size === 0) return;
      await AdminAPI.linkDishRestaurants(selectedDishId, Array.from(selectedRestaurantIds));
    },
  });

  const dishes = dishesQ.data ?? [];
  const restaurants = restaurantsQ.data ?? [];
  const selectedDish = useMemo(() => dishes.find(d => d.id === selectedDishId) ?? null, [dishes, selectedDishId]);

  const toggleRestaurant = (id: number) => {
    setSelectedRestaurantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canLink = selectedDishId && selectedRestaurantIds.size > 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Link Dishes ↔ Restaurants</h2>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <label className="text-sm font-medium mb-2 block">Municipality</label>
          <MunicipalitySelect value={muniId} onChange={setMuniId} placeholder="Filter by municipality…" allowAll={false} />
          {!muniId && <p className="text-xs text-neutral-500 mt-2">Choose a municipality to list its dishes and restaurants.</p>}
        </div>

        <div className="md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Dishes / Delicacies</label>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              className="pl-8 pr-3 py-2 border rounded w-full"
              placeholder="Search dishes by name/desc…"
              value={dishQuery}
              onChange={(e) => setDishQuery(e.target.value)}
              disabled={!muniId}
            />
          </div>

          <div className="border rounded h-72 overflow-auto">
            {muniId === null ? (
              <div className="p-3 text-sm text-neutral-500">Pick a municipality…</div>
            ) : dishesQ.isLoading ? (
              <div className="p-3 text-sm text-neutral-500">Loading dishes…</div>
            ) : dishesQ.error ? (
              <div className="p-3 text-sm text-red-600">Failed to load dishes.</div>
            ) : dishes.length === 0 ? (
              <div className="p-3 text-sm text-neutral-500">No results.</div>
            ) : (
              <ul className="divide-y">
                {dishes.map((d: Dish) => {
                  const isActive = selectedDishId === d.id;
                  return (
                    <li
                      key={d.id}
                      className={`p-3 cursor-pointer hover:bg-neutral-50 ${isActive ? "bg-primary-50" : ""}`}
                      onClick={() => setSelectedDishId(d.id)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={d.image_url || "https://via.placeholder.com/56"}
                          className="w-10 h-10 rounded object-cover border"
                          alt={d.name}
                        />
                        <div>
                          <div className="font-medium">{d.name}</div>
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">{d.category}</div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectedDish && (
            <div className="mt-2 text-xs text-neutral-600">
              Selected: <span className="font-medium">{selectedDish.name}</span>
            </div>
          )}
        </div>

        <div className="md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Restaurants / Sellers</label>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              className="pl-8 pr-3 py-2 border rounded w-full"
              placeholder="Search restaurants by name…"
              value={restQuery}
              onChange={(e) => setRestQuery(e.target.value)}
              disabled={!muniId}
            />
          </div>

          <div className="border rounded h-72 overflow-auto">
            {muniId === null ? (
              <div className="p-3 text-sm text-neutral-500">Pick a municipality…</div>
            ) : restaurantsQ.isLoading ? (
              <div className="p-3 text-sm text-neutral-500">Loading restaurants…</div>
            ) : restaurantsQ.error ? (
              <div className="p-3 text-sm text-red-600">Failed to load restaurants.</div>
            ) : restaurants.length === 0 ? (
              <div className="p-3 text-sm text-neutral-500">No results.</div>
            ) : (
              <ul className="divide-y">
                {restaurants.map((r: Restaurant) => {
                  const checked = (selectedRestaurantIds as Set<number>).has(r.id);
                  return (
                    <li key={r.id} className="p-3 hover:bg-neutral-50">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={() => toggleRestaurant(r.id)}
                        />
                        <img
                          src={r.image_url || "https://via.placeholder.com/56"}
                          className="w-10 h-10 rounded object-cover border"
                          alt={r.name}
                        />
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">{r.kind}</div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-2 text-xs text-neutral-600">
            Selected restaurants: {selectedRestaurantIds.size}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          className="btn border px-4 py-2 rounded"
          onClick={() => { setSelectedDishId(null); setSelectedRestaurantIds(new Set()); }}
        >
          Clear
        </button>
        <button
          className={`btn px-4 py-2 rounded text-white flex items-center gap-2 ${canLink ? "bg-primary-600 hover:bg-primary-700" : "bg-neutral-300 cursor-not-allowed"}`}
          disabled={!canLink || linkMutation.isPending}
          onClick={() => linkMutation.mutate()}
          title={!selectedDishId ? "Pick a dish" : selectedRestaurantIds.size === 0 ? "Pick at least one restaurant" : "Link"}
        >
          <LinkIcon size={16} />
          {linkMutation.isPending ? "Linking…" : "Link selected"}
        </button>
      </div>

      {linkMutation.isError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {(linkMutation.error as Error)?.message ?? "Failed to link."}
        </div>
      )}
      {linkMutation.isSuccess && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
          Linked successfully.
        </div>
      )}
    </div>
  );
}
