import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

interface UserLocationMarkerProps {
  position: [number, number];
  accuracy?: number | null;
}

const UserLocationMarker: React.FC<UserLocationMarkerProps> = ({ position, accuracy }) => {
  const map = useMap();
  const layerRef = useRef<{
    outer?: L.Circle;
    halo?: L.CircleMarker;
    marker?: L.CircleMarker;
    accuracyCircle?: L.Circle;
    bearing?: L.Polyline;
  } | null>(null);

  // Create and manage the layers
  useEffect(() => {
    if (!map) return;

    // Clean up any existing layers
    const cleanup = () => {
      try {
        if (layerRef.current?.outer) map.removeLayer(layerRef.current.outer);
        if (layerRef.current?.halo) map.removeLayer(layerRef.current.halo);
        if (layerRef.current?.marker) map.removeLayer(layerRef.current.marker);
        if (layerRef.current?.accuracyCircle) map.removeLayer(layerRef.current.accuracyCircle);
        if (layerRef.current?.bearing) map.removeLayer(layerRef.current.bearing);
        layerRef.current = null;
      } catch (err) {
        // Ignore cleanup errors
      }
    };

    // Create new layers
    const latlng = L.latLng(position[0], position[1]);
    
    // Accuracy circle - scale for visual clarity
    const visualAccuracy = accuracy ? Math.min(Math.max(accuracy, 10), 1000) * 0.8 : 50;

    // Outer glow effect
    const outer = L.circle(latlng, {
      radius: visualAccuracy,
      color: '#2b6cb0',
      weight: 1,
      fillColor: '#2b6cb0',
      fillOpacity: 0.03,
      interactive: false
    }).addTo(map);

    // Pulsing halo effect
    const halo = L.circleMarker(latlng, {
      radius: Math.max(visualAccuracy > 50 ? 12 : 10, 10),
      color: '#2b6cb0',
      weight: 0,
      fillColor: '#2b6cb0',
      fillOpacity: 0.08,
      interactive: false
    }).addTo(map);

    // Center marker
    const marker = L.circleMarker(latlng, {
      radius: 5,
      color: '#fff',
      weight: 1,
      fillColor: '#2b6cb0',
      fillOpacity: 1
    }).addTo(map);

    // Accuracy circle with label
    if (accuracy) {
      const accuracyCircle = L.circle(latlng, {
        radius: accuracy,
        color: '#2b6cb0',
        weight: 1,
        fillColor: '#2b6cb0',
        fillOpacity: 0.05,
        interactive: false
      }).addTo(map);

      // Add accuracy label
      const label = L.divIcon({
        className: 'accuracy-label',
        html: `<div class="bg-white/90 backdrop-blur-sm text-xs px-2 py-0.5 rounded shadow-sm">
                Accuracy: ${Math.round(accuracy)}m
               </div>`,
      });

      L.marker(latlng, {
        icon: label,
        interactive: false,
        zIndexOffset: 1000
      }).addTo(map);

      layerRef.current = { outer, halo, marker, accuracyCircle };
    } else {
      layerRef.current = { outer, halo, marker };
    }

    // Add pulsing animation class
    try {
      const el = (halo as any)._path as SVGElement | undefined;
      if (el) el.classList.add('pulsing-marker');
    } catch (err) {
      // Ignore animation errors
    }

    return cleanup;
  }, [map, position, accuracy]);

  return null;
};

export default UserLocationMarker;