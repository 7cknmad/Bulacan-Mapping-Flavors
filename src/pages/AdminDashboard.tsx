import { useEffect, useState } from 'react';
import { useAdminAuth } from '../admin/useAdminAuth';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export default function AdminDashboard() {
  const { me, loading } = useAdminAuth();
  const [overview, setOverview] = useState<any>(null);
  const [topDishes, setTopDishes] = useState<any[]>([]);
  const [topRestos, setTopRestos] = useState<any[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!me?.ok) { window.location.href = '/#/admin/login'; return; }
    (async () => {
      const [a,b,c] = await Promise.all([
        fetch(`${API}/api/admin/stats/overview`, { credentials:'include' }).then(r=>r.json()),
        fetch(`${API}/api/admin/stats/top-dishes?limit=7`, { credentials:'include' }).then(r=>r.json()),
        fetch(`${API}/api/admin/stats/top-restaurants?limit=7`, { credentials:'include' }).then(r=>r.json()),
      ]);
      setOverview(a); setTopDishes(b); setTopRestos(c);
    })();
  }, [loading, me]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!me?.ok) return null;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Admin Analytics</h1>

      {overview && (
        <div className="grid sm:grid-cols-3 gap-4">
          <StatCard label="Municipalities" value={overview.municipalities} />
          <StatCard label="Dishes / Delicacies" value={`${overview.dishes} / ${overview.delicacies}`} />
          <StatCard label="Restaurants" value={overview.restaurants} />
          <StatCard label="Links" value={overview.links} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <ChartCard title="Top Dishes (by places)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topDishes}>
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="places" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Restaurants (by dish count)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topRestos}>
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="dishes" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function StatCard({ label, value }: any) {
  return (
    <div className="p-4 rounded-lg border bg-white shadow-sm">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
function ChartCard({ title, children }: any) {
  return (
    <div className="p-4 rounded-lg border bg-white shadow-sm">
      <div className="font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}
