import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import ErrorBoundary from "../common/ErrorBoundary";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MunicipalityCard from '../cards/MunicipalityCard';
import { AnimatePresence } from "framer-motion";

type UIMunicipality = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  coordinates: [number, number];
};

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createCustomIcon = (color: string) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

const MapUpdate: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.75, easeLinearity: 0.25 });
  }, [center, zoom, map]);
  return null;
};

interface InteractiveMapProps {
  highlightedMunicipality?: string;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ highlightedMunicipality }) => {
  const bulacanCenter: [number, number] = useMemo(() => [14.8527, 120.816], []);
  const [municipalities, setMunicipalities] = useState<UIMunicipality[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedMunicipality, setSelectedMunicipality] = useState<UIMunicipality | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(bulacanCenter);
  const [mapZoom, setMapZoom] = useState<number>(10);

  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`${API}/api/municipalities`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows: Array<{
          id: number; name: string; slug: string; description: string | null;
          lat: number | string; lng: number | string;
        }> = await res.json();
        if (cancelled) return;
        const uiRows: UIMunicipality[] = rows.map((r) => ({
          id: r.id, slug: r.slug, name: r.name, description: r.description,
          coordinates: [Number(r.lat), Number(r.lng)],
        }));
        setMunicipalities(uiRows);
      } catch (e: any) {
        if (!cancelled) setErrorMsg(e?.message || 'Failed to load municipalities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!highlightedMunicipality || municipalities.length === 0) return;
    const maybeId = Number(highlightedMunicipality);
    const match =
      municipalities.find((m) => m.slug === highlightedMunicipality) ??
      (Number.isFinite(maybeId) ? municipalities.find((m) => m.id === maybeId) : undefined);

    if (match) {
      setSelectedMunicipality(match);
      setMapCenter(match.coordinates);
      setMapZoom(12);
      mapRef.current?.flyTo(match.coordinates, 12, { duration: 0.75, easeLinearity: 0.25 });
    }
  }, [highlightedMunicipality, municipalities]);

  const handleMarkerClick = (m: UIMunicipality) => {
    setSelectedMunicipality(m);
    setMapCenter(m.coordinates);
    setMapZoom(12);
    mapRef.current?.flyTo(m.coordinates, 12, { duration: 0.75, easeLinearity: 0.25 });
  };

  const resetMap = () => {
    setSelectedMunicipality(null);
    setMapCenter(bulacanCenter);
    setMapZoom(10);
    mapRef.current?.flyTo(bulacanCenter, 10, { duration: 0.75, easeLinearity: 0.25 });
  };

  return (
    <div
  className={`relative h-[500px] md:h-[600px] lg:h-[700px] w-full rounded-lg overflow-hidden shadow-lg ${
    selectedMunicipality ? "panel-open" : ""
  }`}
>
      <MapContainer
        center={bulacanCenter}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        whenCreated={(map) => { mapRef.current = map; }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdate center={mapCenter} zoom={mapZoom} />

        {!loading && !errorMsg && municipalities.map((m) => (
          <Marker
            key={m.id}
            position={m.coordinates}
            icon={createCustomIcon(m.id === selectedMunicipality?.id ? 'red' : 'blue')}
            eventHandlers={{ click: () => handleMarkerClick(m) }}
          >
            <Popup>
              <div className="font-semibold">{m.name}</div>
              <div className="text-sm">{(m.description ?? '').substring(0, 100)}...</div>
              <button
                className="text-primary-600 text-sm font-medium mt-1 hover:underline"
                onClick={() => handleMarkerClick(m)}
              >
                View Details
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <AnimatePresence initial={false} mode="wait">
        {selectedMunicipality && (
          <div className="absolute top-4 right-4 w-full md:w-96 lg:w-[520px] z-[400]">
            <ErrorBoundary fallbackTitle="Panel error">
              {/* key ensures smooth cross-fade when switching between municipalities */}
              <MunicipalityCard
                key={selectedMunicipality.id}
                municipality={selectedMunicipality as any}
                onClose={resetMap}
              />
            </ErrorBoundary>
          </div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-4 left-4 z-[400] bg-white px-4 py-2 rounded-md shadow-md">
        <h3 className="font-medium text-sm">Bulacan Province</h3>
        <p className="text-xs text-neutral-600">
          {loading ? 'Loading municipalities…' : errorMsg ? 'Failed to load municipalities' : 'Click on markers to explore municipalities'}
        </p>
      </div>
    </div>
  );
};

export default InteractiveMap;
