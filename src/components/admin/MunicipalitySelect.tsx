// src/components/admin/MunicipalitySelect.tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMunicipalities, type Municipality } from "../../utils/api";

type Props = {
  value?: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  allowAll?: boolean;
};

export default function MunicipalitySelect({
  value, onChange, placeholder = "Select municipality…", allowAll = true,
}: Props) {
  const [q, setQ] = useState("");
  const muniQ = useQuery<Municipality[]>({
    queryKey: ["admin:municipalities"],
    queryFn: fetchMunicipalities,
    staleTime: 5 * 60_000,
  });

  const options = useMemo(() => {
    const base = (muniQ.data ?? []).map((m) => ({ id: m.id, label: `${m.name} (${m.slug})` }));
    if (!q.trim()) return base;
    const s = q.toLowerCase();
    return base.filter((o) => o.label.toLowerCase().includes(s));
  }, [muniQ.data, q]);

  const current = options.find((o) => o.id === value) ?? null;

  return (
    <div className="relative">
      <input
        className="border rounded px-3 py-2 w-72"
        placeholder={current ? current.label : placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="absolute left-0 right-0 mt-1 bg-white border rounded shadow max-h-64 overflow-auto z-[1000]">
        {allowAll && (
          <button
            className="w-full text-left px-3 py-2 hover:bg-neutral-50"
            onClick={() => { onChange(null); setQ(""); }}
          >
            All municipalities
          </button>
        )}
        {options.map((o) => (
          <button
            key={o.id}
            className="w-full text-left px-3 py-2 hover:bg-neutral-50"
            onClick={() => { onChange(o.id); setQ(o.label); }}
          >
            {o.label}
          </button>
        ))}
        {options.length === 0 && (
          <div className="px-3 py-2 text-sm text-neutral-500">No results</div>
        )}
      </div>
    </div>
  );
}
