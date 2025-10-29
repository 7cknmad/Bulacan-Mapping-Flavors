import React from 'react';
import { LayerGroup } from 'react-leaflet';

// TODO: Install dependencies before enabling clustering:
// npm install leaflet.markercluster @types/leaflet.markercluster

interface MarkerClusterGroupProps {
  children: React.ReactNode;
}

// Simple layer group that will be replaced with proper clustering once dependencies are installed
const MarkerClusterGroup: React.FC<MarkerClusterGroupProps> = ({ children }) => {
  return <LayerGroup>{children}</LayerGroup>;
};

export default MarkerClusterGroup;