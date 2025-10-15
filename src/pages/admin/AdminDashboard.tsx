// src/pages/admin/AdminDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminAPI, AdminAuth, type Dish, type Restaurant } from "../../utils/adminApi";
import MunicipalitySelect from "../../components/admin/MunicipalitySelect";
import { Check, LogOut, PlusCircle, Save, Search, Trash2, Link as LinkIcon, Unlink } from "lucide-react";

type TabKey = "analytics" | "dishes" | "restaurants" | "curation" | "linking";

export default function AdminDashboard() {
  const [active, setActive] = useState<TabKey>("analytics");
  const meQ = useQuery({ queryKey: ["admin:me"], queryFn: AdminAuth.me, staleTime: 60_000 });

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
            onClick={async () => { await AdminAuth.logout(); location.hash = "#/admin/login"; }}
            title="Log out"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-4">
        <nav className="-mb-px flex gap-6">
          {(["analytics","dishes","restaurants","curation","linking"] as TabKey[]).map(k => (
            <button
              key={k}
              className={`pb-2 border-b-2 ${active===k ? "border-primary-600 text-primary-700" : "border-transparent text-neutral-600 hover:text-neutral-800"}`}
              onClick={() => setActive(k)}
            >
              {k[0].toUpperCase()+k.slice(1)}
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

/* ----------------- Analytics ----------------- */
function AnalyticsPanel() {
  const [muniId, setMuniId] = useState<number | null>(null);
  const sumQ = useQuery({
    queryKey: ["admin:analytics", muniId],
    queryFn: () => AdminAPI.analyticsSummary(muniId ?? undefined),
    staleTime: 30_000,
  });

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Municipality</label>
        <MunicipalitySelect value={muniId} onChange={setMuniId} placeholder="All municipalities" />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="Total Dishes" value={sumQ.data?.totals?.dishes ?? "—"} />
        <StatCard label="Total Restaurants" value={sumQ.data?.totals?.restaurants ?? "—"} />
        <StatCard label="Scope" value={muniId ? `Municipality #${muniId}` : "All"} />
      </div>

      <section>
        <div className="font-medium mb-2">Top Restaurants</div>
        <div className="border rounded overflow-hidden">
          {!sumQ.data?.topRestaurants?.length ? (
            <div className="p-3 text-sm text-neutral-500">No data yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="text-left p-2">Name</th>
                  <th className="text-right p-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {sumQ.data.topRestaurants.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-right">{r.rating ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
function StatCard({ label, value }: { label: string; value: number|string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

/* ----------------- Dishes CRUD ----------------- */
function DishesPanel() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [muniId, setMuniId] = useState<number | null>(null);
  const [autoSlug, setAutoSlug] = useState(true);
  const [editing, setEditing] = useState<Partial<Dish> | null>(null);

  const listQ = useQuery({
    queryKey: ["admin:dishes", muniId, q],
    queryFn: () => AdminAPI.getDishes({ municipalityId: muniId ?? undefined, q }),
    staleTime: 15_000,
  });

  const createM = useMutation({
    mutationFn: (payload: any) => AdminAPI.createDish(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin:dishes"] }); setEditing(null); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => AdminAPI.updateDish(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin:dishes"] }); setEditing(null); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => AdminAPI.deleteDish(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin:dishes"] }); if (editing?.id === id) setEditing(null); },
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
  const startEdit = (row: Dish) => setEditing({ ...row });

  useEffect(() => {
    if (autoSlug && editing?.name) {
      const s = editing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
      setEditing(prev => prev ? { ...prev, slug: s } : prev);
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
      flavor_profile: editing.flavor_profile ?? [],
      ingredients: editing.ingredients ?? [],
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
    await deleteM.mutateAsync(id);
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
          <button className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
            onClick={startCreate}>
            <PlusCircle size={16} /> New Dish
          </button>
        </div>

        <div className="border rounded overflow-hidden">
          {listQ.isLoading ? (
            <div className="p-4 text-sm text-neutral-500">Loading…</div>
          ) : listQ.error ? (
            <div className="p-4 text-sm text-red-600">Failed to load dishes.</div>
          ) : (listQ.data ?? []).length === 0 ? (
            <div className="p-4 text-sm text-neutral-500">No results.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
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
                    <td className="p-2">{(d.flavor_profile ?? []).join(", ")}</td>
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

      <div className="lg:col-span-2">
        <div className="rounded border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">{editing?.id ? "Edit Dish" : "Create Dish"}</div>
            <div className="text-xs text-neutral-500">
              {editing?.municipality_id ? `Municipality ID: ${editing.municipality_id}` : "Select municipality"}
            </div>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-medium">Municipality <span className="text-red-600">*</span></label>
            <MunicipalitySelect
              value={editing?.municipality_id ?? null}
              onChange={(id) => setEditing(prev => prev ? { ...prev, municipality_id: id ?? 0 } : prev)}
              allowAll={false}
              placeholder="Choose municipality…"
            />

            <div className="grid gap-1">
              <label className="text-sm font-medium">Name <span className="text-red-600">*</span></label>
              <input className="border rounded px-3 py-2"
                value={editing?.name ?? ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)} />
            </div>

            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Slug <span className="text-red-600">*</span></label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={autoSlug} onChange={(e) => setAutoSlug(e.target.checked)} />
                  Auto
                </label>
              </div>
              <input className="border rounded px-3 py-2"
                value={editing?.slug ?? ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, slug: e.target.value } : prev)}
                disabled={autoSlug} />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Category</label>
              <select
                className="border rounded px-3 py-2"
                value={editing?.category ?? "food"}
                onChange={(e) => setEditing(prev => prev ? { ...prev, category: e.target.value as Dish["category"] } : prev)}
              >
                <option value="food">Food</option>
                <option value="delicacy">Delicacy</option>
                <option value="drink">Drink</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Image URL</label>
              <input className="border rounded px-3 py-2"
                placeholder="https://…"
                value={editing?.image_url ?? ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, image_url: e.target.value } : prev)} />
              {editing?.image_url ? (
                <img
                  src={editing.image_url}
                  alt="preview"
                  className="h-20 w-20 rounded object-cover border"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : null}
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Description</label>
              <textarea className="border rounded px-3 py-2" rows={3}
                value={editing?.description ?? ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, description: e.target.value } : prev)} />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Flavor profile (comma-separated)</label>
              <input className="border rounded px-3 py-2"
                value={(editing?.flavor_profile ?? []).join(", ")}
                onChange={(e) => setEditing(prev => prev ? { ...prev, flavor_profile: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } : prev)} />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Ingredients (comma-separated)</label>
              <input className="border rounded px-3 py-2"
                value={(editing?.ingredients ?? []).join(", ")}
                onChange={(e) => setEditing(prev => prev ? { ...prev, ingredients: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } : prev)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Popularity</label>
                <input type="number" className="border rounded px-3 py-2 w-full"
                  value={editing?.popularity ?? 0}
                  onChange={(e) => setEditing(prev => prev ? { ...prev, popularity: Number(e.target.value) } : prev)} />
              </div>
              <div>
                <label className="text-sm font-medium">Rating</label>
                <input type="number" step="0.1" className="border rounded px-3 py-2 w-full"
                  value={editing?.rating ?? 0}
                  onChange={(e) => setEditing(prev => prev ? { ...prev, rating: Number(e.target.value) } : prev)} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {editing?.id ? (
                <button className="inline-flex items-center gap-2 px-3 py-2 rounded border text-red-600 hover:bg-red-50"
                  onClick={() => editing?.id && deleteM.mutate(editing.id)}>
                  <Trash2 size={16} /> Delete
                </button>
              ) : null}
              <button className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
                onClick={save} disabled={createM.isPending || updateM.isPending}>
                <Save size={16} /> Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ----------------- Restaurants CRUD ----------------- */
function RestaurantsPanel() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [muniId, setMuniId] = useState<number | null>(null);
  const [autoSlug, setAutoSlug] = useState(true);
  const [editing, setEditing] = useState<Partial<Restaurant> | null>(null);

  const listQ = useQuery({
    queryKey: ["admin:restaurants", muniId, q],
    queryFn: () => AdminAPI.getRestaurants({ municipalityId: muniId ?? undefined, q }),
    staleTime: 15_000,
  });

  const createM = useMutation({
    mutationFn: (payload: any) => AdminAPI.createRestaurant(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin:restaurants"] }); setEditing(null); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => AdminAPI.updateRestaurant(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin:restaurants"] }); setEditing(null); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => AdminAPI.deleteRestaurant(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin:restaurants"] }); if (editing?.id === id) setEditing(null); },
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
  const startEdit = (row: Restaurant) => setEditing({ ...row });

  useEffect(() => {
    if (autoSlug && editing?.name) {
      const s = editing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
      setEditing(prev => prev ? { ...prev, slug: s } : prev);
    }
  }, [editing?.name, autoSlug]);

  const save = async () => {
    if (!editing) return;
    if (!editing.municipality_id || !editing.name || !editing.slug || !editing.address) {
      alert("Municipality, Name, Slug and Address are required.");
      return;
    }
    const payload = { ...editing, cuisine_types: editing.cuisine_types ?? [] };
    if (editing.id && editing.id > 0) {
      await updateM.mutateAsync({ id: editing.id, payload });
    } else {
      await createM.mutateAsync(payload as any);
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
          <button className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
            onClick={startCreate}>
            <PlusCircle size={16} /> New Restaurant
          </button>
        </div>

        <div className="border rounded overflow-hidden">
          {listQ.isLoading ? (
            <div className="p-4 text-sm text-neutral-500">Loading…</div>
          ) : listQ.error ? (
            <div className="p-4 text-sm text-red-600">Failed to load restaurants.</div>
          ) : (listQ.data ?? []).length === 0 ? (
            <div className="p-4 text-sm text-neutral-500">No results.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Kind</th>
                  <th className="text-left p-2">Cuisine</th>
                  <th className="text-right p-2">Rating</th>
                  <th className="text-right p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listQ.data!.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-neutral-50">
                    <td className="p-2">
                      <button className="text-primary-700 hover:underline" onClick={() => startEdit(r)}>
                        {r.name}
                      </button>
                    </td>
                    <td className="p-2">{r.kind}</td>
                    <td className="p-2">{(r.cuisine_types ?? []).join(", ")}</td>
                    <td className="p-2 text-right">{r.rating ?? "-"}</td>
                    <td className="p-2 text-right">
                      <button className="text-red-600 hover:text-red-700" onClick={() => r.id && deleteM.mutate(r.id)}>
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

      <div className="lg:col-span-2">
        <div className="rounded border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">{editing?.id ? "Edit Restaurant" : "Create Restaurant"}</div>
            <div className="text-xs text-neutral-500">
              {editing?.municipality_id ? `Municipality ID: ${editing.municipality_id}` : "Select municipality"}
            </div>
          </div>

          <div className="grid gap-3">
            <label className="text-sm font-medium">Municipality <span className="text-red-600">*</span></label>
            <MunicipalitySelect
              value={editing?.municipality_id ?? null}
              onChange={(id) => setEditing(prev => prev ? { ...prev, municipality_id: id ?? 0 } : prev)}
              allowAll={false}
              placeholder="Choose municipality…"
            />

            <div className="grid gap-1">
              <label className="text-sm font-medium">Name <span className="text-red-600">*</span></label>
              <input className="border rounded px-3 py-2"
                value={editing?.name ?? ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)} />
            </div>

            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Slug <span className="text-red-600">*</span></label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={autoSlug} onChange={(e) => setAutoSlug(e.target.checked)} />
                  Auto
                </label>
              </div>
              <input className="border rounded px-3 py-2"
                value={editing?.slug ?? ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, slug: e.target.value } : prev)}
                disabled={autoSlug} />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Kind</label>
              <select
                className="border rounded px-3 py-2"
                value={editing?.kind ?? "restaurant"}
                onChange={(e) => setEditing(prev => prev ? { ...prev, kind: e.target.value as Restaurant["kind"] } : prev)}
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
              <input className="border rounded px-3 py-2"
                placeholder="https://…"
                value={editing?.image_url ?? ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, image_url: e.target.value } : prev)} />
              {editing?.image_url ? (
                <img
                  src={editing.image_url}
                  alt="preview"
                  className="h-20 w-20 rounded object-cover border"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : null}
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Address <span className="text-red-600">*</span></label>
              <input className="border rounded px-3 py-2"
                value={editing?.address ?? ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, address: e.target.value } : prev)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Latitude</label>
                <input type="number" className="border rounded px-3 py-2 w-full"
                  value={editing?.lat ?? 0}
                  onChange={(e) => setEditing(prev => prev ? { ...prev, lat: Number(e.target.value) } : prev)} />
              </div>
              <div>
                <label className="text-sm font-medium">Longitude</label>
                <input type="number" className="border rounded px-3 py-2 w-full"
                  value={editing?.lng ?? 0}
                  onChange={(e) => setEditing(prev => prev ? { ...prev, lng: Number(e.target.value) } : prev)} />
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Description</label>
              <textarea className="border rounded px-3 py-2" rows={3}
                value={editing?.description ?? ""}
                onChange={(e) => setEditing(prev => prev ? { ...prev, description: e.target.value } : prev)} />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Cuisine types (comma-separated)</label>
              <input className="border rounded px-3 py-2"
                value={(editing?.cuisine_types ?? []).join(", ")}
                onChange={(e) => setEditing(prev => prev ? { ...prev, cuisine_types: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } : prev)} />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Price range</label>
              <select
                className="border rounded px-3 py-2"
                value={editing?.price_range ?? "moderate"}
                onChange={(e) => setEditing(prev => prev ? { ...prev, price_range: e.target.value as Restaurant["price_range"] } : prev)}
              >
                <option value="budget">Budget</option>
                <option value="moderate">Moderate</option>
                <option value="expensive">Expensive</option>
              </select>
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Rating</label>
              <input type="number" step="0.1" className="border rounded px-3 py-2 w-full"
                value={editing?.rating ?? 0}
                onChange={(e) => setEditing(prev => prev ? { ...prev, rating: Number(e.target.value) } : prev)} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {editing?.id ? (
                <button className="inline-flex items-center gap-2 px-3 py-2 rounded border text-red-600 hover:bg-red-50"
                  onClick={() => editing?.id && deleteM.mutate(editing.id)}>
                  <Trash2 size={16} /> Delete
                </button>
              ) : null}
              <button className="inline-flex items-center gap-2 px-3 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
                onClick={save} disabled={createM.isPending || updateM.isPending}>
                <Save size={16} /> Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ----------------- Curation (top 3) ----------------- */
function CurationPanel() {
  const [muniId, setMuniId] = useState<number | null>(null);

  const dishesQ = useQuery({
    queryKey: ["curation:dishes", muniId],
    queryFn: () => AdminAPI.getDishes({ municipalityId: muniId ?? undefined }),
    enabled: muniId !== null,
  });
  const restQ = useQuery({
    queryKey: ["curation:restaurants", muniId],
    queryFn: () => AdminAPI.getRestaurants({ municipalityId: muniId ?? undefined }),
    enabled: muniId !== null,
  });

  const setFeat = useMutation({
    mutationFn: ({ id, featured, rank }: { id: number; featured: 0|1; rank: number|null }) =>
      AdminAPI.setDishFeatured(id, featured, rank),
  });

  const setSig = useMutation({
    mutationFn: ({ id, signature, rank }: { id: number; signature: 0|1; rank: number|null }) =>
      AdminAPI.setRestaurantSignature(id, signature, rank),
  });

  const dishes = dishesQ.data ?? [];
  const foods = dishes.filter(d => d.category === "food");
  const delicacies = dishes.filter(d => d.category === "delicacy");
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
              getRank={(d) => d.featured_rank ?? null}
              setRank={(d, rank) => setFeat.mutate({ id: d.id, featured: rank ? 1 : 0, rank })}
            />
            <CurateList
              title="Top 3 Delicacies"
              items={delicacies}
              getRank={(d) => d.featured_rank ?? null}
              setRank={(d, rank) => setFeat.mutate({ id: d.id, featured: rank ? 1 : 0, rank })}
            />
          </section>

          <section>
            <CurateList
              title="Top 3 Restaurants"
              items={restaurants}
              getRank={(r: any) => r.signature_rank ?? null}
              setRank={(r: any, rank: number | null) => setSig.mutate({ id: r.id, signature: rank ? 1 : 0, rank })}
            />
          </section>
        </>
      )}
    </main>
  );
}

function CurateList<T extends { id: number; name: string }>(
  { title, items, getRank, setRank }:
  { title: string; items: T[]; getRank: (x: T) => number | null; setRank: (x: T, rank: number | null) => void }
) {
  const sorted = [...items].sort((a, b) => (getRank(a) ?? 99) - (getRank(b) ?? 99));

  return (
    <div className="border rounded">
      <div className="px-3 py-2 border-b font-medium">{title}</div>
      <ul className="divide-y">
        {sorted.map(item => {
          const rank = getRank(item);
          return (
            <li key={item.id} className="p-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 text-center font-mono">{rank ?? "-"}</span>
                <span>{item.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {[1,2,3].map(n => (
                  <button
                    key={n}
                    className={`px-2 py-1 rounded border text-sm ${rank===n ? "bg-primary-600 text-white border-primary-600" : "hover:bg-neutral-50"}`}
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

/* ----------------- Linking (NEW) ----------------- */
function LinkingPanel() {
  const [muniId, setMuniId] = useState<number | null>(null);
  const [qDish, setQDish] = useState("");
  const [qResto, setQResto] = useState("");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);

  const dishesQ = useQuery({
    queryKey: ["link:dishes", muniId, qDish],
    queryFn: () => AdminAPI.getDishes({ municipalityId: muniId ?? undefined, q: qDish || undefined }),
    enabled: muniId !== null,
  });
  const restosQ = useQuery({
    queryKey: ["link:restaurants", muniId, qResto],
    queryFn: () => AdminAPI.getRestaurants({ municipalityId: muniId ?? undefined, q: qResto || undefined }),
    enabled: muniId !== null,
  });

  const linkedIdsQ = useQuery({
    queryKey: ["link:linkedIds", selectedDish?.id],
    queryFn: () => selectedDish ? AdminAPI.getLinkedRestaurantIds(selectedDish.id) : Promise.resolve([]),
    enabled: !!selectedDish?.id,
  });

  const linkM = useMutation({
    mutationFn: ({ dish_id, restaurant_id, add }: { dish_id: number; restaurant_id: number; add: boolean }) =>
      add ? AdminAPI.linkDishRestaurant(dish_id, restaurant_id) : AdminAPI.unlinkDishRestaurant(dish_id, restaurant_id),
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
              {(dishesQ.data ?? []).map(d => (
                <li key={d.id} className={`p-2 cursor-pointer ${selectedDish?.id === d.id ? "bg-primary-50" : "hover:bg-neutral-50"}`}
                  onClick={() => setSelectedDish(d)}>
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
                {(restosQ.data ?? []).map(r => {
                  const checked = linkedSet.has(r.id);
                  return (
                    <li key={r.id} className="p-2 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-neutral-500">{r.kind} • {(r.cuisine_types ?? []).join(", ")}</div>
                      </div>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => linkM.mutate({ dish_id: selectedDish.id!, restaurant_id: r.id, add: e.target.checked })}
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
