import React, { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/* ================== API helpers ================== */
const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function jget<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${text}`);
  try { return JSON.parse(text) as T; } catch { throw new Error(`Bad JSON: ${text.slice(0, 160)}`); }
}
async function jsend(path: string, body: any, method: "POST"|"PATCH"|"DELETE"="POST") {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${text}`);
  return text ? JSON.parse(text) : {};
}
const safeJsonArray = (v: any) => (Array.isArray(v) ? v : v ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []);

/* ================== Types ================== */
type Municipality = { id:number; name:string; slug:string; };
type Dish = {
  id:number; name:string; slug:string; description:string|null;
  image_url:string|null; rating:number|null; popularity:number|null;
  flavor_profile:string[]|null; ingredients:string[]|null;
  municipality_id:number; municipality_name?:string; category:"food"|"delicacy"|"drink";
  panel_rank?: number|null;
};
type Restaurant = {
  id:number; name:string; slug:string; kind:"restaurant"|"stall"|"store"|"dealer"|"market"|"home-based";
  description:string|null; address:string; phone:string|null; website:string|null;
  facebook:string|null; instagram:string|null; opening_hours:string|null;
  price_range:"budget"|"moderate"|"expensive"; cuisine_types:string[]|null;
  rating:number; lat:number; lng:number; municipality_id?: number; panel_rank?: number|null;
};

/* ================== Utils ================== */
function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function toListFromInput(v: string): string[] {
  return (v || "").split(",").map(s => s.trim()).filter(Boolean);
}

/* ================== MunicipalitySelect (native) ================== */
function useMunicipalities() {
  const [list, setList] = useState<Municipality[]>([]);
  useEffect(() => { (async () => {
    const rows = await jget<Municipality[]>("/api/municipalities");
    setList(rows.map(r => ({ id:r.id, name:r.name, slug:r.slug })));
  })(); }, []);
  return list;
}
function MunicipalitySelect({
  value, onChange, allowAll=true,
  className="input w-full"
}: { value:number|null|undefined; onChange:(v:number|null)=>void; allowAll?:boolean; className?:string }) {
  const munis = useMunicipalities();
  return (
    <select
      className={className}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      {allowAll && <option value="">All municipalities</option>}
      {munis.map(m => (
        <option key={m.id} value={m.id}>{m.name} ({m.slug})</option>
      ))}
    </select>
  );
}

/* ================== AdminDashboard ================== */
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"dishes"|"restaurants"|"curation">("dishes");
  const [municipalityId, setMunicipalityId] = useState<number|null>(null);
  const [q, setQ] = useState("");

  const munis = useMunicipalities();
  const activeMuni = useMemo(() => munis.find(m => m.id === municipalityId) || null, [munis, municipalityId]);

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <div className="text-xs text-neutral-500 mb-1">Municipality scope</div>
          <MunicipalitySelect value={municipalityId} onChange={setMunicipalityId} />
        </div>
        <div className="flex-1">
          <div className="text-xs text-neutral-500 mb-1">Search (real-time)</div>
          <input
            className="input w-full"
            placeholder="Type to filter by name/description…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button className={`btn ${activeTab==='dishes'?'btn-primary':''}`} onClick={()=>setActiveTab("dishes")}>Dishes</button>
          <button className={`btn ${activeTab==='restaurants'?'btn-primary':''}`} onClick={()=>setActiveTab("restaurants")}>Restaurants</button>
          <button className={`btn ${activeTab==='curation'?'btn-primary':''}`} onClick={()=>setActiveTab("curation")}>Curation</button>
        </div>
      </div>

      {/* Context banner */}
      <div className="p-3 rounded border bg-neutral-50 text-sm flex items-center justify-between">
        <div>
          <span className="text-neutral-600">Editing in:&nbsp;</span>
          <span className="font-medium">
            {activeMuni ? `${activeMuni.name} (${activeMuni.slug})` : "All municipalities"}
          </span>
        </div>
        {activeMuni && (
          <button className="text-primary-600 hover:underline" onClick={() => setMunicipalityId(null)}>
            Clear
          </button>
        )}
      </div>

      {activeTab === "dishes" && <ManageDishes municipalityId={municipalityId} q={q} />}
      {activeTab === "restaurants" && <ManageRestaurants municipalityId={municipalityId} q={q} />}
      {activeTab === "curation" && <CurationTab municipalityId={municipalityId} />}
    </div>
  );
}

