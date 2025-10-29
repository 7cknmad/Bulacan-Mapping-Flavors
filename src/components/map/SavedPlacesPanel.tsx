import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFavorites, type FavoriteItem } from '../../hooks/useFavorites';

interface SavedPlacesPanelProps {
  onSelect: (item: FavoriteItem) => void;
  className?: string;
}

const SavedPlacesPanel: React.FC<SavedPlacesPanelProps> = ({ onSelect, className = '' }) => {
  const { favorites, removeFavorite, clearAllFavorites } = useFavorites();

  // Sort favorites by saved_at timestamp
  const sortedFavorites = [...favorites].sort((a, b) => 
    ((b.saved_at || 0) - (a.saved_at || 0))
  ).slice(0, 10);

  if (!sortedFavorites.length) return null;

  return (
    <div className={`bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-sm ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-neutral-800">Saved Places</h3>
        <button
          onClick={clearAllFavorites}
          className="text-xs text-neutral-500 hover:text-neutral-700"
          aria-label="Clear all saved places"
        >
          Clear All
        </button>
      </div>
      <AnimatePresence mode="sync">
        {sortedFavorites.map((item) => (
          <motion.div
            key={`${item.type}-${item.id}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="relative group"
          >
            <button
              onClick={() => onSelect(item)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-primary-50 transition-colors flex items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-neutral-800 truncate">
                  {item.name}
                </div>
                {item.municipality_name && (
                  <div className="text-xs text-neutral-500 truncate">
                    {item.municipality_name}
                  </div>
                )}
                <div className="text-xs text-neutral-400">
                  {item.type === 'restaurant' ? '🍽️ Restaurant' : '🍜 Dish'}
                </div>
              </div>
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  removeFavorite(item.id, item.type); 
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-500"
                aria-label={`Remove ${item.name} from saved places`}
              >
                ×
              </button>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default SavedPlacesPanel;