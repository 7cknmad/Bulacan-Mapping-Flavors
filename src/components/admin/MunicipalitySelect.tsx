import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMunicipalities, type Municipality } from "../../utils/api";

type Props = {
  value?: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  allowAll?: boolean;
  label?: string;
  className?: string;
  disabled?: boolean;
};

export default function MunicipalitySelect({
  value,
  onChange,
  placeholder = "Select municipality…",
  allowAll = true,
  label = "Municipality",
  className = "w-72",
  disabled = false,
}: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const muniQ = useQuery<Municipality[]>({
    queryKey: ["admin:municipalities"],
    queryFn: fetchMunicipalities,
    staleTime: 5 * 60_000,
  });

  // Build options and filter by search
  const options = useMemo(() => {
    const base =
      (muniQ.data ?? []).map((m) => ({
        id: m.id,
        label: `${m.name} (${m.slug})`,
      })) || [];
    if (!q.trim()) return base;
    const s = q.toLowerCase();
    return base.filter((o) => o.label.toLowerCase().includes(s));
  }, [muniQ.data, q]);

  // Current selected label
  const selected = useMemo(
    () => (muniQ.data ?? []).find((m) => m.id === value) || null,
    [muniQ.data, value]
  );

  // Keep the input display synced when value changes externally
  useEffect(() => {
    if (!selected) {
      setQ("");
      return;
    }
    setQ(`${selected.name} (${selected.slug})`);
  }, [selected?.id]);

  // Close on outside click / Esc
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const pick = (id: number | null, labelText?: string) => {
    onChange(id);
    setQ(id ? labelText ?? q : "");
    setOpen(false);
  };

  const busy = muniQ.isLoading;
  const err = muniQ.error as Error | null;

  return (
    <label className={`block ${className}`} ref={wrapRef}>
      <div className="text-xs font-medium text-neutral-600 mb-1">{label}</div>

      <div className={`relative ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
        <input
          className="border rounded px-3 py-2 w-full text-sm pr-9"
          placeholder={placeholder}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <button
          type="button"
          className="absolute right-1 top-1.5 px-2 py-1 text-neutral-500 hover:text-neutral-700"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle municipalities"
        >
          ▾
        </button>

        {open && (
          <div className="absolute left-0 right-0 mt-1 bg-white border rounded shadow max-h-64 overflow-auto z-[1000]">
            {busy && (
              <div className="px-3 py-2 text-sm text-neutral-500">Loading…</div>
            )}
            {err && (
              <div className="px-3 py-2 text-sm text-red-600">
                Failed to load municipalities
              </div>
            )}

            {!busy && !err && allowAll && (
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-neutral-50 text-sm"
                onClick={() => pick(null)}
              >
                All municipalities
              </button>
            )}

            {!busy && !err && options.map((o) => (
              <button
                type="button"
                key={o.id}
                className={`w-full text-left px-3 py-2 hover:bg-neutral-50 text-sm ${
                  value === o.id ? "bg-amber-50" : ""
                }`}
                onClick={() => pick(o.id, o.label)}
              >
                {o.label}
              </button>
            ))}

            {!busy && !err && options.length === 0 && (
              <div className="px-3 py-2 text-sm text-neutral-500">No results</div>
            )}
          </div>
        )}
      </div>
    </label>
  );
}
