// src/pages/admin/AdminDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminAuth,
  listMunicipalities,
  type Municipality,
  // dishes
  listDishes,
  createDish,
  updateDish,
  deleteDish,
  setDishCuration,
  type Dish,
  // restaurants
  listRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  setRestaurantCuration,
  // linking
  listRestaurantsForDish,
  linkDishRestaurant,
  unlinkDishRestaurant,
} from "../../utils/adminApi";

import MunicipalitySelect from "../../components/admin/MunicipalitySelect";
import { Check, Link as LinkIcon, LogOut, PlusCircle, Save, Search, Trash2 } from "lucide-react";

/* ------------------------------- helpers ------------------------------- */

function useStickyMuniId() {
  const key = "admin:lastMuniId";
  const [muniId, setMuniId] = useState<number | null>(() => {
    const raw = localStorage.getItem(key);
    return raw ? Number(raw) : null;
  });
  useEffect(() => {
    if (muniId == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(muniId));
  }, [muniId]);
  return { muniId, setMuniId };
}

const toArray = (val: unknown): string[] => {
  if (Array.isArray(val)) return val as string[];
  if (val == null) return [];
  if (typeof val === "string") {
    // try JSON first
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {}
    // then comma-split fallback
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

/* --------------------------------- main -------------------------------- */

type TabKey = "analytics" | "dishes" | "restaurants" | "curation" | "linking";

export default function AdminDashboard() {
  const [active, setActive] = useState<TabKey>("analytics");
  const meQ = useQuery({ queryKey: ["admin:me"], queryFn: adminAuth.me, staleTime: 60_000 });

  const tryLogout = async () => {
    // Your adminApi may not expose logout; this keeps it safe.
    try {
      await (adminAuth as any).logout?.();
    } catch {}
    location.hash = "#/admin/login";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-neutral-600">
            {meQ.data?.user?.email ? `Signed in as ${meQ.data.user.email}` : ""}
          </div>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded border hover:bg-neutral-50"
            onClick={tryLogout}
            title="Log out"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-4 sticky top-0 bg-white z-10">
        <nav className="-mb-px flex gap-6">
          {(["analytics", "dishes", "restaurants", "curation", "linking"] as TabKey[]).map((k) => (
            <button
              key={k}
              className={`pb-2 border-b-2 ${
                active === k
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-neutral-600 hover:text-neutral-800"
              }`}
              onClick={() => setActive(k)}
            >
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {active === "analytics" && <AnalyticsPanel />}
      {active === "dishes" && <DishesPanel />}
      {active === "restaurants" && <RestaurantsPanel />}
      {active === "curation" && <CurationPanel />}
      {active === "linking" && <LinkingPanel />}
    </div>
  );
}

/* =============================== Analytics ============================== */

function AnalyticsPanel() {
  const { muniId, setMuniId } = useStickyMuniId();

  const dishesQ = useQuery({
    queryKey: ["analytics:dishes", muniId],
    queryFn: () => listDishes({ municipalityId: muniId ?? undefined }),
  });
  const restosQ = useQuery({
    queryKey: ["analytics:restos", muniId],
    queryFn: () => listRestaurants({ municipalityId: muniId ?? undefined }),
  });

  const catCounts = useMemo(() => {
    const d = dishesQ.data ?? [];
    return {
      food: d.filter((x) => x.category === "food").length,
      delicacy: d.filter((x) => x.category === "delicacy").length,
      drink: d.filter((x) => x.category === "drink").length,
    };
  }, [dishesQ.data]);

  const topRestos = useMemo(() => {
    const r = restosQ.data ?? [];
    return [...r].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 10);
  }, [restosQ.data]);

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Municipality</label>
        <MunicipalitySelect value={muniId} onChange={setMuniId} placeholder="All municipalities" />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="Total Dishes" value={dishesQ.data?.length ?? "—"} />
        <StatCard label="Total Restaurants" value={restosQ.data?.length ?? "—"} />
        <StatCard label="Scope" value={muniId ? `Municipality #${muniId}` : "All"} />
      </div>

      <section className="rounded border p-4">
        <div className="font-medium mb-2">Dishes by Category</div>
        <SmallBars
          data={[
            { label: "Food", value: catCounts.food },
            { label: "Delicacy", value: catCounts.delicacy },
            { label: "Drink", value: catCounts.drink },
          ]}
        />
      </section>

      <section className="rounded border p-4">
        <div className="font-medium mb-2">Top Restaurants (by rating)</div>
        {topRestos.length === 0 ? (
          <div className="text-sm text-neutral-500">No data.</div>
        ) : (
          <RatingBubbles rows={topRestos} />
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
function SmallBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <div className="w-24 text-sm">{d.label}</div>
          <div className="flex-1 h-3 bg-neutral-100 rounded">
            <div
              className="h-3 rounded bg-primary-600"
              style={{ width: `${(d.value / max) * 100}%` }}
              title={`${d.value}`}
            />
          </div>
          <div className="w-10 text-right text-sm">{d.value}</div>
        </div>
      ))}
    </div>
  );
}
function RatingBubbles({ rows }: { rows: { id: number; name: string; rating: number | null }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.rating ?? 0));
  const W = 600,
    H = 120,
    pad = 16;
  return (
    <div className="overflow-auto">
      <svg width={W} height={H} className="min-w-[600px]">
        {rows.map((r, idx) => {
          const x = pad + (idx * (W - pad * 2)) / Math.max(1, rows.length - 1);
          const val = r.rating ?? 0;
          const radius = 8 + (val / max) * 22;
          return (
            <g key={r.id} transform={`translate(${x},${H / 2})`}>
              <circle r={radius} className="fill-primary-500 opacity-80" />
              <text textAnchor="middle" y={radius + 14} className="text-[10px] fill-neutral-700">
                {r.name}
              </text>
              <text textAnchor="middle" y={4} className="text-[10px] fill-white font-semibold">
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================ Dishes (CRUD) ============================ */

function DishesPanel() {
  const qc = useQueryClient();
  const { muniId, setMuniId } = useStickyMuniId();
  const [q, setQ] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);
  const [editing, setEditing] = useState<Partial<Dish> | null>(null);

  const listQ = useQuery({
    queryKey: ["admin:dishes", muniId, q],
    queryFn: () => listDishes({ municipalityId: muniId ?? undefined, q }),
    staleTime: 15_000,
  });

  const createM = useMutation({
    mutationFn: (payload: any) => createDish(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin:dishes"] });
      setEditing(null);
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateDish(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin:dishes"] });
      setEditing(null);
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteDish(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin:dishes"] });
      if (editing?.id === id) setEditing(null);
    },
  });

  const startCreate = () => {
    setEditing({
      id: 0,
      municipality_id: muniId ?? 0,
      name: "",
      slug: "",
      description: "",
      image_url: "",
      category: "food",
      flavor_profile: [],
      ingredients: [],
      popularity: 0,
      rating: 0,
    });
  };
  const startEdit = (row: Dish) =>
    setEditing({
      ...row,
      flavor_profile: toArray(row.flavor_profile),
      ingredients: toArray(row.ingredients),
    });

  useEffect(() => {
    if (autoSlug && editing?.name) {
      setEditing((prev) => (prev ? { ...prev, slug: slugify(prev.name || "") } : prev));
    }
  }, [editing?.name, autoSlug]);

  const save = async () => {
    if (!editing) return;
    if (!editing.municipality_id || !editing.name || !editing.slug) {
      alert("Municipality, Name and Slug are required.");
      return;
    }
    const payload = {
      ...editing,
      flavor_profile: toArray(editing.flavor_profile),
      ingredients: toArray(editing.ingredients),
    };
    if (editing.id && editing.id > 0) {
      await updateM.mutateAsync({ id: editing.id, payload });
    } else {
      await createM.mutateAsync(payload as any);
    }
  };
  const remove = async (id?: number) => {
    if (!id) return;
    if (!confirm("Delete this dish? This cannot be undone.")) return;
    try {
      await deleteM.mutateAsync(id);
    } catch (e: any) {
      alert(`Failed to delete dish: ${e?.message || e}`);
    }
  };

  return (
    <main className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                className="pl-8 pr-3 py-2 border rounded w-72"
                placeholder="Search by name/slug…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <MunicipalitySelect value={muniId} onChange={setMuniId} placeholder="Filter municipality…" />
          </div>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
            onClick={startCreate}
          >
            <PlusCircle size={16} /> New Dish
          </button>
        </div>

        <div className="border rounded overflow-hidden">
          <div className="max-h-[520px] overflow-auto">
            {listQ.isLoading ? (
              <div className="p-4 text-sm text-neutral-500">Loading…</div>
            ) : listQ.error ? (
              <div className="p-4 text-sm text-red-600">Failed to load dishes.</div>
            ) : (listQ.data ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No results.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Category</th>
                    <th className="text-left p-2">Flavor</th>
                    <th className="text-right p-2">Rating</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listQ.data!.map((d) => (
                    <tr key={d.id} className="border-t hover:bg-neutral-50">
                      <td className="p-2">
                        <button className="text-primary-700 hover:underline" onClick={() => startEdit(d)}>
                          {d.name}
                        </button>
                      </td>
                      <td className="p-2">{d.category}</td>
                      <td className="p-2">{toArray(d.flavor_profile).join(", ") || "—"}</td>
                      <td className="p-2 text-right">{d.rating ?? "-"}</td>
                      <td className="p-2 text-right">
                        <button className="text-red-600 hover:text-red-700" onClick={() => remove(d.id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <EditDishCard
          editing={editing}
          setEditing={setEditing}
          autoSlug={autoSlug}
          setAutoSlug={setAutoSlug}
          onSave={save}
          saving={createM.isPending || updateM.isPending}
        />
      </div>
    </main>
  );
}

function EditDishCard({
  editing,
  setEditing,
  autoSlug,
  setAutoSlug,
  onSave,
  saving,
}: {
  editing: Partial<Dish> | null;
  setEditing: (v: Partial<Dish> | null) => void;
  autoSlug: boolean;
  setAutoSlug: (v: boolean) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="rounded border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">{editing?.id ? "Edit Dish" : "Create Dish"}</div>
        <div className="text-xs text-neutral-500">
          {editing?.municipality_id ? `Municipality ID: ${editing.municipality_id}` : "Select municipality"}
        </div>
      </div>

      <div className="grid gap-3">
        <label className="text-sm font-medium">
          Municipality <span className="text-red-600">*</span>
        </label>
        <MunicipalitySelect
          value={editing?.municipality_id ?? null}
          onChange={(id) => setEditing((prev) => (prev ? { ...prev, municipality_id: id ?? 0 } : prev))}
          allowAll={false}
          placeholder="Choose municipality…"
        />

        <div className="grid gap-1">
          <label className="text-sm font-medium">
            Name <span className="text-red-600">*</span>
          </label>
          <input
            className="border rounded px-3 py-2"
            value={editing?.name ?? ""}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
          />
        </div>

        <div className="grid gap-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Slug <span className="text-red-600">*</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={autoSlug} onChange={(e) => setAutoSlug(e.target.checked)} />
              Auto
            </label>
          </div>
          <input
            className="border rounded px-3 py-2"
            value={editing?.slug ?? ""}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, slug: e.target.value } : prev))}
            disabled={autoSlug}
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Category</label>
          <select
            className="border rounded px-3 py-2"
            value={editing?.category ?? "food"}
            onChange={(e) =>
              setEditing((prev) => (prev ? { ...prev, category: e.target.value as Dish["category"] } : prev))
            }
          >
            <option value="food">Food</option>
            <option value="delicacy">Delicacy</option>
            <option value="drink">Drink</option>
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Image URL</label>
          <input
            className="border rounded px-3 py-2"
            placeholder="https://…"
            value={editing?.image_url ?? ""}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, image_url: e.target.value } : prev))}
          />
          {editing?.image_url ? (
            <img
              src={editing.image_url}
              alt="preview"
              className="h-20 w-20 rounded object-cover border"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
          ) : null}
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="border rounded px-3 py-2"
            rows={3}
            value={editing?.description ?? ""}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Flavor profile (comma-separated)</label>
          <input
            className="border rounded px-3 py-2"
            value={toArray(editing?.flavor_profile).join(", ")}
            onChange={(e) =>
              setEditing((prev) =>
                prev ? { ...prev, flavor_profile: toArray(e.target.value) } : prev
              )
            }
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Ingredients (comma-separated)</label>
          <input
            className="border rounded px-3 py-2"
            value={toArray(editing?.ingredients).join(", ")}
            onChange={(e) =>
              setEditing((prev) => (prev ? { ...prev, ingredients: toArray(e.target.value) } : prev))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Popularity</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={editing?.popularity ?? 0}
              onChange={(e) =>
                setEditing((prev) => (prev ? { ...prev, popularity: Number(e.target.value) } : prev))
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium">Rating</label>
            <input
              type="number"
              step="0.1"
              className="border rounded px-3 py-2 w-full"
              value={editing?.rating ?? 0}
              onChange={(e) =>
                setEditing((prev) => (prev ? { ...prev, rating: Number(e.target.value) } : prev))
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
            onClick={onSave}
            disabled={saving}
          >
            <Save size={16} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================= Restaurants (CRUD) ========================== */

function RestaurantsPanel() {
  const qc = useQueryClient();
  const { muniId, setMuniId } = useStickyMuniId();

  const [q, setQ] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);
  const [editing, setEditing] = useState<Partial<ReturnType<typeof normalizeRestaurant>> | null>(null);

  const listQ = useQuery({
    queryKey: ["admin:restaurants", muniId, q],
    queryFn: () => listRestaurants({ municipalityId: muniId ?? undefined, q }),
    staleTime: 15_000,
    select: (rows) => (rows ?? []).map(normalizeRestaurant),
  });

  const createM = useMutation({
    mutationFn: (payload: any) => createRestaurant(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin:restaurants"] });
      setEditing(null);
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateRestaurant(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin:restaurants"] });
      setEditing(null);
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteRestaurant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin:restaurants"] });
      if ((editing as any)?.id === id) setEditing(null);
    },
  });

  const startCreate = () => {
    setEditing({
      id: 0,
      municipality_id: muniId ?? 0,
      name: "",
      slug: "",
      kind: "restaurant",
      description: "",
      image_url: "",
      address: "",
      price_range: "moderate",
      cuisine_types: [],
      rating: 0,
      lat: 0,
      lng: 0,
    });
  };
  const startEdit = (row: any) => setEditing(normalizeRestaurant(row));

  useEffect(() => {
    if (autoSlug && editing?.name) {
      setEditing((prev: any) => (prev ? { ...prev, slug: slugify(prev.name || "") } : prev));
    }
  }, [editing?.name, autoSlug]);

  const save = async () => {
    if (!editing) return;
    if (!editing.municipality_id || !editing.name || !editing.slug || !editing.address) {
      alert("Municipality, Name, Slug and Address are required.");
      return;
    }
    const payload = { ...editing, cuisine_types: toArray(editing.cuisine_types) };
    if (editing.id && editing.id > 0) {
      await updateM.mutateAsync({ id: editing.id as number, payload });
    } else {
      await createM.mutateAsync(payload as any);
    }
  };

  const remove = async (id?: number) => {
    if (!id) return;
    if (!confirm("Delete this restaurant? This cannot be undone.")) return;
    try {
      await deleteM.mutateAsync(id);
    } catch (e: any) {
      alert(`Failed to delete restaurant: ${e?.message || e}`);
    }
  };

  return (
    <main className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                className="pl-8 pr-3 py-2 border rounded w-72"
                placeholder="Search restaurants…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <MunicipalitySelect value={muniId} onChange={setMuniId} placeholder="Filter municipality…" />
          </div>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
            onClick={startCreate}
          >
            <PlusCircle size={16} /> New Restaurant
          </button>
        </div>

        <div className="border rounded overflow-hidden">
          <div className="max-h-[520px] overflow-auto">
            {listQ.isLoading ? (
              <div className="p-4 text-sm text-neutral-500">Loading…</div>
            ) : listQ.error ? (
              <div className="p-4 text-sm text-red-600">Failed to load restaurants.</div>
            ) : (listQ.data ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No results.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Kind</th>
                    <th className="text-left p-2">Cuisine</th>
                    <th className="text-right p-2">Rating</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listQ.data!.map((r: any) => (
                    <tr key={r.id} className="border-t hover:bg-neutral-50">
                      <td className="p-2">
                        <button className="text-primary-700 hover:underline" onClick={() => startEdit(r)}>
                          {r.name}
                        </button>
                      </td>
                      <td className="p-2">{r.kind}</td>
                      <td className="p-2">{toArray(r.cuisine_types).join(", ") || "—"}</td>
                      <td className="p-2 text-right">{r.rating ?? "-"}</td>
                      <td className="p-2 text-right">
                        <button className="text-red-600 hover:text-red-700" onClick={() => remove(r.id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <EditRestaurantCard
          editing={editing as any}
          setEditing={setEditing as any}
          autoSlug={autoSlug}
          setAutoSlug={setAutoSlug}
          onSave={save}
          saving={createM.isPending || updateM.isPending}
        />
      </div>
    </main>
  );
}

function normalizeRestaurant(row: any) {
  return {
    ...row,
    cuisine_types: toArray(row?.cuisine_types),
  };
}

function EditRestaurantCard({
  editing,
  setEditing,
  autoSlug,
  setAutoSlug,
  onSave,
  saving,
}: {
  editing: Partial<any> | null;
  setEditing: (v: Partial<any> | null) => void;
  autoSlug: boolean;
  setAutoSlug: (v: boolean) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="rounded border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">{editing?.id ? "Edit Restaurant" : "Create Restaurant"}</div>
        <div className="text-xs text-neutral-500">
          {editing?.municipality_id ? `Municipality ID: ${editing.municipality_id}` : "Select municipality"}
        </div>
      </div>

      <div className="grid gap-3">
        <label className="text-sm font-medium">
          Municipality <span className="text-red-600">*</span>
        </label>
        <MunicipalitySelect
          value={editing?.municipality_id ?? null}
          onChange={(id) => setEditing((prev) => (prev ? { ...prev, municipality_id: id ?? 0 } : prev))}
          allowAll={false}
          placeholder="Choose municipality…"
        />

        <div className="grid gap-1">
          <label className="text-sm font-medium">
            Name <span className="text-red-600">*</span>
          </label>
          <input
            className="border rounded px-3 py-2"
            value={editing?.name ?? ""}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
          />
        </div>

        <div className="grid gap-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Slug <span className="text-red-600">*</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={autoSlug} onChange={(e) => setAutoSlug(e.target.checked)} />
              Auto
            </label>
          </div>
          <input
            className="border rounded px-3 py-2"
            value={editing?.slug ?? ""}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, slug: e.target.value } : prev))}
            disabled={autoSlug}
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Kind</label>
          <select
            className="border rounded px-3 py-2"
            value={editing?.kind ?? "restaurant"}
            onChange={(e) =>
              setEditing((prev) => (prev ? { ...prev, kind: e.target.value as any } : prev))
            }
          >
            <option value="restaurant">Restaurant</option>
            <option value="stall">Stall</option>
            <option value="store">Store</option>
            <option value="dealer">Dealer</option>
            <option value="market">Market</option>
            <option value="home-based">Home-based</option>
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Image URL</label>
          <input
            className="border rounded px-3 py-2"
            placeholder="https://…"
            value={editing?.image_url ?? ""}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, image_url: e.target.value } : prev))}
          />
          {editing?.image_url ? (
            <img
              src={editing.image_url}
              alt="preview"
              className="h-20 w-20 rounded object-cover border"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
          ) : null}
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">
            Address <span className="text-red-600">*</span>
          </label>
          <input
            className="border rounded px-3 py-2"
            value={editing?.address ?? ""}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, address: e.target.value } : prev))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Latitude</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={editing?.lat ?? 0}
              onChange={(e) => setEditing((prev) => (prev ? { ...prev, lat: Number(e.target.value) } : prev))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Longitude</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={editing?.lng ?? 0}
              onChange={(e) => setEditing((prev) => (prev ? { ...prev, lng: Number(e.target.value) } : prev))}
            />
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="border rounded px-3 py-2"
            rows={3}
            value={editing?.description ?? ""}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Cuisine types (comma-separated)</label>
          <input
            className="border rounded px-3 py-2"
            value={toArray(editing?.cuisine_types).join(", ")}
            onChange={(e) =>
              setEditing((prev) => (prev ? { ...prev, cuisine_types: toArray(e.target.value) } : prev))
            }
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Price range</label>
          <select
            className="border rounded px-3 py-2"
            value={editing?.price_range ?? "moderate"}
            onChange={(e) =>
              setEditing((prev) => (prev ? { ...prev, price_range: e.target.value as any } : prev))
            }
          >
            <option value="budget">Budget</option>
            <option value="moderate">Moderate</option>
            <option value="expensive">Expensive</option>
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Rating</label>
          <input
            type="number"
            step="0.1"
            className="border rounded px-3 py-2 w-full"
            value={editing?.rating ?? 0}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, rating: Number(e.target.value) } : prev))}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
            onClick={onSave}
            disabled={saving}
          >
            <Save size={16} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================ Curation =============================== */

function CurationPanel() {
  const { muniId, setMuniId } = useStickyMuniId();

  const dishesQ = useQuery({
    queryKey: ["curation:dishes", muniId],
    queryFn: () => listDishes({ municipalityId: muniId ?? undefined }),
    enabled: muniId !== null,
  });
  const restQ = useQuery({
    queryKey: ["curation:restaurants", muniId],
    queryFn: () => listRestaurants({ municipalityId: muniId ?? undefined }),
    enabled: muniId !== null,
  });

  const setDish = useMutation({
    mutationFn: ({ id, is_signature, panel_rank }: { id: number; is_signature: 0 | 1; panel_rank: number | null }) =>
      setDishCuration(id, { is_signature, panel_rank }),
    onSuccess: () => {
      // soft refresh list so you see ranks update immediately
      dishesQ.refetch();
    },
  });

  const setResto = useMutation({
    mutationFn: ({
      id,
      featured,
      featured_rank,
    }: {
      id: number;
      featured: 0 | 1;
      featured_rank: number | null;
    }) => setRestaurantCuration(id, { featured, featured_rank }),
    onSuccess: () => restQ.refetch(),
  });

  const dishes = dishesQ.data ?? [];
  const foods = dishes.filter((d) => d.category === "food");
  const delicacies = dishes.filter((d) => d.category === "delicacy");
  const restaurants = restQ.data ?? [];

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Municipality</label>
        <MunicipalitySelect value={muniId} onChange={setMuniId} placeholder="Choose municipality…" allowAll={false} />
      </div>

      {muniId === null ? (
        <div className="text-sm text-neutral-500">Pick a municipality to curate.</div>
      ) : (
        <>
          <section className="grid md:grid-cols-2 gap-6">
            <CurateList
              title="Top 3 Foods"
              items={foods}
              rank={(d: any) => d.panel_rank ?? null}
              setRank={(d: any, n: number | null) => setDish.mutate({ id: d.id, is_signature: n ? 1 : 0, panel_rank: n })}
            />
            <CurateList
              title="Top 3 Delicacies"
              items={delicacies}
              rank={(d: any) => d.panel_rank ?? null}
              setRank={(d: any, n: number | null) => setDish.mutate({ id: d.id, is_signature: n ? 1 : 0, panel_rank: n })}
            />
          </section>

          <section>
            <CurateList
              title="Top 3 Restaurants"
              items={restaurants}
              rank={(r: any) => r.featured_rank ?? null}
              setRank={(r: any, n: number | null) => setResto.mutate({ id: r.id, featured: n ? 1 : 0, featured_rank: n })}
            />
          </section>
        </>
      )}
    </main>
  );
}

function CurateList<T extends { id: number; name: string }>({
  title,
  items,
  rank,
  setRank,
}: {
  title: string;
  items: T[];
  rank: (x: T) => number | null;
  setRank: (x: T, n: number | null) => void;
}) {
  const sorted = [...items].sort((a, b) => (rank(a) ?? 99) - (rank(b) ?? 99));
  return (
    <div className="border rounded">
      <div className="px-3 py-2 border-b font-medium">{title}</div>
      <ul className="max-h-[360px] overflow-auto divide-y">
        {sorted.map((item) => {
          const r = rank(item);
          return (
            <li key={item.id} className="p-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 text-center font-mono rounded bg-neutral-100">{r ?? "–"}</span>
                <span>{item.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    className={`px-2 py-1 rounded border text-sm ${
                      r === n ? "bg-primary-600 text-white border-primary-600" : "hover:bg-neutral-50"
                    }`}
                    onClick={() => setRank(item, n)}
                  >
                    #{n}
                  </button>
                ))}
                <button className="px-2 py-1 rounded border text-sm hover:bg-neutral-50" onClick={() => setRank(item, null)}>
                  Clear
                </button>
              </div>
            </li>
          );
        })}
        {items.length === 0 && <li className="p-2 text-sm text-neutral-500">No items.</li>}
      </ul>
    </div>
  );
}

/* ================================ Linking =============================== */

function LinkingPanel() {
  const { muniId, setMuniId } = useStickyMuniId();
  const [qDish, setQDish] = useState("");
  const [qResto, setQResto] = useState("");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);

  const dishesQ = useQuery({
    queryKey: ["link:dishes", muniId, qDish],
    queryFn: () => listDishes({ municipalityId: muniId ?? undefined, q: qDish || undefined }),
    enabled: muniId !== null,
  });
  const restosQ = useQuery({
    queryKey: ["link:restaurants", muniId, qResto],
    queryFn: () => listRestaurants({ municipalityId: muniId ?? undefined, q: qResto || undefined }),
    enabled: muniId !== null,
  });

  // Load linked restaurant IDs — try admin route first, fallback to public filter by dishId (if your API supports it)
  const linkedIdsQ = useQuery({
    queryKey: ["link:ids", selectedDish?.id],
    enabled: !!selectedDish?.id,
    queryFn: async () => {
      if (!selectedDish?.id) return [] as number[];
      try {
        const rows: any[] = await listRestaurantsForDish(selectedDish.id);
        // Accept either {id:number} or full restaurant rows
        return rows.map((r: any) => (typeof r.id === "number" ? r.id : r.restaurant_id)).filter(Boolean);
      } catch {
        const rows = await listRestaurants({ dishId: selectedDish.id });
        return (rows ?? []).map((r: any) => r.id);
      }
    },
  });

  const linkM = useMutation({
    mutationFn: ({
      dish_id,
      restaurant_id,
      add,
    }: {
      dish_id: number;
      restaurant_id: number;
      add: boolean;
    }) => (add ? linkDishRestaurant(dish_id, restaurant_id) : unlinkDishRestaurant(dish_id, restaurant_id)),
    onSuccess: () => linkedIdsQ.refetch(),
  });

  const linkedSet = useMemo(() => new Set(linkedIdsQ.data ?? []), [linkedIdsQ.data]);

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Municipality</label>
        <MunicipalitySelect value={muniId} onChange={setMuniId} placeholder="Choose municipality…" allowAll={false} />
      </div>

      {muniId === null ? (
        <div className="text-sm text-neutral-500">Pick a municipality to start linking.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Dishes */}
          <section className="border rounded">
            <div className="px-3 py-2 border-b flex items-center gap-2">
              <Search size={16} className="text-neutral-400" />
              <input
                className="flex-1 text-sm outline-none"
                placeholder="Search dishes…"
                value={qDish}
                onChange={(e) => setQDish(e.target.value)}
              />
            </div>
            <ul className="max-h-[420px] overflow-auto divide-y">
              {(dishesQ.data ?? []).map((d) => (
                <li
                  key={d.id}
                  className={`p-2 cursor-pointer ${
                    selectedDish?.id === d.id ? "bg-primary-50" : "hover:bg-neutral-50"
                  }`}
                  onClick={() => setSelectedDish(d)}
                >
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-neutral-500">{d.category}</div>
                </li>
              ))}
              {!dishesQ.data?.length && <li className="p-2 text-sm text-neutral-500">No dishes.</li>}
            </ul>
          </section>

          {/* Restaurants with checkboxes */}
          <section className="border rounded">
            <div className="px-3 py-2 border-b flex items-center gap-2">
              <Search size={16} className="text-neutral-400" />
              <input
                className="flex-1 text-sm outline-none"
                placeholder="Search restaurants…"
                value={qResto}
                onChange={(e) => setQResto(e.target.value)}
              />
            </div>

            {!selectedDish ? (
              <div className="p-3 text-sm text-neutral-500">Select a dish to manage links.</div>
            ) : (
              <ul className="max-h-[420px] overflow-auto divide-y">
                {(restosQ.data ?? []).map((r: any) => {
                  const checked = linkedSet.has(r.id);
                  return (
                    <li key={r.id} className="p-2 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-neutral-500">
                          {r.kind} • {toArray(r.cuisine_types).join(", ") || "—"}
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            linkM.mutate({ dish_id: selectedDish.id!, restaurant_id: r.id, add: e.target.checked })
                          }
                        />
                        {checked ? <Check size={16} className="text-primary-600" /> : <LinkIcon size={16} className="text-neutral-400" />}
                      </label>
                    </li>
                  );
                })}
                {!restosQ.data?.length && <li className="p-2 text-sm text-neutral-500">No restaurants.</li>}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