/* ================== Dishes (CRUD + Delete) ================== */
const dishSchema = z.object({
  municipality_id: z.number().int().positive({ message: "Municipality is required" }),
  category_code: z.enum(["food", "delicacy", "drink"]),
  name: z.string().min(2, "Name is too short"),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Use lowercase, numbers and dashes only"),
  description: z.string().optional(),
  flavor_profile_csv: z.string().optional(),
  ingredients_csv: z.string().optional(),
  image_url: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  popularity: z.coerce.number().min(0).max(100).default(0),
  rating: z.coerce.number().min(0).max(5).default(0),
});
type DishForm = z.infer<typeof dishSchema>;

function ManageDishes({ municipalityId, q }: { municipalityId: number|null; q: string }) {
  const [list, setList] = useState<Dish[]>([]);
  const [cat, setCat] = useState<""|"food"|"delicacy"|"drink">("");
  const [editing, setEditing] = useState<Dish|null>(null);
  const [autoSlug, setAutoSlug] = useState(true);

  const {
    register, handleSubmit, control, setValue, watch, reset,
    formState: { errors, isSubmitting }
  } = useForm<DishForm>({
    resolver: zodResolver(dishSchema),
    defaultValues: {
      municipality_id: municipalityId ?? undefined,
      category_code: "food",
      name: "", slug: "",
      description: "",
      flavor_profile_csv: "",
      ingredients_csv: "",
      image_url: "",
      popularity: 0, rating: 0,
    }
  });

  // auto-slug
  const nameWatch = watch("name");
  useEffect(() => { if (autoSlug) setValue("slug", slugify(nameWatch || "")); }, [nameWatch, autoSlug, setValue]);

  // Load table (realtime filters by muni + q + category)
  const reload = async () => {
    const qs = new URLSearchParams();
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    if (q) qs.set("q", q);
    if (cat) qs.set("category", cat);
    qs.set("limit", "200");
    const rows = await jget<Dish[]>(`/api/dishes?${qs.toString()}`);
    setList(rows.map(r => ({
      ...r,
      flavor_profile: safeJsonArray(r.flavor_profile),
      ingredients: safeJsonArray(r.ingredients),
    })));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [municipalityId, q, cat]);

  const onCreate = async (data: DishForm) => {
    await jsend("/api/admin/dishes", {
      municipality_id: data.municipality_id,
      category_code: data.category_code,
      name: data.name.trim(),
      slug: data.slug.trim(),
      description: data.description || null,
      flavor_profile: toListFromInput(data.flavor_profile_csv || ""),
      ingredients: toListFromInput(data.ingredients_csv || ""),
      image_url: data.image_url || null,
      popularity: data.popularity ?? 0,
      rating: data.rating ?? 0,
    }, "POST");
    reset({ municipality_id: municipalityId ?? undefined, category_code: "food", name:"", slug:"", description:"", flavor_profile_csv:"", ingredients_csv:"", image_url:"", popularity:0, rating:0 });
    setAutoSlug(true);
    reload();
  };

  const startEdit = (d: Dish) => {
    setEditing(d);
    reset({
      municipality_id: d.municipality_id,
      category_code: d.category,
      name: d.name, slug: d.slug,
      description: d.description ?? "",
      flavor_profile_csv: (d.flavor_profile ?? []).join(", "),
      ingredients_csv: (d.ingredients ?? []).join(", "),
      image_url: d.image_url ?? "",
      popularity: d.popularity ?? 0,
      rating: d.rating ?? 0,
    });
    setAutoSlug(false);
  };

  const saveEdit = async (data: DishForm) => {
    if (!editing) return;
    await jsend(`/api/admin/dishes/${editing.id}`, {
      municipality_id: data.municipality_id,
      category_code: data.category_code,
      name: data.name.trim(),
      slug: data.slug.trim(),
      description: data.description || null,
      flavor_profile: toListFromInput(data.flavor_profile_csv || ""),
      ingredients: toListFromInput(data.ingredients_csv || ""),
      image_url: data.image_url || null,
      popularity: data.popularity ?? 0,
      rating: data.rating ?? 0,
    }, "PATCH");
    setEditing(null);
    reset();
    setAutoSlug(true);
    reload();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this dish? This also removes its links.")) return;
    await jsend(`/api/admin/dishes/${id}`, null, "DELETE");
    if (editing?.id === id) { setEditing(null); reset(); }
    reload();
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Left: filters + table */}
      <div className="md:col-span-2 space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-sm text-neutral-500">Category</div>
          <select className="input w-40" value={cat} onChange={(e)=>setCat(e.target.value as any)}>
            <option value="">All</option>
            <option value="food">Food</option>
            <option value="delicacy">Delicacy</option>
            <option value="drink">Drink</option>
          </select>
          <div className="text-xs text-neutral-500 ml-auto">
            Showing <b>{list.length}</b> result(s)
          </div>
        </div>

        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2">Cat</th>
                <th className="p-2">Muni</th>
                <th className="p-2">Rank</th>
                <th className="p-2 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(d => (
                <tr key={d.id} className="border-t">
                  <td className="p-2">{d.name}</td>
                  <td className="p-2 text-center">{d.category}</td>
                  <td className="p-2 text-center">{d.municipality_id}</td>
                  <td className="p-2 text-center">{d.panel_rank ?? "—"}</td>
                  <td className="p-2 flex items-center justify-center gap-3">
                    <button className="text-primary-600 underline" onClick={()=>startEdit(d)}>Edit</button>
                    <button className="text-red-600 underline" onClick={()=>del(d.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-neutral-500">No results.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: single form (Create/Edit) */}
      <div className="space-y-3">
        <h3 className="font-semibold">{editing ? "Edit Dish" : "Create Dish"}</h3>
        <form className="space-y-2" onSubmit={editing ? handleSubmit(saveEdit) : handleSubmit(onCreate)}>
          <div>
            <div className="text-xs text-neutral-500 mb-1">Municipality</div>
            <Controller
              name="municipality_id"
              control={control}
              render={({ field }) => (
                <MunicipalitySelect allowAll={false} value={field.value ?? null} onChange={(id)=>field.onChange(id ?? undefined)} />
              )}
            />
            {errors.municipality_id && <div className="text-xs text-red-600 mt-1">{errors.municipality_id.message}</div>}
          </div>

          <div>
            <div className="text-xs text-neutral-500 mb-1">Name</div>
            <input className="input w-full" placeholder="e.g. Valenciana (SJDM)" {...register("name")} />
            {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name.message}</div>}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-xs text-neutral-500 mb-1">Slug</div>
              <input className="input w-full" placeholder="auto-generated-from-name" {...register("slug")} />
              {errors.slug && <div className="text-xs text-red-600 mt-1">{errors.slug.message}</div>}
            </div>
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={autoSlug} onChange={(e)=>setAutoSlug(e.target.checked)} />
              Auto-slug
            </label>
          </div>

          <div>
            <div className="text-xs text-neutral-500 mb-1">Category</div>
            <select className="input w-full" {...register("category_code")}>
              <option value="food">Food</option>
              <option value="delicacy">Delicacy</option>
              <option value="drink">Drink</option>
            </select>
          </div>

          <textarea className="input" placeholder="Description" {...register("description")} />
          <input className="input" placeholder="Flavor profile (comma-sep)" {...register("flavor_profile_csv")} />
          <input className="input" placeholder="Ingredients (comma-sep)" {...register("ingredients_csv")} />
          <input className="input" placeholder="Image URL" {...register("image_url")} />
          {errors.image_url && <div className="text-xs text-red-600 mt-1">{errors.image_url.message}</div>}

          <div className="flex gap-2">
            <input className="input" type="number" step="1" placeholder="Popularity" {...register("popularity", { valueAsNumber: true })} />
            <input className="input" type="number" step="0.1" placeholder="Rating" {...register("rating", { valueAsNumber: true })} />
          </div>

          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={isSubmitting}>{editing ? "Save" : "Create"}</button>
            {editing && <button type="button" className="btn" onClick={()=>{ setEditing(null); reset(); setAutoSlug(true); }}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================== Restaurants (CRUD + Delete) ================== */
const restoSchema = z.object({
  municipality_id: z.number().int().positive({ message: "Municipality is required" }),
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  kind: z.enum(["restaurant", "stall", "store", "dealer", "market", "home-based"]).default("restaurant"),
  address: z.string().min(3),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  description: z.string().optional(),
  price_range: z.enum(["budget", "moderate", "expensive"]).default("moderate"),
  cuisine_csv: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  facebook: z.string().url().optional().or(z.literal("")),
  instagram: z.string().url().optional().or(z.literal("")),
  opening_hours: z.string().optional(),
  rating: z.coerce.number().min(0).max(5).default(0),
});
type RestoForm = z.infer<typeof restoSchema>;

function ManageRestaurants({ municipalityId, q }: { municipalityId: number|null; q: string }) {
  const [list, setList] = useState<Restaurant[]>([]);
  const [editing, setEditing] = useState<Restaurant|null>(null);
  const [autoSlug, setAutoSlug] = useState(true);

  const { register, handleSubmit, control, setValue, reset, watch, formState:{ errors, isSubmitting } } =
    useForm<RestoForm>({
      resolver: zodResolver(restoSchema),
      defaultValues: {
        municipality_id: municipalityId ?? undefined,
        name:"", slug:"", kind:"restaurant",
        address:"", lat:0, lng:0, description:"",
        price_range:"moderate", cuisine_csv:"",
        phone:"", website:"", facebook:"", instagram:"",
        opening_hours:"", rating:0,
      }
    });

  const nameWatch = watch("name");
  useEffect(()=>{ if (autoSlug) setValue("slug", slugify(nameWatch||"")); }, [nameWatch, autoSlug, setValue]);

  const reload = async () => {
    const qs = new URLSearchParams();
    if (municipalityId) qs.set("municipalityId", String(municipalityId));
    if (q) qs.set("q", q);
    qs.set("limit", "200");
    const rows = await jget<Restaurant[]>(`/api/restaurants?${qs.toString()}`);
    setList(rows.map(r => ({ ...r, cuisine_types: safeJsonArray(r.cuisine_types) })));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [municipalityId, q]);

  const onCreate = async (data:RestoForm) => {
    await jsend("/api/admin/restaurants", {
      municipality_id: data.municipality_id,
      name: data.name.trim(), slug: data.slug.trim(), kind: data.kind,
      address: data.address.trim(), lat:data.lat, lng:data.lng,
      description: data.description || null,
      price_range: data.price_range,
      cuisine_types: toListFromInput(data.cuisine_csv||""),
      phone: data.phone || null, website: data.website || null,
      facebook: data.facebook || null, instagram: data.instagram || null,
      opening_hours: data.opening_hours || null,
      rating: data.rating ?? 0,
    }, "POST");
    reset({ municipality_id: municipalityId ?? undefined, kind:"restaurant", price_range:"moderate" } as any);
    setAutoSlug(true);
    reload();
  };

  const startEdit = (r:Restaurant) => {
    setEditing(r);
    reset({
      municipality_id: r.municipality_id ?? municipalityId ?? undefined,
      name: r.name, slug: r.slug, kind: r.kind as any,
      address: r.address, lat:r.lat, lng:r.lng, description:r.description ?? "",
      price_range: r.price_range, cuisine_csv:(r.cuisine_types??[]).join(", "),
      phone:r.phone ?? "", website:r.website ?? "", facebook:r.facebook ?? "", instagram:r.instagram ?? "",
      opening_hours:r.opening_hours ?? "", rating:r.rating ?? 0,
    });
    setAutoSlug(false);
  };

  const saveEdit = async (data:RestoForm) => {
    if (!editing) return;
    await jsend(`/api/admin/restaurants/${editing.id}`, {
      municipality_id: data.municipality_id,
      name: data.name.trim(), slug: data.slug.trim(), kind: data.kind,
      address: data.address.trim(), lat:data.lat, lng:data.lng,
      description: data.description || null,
      price_range: data.price_range,
      cuisine_types: toListFromInput(data.cuisine_csv||""),
      phone: data.phone || null, website: data.website || null,
      facebook: data.facebook || null, instagram: data.instagram || null,
      opening_hours: data.opening_hours || null,
      rating: data.rating ?? 0,
    }, "PATCH");
    setEditing(null);
    reset(); setAutoSlug(true);
    reload();
  };

  const del = async (id:number) => {
    if (!confirm("Delete this restaurant? This also removes its links.")) return;
    await jsend(`/api/admin/restaurants/${id}`, null, "DELETE");
    if (editing?.id === id) { setEditing(null); reset(); }
    reload();
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Left: table */}
      <div className="md:col-span-2">
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2">Muni</th>
                <th className="p-2">Price</th>
                <th className="p-2">Rank</th>
                <th className="p-2 w-36">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-center">{r.municipality_id ?? "—"}</td>
                  <td className="p-2 text-center">{r.price_range}</td>
                  <td className="p-2 text-center">{r.panel_rank ?? "—"}</td>
                  <td className="p-2 flex items-center justify-center gap-3">
                    <button className="text-primary-600 underline" onClick={()=>startEdit(r)}>Edit</button>
                    <button className="text-red-600 underline" onClick={()=>del(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-neutral-500">No results.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: single form */}
      <div className="space-y-3">
        <h3 className="font-semibold">{editing ? "Edit Restaurant" : "Create Restaurant"}</h3>
        <form className="space-y-2" onSubmit={editing ? handleSubmit(saveEdit) : handleSubmit(onCreate)}>
          <div>
            <div className="text-xs text-neutral-500 mb-1">Municipality</div>
            <Controller
              name="municipality_id"
              control={control}
              render={({ field }) => (
                <MunicipalitySelect allowAll={false} value={field.value ?? null} onChange={(id)=>field.onChange(id ?? undefined)} />
              )}
            />
            {errors.municipality_id && <div className="text-xs text-red-600 mt-1">{errors.municipality_id.message}</div>}
          </div>

          <div>
            <div className="text-xs text-neutral-500 mb-1">Name</div>
            <input className="input w-full" {...register("name")} />
            {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name.message}</div>}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-xs text-neutral-500 mb-1">Slug</div>
              <input className="input w-full" {...register("slug")} />
              {errors.slug && <div className="text-xs text-red-600 mt-1">{errors.slug.message}</div>}
            </div>
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={autoSlug} onChange={(e)=>setAutoSlug(e.target.checked)} />
              Auto-slug
            </label>
          </div>

          <select className="input" {...register("kind")}>
            <option>restaurant</option><option>stall</option><option>store</option>
            <option>dealer</option><option>market</option><option>home-based</option>
          </select>

          <input className="input" {...register("address")} placeholder="Address" />
          <div className="flex gap-2">
            <input className="input" type="number" step="0.000001" placeholder="Lat" {...register("lat", { valueAsNumber: true })} />
            <input className="input" type="number" step="0.000001" placeholder="Lng" {...register("lng", { valueAsNumber: true })} />
          </div>

          <select className="input" {...register("price_range")}>
            <option>budget</option><option>moderate</option><option>expensive</option>
          </select>

          <textarea className="input" {...register("description")} placeholder="Description" />
          <input className="input" {...register("cuisine_csv")} placeholder="Cuisines (comma-sep)" />
          <input className="input" {...register("phone")} placeholder="Phone" />
          <input className="input" {...register("website")} placeholder="Website URL" />
          <input className="input" {...register("facebook")} placeholder="Facebook URL" />
          <input className="input" {...register("instagram")} placeholder="Instagram URL" />
          <input className="input" {...register("opening_hours")} placeholder="Opening hours" />
          <input className="input" type="number" step="0.1" {...register("rating", { valueAsNumber: true })} placeholder="Rating" />

          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={isSubmitting}>{editing ? "Save" : "Create"}</button>
            {editing && <button type="button" className="btn" onClick={()=>{ setEditing(null); reset(); setAutoSlug(true); }}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================== Curation (real-time, muni filters, indicators) ================== */
function CurationTab({ municipalityId }: { municipalityId: number|null }) {
  // Left (dishes) filters
  const [dishMuni, setDishMuni] = useState<number|null>(municipalityId ?? null);
  const [dishQ, setDishQ] = useState("");
  // Right (restaurants) filters
  const [restoMuni, setRestoMuni] = useState<number|null>(municipalityId ?? null);
  const [restoQ, setRestoQ] = useState("");

  // Lists
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  // Selections
  const [selDishIds, setSelDishIds] = useState<Set<number>>(new Set());
  const [selRestoIds, setSelRestoIds] = useState<Set<number>>(new Set());

  // Loaders (realtime: whenever inputs change)
  useEffect(() => {
    (async () => {
      const qs = new URLSearchParams();
      if (dishMuni) qs.set("municipalityId", String(dishMuni));
      if (dishQ) qs.set("q", dishQ);
      const rows = await jget<Dish[]>(`/api/dishes?${qs.toString()}`);
      setDishes(rows);
      // clean selection if items disappeared
      setSelDishIds(prev => new Set([...prev].filter(id => rows.some(r => r.id === id))));
    })();
  }, [dishMuni, dishQ]);

  useEffect(() => {
    (async () => {
      const qs = new URLSearchParams();
      if (restoMuni) qs.set("municipalityId", String(restoMuni));
      if (restoQ) qs.set("q", restoQ);
      const rows = await jget<Restaurant[]>(`/api/restaurants?${qs.toString()}`);
      setRestaurants(rows);
      setSelRestoIds(prev => new Set([...prev].filter(id => rows.some(r => r.id === id))));
    })();
  }, [restoMuni, restoQ]);

  const toggleDish = (id:number) => setSelDishIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleResto = (id:number) => setSelRestoIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const selectAllDishesVisible = () => setSelDishIds(new Set(dishes.map(d => d.id)));
  const clearAllDishes = () => setSelDishIds(new Set());
  const selectAllRestosVisible = () => setSelRestoIds(new Set(restaurants.map(r => r.id)));
  const clearAllRestos = () => setSelRestoIds(new Set());

  const linkSelected = async () => {
    if (selDishIds.size === 0 || selRestoIds.size === 0) { alert("Select at least one dish and one restaurant."); return; }
    const dishIds = [...selDishIds];
    const restoIds = [...selRestoIds];
    for (const d of dishIds) {
      for (const r of restoIds) {
        await jsend(`/api/admin/dish-restaurants`, { dish_id: d, restaurant_id: r, availability: "regular" }, "POST");
      }
    }
    alert(`Linked ${dishIds.length} dish(es) to ${restoIds.length} restaurant(s).`);
  };

  const unlinkSelected = async () => {
    if (selDishIds.size === 0 || selRestoIds.size === 0) { alert("Select at least one dish and one restaurant."); return; }
    const dishIds = [...selDishIds];
    const restoIds = [...selRestoIds];
    for (const d of dishIds) {
      for (const r of restoIds) {
        const qs = new URLSearchParams({ dishId: String(d), restaurantId: String(r) });
        await jsend(`/api/admin/dish-restaurants?${qs.toString()}`, null, "DELETE");
      }
    }
    alert(`Unlinked ${dishIds.length} dish(es) from ${restoIds.length} restaurant(s).`);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Dishes column */}
      <div className="border rounded p-3">
        <div className="flex items-end gap-2 mb-3">
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">Filter municipality (dishes)</div>
            <MunicipalitySelect value={dishMuni} onChange={setDishMuni} />
          </div>
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">Search dishes</div>
            <input className="input w-full" value={dishQ} onChange={(e)=>setDishQ(e.target.value)} placeholder="Type to filter…" />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-600 mb-2">
          <div>Selected: <b>{selDishIds.size}</b> / {dishes.length}</div>
          <div className="flex gap-2">
            <button className="underline" onClick={selectAllDishesVisible}>Select visible</button>
            <button className="underline" onClick={clearAllDishes}>Clear</button>
          </div>
        </div>

        <div className="max-h-[380px] overflow-auto rounded border">
          <table className="w-full text-sm">
            <tbody>
              {dishes.map(d => (
                <tr key={d.id} className={`border-b ${selDishIds.has(d.id) ? "bg-primary-50" : ""}`}>
                  <td className="p-2 w-8">
                    <input type="checkbox" checked={selDishIds.has(d.id)} onChange={()=>toggleDish(d.id)} />
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-neutral-500">{d.category} • muni:{d.municipality_id}</div>
                  </td>
                </tr>
              ))}
              {dishes.length === 0 && <tr><td className="p-3 text-center text-neutral-500">No dishes.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restaurants column */}
      <div className="border rounded p-3">
        <div className="flex items-end gap-2 mb-3">
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">Filter municipality (restaurants)</div>
            <MunicipalitySelect value={restoMuni} onChange={setRestoMuni} />
          </div>
          <div className="flex-1">
            <div className="text-xs text-neutral-500 mb-1">Search restaurants</div>
            <input className="input w-full" value={restoQ} onChange={(e)=>setRestoQ(e.target.value)} placeholder="Type to filter…" />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-600 mb-2">
          <div>Selected: <b>{selRestoIds.size}</b> / {restaurants.length}</div>
          <div className="flex gap-2">
            <button className="underline" onClick={selectAllRestosVisible}>Select visible</button>
            <button className="underline" onClick={clearAllRestos}>Clear</button>
          </div>
        </div>

        <div className="max-h-[380px] overflow-auto rounded border">
          <table className="w-full text-sm">
            <tbody>
              {restaurants.map(r => (
                <tr key={r.id} className={`border-b ${selRestoIds.has(r.id) ? "bg-primary-50" : ""}`}>
                  <td className="p-2 w-8">
                    <input type="checkbox" checked={selRestoIds.has(r.id)} onChange={()=>toggleResto(r.id)} />
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-neutral-500">{r.kind} • muni:{r.municipality_id ?? "—"}</div>
                  </td>
                </tr>
              ))}
              {restaurants.length === 0 && <tr><td className="p-3 text-center text-neutral-500">No restaurants.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="md:col-span-2 flex items-center justify-between">
        <div className="text-sm text-neutral-600">
          Linking: <b>{selDishIds.size}</b> dish(es) × <b>{selRestoIds.size}</b> restaurant(s)
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={unlinkSelected}>Unlink selected</button>
          <button className="btn btn-primary" onClick={linkSelected}>Link selected</button>
        </div>
      </div>
    </div>
  );
}
