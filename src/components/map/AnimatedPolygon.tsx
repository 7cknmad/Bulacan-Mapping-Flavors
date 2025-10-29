import React, { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

interface AnimatedPolygonProps {
  data: any;
  isSelected: boolean;
  isHovered: boolean;
  onClick: (feature: any) => void;
  onHover: (name: string | null) => void;
}

const AnimatedPolygon: React.FC<AnimatedPolygonProps> = ({
  data,
  isSelected,
  isHovered,
  onClick,
  onHover
}) => {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !data) return;

    const getStyle = () => ({
      color: isSelected ? '#e53e3e' : isHovered ? '#2b6cb0' : '#3182ce',
      weight: isSelected ? 4 : isHovered ? 3 : 2,
      fillOpacity: isSelected ? 0.5 : isHovered ? 0.4 : 0.3,
      fillColor: isSelected ? '#fed7d7' : isHovered ? '#bee3f8' : '#90cdf4',
      className: 'municipality-polygon transition-all duration-300 ease-in-out'
    });

    // Create the polygon layer
    const layer = L.geoJSON(data, {
      style: getStyle(),
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: () => onHover(feature?.properties?.name || null),
          mouseout: () => onHover(null),
          click: () => onClick(feature)
        });

        // Add data-attributes for CSS animations
        const path = (layer as any)._path;
        if (path) {
          path.setAttribute('data-selected', String(isSelected));
          path.setAttribute('data-hovered', String(isHovered));
        }
      }
    });

    // Add to map
    layer.addTo(map);

    // Update style when selection/hover state changes
    const updateStyle = () => {
      layer.setStyle(getStyle());
      layer.eachLayer((l: any) => {
        if (l._path) {
          l._path.setAttribute('data-selected', String(isSelected));
          l._path.setAttribute('data-hovered', String(isHovered));
        }
      });
    };

    updateStyle();

    return () => {
      map.removeLayer(layer);
    };
  }, [map, data, isSelected, isHovered, onClick, onHover]);

  return null;
};

export default AnimatedPolygon;