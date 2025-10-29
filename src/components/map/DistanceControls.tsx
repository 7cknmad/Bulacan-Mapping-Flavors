import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface DistanceControlsProps {
  radiusKm: number;
  onRadiusChange: (radius: number) => void;
  onSortByDistance: () => void;
  isSortedByDistance: boolean;
  className?: string;
  userLocation?: [number, number] | null;
}

const DistanceControls: React.FC<DistanceControlsProps> = ({
  radiusKm,
  onRadiusChange,
  onSortByDistance,
  isSortedByDistance,
  className = '',
  userLocation
}) => {
  // Preset radius options in kilometers
  const radiusOptions = [1, 2, 5, 10, 20];

  if (!userLocation) return null;

  return (
    <div className={`bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 ${className}`}>
      <div className="space-y-3">
        <div>
          <label htmlFor="radius-slider" className="block text-sm font-medium text-neutral-700 mb-1">
            Search Radius: {radiusKm}km
          </label>
          <input
            id="radius-slider"
            type="range"
            min="1"
            max="20"
            step="1"
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-neutral-500 mt-1">
            {radiusOptions.map((r) => (
              <button
                key={r}
                onClick={() => onRadiusChange(r)}
                className={`px-2 py-1 rounded ${
                  radiusKm === r ? 'bg-primary-100 text-primary-700' : 'hover:bg-neutral-100'
                }`}
              >
                {r}km
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSortByDistance}
            className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 ${
              isSortedByDistance
                ? 'bg-primary-100 text-primary-700'
                : 'bg-neutral-100 hover:bg-neutral-200'
            }`}
          >
            <span>Sort by Distance</span>
            {isSortedByDistance && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-1.5 h-1.5 rounded-full bg-primary-500"
              />
            )}
          </button>
        </div>

        <div className="text-xs text-neutral-500 mt-1">
          Shows restaurants within {radiusKm}km of your location
        </div>
      </div>
    </div>
  );
};

export default DistanceControls;