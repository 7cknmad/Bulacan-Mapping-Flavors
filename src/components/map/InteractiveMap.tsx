import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useSelectedMunicipality } from '../../hooks/useSelectedMunicipality';
import { useRecentVisits, type RecentVisit } from '../../hooks/useRecentVisits';
import MapSearch from './MapSearch';
import { MapContainer, TileLayer, GeoJSON, useMapEvent, CircleMarker, Popup } from 'react-leaflet';
import { resolvePath } from '../../utils/baseUrl';
import RecentVisitsPanel from './RecentVisitsPanel';
import SavedPlacesPanel from './SavedPlacesPanel';
import UserLocationMarker from './UserLocationMarker';
import RestaurantMarker from './RestaurantMarker';
import MarkerClusterGroup from './MarkerClusterGroup';
import MunicipalityLabel from './MunicipalityLabel';
import MapControlPanel from './MapControlPanel';
import RadiusOverlay from './RadiusOverlay';
import './map.css';
// Component to handle map background clicks
const MapClickHandler: React.FC<{ onMapClick: (e: L.LeafletMouseEvent) => void }> = ({ onMapClick }) => {
  useMapEvent('click', onMapClick);
  return null;
};
import ErrorBoundary from "../common/ErrorBoundary";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MunicipalityCard from '../cards/MunicipalityCard';
import { AnimatePresence } from "framer-motion";
import { fetchTopRestaurants, fetchRestaurantsCached } from '../../utils/api';


interface UIMunicipality {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  coordinates: [number, number];
}

type RestMarker = {
  id: number;
  name: string;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}

type InteractiveMapProps = {
  highlightedMunicipality?: string;
  fullScreen?: boolean;
  compact?: boolean; // small preview mode
  // optional external restaurant markers (from list pages) to show on the map
  restaurantMarkers?: Array<RestMarker> | null;
  // optional override of user location (lat,lng)
  userLocationOverride?: [number, number] | null;
}



