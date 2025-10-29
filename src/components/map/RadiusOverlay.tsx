import React from 'react';
import { Circle } from 'react-leaflet';

interface RadiusOverlayProps {
  center: [number, number];
  radiusKm: number;
}

const RadiusOverlay: React.FC<RadiusOverlayProps> = ({ center, radiusKm }) => {
  return (
    <Circle
      center={center}
      radius={radiusKm * 1000} // Convert km to meters
      pathOptions={{
        color: '#2b6cb0',
        weight: 1,
        fillColor: '#2b6cb0',
        fillOpacity: 0.05,
        dashArray: '5,5'
      }}
    />
  );
};

export default RadiusOverlay;