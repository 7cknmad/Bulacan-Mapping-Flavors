import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFavorites, type FavoriteItem } from '../../hooks/useFavorites';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../ToastProvider';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../ConfirmModal';

interface SavedPlacesPanelProps {
  onSelect: (item: FavoriteItem) => void;
  className?: string;
}

const SavedPlacesPanel: React.FC<SavedPlacesPanelProps> = ({ onSelect, className = '' }) => {
  const [detailsItem, setDetailsItem] = React.useState<FavoriteItem | null>(null);
  const { favorites, removeFavorite, clearAllFavorites } = useFavorites();
  const { user } = useAuth();
  const addToast = useToast();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingRemove, setPendingRemove] = React.useState<FavoriteItem | null>(null);

  // Only show restaurants
  const restaurantFavorites = favorites.filter(f => f.type === 'restaurant');
  // Sort by saved_at
  const sortedFavorites = [...restaurantFavorites].sort((a, b) => ((b.saved_at || 0) - (a.saved_at || 0))).slice(0, 10);

  if (!sortedFavorites.length) return null;

  // Always show name, fallback to 'Unnamed Restaurant' if missing
  const getName = (item: FavoriteItem) => item.name?.trim() ? item.name : 'Unnamed Restaurant';

  const handleRemove = async () => {
    if (!pendingRemove || !user) return;
    try {
      await removeFavorite(Number(pendingRemove.id), 'restaurant');
      setConfirmOpen(false);
      setPendingRemove(null);
    } catch (error: any) {
      if (error?.code === 'LOGIN_REQUIRED') {
        addToast('Please log in to manage favorites.', 'error');
        navigate('/auth');
        return;
      }
      addToast('Failed to update favorites.', 'error');
    }
  };

  return (
    <div className={`bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-sm ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-neutral-800">Saved Restaurants</h3>
        <button
          onClick={clearAllFavorites}
          className="text-xs text-neutral-500 hover:text-neutral-700"
          aria-label="Clear all saved restaurants"
        >
          Clear All
        </button>
      </div>
      <AnimatePresence mode="sync">
        {sortedFavorites.map((item) => (
          <motion.div
            key={`restaurant-${item.id}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="relative group"
          >
            <div className="w-full px-2 py-1.5 rounded hover:bg-primary-50 transition-colors flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-neutral-800 truncate">
                  {getName(item)}
                </div>
                {item.municipality_name && (
                  <div className="text-xs text-neutral-500 truncate">
                    {item.municipality_name}
                  </div>
                )}
                <div className="text-xs text-neutral-400">
                  🍽️ Restaurant
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <button
                  onClick={() => onSelect(item)}
                  className="text-xs px-2 py-1 rounded bg-primary-100 hover:bg-primary-200 text-primary-700"
                  aria-label={`Show ${getName(item)} on map`}
                >
                  Show on Map
                </button>
                <button
                  onClick={() => setDetailsItem(item)}
                  className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                  aria-label={`View details for ${getName(item)}`}
                >
                  View Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!user) return;
                    setPendingRemove(item);
                    setConfirmOpen(true);
                  }}
                  className={`text-xs p-1 hover:text-red-500 ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label={`Remove ${getName(item)} from saved restaurants`}
                  disabled={!user}
                  title={!user ? 'Login required to manage favorites' : undefined}
                >
                  ×
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {/* Details panel for selected restaurant */}
      {detailsItem && (
        <div className="fixed left-0 top-0 w-[340px] h-full bg-white/95 backdrop-blur-lg shadow-2xl z-[9999] p-4 overflow-y-auto">
          <button
            className="absolute top-2 right-2 text-neutral-500 hover:text-neutral-700 text-lg"
            onClick={() => setDetailsItem(null)}
            aria-label="Close details"
          >
            ×
          </button>
          <h2 className="font-bold text-xl mb-2">{getName(detailsItem)}</h2>
          {detailsItem.image_url && (
            <img src={detailsItem.image_url} alt={getName(detailsItem)} className="w-full h-40 object-cover rounded mb-2" />
          )}
          <div className="mb-2 text-sm text-neutral-700">
            <strong>Municipality:</strong> {detailsItem.municipality_name || 'Unknown'}
          </div>
          {detailsItem.lat && detailsItem.lng && (
            <div className="mb-2 text-sm text-neutral-700">
              <strong>Location:</strong> {detailsItem.lat}, {detailsItem.lng}
            </div>
          )}
          {/* Add more details as needed */}
        </div>
      )}
      {/* Confirm deletion modal */}
      <ConfirmModal
        open={confirmOpen}
        title="Remove Saved Restaurant?"
        message={pendingRemove ? `Are you sure you want to remove "${getName(pendingRemove)}" from your saved restaurants?` : ''}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => { setConfirmOpen(false); setPendingRemove(null); }}
      />
    </div>
  );
};

export default SavedPlacesPanel;