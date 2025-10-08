import React, { useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const sjdmId = 1;

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
function csvToJsonArray(s: string) {
  const arr = s
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
  return JSON.stringify(arr);
}

export default function Admin() {
  // --- Restaurant form state ---
  const [rName, setRName] = useState("");
  const rSlug = useMemo(() => slugify(rName ? `${rName}-sjdm` : ""), [rName]);
  const [rKind, setRKind] = useState<"restaurant"|"stall"|"store"|"dealer"|"market"|"home-based">("restaurant");
  const [rAddress, setRAddress] = useState("San Jose del Monte, Bulacan (exact address TBD)");
  const [rLat, setRLat] = useState("14.84");
  const [rLng, setRLng] = useState("121.05");
  const [rPrice, setRPrice] = useState<"budget"|"moderate"|"expensive">("moderate");
  const [rCuisines, setRCuisines] = useState("Filipino, Casual");
  const [rDesc, setRDesc] = useState("");
  const [rMsg, setRMsg] = useState<string | null>(null);

  // --- Dish form state ---
  const [dName, setDName] = useState("");
  const dSlug = useMemo(() => slugify(dName ? `${dName}-sjdm` : ""), [dName]);
  const [dCategory, setDCategory] = useState<"food"|"delicacy"|"drink">("food");
  const [dDesc, setDDesc] = useState("");
  const [dFlavors, setDFlavors] = useState("savory");
  const [dIngs, setDIngs] = useState("");
  const [dImage, setDImage] = useState("");
  const [dPopularity, setDPopularity] = useState("70");
  const [dRating, setDRating] = useState("0");
  const [dMsg, setDMsg] = useState<string | null>(null);

  // --- Link form state ---
  const [linkDishId, setLinkDishId] = useState("");
  const [linkRestId, setLinkRestId] = useState("");
  const [linkPrice, setLinkPrice] = useState("");
  const [linkAvail, setLinkAvail] = useState<"regular"|"seasonal"|"preorder">("regular");
  const [lMsg, setLMsg] = useState<string | null>(null);

  async function postJSON(url: string, body: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    try { return JSON.parse(text); } catch { return text; }
  }

  async function handleCreateRestaurant(e: React.FormEvent) {
    e.preventDefault();
    setRMsg(null);
    try {
      const payload = {
        municipality_id: sjdmId,
        name: rName,
        slug: rSlug,
        kind: rKind,
        address: rAddress,
        lat: Number(rLat),
        lng: Number(rLng),
        price_range: rPrice,
        cuisine_types: JSON.parse(csvToJsonArray(rCuisines)),
        description: rDesc || null
      };
      const data = await postJSON(`${API}/api/admin/restaurants`, payload);
      setRMsg(`✅ Saved restaurant id=${data?.id ?? "?"}`);
    } catch (err: any) {
      setRMsg(`❌ ${err.message || String(err)}`);
    }
  }

  async function handleCreateDish(e: React.FormEvent) {
    e.preventDefault();
    setDMsg(null);
    try {
      const payload = {
        municipality_id: sjdmId,
        category_code: dCategory,
        name: dName,
        slug: dSlug,
        description: dDesc || null,
        flavor_profile: JSON.parse(csvToJsonArray(dFlavors)),
        ingredients: JSON.parse(csvToJsonArray(dIngs)),
        image_url: dImage || null,
        popularity: Number(dPopularity || 0),
        rating: Number(dRating || 0),
      };
      const data = await postJSON(`${API}/api/admin/dishes`, payload);
      setDMsg(`✅ Saved dish id=${data?.id ?? "?"}`);
    } catch (err: any) {
      setDMsg(`❌ ${err.message || String(err)}`);
    }
  }

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setLMsg(null);
    try {
      const payload = {
        dish_id: Number(linkDishId),
        restaurant_id: Number(linkRestId),
        price_note: linkPrice || null,
        availability: linkAvail
      };
      const data = await postJSON(`${API}/api/admin/dish-restaurants`, payload);
      setLMsg(`✅ Linked (dish_id=${payload.dish_id}, restaurant_id=${payload.restaurant_id})`);
    } catch (err: any) {
      setLMsg(`❌ ${err.message || String(err)}`);
    }
  }

  return (
    <div className="pt-20 pb-16 min-h-screen bg-neutral-50">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="mb-6">Admin • Quick Data Entry (SJDM)</h1>

        {/* Add Restaurant */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="mb-4">Add Restaurant / Stall / Store</h2>
          <form onSubmit={handleCreateRestaurant} className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col">
              <span className="text-sm mb-1">Name *</span>
              <input className="input" value={rName} onChange={e=>setRName(e.target.value)} required />
            </label>
            <label className="flex flex-col">
              <span className="text-sm mb-1">Slug (auto)</span>
              <input className="input bg-neutral-100" value={rSlug} readOnly />
            </label>

            <label className="flex flex-col">
              <span className="text-sm mb-1">Kind</span>
              <select className="input" value={rKind} onChange={e=>setRKind(e.target.value as any)}>
                <option>restaurant</option><option>stall</option><option>store</option>
                <option>dealer</option><option>market</option><option>home-based</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-sm mb-1">Price range</span>
              <select className="input" value={rPrice} onChange={e=>setRPrice(e.target.value as any)}>
                <option>budget</option><option>moderate</option><option>expensive</option>
              </select>
            </label>

            <label className="flex flex-col md:col-span-2">
              <span className="text-sm mb-1">Address *</span>
              <input className="input" value={rAddress} onChange={e=>setRAddress(e.target.value)} required />
            </label>

            <label className="flex flex-col">
              <span className="text-sm mb-1">Latitude *</span>
              <input className="input" value={rLat} onChange={e=>setRLat(e.target.value)} required />
            </label>
            <label className="flex flex-col">
              <span className="text-sm mb-1">Longitude *</span>
              <input className="input" value={rLng} onChange={e=>setRLng(e.target.value)} required />
            </label>

            <label className="flex flex-col md:col-span-2">
              <span className="text-sm mb-1">Cuisines (comma)</span>
              <input className="input" value={rCuisines} onChange={e=>setRCuisines(e.target.value)} />
            </label>
            <label className="flex flex-col md:col-span-2">
              <span className="text-sm mb-1">Description</span>
              <textarea className="input min-h-[72px]" value={rDesc} onChange={e=>setRDesc(e.target.value)} />
            </label>

            <div className="md:col-span-2 flex items-center gap-3">
              <button className="btn btn-primary" type="submit">Save Restaurant</button>
              {rMsg && <div className="text-sm">{rMsg}</div>}
            </div>
          </form>
        </div>

        {/* Add Dish */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="mb-4">Add Dish (SJDM)</h2>
          <form onSubmit={handleCreateDish} className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col">
              <span className="text-sm mb-1">Name *</span>
              <input className="input" value={dName} onChange={e=>setDName(e.target.value)} required />
            </label>
            <label className="flex flex-col">
              <span className="text-sm mb-1">Slug (auto)</span>
              <input className="input bg-neutral-100" value={dSlug} readOnly />
            </label>

            <label className="flex flex-col">
              <span className="text-sm mb-1">Category *</span>
              <select className="input" value={dCategory} onChange={e=>setDCategory(e.target.value as any)}>
                <option>food</option><option>delicacy</option><option>drink</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-sm mb-1">Image URL</span>
              <input className="input" value={dImage} onChange={e=>setDImage(e.target.value)} />
            </label>

            <label className="flex flex-col md:col-span-2">
              <span className="text-sm mb-1">Short description</span>
              <textarea className="input min-h-[72px]" value={dDesc} onChange={e=>setDDesc(e.target.value)} />
            </label>

            <label className="flex flex-col">
              <span className="text-sm mb-1">Flavor profile (comma)</span>
              <input className="input" placeholder="savory, spicy" value={dFlavors} onChange={e=>setDFlavors(e.target.value)} />
            </label>
            <label className="flex flex-col">
              <span className="text-sm mb-1">Ingredients (comma)</span>
              <input className="input" placeholder="pork, garlic" value={dIngs} onChange={e=>setDIngs(e.target.value)} />
            </label>

            <label className="flex flex-col">
              <span className="text-sm mb-1">Popularity (0–100)</span>
              <input className="input" value={dPopularity} onChange={e=>setDPopularity(e.target.value)} />
            </label>
            <label className="flex flex-col">
              <span className="text-sm mb-1">Rating (0–5)</span>
              <input className="input" value={dRating} onChange={e=>setDRating(e.target.value)} />
            </label>

            <div className="md:col-span-2 flex items-center gap-3">
              <button className="btn btn-primary" type="submit">Save Dish</button>
              {dMsg && <div className="text-sm">{dMsg}</div>}
            </div>
          </form>
        </div>

        {/* Link Dish ⇄ Restaurant */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="mb-4">Link Dish ⇄ Restaurant</h2>
          <form onSubmit={handleLink} className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col">
              <span className="text-sm mb-1">Dish ID *</span>
              <input className="input" value={linkDishId} onChange={e=>setLinkDishId(e.target.value)} required />
            </label>
            <label className="flex flex-col">
              <span className="text-sm mb-1">Restaurant ID *</span>
              <input className="input" value={linkRestId} onChange={e=>setLinkRestId(e.target.value)} required />
            </label>

            <label className="flex flex-col">
              <span className="text-sm mb-1">Price note</span>
              <input className="input" placeholder="₱120/serving" value={linkPrice} onChange={e=>setLinkPrice(e.target.value)} />
            </label>
            <label className="flex flex-col">
              <span className="text-sm mb-1">Availability</span>
              <select className="input" value={linkAvail} onChange={e=>setLinkAvail(e.target.value as any)}>
                <option>regular</option><option>seasonal</option><option>preorder</option>
              </select>
            </label>

            <div className="md:col-span-2 flex items-center gap-3">
              <button className="btn btn-primary" type="submit">Create Link</button>
              {lMsg && <div className="text-sm">{lMsg}</div>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
