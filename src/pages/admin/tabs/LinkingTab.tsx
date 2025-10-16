// src/pages/admin/tabs/LinkingTab.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import MunicipalitySelect from "../../../components/admin/MunicipalitySelect";
import {
  listDishes,
  listRestaurants,
  listRestaurantsForDish,
  linkDishRestaurant,
  unlinkDishRestaurant,
  type Dish,
  type Restaurant,
} from "../../../utils/adminApi";
import { Check, Link as LinkIcon, Unlink as UnlinkIcon, Search } from "lucide-react";

/** Small helper for class concat */
function cx(...a: Array<string | false | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function LinkingTab() {
  const qc = useQueryClient();

  const [muniId, setMuniId] = useState<number | null>(null);
  const [dishQuery, setDishQuery] = useState("");
  const [restQuery, setRestQuery] = useState("");
  const [selectedDishId, setSelectedDishId] = useState<number | null>(null);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<Set<number>>(new Set());

  // Reset selections when municipality changes
  useEffect(() => {
    setSelectedDishId(null);
    setSelectedRestaurantIds(new Set());
  }, [muniId]);

  // Dishes (filtered by muni + search)
  const dishesQ = useQuery({
    queryKey: ["admin:link:dishes", muniId, dishQuery],
    queryFn: () =>
      listDishes({
        municipalityId: muniId ?? undefined,
        q: dishQuery || undefined,
      }),
    enabled: muniId !== null,
    staleTime: 30_000,
  });

  // Restaurants (filtered by muni + search)
  const restaurantsQ = useQuery({
    queryKey: ["admin:link:restaurants", muniId, restQuery],
    queryFn: () =>
      listRestaurants({
        municipalityId: muniId ?? undefined,
        q: restQuery || undefined,
      }),
    enabled: muniId !== null,
    staleTime: 30_000,
  });

  // Already-linked restaurants for selected dish
  const linkedQ = useQuery({
    queryKey: ["admin:link:linked-restaurants", selectedDishId],
    queryFn: async () => {
      if (!selectedDishId) return [];
      try {
        return await listRestaurantsForDish(selectedDishId);
      } catch (err: any) {
        // If the backend route isn’t available yet, don’t hard-fail the UI.
        if (String(err?.message || "").includes("404")) return [];
        throw err;
      }
    },
    enabled: !!selectedDishId,
    staleTime: 15_000,
    retry: 1,
  });

  const dishes = (dishesQ.data ?? []) as Dish[];
  const restaurants = (restaurantsQ.data ?? []) as Restaurant[];

  const selectedDish = useMemo(
    () => (selectedDishId ? dishes.find((d) => d.id === selectedDishId) ?? null : null),
    [dishes, selectedDishId]
  );

  const linkedIds = useMemo(() => {
    const ids = new Set<number>();
    (linkedQ.data ?? []).forEach((r: Restaurant) => ids.add(r.id));
    return ids;
  }, [linkedQ.data]);

  const toggleRestaurant = (id: number) => {
    setSelectedRestaurantIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Link mutation (batchs each selection)
  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDishId) return;
      const toLink = Array.from(selectedRestaurantIds).filter((id) => !linkedIds.has(id));
      await Promise.all(toLink.map((rid) => linkDishRestaurant(selectedDishId, rid)));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin:link:linked-restaurants", selectedDishId] });
    },
  });

  // Unlink mutation (batchs only those that are already linked)
  const unlinkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDishId) return;
      const toUnlink = Array.from(selectedRestaurantIds).filter((id) => linkedIds.has(id));
      await Promise.all(toUnlink.map((rid) => unlinkDishRestaurant(selectedDishId, rid)));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin:link:linked-restaurants", selectedDishId] });
      setSelectedRestaurantIds((prev) => {
        // After unlinking, keep them selected (UX preference); change to clear if you want.
        return new Set(prev);
      });
    },
  });

  const canLink = !!selectedDishId && Array.from(selectedRestaurantIds).some((id) => !linkedIds.has(id));
  const canUnlink = !!selectedDishId && Array.from(selectedRestaurantIds).some((id) => linkedIds.has(id));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Link Dishes ↔ Restaurants</h2>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Municipality filter */}
        <div className="md:col-span-1">
          <label className="text-sm font-medium mb-2 block">Municipality</label>
          <MunicipalitySelect
            value={muniId}
            onChange={setMuniId}
            placeholder="Filter by municipality…"
            allowAll={false}
          />
          {!muniId && (
            <p className="text-xs text-neutral-500 mt-2">
              Choose a municipality to list its dishes and restaurants.
            </p>
          )}
        </div>

        {/* Dishes list */}
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
                {dishes.map((d) => {
                  const isActive = selectedDishId === d.id;
                  return (
                    <li
                      key={d.id}
                      className={cx(
                        "p-3 cursor-pointer hover:bg-neutral-50",
                        isActive && "bg-primary-50"
                      )}
                      onClick={() => setSelectedDishId(d.id)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={d.image_url || "https://via.placeholder.com/56"}
                          className="w-10 h-10 rounded object-cover border"
                          alt={d.name}
                          onError={(e) => ((e.currentTarget.src = "https://via.placeholder.com/56"))}
                        />
                        <div>
                          <div className="font-medium">{d.name}</div>
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            {d.category}
                          </div>
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
              Selected dish: <span className="font-medium">{selectedDish.name}</span>
            </div>
          )}
        </div>

        {/* Restaurants list w/ linked indicators */}
        <div className="md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Restaurants / Sellers</label>
            {selectedDishId && (
              <span className="text-xs text-neutral-500">
                Linked: {linkedIds.size}
              </span>
            )}
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
                {restaurants.map((r) => {
                  const checked = (selectedRestaurantIds as Set<number>).has(r.id);
                  const isLinked = linkedIds.has(r.id);
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
                          onError={(e) => ((e.currentTarget.src = "https://via.placeholder.com/56"))}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            {r.kind}
                          </div>
                        </div>
                        {isLinked && (
                          <span className="inline-flex items-center text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                            <Check className="h-3 w-3 mr-1" /> linked
                          </span>
                        )}
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

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          className="btn border px-4 py-2 rounded"
          onClick={() => {
            setSelectedDishId(null);
            setSelectedRestaurantIds(new Set());
          }}
        >
          Clear
        </button>

        <button
          className={cx(
            "btn px-4 py-2 rounded text-white flex items-center gap-2",
            canUnlink ? "bg-red-600 hover:bg-red-700" : "bg-neutral-300 cursor-not-allowed"
          )}
          disabled={!canUnlink || unlinkMutation.isPending}
          onClick={() => unlinkMutation.mutate()}
          title={!selectedDishId ? "Pick a dish" : "Unlink selected from dish"}
        >
          <UnlinkIcon size={16} />
          {unlinkMutation.isPending ? "Unlinking…" : "Unlink selected"}
        </button>

        <button
          className={cx(
            "btn px-4 py-2 rounded text-white flex items-center gap-2",
            canLink ? "bg-primary-600 hover:bg-primary-700" : "bg-neutral-300 cursor-not-allowed"
          )}
          disabled={!canLink || linkMutation.isPending}
          onClick={() => linkMutation.mutate()}
          title={!selectedDishId ? "Pick a dish" : "Link selected to dish"}
        >
          <LinkIcon size={16} />
          {linkMutation.isPending ? "Linking…" : "Link selected"}
        </button>
      </div>

      {(linkMutation.isError || unlinkMutation.isError) && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {(linkMutation.error as Error)?.message ??
            (unlinkMutation.error as Error)?.message ??
            "Operation failed."}
        </div>
      )}
      {(linkMutation.isSuccess || unlinkMutation.isSuccess) && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
          Done.
        </div>
      )}
    </div>
  );
}
