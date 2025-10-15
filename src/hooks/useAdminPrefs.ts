// src/hooks/useAdminPrefs.ts
import { useEffect, useState } from "react";

const KEY = "admin:lastMuniId";

export function useAdminMuniPref() {
  const [muniId, setMuniId] = useState<number | null>(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  });

  useEffect(() => {
    if (muniId === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(muniId));
  }, [muniId]);

  return { muniId, setMuniId };
}
