import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { Marker } from 'react-leaflet';
import './municipality-label.css';

interface MunicipalityLabelProps {
  name: string;
  position: [number, number];
  isSelected?: boolean;
  isHovered?: boolean;
}

/**
 * A smart floating label component that positions itself around a municipality centroid
 * with hover effects and collision avoidance
 */
const MunicipalityLabel: React.FC<MunicipalityLabelProps> = ({
  name,
  position,
  isSelected = false,
  isHovered = false
}) => {
  const map = useMap();
  const labelRef = useRef<L.Marker | null>(null);
  const [labelPosition, setLabelPosition] = useState<[number, number]>(position);
  
  // Only show when hovered or selected
  const shouldShow = isHovered || isSelected;

  // Convert lat/lng to screen coordinates
  useEffect(() => {
    if (!map || !position || !shouldShow) return;

    const updatePosition = () => {
      // Convert position to screen coordinates
      const point = map.latLngToContainerPoint(position);
      const zoom = map.getZoom();
      
      // Adjust label position based on zoom level and screen space
      let offsetY = 0;
      let offsetX = 0;

      if (zoom > 10) {
        offsetY = -20; // Move label up at closer zoom levels
      } else {
        offsetY = -10; // Less offset at farther zoom levels
      }

      // Adjust for screen edges
      const bounds = map.getBounds();
      const newPos = L.latLng(position[0], position[1]);

      if (point.x < 100) {
        offsetX = 20; // Move right if near left edge
      } else if (point.x > map.getContainer().offsetWidth - 100) {
        offsetX = -20; // Move left if near right edge
      }

      // Convert back to lat/lng with offset
      const newPoint = L.point(point.x + offsetX, point.y + offsetY);
      const adjustedLatLng = map.containerPointToLatLng(newPoint);
      
      // Update position if within bounds
      if (bounds.contains(adjustedLatLng)) {
        setLabelPosition([adjustedLatLng.lat, adjustedLatLng.lng]);
      }
    };

    // Update position on map move and zoom
    updatePosition();
    map.on('zoom', updatePosition);
    map.on('move', updatePosition);

    return () => {
      map.off('zoom', updatePosition);
      map.off('move', updatePosition);
    };
  }, [map, position, shouldShow]);

  // Create and manage the marker
  useEffect(() => {
    if (!map || !shouldShow) return;

    const icon = L.divIcon({
      className: 'municipality-label-container',
      html: `
        <div class="municipality-label ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}"
             data-municipality="${name}">
          <div class="label-content">
            <span class="label-text">${name}</span>
            <div class="label-indicator"></div>
          </div>
        </div>
      `,
    });

    const marker = L.marker(labelPosition, {
      icon,
      interactive: false,
      zIndexOffset: isSelected ? 1000 : isHovered ? 500 : 0
    }).addTo(map);

    // Add entrance animation
    const el = marker.getElement();
    if (el) {
      requestAnimationFrame(() => {
        el.classList.add('label-visible');
      });
    }

    labelRef.current = marker;

    return () => {
      if (map && marker) {
        map.removeLayer(marker);
      }
    };
  }, [map, labelPosition, shouldShow, name, isSelected, isHovered]);

  return null;
};

export default MunicipalityLabel;