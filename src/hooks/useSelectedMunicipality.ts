import { useState, useCallback } from 'react';

export function useSelectedMunicipality<T extends { id: number }>() {
  const [selected, setSelected] = useState<T | null>(null);

  const select = useCallback((m: T) => setSelected(m), []);
  const clear = useCallback(() => setSelected(null), []);

  return { selected, select, clear };
}
