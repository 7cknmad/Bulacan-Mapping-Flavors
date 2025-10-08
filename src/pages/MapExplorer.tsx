import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import InteractiveMap from "../components/map/InteractiveMap";
import { fetchMunicipalities, type Municipality } from "../utils/api";

const MapExplorer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const municipalitySlug = searchParams.get("municipality"); // optional ?municipality=<slug>

  const munisQ = useQuery<Municipality[]>({
    queryKey: ["municipalities"],
    queryFn: fetchMunicipalities,
  });

  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);

  // If a slug is in the URL, pre-select that municipality
  useEffect(() => {
    if (!munisQ.data) return;
    if (municipalitySlug) {
      const match = munisQ.data.find((m) => m.slug === municipalitySlug) || null;
      setSelectedMunicipality(match);
    }
  }, [munisQ.data, municipalitySlug]);

  const handleMunicipalityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "all") {
      setSelectedMunicipality(null);
    } else {
      const m = munisQ.data?.find((x) => String(x.id) === val) || null;
      setSelectedMunicipality(m);
    }
  };

  return (
    <div className="pt-16 pb-16 bg-neutral-50 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="mb-8 mt-8">
          <h1 className="mb-4">Explore Bulacan's Culinary Map</h1>
          <p className="text-neutral-700 max-w-3xl">
            Click any municipality to see its highlights. Signature dishes are shown in the side
            panel—no duplicate grid below for a cleaner, focused experience.
          </p>
        </div>

        {/* Municipality select (optional quick jump) */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex items-center gap-3">
          <label htmlFor="municipality" className="font-medium text-neutral-700">
            Municipality:
          </label>

          {munisQ.isLoading ? (
            <div className="text-sm text-neutral-500">Loading…</div>
          ) : munisQ.error ? (
            <div className="text-sm text-red-600">Failed to load municipalities.</div>
          ) : (
            <select
              id="municipality"
              className="input max-w-xs"
              onChange={handleMunicipalityChange}
              value={selectedMunicipality?.id ?? "all"}
            >
              <option value="all">All Municipalities</option>
              {munisQ.data!.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Interactive Map (side panel shows the signature dishes) */}
        <div className="rounded-lg overflow-hidden shadow-lg">
          {/* InteractiveMap accepts either a slug or an id-as-string.
             We pass id as string for precision. */}
          <InteractiveMap
            highlightedMunicipality={
              selectedMunicipality ? String(selectedMunicipality.id) : undefined
            }
          />
        </div>
      </div>
    </div>
  );
};

export default MapExplorer;
