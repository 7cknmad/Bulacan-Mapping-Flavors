import React from 'react';
import { Map as MapIcon, Compass, Filter, Search } from 'lucide-react';

interface MapControlPanelProps {
  searchRadius: number;
  onSearchRadiusChange: (radius: number) => void;
  sortByDistance: boolean;
  onSortByDistanceChange: () => void;
  viewDirectionEnabled: boolean;
  onViewDirectionChange: (enabled: boolean) => void;
  bearingDeg: number;
  onBearingChange: (bearing: number) => void;
  coneWidthDeg: number;
  onConeWidthChange: (width: number) => void;
  useDeviceCompass: boolean;
  onUseDeviceCompassChange: (use: boolean) => void;
  userLocation: [number, number] | null;
  onLocate: () => void;
  onMapStyleChange: () => void;
  onMapReset: () => void;
  className?: string;
}

const MapControlPanel: React.FC<MapControlPanelProps> = ({
  searchRadius,
  onSearchRadiusChange,
  sortByDistance,
  onSortByDistanceChange,
  viewDirectionEnabled,
  onViewDirectionChange,
  bearingDeg,
  onBearingChange,
  coneWidthDeg,
  onConeWidthChange,
  useDeviceCompass,
  onUseDeviceCompassChange,
  userLocation,
  onLocate,
  onMapStyleChange,
  onMapReset,
  className = '',
}) => {
  return (
    <div className={`bg-white/95 backdrop-blur-sm shadow-lg rounded-lg p-4 ${className}`}>
      {/* Section: Location & Search */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Search size={16} />
            Search & Filter
          </h3>
          <button
            onClick={onMapReset}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            Reset
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Search Radius: {searchRadius}km</label>
            <input
              type="range"
              min={1}
              max={20}
              value={searchRadius}
              onChange={(e) => onSearchRadiusChange(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600">Sort by Distance</label>
            <button
              onClick={onSortByDistanceChange}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                sortByDistance ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {sortByDistance ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>

      <div className="my-4 border-t border-gray-200" />

      {/* Section: View Direction */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Compass size={16} />
            View Direction
          </h3>
          <button
            onClick={() => onViewDirectionChange(!viewDirectionEnabled)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewDirectionEnabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {viewDirectionEnabled ? 'On' : 'Off'}
          </button>
        </div>

        {viewDirectionEnabled && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Bearing: {bearingDeg}°</label>
              <input
                type="range"
                min={0}
                max={359}
                value={bearingDeg}
                onChange={(e) => onBearingChange(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 mb-1 block">Cone Width: {coneWidthDeg}°</label>
              <input
                type="range"
                min={10}
                max={180}
                value={coneWidthDeg}
                onChange={(e) => onConeWidthChange(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600">Use Device Compass</label>
              <button
                onClick={() => onUseDeviceCompassChange(!useDeviceCompass)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  useDeviceCompass ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {useDeviceCompass ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="my-4 border-t border-gray-200" />

      {/* Section: Map Controls */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapIcon size={16} />
            Map Controls
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onLocate}
            className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
              userLocation
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Compass size={14} />
            {userLocation ? 'Update Location' : 'Get Location'}
          </button>

          <button
            onClick={onMapStyleChange}
            className="px-3 py-1.5 rounded text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-2 transition-colors"
          >
            <MapIcon size={14} />
            Change Style
          </button>
        </div>
      </div>

      {/* Responsive design note */}
      <div className="mt-4 text-xs text-gray-500">
        Tip: Use these controls to filter and customize your map view
      </div>
    </div>
  );
};

export default MapControlPanel;