import { useEffect, useState } from 'react';
export function useAdminAuth() {
  const [me, setMe] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/me`, { credentials: 'include' });
        setMe(res.ok ? await res.json() : null);
      } catch { setMe(null); }
      finally { setLoading(false); }
    })();
  }, []);
  return { me, loading };
}
