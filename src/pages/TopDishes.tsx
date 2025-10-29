
import { useQuery } from '@tanstack/react-query';
import { fetchTopDishes, type Dish } from '../utils/api';
import DishCard from '../components/cards/DishCard';
import { motion } from 'framer-motion';
import { useSearchParams, Link } from 'react-router-dom';

export default function TopDishes(){
  const [params] = useSearchParams();
  const municipalityId = Number(params.get('municipalityId') || '');

  const topQ = useQuery<Dish[]>({
    queryKey: ['top-dishes', municipalityId || 'all'],
    queryFn: () => fetchTopDishes(municipalityId || 0),
    enabled: !!(Number.isFinite(municipalityId) || municipalityId === 0),
    staleTime: 30_000,
  });

  const rows = topQ.data ?? [];
  const total = rows.length;

  return (
    <motion.div className="pt-16 pb-16 bg-neutral-50 min-h-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22 }}>
      <div className="container mx-auto px-4">
        <div className="mb-4 mt-6 flex items-center justify-between">
          <div>
            <h1 className="mb-1">Top dishes{municipalityId ? ` — municipality ${municipalityId}` : ''}</h1>
            <p className="text-neutral-600">Top-rated dishes based on aggregated server data.</p>
          </div>
          <Link to="/dishes" className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-neutral-50">← Back to Dishes</Link>
        </div>

        {topQ.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="skeleton rounded h-40" />))}
          </div>
        ) : topQ.error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700">{(topQ.error as Error).message || 'Error loading top dishes.'}</div>
        ) : total === 0 ? (
          <div className="p-10 text-center text-neutral-500 bg-white border rounded-lg">No top dishes found for this municipality.</div>
        ) : (
          <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rows.map((d) => (
              <motion.div key={d.id} layout>
                <DishCard dish={d} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
