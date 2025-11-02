import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import './user-location.css';

interface UserLocationMarkerProps {
  position: [number, number];
  accuracy?: number | null;
}

const UserLocationMarker: React.FC<UserLocationMarkerProps> = ({ position, accuracy }) => {
  const map = useMap();
  const layerRef = useRef<{
    marker?: L.Marker;
    accuracyCircle?: L.Circle;
    accuracyLabel?: L.Marker;
  } | null>(null);

  // Create and manage the layers
  useEffect(() => {
    if (!map) return;

    // Clean up any existing layers
    const cleanup = () => {
      try {
        if (layerRef.current?.marker) map.removeLayer(layerRef.current.marker);
        if (layerRef.current?.accuracyCircle) map.removeLayer(layerRef.current.accuracyCircle);
        if (layerRef.current?.accuracyLabel) map.removeLayer(layerRef.current.accuracyLabel);
        layerRef.current = null;
      } catch (err) {
        // Ignore cleanup errors
      }
    };

    // Create new layers
    const latlng = L.latLng(position[0], position[1]);
    
    // Constants for visual styling
    const colors = {
      primary: '#2563eb', // blue-600
      secondary: '#3b82f6', // blue-500
      accent: '#60a5fa', // blue-400
    };

    // Create ripple effect marker
    const createRippleIcon = () => {
      return L.divIcon({
        className: 'ripple-marker',
        html: `
          <div class="relative">
            <div class="absolute inset-0 rounded-full bg-blue-500/20 animate-ping"></div>
            <div class="absolute inset-0 rounded-full bg-blue-500/40" style="animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; animation-delay: 0.5s;"></div>
            <div class="absolute inset-0 rounded-full bg-white shadow-lg flex items-center justify-center">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
            </div>
            <style>
              @keyframes ping {
                75%, 100% {
                  transform: scale(2);
                  opacity: 0;
                }
              }
              @keyframes pulse {
                50% {
                  transform: scale(1.1);
                }
              }
            </style>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
    };

    // Accuracy radius with gradient
    if (accuracy) {
      const accuracyCircle = L.circle(latlng, {
        radius: accuracy,
        className: 'accuracy-circle',
        interactive: false,
        stroke: false,
      }).addTo(map);

      // Add radial gradient to accuracy circle
      const path = (accuracyCircle as any)._path as SVGElement;
      if (path) {
        const id = `accuracy-gradient-${Math.random().toString(36).substr(2, 9)}`;
        const svg = path.ownerSVGElement;
        if (svg) {
          const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS('http://www.w3.org/2000/svg', 'defs'), svg.firstChild);
          const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
          gradient.setAttribute('id', id);
          
          const stops = [
            { offset: '0%', color: colors.primary, opacity: '0.2' },
            { offset: '50%', color: colors.secondary, opacity: '0.1' },
            { offset: '100%', color: colors.accent, opacity: '0' },
          ];
          
          stops.forEach(({ offset, color, opacity }) => {
            const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop.setAttribute('offset', offset);
            stop.setAttribute('stop-color', color);
            stop.setAttribute('stop-opacity', opacity);
            gradient.appendChild(stop);
          });
          
          defs.appendChild(gradient);
          path.setAttribute('fill', `url(#${id})`);
        }
      }

      // Accuracy label with animation
      const label = L.divIcon({
        className: 'accuracy-label',
        html: `
          <div class="px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-lg
                    border border-blue-200 text-xs text-blue-700 font-medium
                    transform transition-all duration-300 hover:scale-110">
            Accuracy: ${Math.round(accuracy)}m
          </div>
        `,
      });

      const accuracyLabel = L.marker(latlng, {
        icon: label,
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(map);

      layerRef.current = { accuracyCircle, accuracyLabel };
    }

    // Main location marker with ripple effect
    const marker = L.marker(latlng, {
      icon: createRippleIcon(),
      zIndexOffset: 1001,
    }).addTo(map);

    layerRef.current = { ...layerRef.current, marker };

    return cleanup;
  }, [map, position, accuracy]);

  return null;
};

export default UserLocationMarker;