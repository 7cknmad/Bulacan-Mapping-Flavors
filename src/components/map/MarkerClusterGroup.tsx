import React from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { createPathComponent, LayerProps } from '@react-leaflet/core';
import './marker-cluster.css';

interface MarkerClusterGroupProps extends LayerProps {
  children: React.ReactNode;
  chunkedLoading?: boolean;
  spiderfyOnMaxZoom?: boolean;
  showCoverageOnHover?: boolean;
  zoomToBoundsOnClick?: boolean;
  maxClusterRadius?: number;
}

const MarkerClusterGroup = createPathComponent<L.MarkerClusterGroup, MarkerClusterGroupProps>(
  function createMarkerClusterGroup({ children: _c, ...props }, ctx) {
    const clusterProps = {
      ...props,
      iconCreateFunction: (cluster: L.MarkerCluster) => {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count > 50) size = 'large';
        else if (count > 10) size = 'medium';
        
        return L.divIcon({
          html: `<div class="marker-cluster marker-cluster-${size}">
                  <div class="marker-cluster-inner">
                    <span>${count}</span>
                  </div>
                </div>`,
          className: 'custom-marker-cluster',
        });
      },
    };

    const instance = new L.MarkerClusterGroup(clusterProps);
    return {
      instance,
      context: { ...ctx, layerContainer: instance },
    };
  }
);

export default MarkerClusterGroup;