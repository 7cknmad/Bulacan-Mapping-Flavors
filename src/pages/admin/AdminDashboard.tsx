// src/pages/admin/AdminDashboard.tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminStats, type Overview, type TopDish, type TopRestaurant } from "../../utils/adminApi";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#2563eb", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6", "#a855f7"];

export default function AdminDashboard() {
  const [muniFilter, setMuniFilter] = useState<number | undefined>(undefined);

  const overviewQ = useQuery<Overview>({
    queryKey: ["admin:stats:overview"],
    queryFn: adminStats.overview,
    staleTime: 60_000,
  });

  const topDishesQ = useQuery<TopDish[]>({
    queryKey: ["admin:stats:top-dishes", muniFilter],
    queryFn: () => adminStats.topDishes(muniFilter, undefined, 8),
    staleTime: 60_000,
  });

  const topRestaurantsQ = useQuery<TopRestaurant[]>({
    queryKey: ["admin:stats:top-restaurants", muniFilter],
    queryFn: () => adminStats.topRestaurants(muniFilter, 8),
    staleTime: 60_000,
  });

  const barData = useMemo(() => {
    const o = overviewQ.data;
    if (!o) return [];
    return [
      { name: "Municipalities", value: o.municipalities ?? 0 },
      { name: "Dishes", value: o.dishes ?? 0 },
      { name: "Delicacies", value: o.delicacies ?? 0 },
      { name: "Restaurants", value: o.restaurants ?? 0 },
      { name: "Links", value: o.links ?? 0 },
    ];
  }, [overviewQ.data]);

  const pieData = useMemo(() => {
    const ds = topDishesQ.data ?? [];
    return ds.map((d) => ({ name: d.name, value: Math.max(1, d.places), id: d.id }));
  }, [topDishesQ.data]);

  return (
    <main className="mx-auto max-w-7xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-neutral-600">Overview & quick analytics</p>
      </header>

      {/* Filters (keep minimal for now; wire to your MunicipalitySelect later if you like) */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm text-neutral-600">Municipality filter (ID):</label>
        <input
          type="number"
          className="border rounded px-2 py-1 w-32"
          placeholder="(all)"
          value={muniFilter ?? ""}
          onChange={(e) => setMuniFilter(e.target.value ? Number(e.target.value) : undefined)}
        />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Municipalities", val: overviewQ.data?.municipalities ?? 0 },
          { label: "Dishes", val: overviewQ.data?.dishes ?? 0 },
          { label: "Delicacies", val: overviewQ.data?.delicacies ?? 0 },
          { label: "Restaurants", val: overviewQ.data?.restaurants ?? 0 },
          { label: "Links", val: overviewQ.data?.links ?? 0 },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="text-sm text-neutral-500">{c.label}</div>
            <div className="text-2xl font-semibold">{c.val}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="font-medium mb-2">Inventory</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={barData}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="font-medium mb-2">Top Dishes (by places linked)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} nameKey="name" dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 text-sm text-neutral-700 list-disc pl-5">
            {(topDishesQ.data ?? []).map((d) => (
              <li key={d.id}>
                {d.name} — {d.places} place{d.places === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8 rounded-lg border bg-white p-4 shadow-sm">
        <div className="font-medium mb-2">Top Restaurants (by dishes linked)</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Slug</th>
                <th className="py-2 pr-4">Dishes Linked</th>
                <th className="py-2 pr-4">Rank</th>
              </tr>
            </thead>
            <tbody>
              {(topRestaurantsQ.data ?? []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 pr-4">{r.name}</td>
                  <td className="py-2 pr-4 text-neutral-500">{r.slug}</td>
                  <td className="py-2 pr-4">{r.dishes}</td>
                  <td className="py-2 pr-4">{r.rank_hint ?? "-"}</td>
                </tr>
              ))}
              {topRestaurantsQ.data?.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-neutral-500">No data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Error stripes — non-fatal */}
      {(overviewQ.error || topDishesQ.error || topRestaurantsQ.error) && (
        <div className="mt-6 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
          Some analytics failed to load. You can still use the dashboard. (Check API logs / cookies / CORS.)
        </div>
      )}
    </main>
  );
}