const InteractiveMap: React.FC<InteractiveMapProps> = ({ highlightedMunicipality, fullScreen = false, compact = false, restaurantMarkers = null, userLocationOverride = null }) => {
  const [searchRadius, setSearchRadius] = useState<number>(5);
  const [sortByDistance, setSortByDistance] = useState<boolean>(false);
  const { addVisit } = useRecentVisits();
  const bulacanCenter: [number, number] = useMemo(() => [14.8527, 120.816], []);
  const [bulacanGeoJson, setBulacanGeoJson] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { selected: selectedMunicipality, select, clear } = useSelectedMunicipality<UIMunicipality>();
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(bulacanCenter);
  const [focusedRestaurants, setFocusedRestaurants] = useState<RestMarker[]>([]);
  const [mapZoom, setMapZoom] = useState<number>(10);
  const mapRef = useRef<L.Map | null>(null);
  const MAP_MIN_ZOOM = 8;
  const MAP_MAX_ZOOM = 15;
  const initialFitDone = useRef(false);
  const [tileStyle, setTileStyle] = useState<'osm'|'voyager'>('osm');
  const [query, setQuery] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const locationLayerRef = useRef<{ outer?: L.Circle; halo?: L.CircleMarker; marker?: L.CircleMarker } | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; feature: any }>>([]);
  // View-direction (client-side) — shows a viewing cone from user location and optionally filters markers
  const [viewDirectionEnabled, setViewDirectionEnabled] = useState<boolean>(false);
  const [bearingDeg, setBearingDeg] = useState<number>(0); // 0-359
  const [coneWidthDeg, setConeWidthDeg] = useState<number>(60); // cone width in degrees
  const [useDeviceCompass, setUseDeviceCompass] = useState<boolean>(false);
  const [sectorGeoJson, setSectorGeoJson] = useState<any | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const debounceRef = useRef<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const isOpen = !!selectedMunicipality;
  // Refs for search input / container to manage focus and outside clicks
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  // highlighted place coming from the modal (dish/restaurant hover)
  const [highlightedPlaceCoords, setHighlightedPlaceCoords] = useState<[number, number] | null>(null);
  const [highlightedPlaceName, setHighlightedPlaceName] = useState<string | null>(null);
  const highlightLayerRef = useRef<L.Layer | null>(null);
  const [highlightedPlaceType, setHighlightedPlaceType] = useState<'dish'|'restaurant'|null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  // Effect to highlight a specific restaurant on mount if provided in restaurantMarkers
  useEffect(() => {
    if (!restaurantMarkers || restaurantMarkers.length !== 1) return;
    
    const restaurant = restaurantMarkers[0];
    if (typeof restaurant.lat === 'number' && typeof restaurant.lng === 'number') {
      setHighlightedPlaceCoords([restaurant.lat, restaurant.lng]);
      setHighlightedPlaceName(restaurant.name);
      setHighlightedPlaceType('restaurant');
      
      // Fly to the restaurant with a slight delay to ensure map is ready
      setTimeout(() => {
        mapRef.current?.flyTo([restaurant.lat, restaurant.lng], 15, { duration: 0.6 });
      }, 100);
    }
  }, [restaurantMarkers]);


  // Local component: instructions shown to first-time visitors
  const InstructionsKey = 'bulacan_map_instructions_dismissed_v1';
  const MapInstructions: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const [visible, setVisible] = useState<boolean>(() => {
      try {
        return !Boolean(window.localStorage.getItem(InstructionsKey));
      } catch (err) {
        return true;
      }
    });

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setVisible(false);
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    if (!visible) return null;

    const dismissPermanently = () => {
      try { window.localStorage.setItem(InstructionsKey, '1'); } catch (err) {}
      setVisible(false);
      onClose?.();
    };

    const remindLater = () => {
      setVisible(false);
      onClose?.();
    };

    return (
      <div className="absolute inset-0 z-[1200] flex items-start justify-center pointer-events-none">
        <div className="pointer-events-auto mt-16 w-[min(680px,95%)] bg-white/95 backdrop-blur-md rounded-lg shadow-lg p-4 text-sm text-neutral-800">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h4 className="font-semibold">Explore Bulacan</h4>
              <p className="mt-1 text-xs text-neutral-600">Use the map to explore municipalities. Click a polygon to open details, use the search box to jump to a place, or use the floating controls to locate and change map style.</p>
              <ul className="mt-2 text-xs list-disc pl-4 text-neutral-600">
                <li>Click a municipality polygon to open its panel.</li>
                <li>Search from the top-left box — keyboard navigation supported.</li>
                <li>Use the locate or style buttons on the top-right.</li>
              </ul>
              <div className="mt-3 flex gap-2">
                <button onClick={dismissPermanently} className="px-3 py-1 rounded bg-primary-600 text-white text-xs">Got it — don't show again</button>
                <button onClick={remindLater} className="px-3 py-1 rounded border text-xs">Remind me later</button>
              </div>
            </div>
            <div className="text-xs text-neutral-500">{loading ? 'Loading boundaries…' : errorMsg ? 'Boundary data failed' : ''}</div>
          </div>
        </div>
      </div>
    );
  };

  // Load Bulacan GeoJSON boundaries
  useEffect(() => {
    setLoading(true);
    const fetchGeoJSON = async () => {
      try {
        const response = await fetch(resolvePath('/geo/export.geojson'));
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setBulacanGeoJson(data);
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
        setErrorMsg('Failed to load Bulacan boundaries');
      } finally {
        setLoading(false);
      }
    };
    fetchGeoJSON();
  }, []);

  // Imperatively manage the highlight layer when coords change
  useEffect(() => {
    if (!mapRef.current) return;
    try {
      // remove existing
      if (highlightLayerRef.current) {
        try { mapRef.current.removeLayer(highlightLayerRef.current); } catch (err) {}
        highlightLayerRef.current = null;
      }
      if (!highlightedPlaceCoords) return;
      const [lat, lng] = highlightedPlaceCoords;
      // choose styles by type
      const isDish = highlightedPlaceType === 'dish';
      const outerColor = isDish ? '#805ad5' : '#f6ad55';
      const innerColor = isDish ? '#6b46c1' : '#dd6b20';
      const outer = L.circle([lat, lng], { radius: 45, color: outerColor, weight: 1, fillColor: outerColor, fillOpacity: 0.08, interactive: false });
      const inner = L.circleMarker([lat, lng], { radius: 8, color: innerColor, weight: 2, fillColor: innerColor, fillOpacity: 1 });
      // add to a layer group so we can remove easily
      const group = L.layerGroup([outer, inner]);
      group.addTo(mapRef.current);
      // give the outer path a pulsing class (if available)
      try {
        const path = (outer as any)._path as SVGElement | undefined;
        if (path) path.classList.add('pulsing-marker');
      } catch (err) {}
      if (highlightedPlaceName) {
        try { inner.bindPopup(`<div style="font-weight:600">${String(highlightedPlaceName)}</div>`).openPopup(); } catch (err) {}
      }
      highlightLayerRef.current = group;
    } catch (err) {
      // ignore
    }
    return () => {
      if (mapRef.current && highlightLayerRef.current) {
        try { mapRef.current.removeLayer(highlightLayerRef.current); } catch (err) {}
        highlightLayerRef.current = null;
      }
    };
  }, [highlightedPlaceCoords, highlightedPlaceName]);

  // When GeoJSON is loaded, set map max bounds to the loaded area to avoid panning far away
  useEffect(() => {
    if (!bulacanGeoJson || !mapRef.current) return;
    try {
      const layer = L.geoJSON(bulacanGeoJson as any);
      const bounds = layer.getBounds();
      if (bounds && bounds.isValid && bounds.isValid()) {
        // add a small buffer so UI controls can be visible near edges
        const pad = 0.1; // degrees buffer
        const southWest = L.latLng(bounds.getSouth() - pad, bounds.getWest() - pad);
        const northEast = L.latLng(bounds.getNorth() + pad, bounds.getEast() + pad);
        const maxBounds = L.latLngBounds(southWest, northEast);
        mapRef.current.setMaxBounds(maxBounds);
      }
    } catch (err) {
      // ignore
    }
  }, [bulacanGeoJson]);

  // Fit the map to Bulacan bounds once when data and map are ready; choose a closer zoom but still show full bounds
  useEffect(() => {
    if (!bulacanGeoJson || !mapRef.current || initialFitDone.current) return;
    try {
      const layer = L.geoJSON(bulacanGeoJson as any);
      const bounds = layer.getBounds();
      if (bounds && bounds.isValid && bounds.isValid()) {
        const center = bounds.getCenter();
        // compute zoom that fits bounds, then nudge it one level closer (but clamp)
        const fitZoom = mapRef.current.getBoundsZoom(bounds, false);
        const targetZoom = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, fitZoom + 1));
        mapRef.current.flyTo([center.lat, center.lng], targetZoom, { duration: 0.8 });
        setMapCenter([center.lat, center.lng]);
        setMapZoom(targetZoom);
        initialFitDone.current = true;
      }
    } catch (err) {
      // ignore
    }
  }, [bulacanGeoJson]);

  // Keyboard: close panel with Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, clear]);

  // Lock background scroll when panel is open (especially on mobile)
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Listen for external controls (e.g., sliders on MapExplorer)
  useEffect(() => {
    const onSetOpacity = (e: Event) => {
      try {
        const detail = (e as CustomEvent<{ opacity?: number }>).detail;
        const opacity = typeof detail?.opacity === 'number' ? detail.opacity : undefined;
        if (mapRef.current && typeof opacity === 'number') {
          const pane = mapRef.current.getPane && mapRef.current.getPane('tilePane') as HTMLElement | null;
          if (pane) pane.style.opacity = String(opacity);
        }
      } catch (err) {
        // ignore
      }
    };

    const onSetZoom = (e: Event) => {
      try {
        const detail = (e as CustomEvent<{ zoom?: number }>).detail;
        const zoom = typeof detail?.zoom === 'number' ? detail.zoom : undefined;
        if (mapRef.current && typeof zoom === 'number') {
          mapRef.current.setZoom(zoom);
        }
      } catch (err) {
        // ignore
      }
    };

    const onReset = () => {
      resetMap();
    };

    const onLocate = () => {
      handleLocate();
    };

    const onToggleTile = () => {
      toggleTile();
    };

    const onZoomDelta = (e: Event) => {
      try {
        const detail = (e as CustomEvent<{ delta?: number }>).detail;
        const delta = typeof detail?.delta === 'number' ? detail.delta : 0;
        if (mapRef.current && delta) {
          mapRef.current.setZoom((mapRef.current.getZoom() ?? 10) + delta);
        }
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('map:setOpacity', onSetOpacity as EventListener);
    window.addEventListener('map:setZoom', onSetZoom as EventListener);
    window.addEventListener('map:reset', onReset as EventListener);
    window.addEventListener('map:locate', onLocate as EventListener);
    window.addEventListener('map:toggleTile', onToggleTile as EventListener);
    window.addEventListener('map:zoomDelta', onZoomDelta as EventListener);
    return () => {
      window.removeEventListener('map:setOpacity', onSetOpacity as EventListener);
      window.removeEventListener('map:setZoom', onSetZoom as EventListener);
      window.removeEventListener('map:reset', onReset as EventListener);
      window.removeEventListener('map:locate', onLocate as EventListener);
      window.removeEventListener('map:toggleTile', onToggleTile as EventListener);
      window.removeEventListener('map:zoomDelta', onZoomDelta as EventListener);
    };
  }, []);

  const resetMap = () => {
    clear();
    setMapCenter(bulacanCenter);
    setMapZoom(10);
    try {
      if (bulacanGeoJson && mapRef.current) {
        const layer = L.geoJSON(bulacanGeoJson as any);
        const bounds = layer.getBounds();
        if (bounds && bounds.isValid && bounds.isValid()) {
          const fitZoom = mapRef.current.getBoundsZoom(bounds, false);
          const targetZoom = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, fitZoom + 1));
          const center = bounds.getCenter();
          mapRef.current.flyTo([center.lat, center.lng], targetZoom, { duration: 0.9 });
          return;
        }
      }
    } catch (err) {
      // fallback
    }
    mapRef.current?.flyTo(bulacanCenter, 10, { duration: 0.75, easeLinearity: 0.25 });
  };



  // Clear selection when clicking outside polygons
  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    const target = e.originalEvent.target as HTMLElement | null;
    if (!target || !target.closest || !target.closest('.leaflet-interactive')) {
      resetMap();
    }
  }, []);

  // Handler passed to MunicipalityCard to highlight a place (dish/restaurant)
  const handleHighlightPlace = useCallback(async (place: { type: 'dish' | 'restaurant'; id: string | number; coordinates?: [number, number] } | null) => {
    // clear
    if (!place) {
      setHighlightedPlaceCoords(null);
      setHighlightedPlaceName(null);
      if (mapRef.current && highlightLayerRef.current) {
        try { mapRef.current.removeLayer(highlightLayerRef.current); } catch (err) {}
        highlightLayerRef.current = null;
      }
      return;
    }

    // if coordinates provided, use them
    if (place.coordinates && place.coordinates.length === 2) {
      setHighlightedPlaceCoords(place.coordinates);
      setHighlightedPlaceType(place.type);
      setHighlightedPlaceName(`${place.type === 'restaurant' ? 'Restaurant' : 'Dish'} highlighted`);
      try { mapRef.current?.flyTo(place.coordinates, 15, { duration: 0.4 }); } catch (err) {}
      return;
    }

    // Otherwise try to fetch coordinates from API using selected municipality context
    try {
      if (!selectedMunicipality) return;
      if (place.type === 'restaurant') {
        // try top restaurants first
        const tops = await fetchTopRestaurants(selectedMunicipality.id).catch(() => []);
        const found = tops.find(r => String(r.id) === String(place.id));
        if (found && typeof found.lat === 'number' && typeof found.lng === 'number') {
          const coords: [number, number] = [found.lat, found.lng];
          setHighlightedPlaceCoords(coords);
          setHighlightedPlaceType('restaurant');
          setHighlightedPlaceName(found.name ?? 'Restaurant');
          try { mapRef.current?.flyTo(coords, 15, { duration: 0.4 }); } catch (err) {}
          return;
        }
        // fallback: fetch restaurants list in municipality and find by id
  const listResp = await fetchRestaurantsCached({ municipalityId: selectedMunicipality.id, perPage: 200 }).catch(() => ({ rows: [] as any[] }));
        const found2 = listResp.rows.find((r: any) => String(r.id) === String(place.id));
        if (found2 && typeof found2.lat === 'number' && typeof found2.lng === 'number') {
          const coords: [number, number] = [found2.lat, found2.lng];
          setHighlightedPlaceCoords(coords);
          setHighlightedPlaceType('restaurant');
          setHighlightedPlaceName(found2.name ?? 'Restaurant');
          try { mapRef.current?.flyTo(coords, 15, { duration: 0.4 }); } catch (err) {}
          return;
        }
      } else if (place.type === 'dish') {
        // find restaurants serving the dish in the municipality and highlight the first
  const resp = await fetchRestaurantsCached({ municipalityId: selectedMunicipality.id, dishId: Number(place.id), perPage: 50 }).catch(() => ({ rows: [] as any[] }));
        const r = resp.rows && resp.rows.length ? resp.rows[0] : null;
        if (r && typeof r.lat === 'number' && typeof r.lng === 'number') {
          const coords: [number, number] = [r.lat, r.lng];
          setHighlightedPlaceCoords(coords);
          setHighlightedPlaceType('dish');
          setHighlightedPlaceName(r.name ?? 'Restaurant');
          try { mapRef.current?.flyTo(coords, 15, { duration: 0.4 }); } catch (err) {}
          return;
        }
      }
    } catch (err) {
      // ignore
    }
  }, [selectedMunicipality]);

  // Debounced scheduler: clear immediately on null; delay on actual place to avoid aggressive flyTo on hover
  const scheduleHighlight = useCallback((place: { type: 'dish' | 'restaurant'; id: string | number; coordinates?: [number, number] } | null, immediate = false) => {
    if (highlightTimeoutRef.current) { window.clearTimeout(highlightTimeoutRef.current); highlightTimeoutRef.current = null; }
    if (!place) {
      // clear immediately
      handleHighlightPlace(null);
      return;
    }
    if (immediate) {
      void handleHighlightPlace(place);
      return;
    }
    // schedule
    highlightTimeoutRef.current = window.setTimeout(() => {
      void handleHighlightPlace(place);
      highlightTimeoutRef.current = null;
    }, 300) as unknown as number;
  }, [handleHighlightPlace]);

  // derive list of features for search
  const muniFeatures = useMemo(() => bulacanGeoJson?.features ?? [], [bulacanGeoJson]);

  // filter GeoJSON to only include non-point geometries (polygons/multipolygons)
  type GeoJSONFeature = {
    type: "Feature";
    properties: {
      id?: string | number;
      name?: string;
      slug?: string;
      description?: string | null;
    };
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: number[][][];
    };
  };

  type GeoJSONData = {
    type: "FeatureCollection";
    features: GeoJSONFeature[];
  };

  const geoJsonPolygons = useMemo(() => {
    if (!bulacanGeoJson) return null;
    try {
      const features = (bulacanGeoJson.features || []).filter((f: any) => {
        const t = f?.geometry?.type || '';
        return t !== 'Point' && t !== 'MultiPoint';
      });
      return { ...bulacanGeoJson, features } as GeoJSONData;
    } catch (err) {
      return null;
    }
  }, [bulacanGeoJson]);

  // debounce the query input to reduce work and avoid flashing suggestions
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  // filter suggestions when debouncedQuery changes
  useEffect(() => {
    if (!debouncedQuery || !muniFeatures.length) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }
    const q = debouncedQuery.toLowerCase();
    const matches = muniFeatures
      .filter((f: any) => (f?.properties?.name ?? '').toLowerCase().includes(q))
      .slice(0, 6)
      .map((f: any) => ({ name: f.properties.name, feature: f }));
    setSuggestions(matches);
    setHighlightedIndex(matches.length ? 0 : -1);
  }, [debouncedQuery, muniFeatures]);

  // fit map to a feature (polygon or point)
  const fitFeatureBounds = useCallback((feature: any) => {
    if (!mapRef.current || !feature) return;
    try {
      const layer = L.geoJSON(feature as any);
      const bounds = layer.getBounds();
      if (bounds.isValid && bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { maxZoom: 13, animate: true });
        const center = bounds.getCenter();
        setMapCenter([center.lat, center.lng]);
        setMapZoom(mapRef.current.getZoom());
      } else if (feature.geometry && feature.geometry.coordinates) {
        const coords = feature.geometry.coordinates;
        // handle Point or simple coords
        const latlng: [number, number] = Array.isArray(coords[0]) ? [coords[0][1], coords[0][0]] : [coords[1], coords[0]];
        mapRef.current.flyTo(latlng, 13, { duration: 0.6 });
        setMapCenter(latlng);
        setMapZoom(13);
      }
    } catch (err) {
      // fallback: do nothing
    }
  }, []);

  const handleSelectSuggestion = (f: any) => {
    fitFeatureBounds(f);
    setQuery('');
    setSuggestions([]);
    setHighlightedIndex(-1);
    // blur input so keyboard focus returns to map; keep input ref for screen readers
    try { searchInputRef.current?.blur(); } catch (err) {}
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[highlightedIndex].feature);
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setHighlightedIndex(-1);
    }
  };

  // Listen for municipality restaurant show events
  useEffect(() => {
    const handleShowRestaurants = async (e: CustomEvent<{ municipalityId: number }>) => {
      if (!e.detail.municipalityId) return;
      
      try {
        const resp = await fetchRestaurantsCached({ 
          municipalityId: e.detail.municipalityId,
          perPage: 100
        });
        
        if (resp.rows && resp.rows.length) {
          const restaurants = resp.rows.map(r => ({
            id: r.id,
            name: r.name,
            lat: r.lat,
            lng: r.lng,
            address: r.address
          }));
          
          setFocusedRestaurants(restaurants);
          
          // Fit map bounds to show all restaurants
          const bounds = new L.LatLngBounds(
            restaurants
              .filter(m => typeof m.lat === 'number' && typeof m.lng === 'number')
              .map(m => [m.lat!, m.lng!])
          );
          
          if (bounds.isValid()) {
            mapRef.current?.fitBounds(bounds, { padding: [50, 50] });
          }
        }
      } catch (err) {
        console.error('Failed to fetch restaurants:', err);
      }
    };

    window.addEventListener('map:showRestaurants' as any, handleShowRestaurants as any);
    return () => window.removeEventListener('map:showRestaurants' as any, handleShowRestaurants as any);
  }, []);

  // Clear focused restaurants when municipality is deselected
  useEffect(() => {
    if (!selectedMunicipality) {
      setFocusedRestaurants([]);
    }
  }, [selectedMunicipality]);

  const handleLocate = async () => {
    if (!mapRef.current) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          mapRef.current?.flyTo(latlng, 13, { duration: 0.7 });
          setMapCenter(latlng);
          setMapZoom(13);
          setUserLocation(latlng);
          setUserAccuracy(typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null);
          try {
            window.localStorage.setItem('bulacan_map_user_location_v1', JSON.stringify({ lat: latlng[0], lng: latlng[1], accuracy: pos.coords.accuracy, ts: Date.now() }));
          } catch (err) {
            // ignore
          }
        },
        () => {
          // ignore errors silently
        }
      );
    }
  };

  // Close suggestions when clicking outside of the search container (improves mobile/keyboard UX)
  useEffect(() => {
    if (!suggestions.length) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setSuggestions([]);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [suggestions.length]);

  // When highlighted index changes, ensure the focused option is visible to screen reader/keyboard users
  useEffect(() => {
    if (highlightedIndex < 0) return;
    const el = document.getElementById(`map-search-option-${highlightedIndex}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  // Listen for flyTo events
  useEffect(() => {
    const onFlyTo = (e: Event) => {
      const detail = (e as CustomEvent<{ lat: number; lng: number; zoom?: number }>).detail;
      if (mapRef.current && detail) {
        mapRef.current.flyTo(
          [detail.lat, detail.lng], 
          detail.zoom || mapRef.current.getZoom(), 
          { duration: 0.6 }
        );
      }
    };

    window.addEventListener('map:flyTo', onFlyTo as EventListener);
    return () => window.removeEventListener('map:flyTo', onFlyTo as EventListener);
  }, []);

  // Inject pulsing marker CSS once
  useEffect(() => {
    const id = 'bulacan-map-pulse-style';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = `
      .pulsing-marker { transform-origin: center; animation: bulacan-pulse 1.6s ease-out infinite; }
      @keyframes bulacan-pulse {
        0% { transform: scale(1); opacity: 1; }
        70% { transform: scale(2.4); opacity: 0; }
        100% { transform: scale(2.4); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // Restore persisted user location (if any) on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('bulacan_map_user_location_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        setUserLocation([parsed.lat, parsed.lng]);
        if (typeof parsed.accuracy === 'number') setUserAccuracy(parsed.accuracy);
      }
    } catch (err) {
      // ignore
    }
  }, []);

  // If parent supplies a user location override (e.g., from a list 'Near me'), apply it
  useEffect(() => {
    if (!userLocationOverride || !mapRef.current) return;
    const [lat, lng] = userLocationOverride;
    setUserLocation([lat, lng]);
    setUserAccuracy(null);
    try {
      mapRef.current.flyTo([lat, lng], 13, { duration: 0.6 });
      setMapCenter([lat, lng]);
      setMapZoom(13);
    } catch (err) {
      // ignore
    }
  }, [userLocationOverride]);

  // Device orientation (compass) support — subscribe when requested
  useEffect(() => {
    if (!useDeviceCompass) return;
    const onOrient = (ev: DeviceOrientationEvent) => {
      // alpha is the rotation around z-axis in degrees
      const alpha = ev.alpha;
      if (typeof alpha === 'number') {
        // Normalize to compass heading (this is a best-effort; device variability exists)
        const heading = (360 - alpha) % 360;
        setBearingDeg(Math.round(heading));
      }
    };
    window.addEventListener('deviceorientation', onOrient as EventListener);
    return () => window.removeEventListener('deviceorientation', onOrient as EventListener);
  }, [useDeviceCompass]);

  // Calculate distances to visible markers from user location
  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
  };

  const formatDistance = (distance: number) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${Math.round(distance * 10) / 10}km`;
  };

  const toggleTile = () => setTileStyle((s) => (s === 'osm' ? 'voyager' : 'osm'));

  // Helper: compute initial bearing from lat1,lon1 to lat2,lon2 (degrees)
  const computeBearing = (lat1:number, lon1:number, lat2:number, lon2:number) => {
    const toRad = (d:number) => d * Math.PI / 180;
    const toDeg = (r:number) => r * 180 / Math.PI;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaLambda = toRad(lon2 - lon1);
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
    return brng;
  };

  const angleDiff = (a:number, b:number) => {
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    return d;
  };

  // Destination point by bearing and distance (km)
  const destinationPoint = (lat:number, lon:number, brngDeg:number, distKm:number) => {
    const R = 6371; // km
    const toRad = (d:number) => d * Math.PI / 180;
    const toDeg = (r:number) => r * 180 / Math.PI;
    const brng = toRad(brngDeg);
    const dR = distKm / R;
    const phi1 = toRad(lat);
    const lambda1 = toRad(lon);
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(dR) + Math.cos(phi1) * Math.sin(dR) * Math.cos(brng));
    const lambda2 = lambda1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(phi1), Math.cos(dR) - Math.sin(phi1) * Math.sin(phi2));
    return [toDeg(phi2), ((toDeg(lambda2) + 540) % 360) - 180] as [number, number];
  };

  // State to track whether to show polygons
  const [showPolygons, setShowPolygons] = useState<boolean>(true);

  // Effect to handle polygon visibility and focus on markers
  useEffect(() => {
    if (restaurantMarkers && restaurantMarkers.length > 0) {
      setShowPolygons(false);
      
      // If we have exactly one marker, focus on it
      if (restaurantMarkers.length === 1) {
        const r = restaurantMarkers[0];
        if (typeof r.lat === 'number' && typeof r.lng === 'number') {
          setHighlightedPlaceCoords([r.lat, r.lng]);
          setHighlightedPlaceName(r.name);
          setHighlightedPlaceType('restaurant');
          // Add a slight delay to ensure map is ready
          setTimeout(() => {
            mapRef.current?.flyTo([r.lat!, r.lng!], 15, { duration: 0.6 });
          }, 100);
        }
      } else if (restaurantMarkers.length > 1) {
        // If we have multiple markers, fit bounds to show all
        try {
          const bounds = new L.LatLngBounds(
            restaurantMarkers
              .filter(m => typeof m.lat === 'number' && typeof m.lng === 'number')
              .map(m => [m.lat!, m.lng!])
          );
          if (bounds.isValid()) {
            mapRef.current?.fitBounds(bounds, { padding: [50, 50] });
          }
        } catch (err) {
          console.warn('Failed to fit bounds to markers:', err);
        }
      }
    } else {
      setShowPolygons(true);
    }
  }, [restaurantMarkers]);

  // Build a sector GeoJSON (polygon) centered at userLocation with bearing and width and radiusKm
  const buildSector = (center:[number,number], bearing:number, width:number, radiusKm = 10, steps = 36) => {
    const [lat, lon] = center;
    const half = width / 2;
    const start = (bearing - half + 360) % 360;
    const end = (bearing + half) % 360;
    const coords:[number,number][] = [];
    coords.push([lon, lat]); // center first (lon,lat)
    // generate arc from start to end (handle wrap)
    const sweep = ((end - start + 360) % 360) || 360;
    for (let i = 0; i <= steps; i++) {
      const t = start + (sweep * (i / steps));
      const pt = destinationPoint(lat, lon, t % 360, radiusKm);
      coords.push([pt[1], pt[0]]);
    }
    coords.push([lon, lat]);
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {},
    };
  };

  const wrapperClass = fullScreen
    ? `fixed inset-0 w-full h-screen ${isOpen ? "panel-open" : ""}`
    : compact
      ? `w-40 h-24 rounded overflow-hidden ${isOpen ? "panel-open" : ""}`
      : `relative h-[500px] md:h-[600px] lg:h-[700px] w-full rounded-lg overflow-hidden shadow-lg ${isOpen ? "panel-open" : ""} z-0`;

      // keyboard pan/zoom for accessibility when the map wrapper is focused
      const [liveAnnounce, setLiveAnnounce] = useState<string>('');
      const announce = (msg: string) => {
        setLiveAnnounce(msg);
        window.setTimeout(() => setLiveAnnounce(''), 1800);
      };

      const handleMapKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        const center = map.getCenter();
        const panStep = 0.25; // degrees (approx)
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          map.panTo([center.lat + panStep, center.lng]);
          announce('Panned up');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          map.panTo([center.lat - panStep, center.lng]);
          announce('Panned down');
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          map.panTo([center.lat, center.lng - panStep]);
          announce('Panned left');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          map.panTo([center.lat, center.lng + panStep]);
          announce('Panned right');
        } else if (e.key === '+' || e.key === '=' || e.key === 'PageUp') {
          e.preventDefault();
          map.setZoom((map.getZoom() ?? 10) + 1);
          announce('Zoomed in');
        } else if (e.key === '-' || e.key === 'PageDown') {
          e.preventDefault();
          map.setZoom((map.getZoom() ?? 10) - 1);
          announce('Zoomed out');
        }
      };

  // If a highlightedMunicipality id/slug is provided, attempt to fit the map to it
  useEffect(() => {
    if (!highlightedMunicipality || !muniFeatures.length) return;
    const idOrSlug = String(highlightedMunicipality);
    const match = muniFeatures.find((f: any) => {
      const pid = f?.properties?.id ?? f?.properties?.ID ?? f?.properties?.Id;
      const slug = f?.properties?.slug ?? f?.properties?.name?.toLowerCase().replace(/\s+/g, '-');
      return String(pid) === idOrSlug || String(slug) === idOrSlug || String(f?.properties?.name) === idOrSlug;
    });
    if (match) fitFeatureBounds(match);
  }, [highlightedMunicipality, muniFeatures, fitFeatureBounds]);

  // Recompute sector geojson when userLocation/bearing/width changes
  useEffect(() => {
    if (!userLocation || !viewDirectionEnabled) { setSectorGeoJson(null); return; }
    try {
      const g = buildSector(userLocation, bearingDeg, coneWidthDeg, 10, 32);
      setSectorGeoJson(g);
    } catch (err) {
      setSectorGeoJson(null);
    }
  }, [userLocation, viewDirectionEnabled, bearingDeg, coneWidthDeg]);

  // Compute filtered markers based on view direction (client-side) to avoid extra API calls
  const filteredMarkers = useMemo(() => {
    if (!restaurantMarkers || !restaurantMarkers.length) return [] as RestMarker[];

    // Start with all markers
    let filtered = [...restaurantMarkers];

    // Filter by view direction if enabled
    if (userLocation && viewDirectionEnabled) {
      filtered = filtered.filter((r) => {
        if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return false;
        const br = computeBearing(userLocation[0], userLocation[1], r.lat, r.lng);
        return angleDiff(br, bearingDeg) <= (coneWidthDeg / 2);
      });
    }

    // Filter by distance if user location is available
    if (userLocation) {
      filtered = filtered.filter((r) => {
        if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return false;
        const distance = getDistanceFromLatLonInKm(userLocation[0], userLocation[1], r.lat, r.lng);
        return distance <= searchRadius;
      });

      // Sort by distance if enabled
      if (sortByDistance) {
        filtered.sort((a, b) => {
          if (typeof a.lat !== 'number' || typeof a.lng !== 'number') return 1;
          if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return -1;
          const distA = getDistanceFromLatLonInKm(userLocation[0], userLocation[1], a.lat, a.lng);
          const distB = getDistanceFromLatLonInKm(userLocation[0], userLocation[1], b.lat, b.lng);
          return distA - distB;
        });
      }
    }

    return filtered;
  }, [restaurantMarkers, userLocation, viewDirectionEnabled, bearingDeg, coneWidthDeg, searchRadius, sortByDistance]);

  // Reference some symbols that may only be used in the full UI to avoid "declared but never used" TS errors
  useEffect(() => {
    // noop references
    void Popup;
    void MapClickHandler;
    void ErrorBoundary;
    void MunicipalityCard;
    void AnimatePresence;
    void setViewDirectionEnabled;
    void setConeWidthDeg;
    void setUseDeviceCompass;
    void setSectorGeoJson;
    void sectorGeoJson;
    void MapInstructions;
    void handleMapClick;
    void handleInputKeyDown;
    void filteredMarkers;
  }, []);

  if (compact) {
    return (
      <div className={wrapperClass + ' focus:outline-2 focus:outline-primary-500 focus:outline-offset-2'} role="application" aria-label="Bulacan map preview" tabIndex={0} onKeyDown={handleMapKeyDown}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          minZoom={MAP_MIN_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
          whenReady={(...args: any[]) => {
            if (args[0] && args[0].target) mapRef.current = args[0].target;
          }}
        >
          <TileLayer
            attribution={tileStyle === 'osm' ? '&copy; OpenStreetMap' : '&copy; CartoDB'}
            url={tileStyle === 'osm' ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'}
          />
          {geoJsonPolygons && (
            <GeoJSON
            data={geoJsonPolygons}
            style={(feature) => ({
              color: selectedMunicipality?.name === feature?.properties?.name ? '#e53e3e'
                : hoveredName === feature?.properties?.name ? '#2b6cb0'
                : '#3182ce',
              weight: selectedMunicipality?.name === feature?.properties?.name ? 4
                : hoveredName === feature?.properties?.name ? 3
                : 2,
              fillOpacity: selectedMunicipality?.name === feature?.properties?.name ? 0.5
                : hoveredName === feature?.properties?.name ? 0.4
                : 0.3,
              fillColor: selectedMunicipality?.name === feature?.properties?.name ? '#fed7d7'
                : hoveredName === feature?.properties?.name ? '#bee3f8'
                : '#90cdf4',
              className: 'municipality-polygon transition-all duration-300 ease-in-out'
            })}
            onEachFeature={(feature, layer) => {
              layer.on({
                mouseover: () => setHoveredName(feature?.properties?.name || null),
                mouseout: () => setHoveredName(null),
                click: () => {
                  // Select this municipality
                  // Extract numeric ID from @id property (format: "relation/123456")
                  const relationId = feature?.properties?.['@id'] ?? '';
                  const numericId = Number(relationId.split('/')[1]) || -1;
                  select({
                    id: numericId,
                    slug: feature?.properties?.slug || feature?.properties?.name?.toLowerCase().replace(/\s+/g, '-'),
                    name: feature?.properties?.name,
                    description: feature?.properties?.description ?? null,
                    coordinates: feature?.geometry?.type === "Polygon" || feature?.geometry?.type === "MultiPolygon"
                      ? [(feature.geometry as any).coordinates[0][0][1], (feature.geometry as any).coordinates[0][0][0]]
                      : [0, 0],
                  });
                  
                  // Center and zoom to polygon
                  if (mapRef.current) {
                    const bounds = (layer as L.Polygon).getBounds();
                    mapRef.current.fitBounds(bounds, { maxZoom: 12, animate: true, duration: 0.8 });
                    const center = bounds.getCenter();
                    setMapCenter([center.lat, center.lng]);
                    setMapZoom(mapRef.current.getZoom());
                  }
                }
              });

              // Add data attributes for CSS animations
              const path = (layer as any)._path;
              if (path) {
                path.setAttribute('data-selected', String(selectedMunicipality?.name === feature?.properties?.name));
                path.setAttribute('data-hovered', String(hoveredName === feature?.properties?.name));
              }
            }}
          />
          )}
          {restaurantMarkers && restaurantMarkers.length > 0 && restaurantMarkers.map((r: RestMarker) => {
            const lat = r.lat; const lng = r.lng;
            if (typeof lat !== 'number' || typeof lng !== 'number') return null;
            return (
              <CircleMarker key={`r-${r.id}`} center={[lat, lng]} radius={4} pathOptions={{ color: '#e76f51', fillColor: '#e76f51', fillOpacity: 1 }} />
            );
          })}
        </MapContainer>
        <div className="sr-only" aria-live="polite">{liveAnnounce}</div>
      </div>
    );
  }

  // Full map with controls
  return (
    <div className={wrapperClass + ' focus:outline-2 focus:outline-primary-500 focus:outline-offset-2'} role="application" aria-label="Bulacan interactive map" tabIndex={0} onKeyDown={handleMapKeyDown}>
  {/* Top-center search box */}
      <div className="absolute z-[900] left-1/2 -translate-x-1/2 top-4 w-[min(420px,86%)]" ref={searchContainerRef}>
        <MapSearch
          onSelectResult={(result) => {
            if (result.type === 'municipality') {
              // Find municipality feature and select it
              const feature = muniFeatures.find(f => f.properties?.name === result.name);
              if (feature) handleSelectSuggestion(feature);
            } else if (result.type === 'restaurant' && result.coordinates) {
              // Fly to restaurant location
              mapRef.current?.flyTo(result.coordinates, 15, { duration: 0.6 });
              // TODO: Show restaurant popup/marker
            }
          }}
          className="shadow-lg"
        />
      </div>

  {/* Map Controls Panel */}
  <div className="absolute z-[800] md:right-4 md:top-4 right-4 md:bottom-auto bottom-4">
    <MapControlPanel
      searchRadius={searchRadius}
      onSearchRadiusChange={setSearchRadius}
      sortByDistance={sortByDistance}
      onSortByDistanceChange={() => setSortByDistance(!sortByDistance)}
      viewDirectionEnabled={viewDirectionEnabled}
      onViewDirectionChange={setViewDirectionEnabled}
      bearingDeg={bearingDeg}
      onBearingChange={setBearingDeg}
      coneWidthDeg={coneWidthDeg}
      onConeWidthChange={setConeWidthDeg}
      useDeviceCompass={useDeviceCompass}
      onUseDeviceCompassChange={setUseDeviceCompass}
      userLocation={userLocation}
      onLocate={handleLocate}
      onMapStyleChange={toggleTile}
      onMapReset={resetMap}
      className="w-[320px]"
    />
  </div>

        <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        whenReady={(...args: any[]) => { if (args[0] && args[0].target) mapRef.current = args[0].target; }}
      >
        <TileLayer 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={tileStyle === 'osm' ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'} 
        />


        {/* Sector overlay when view-direction enabled */}
        {sectorGeoJson && <GeoJSON data={sectorGeoJson} style={{ color: '#2b6cb0', weight: 1, fillColor: '#2b6cb0', fillOpacity: 0.06 }} />}

        {/* Map click handler to clear selection when clicking outside polygons */}
        <MapClickHandler onMapClick={handleMapClick} />

        {/* Render UserLocationMarker and RadiusOverlay when location is available */}
        {userLocation && (
          <>
            <UserLocationMarker
              position={userLocation}
              accuracy={userAccuracy}
            />
            <RadiusOverlay
              center={userLocation}
              radiusKm={searchRadius}
            />
          </>
        )}

        {/* Render filtered restaurant markers with clustering */}
        {/* Render focused restaurants from municipality */}
        {focusedRestaurants.length > 0 && (
          <MarkerClusterGroup
            {...({ chunkedLoading: true } as any)}
            maxClusterRadius={40}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
          >
            {focusedRestaurants.map((r) => {
              if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return null;
              return (
                <RestaurantMarker
                  key={`fr-${r.id}`}
                  restaurant={r}
                  userLocation={userLocation}
                  onClick={() => {
                    setHighlightedPlaceCoords([r.lat!, r.lng!]);
                    setHighlightedPlaceName(r.name);
                    setHighlightedPlaceType('restaurant');
                    mapRef.current?.flyTo([r.lat!, r.lng!], 15, { duration: 0.6 });
                  }}
                />
              );
            })}
          </MarkerClusterGroup>
        )}

        {/* Render GeoJSON for municipality boundaries - hidden when showing restaurants */}
        {geoJsonPolygons && showPolygons && (
          <>
            <GeoJSON
              data={geoJsonPolygons}
              style={(feature) => ({
                color: selectedMunicipality?.name === feature?.properties?.name ? '#e53e3e'
                  : hoveredName === feature?.properties?.name ? '#2b6cb0'
                  : '#3182ce',
                weight: selectedMunicipality?.name === feature?.properties?.name ? 4
                  : hoveredName === feature?.properties?.name ? 3
                  : 2,
                fillOpacity: selectedMunicipality?.name === feature?.properties?.name ? 0.5
                  : hoveredName === feature?.properties?.name ? 0.4
                  : 0.3,
                fillColor: selectedMunicipality?.name === feature?.properties?.name ? '#fed7d7'
                  : hoveredName === feature?.properties?.name ? '#bee3f8'
                  : '#90cdf4',
                className: 'municipality-polygon transition-all duration-300 ease-in-out'
              })}
              onEachFeature={(feature, layer) => {
                layer.on({
                  mouseover: () => setHoveredName(feature?.properties?.name || null),
                  mouseout: () => setHoveredName(null),
                  click: () => {
                    // Select this municipality
                    // Extract OSM relation ID from @id property (format: "relation/123456")
                    const osmRelationId = (feature?.properties?.['@id'] || '').split('/')[1];
                    const numericId = Number(osmRelationId) || -1;
                    // Pass the OSM relation ID for database lookup
                    select({
                      id: numericId, // This is the OSM relation ID
                      slug: feature?.properties?.slug || feature?.properties?.name?.toLowerCase().replace(/\s+/g, '-'),
                      name: feature?.properties?.name,
                      description: feature?.properties?.description ?? null,
                      coordinates: feature?.geometry?.type === "Polygon" || feature?.geometry?.type === "MultiPolygon"
                        ? [(feature.geometry as any).coordinates[0][0][1], (feature.geometry as any).coordinates[0][0][0]]
                        : [0, 0],
                    });
                    
                    // Center and zoom to polygon
                    if (mapRef.current) {
                      const bounds = (layer as L.Polygon).getBounds();
                      mapRef.current.fitBounds(bounds, { maxZoom: 12, animate: true, duration: 0.8 });
                      const center = bounds.getCenter();
                      setMapCenter([center.lat, center.lng]);
                      setMapZoom(mapRef.current.getZoom());
                    }
                  }
                });

                // Add data attributes for CSS animations
                const path = (layer as any)._path;
                if (path) {
                  path.setAttribute('data-selected', String(selectedMunicipality?.name === feature?.properties?.name));
                  path.setAttribute('data-hovered', String(hoveredName === feature?.properties?.name));
                }
              }}
            />
            
            {/* Municipality labels */}
            {geoJsonPolygons.features.map((feature: GeoJSONFeature) => {
              try {
                if (feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates[0]) {
                  // Calculate centroid for label position
                  let coords = feature.geometry.coordinates[0][0];
                  if (feature.properties.name === 'San Jose del Monte') {
                    coords = feature.geometry.coordinates[0][Math.floor(feature.geometry.coordinates[0].length / 2)];
                  }
                  return (
                    <MunicipalityLabel
                      key={`label-${feature.properties.name}`}
                      name={feature.properties.name || ''}
                      position={[coords[1], coords[0]]}
                      isSelected={selectedMunicipality?.name === feature.properties.name}
                      isHovered={hoveredName === feature.properties.name}
                    />
                  );
                }
              } catch (err) {
                return null;
              }
              return null;
            })}
          </>
        )}

        <MarkerClusterGroup
          {...({ chunkedLoading: true } as any)}
          maxClusterRadius={40}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
        >
          {filteredMarkers && filteredMarkers.length > 0 && filteredMarkers.map((r) => {
            if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return null;

            // Calculate distance from user if location is available
            const distance = userLocation && getDistanceFromLatLonInKm(userLocation[0], userLocation[1], r.lat, r.lng);
            
            return (
              <React.Fragment key={`r-${r.id}`}>
                <RestaurantMarker
                  restaurant={r}
                  userLocation={userLocation}
                  isHighlighted={highlightedPlaceType === 'restaurant' && 
                    highlightedPlaceCoords && 
                    r.lat === highlightedPlaceCoords[0] && 
                    r.lng === highlightedPlaceCoords[1]}
                  showPopup={highlightedPlaceType === 'restaurant' && 
                    highlightedPlaceCoords && 
                    r.lat === highlightedPlaceCoords[0] && 
                    r.lng === highlightedPlaceCoords[1]}
                  onClick={() => {
                    // Track visit when a marker is clicked
                    addVisit({
                      id: r.id,
                      name: r.name,
                      lat: r.lat,
                      lng: r.lng,
                      municipalityName: hoveredName || undefined
                    });
                    // Update highlighted state
                    setHighlightedPlaceCoords([r.lat!, r.lng!]);
                    setHighlightedPlaceName(r.name);
                    setHighlightedPlaceType('restaurant');
                    // Center map on clicked restaurant
                    mapRef.current?.flyTo([r.lat!, r.lng!], 15, { duration: 0.6 });
                  }}
                />
                <Popup position={[r.lat, r.lng]}>
                  <div className="text-sm">
                    <div className="font-medium">{r.name}</div>
                    {r.address && <div className="text-xs text-neutral-600">{r.address}</div>}
                    {distance && (
                      <div className="text-xs text-primary-600 mt-1 font-medium">
                        {formatDistance(distance)} away
                      </div>
                    )}
                  </div>
                </Popup>
              </React.Fragment>
            );
          })}
        </MarkerClusterGroup>
        
        {/* Municipality labels */}
        {geoJsonPolygons?.features.map((feature: GeoJSONFeature) => {
          try {
            if (feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates[0]) {
              const coords = feature.geometry.coordinates[0][0];
              return (
                <MunicipalityLabel
                  key={`label-${feature.properties.name}`}
                  name={feature.properties.name || ''}
                  position={[coords[1], coords[0]]}
                  isSelected={selectedMunicipality?.name === feature.properties.name}
                  isHovered={hoveredName === feature.properties.name}
                />
              );
            }
          } catch (err) {
            return null;
          }
          return null;
        })}
      </MapContainer>

      {/* Map instructions overlay (first-time visitors) */}
      <MapInstructions />

      {/* Recent visits and saved places panels: only show when not fullscreen */}
      {!fullScreen && (
        <div className="absolute left-4 bottom-4 z-[900] w-[320px] flex flex-col gap-2">
          <SavedPlacesPanel
            onSelect={(item) => {
              if (item.lat && item.lng) {
                mapRef.current?.flyTo([item.lat, item.lng], 15);
                setHighlightedPlaceCoords([item.lat, item.lng]);
                setHighlightedPlaceName(item.name);
                setHighlightedPlaceType(item.type);
              }
            }}
          />
          <RecentVisitsPanel
            onSelect={(visit) => {
              if (visit.lat && visit.lng) {
                mapRef.current?.flyTo([visit.lat, visit.lng], 15);
                setHighlightedPlaceCoords([visit.lat, visit.lng]);
                setHighlightedPlaceName(visit.name);
                setHighlightedPlaceType('restaurant');
              }
            }}
          />
        </div>
      )}

      {/* Municipality details panel (modal) */}
      <AnimatePresence>
        {selectedMunicipality && (
          <MunicipalityCard municipality={selectedMunicipality} onClose={clear} onHighlightPlace={handleHighlightPlace} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default InteractiveMap;
