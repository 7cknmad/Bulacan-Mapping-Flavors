import { useEffect, useState } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../ToastProvider';
import { useNavigate } from 'react-router-dom';

export default function SavedPanel() {
  const { user } = useAuth();
  const { favorites, getFavoritesByType, removeFavorite, clearAllFavorites } = useFavorites();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const addToast = useToast();
  const navigate = useNavigate();

  const savedRestaurants = getFavoritesByType('restaurant');
  const savedDishes = getFavoritesByType('dish');

  const clearSaved = () => {
    setConfirmClearOpen(true);
  };

  const confirmClearSaved = () => {
    clearAllFavorites();
    setConfirmClearOpen(false);
  };

  const cancelClear = () => setConfirmClearOpen(false);

  const handleRemoveFavorite = async (id: number|string, type: string) => {
    try {
  await removeFavorite(Number(id), type as 'restaurant' | 'dish');
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
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
            <Heart size={20} className="text-rose-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-800">Favorites</h3>
            <p className="text-xs text-neutral-500">Your curated collection</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700">
            {favorites.length} saved
          </span>
        </div>
      </div>

      {/* Action Bar with Clear All */}
      {favorites.length > 0 && (
        <div className="flex items-center justify-between bg-neutral-50 rounded-lg p-2">
          <span className="text-sm text-neutral-600 px-2">
            {savedRestaurants.length} restaurants • {savedDishes.length} dishes
          </span>
          {!confirmClearOpen ? (
            <button
              onClick={clearSaved}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md hover:bg-white transition-colors text-neutral-600 hover:text-red-600"
              aria-haspopup="dialog"
              aria-expanded="false"
              title="Clear all favorites"
            >
              <Trash2 size={16} />
              Clear All
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600">Clear all favorites?</span>
              <button 
                onClick={confirmClearSaved} 
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                Yes, Clear All
              </button>
              <button 
                onClick={cancelClear} 
                className="px-3 py-1.5 text-sm bg-white text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        {/* Restaurants Section */}
        {savedRestaurants.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-neutral-500 flex items-center gap-2 px-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Restaurants
            </h4>
            <div className="space-y-2">
              {savedRestaurants.map((r) => (
                <div key={`sr-${r.id}`} className="group relative">
                  <button
                    type="button"
                    onClick={() => navigate(`/restaurant/${r.id}`)}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-all duration-200 hover:shadow-sm w-full text-left"
                    aria-label={`View details for ${r.name}`}
                  >
                    <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                      {r.image_url ? (
                        <img 
                          src={r.image_url} 
                          alt={r.name} 
                          className="h-full w-full object-cover transform group-hover:scale-105 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-neutral-100">
                          <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <h3 className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors mb-1">
                        {r.name}
                      </h3>
                      {r.municipality_name && (
                        <div className="flex items-center gap-1.5 text-neutral-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-xs truncate">{r.municipality_name}</span>
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    aria-label={`Remove ${r.name} from favorites`}
                    title={`Remove ${r.name}`}
                    onClick={() => {
                      if (!user) {
                        addToast('Please log in to manage favorites.', 'error');
                        return;
                      }
                      handleRemoveFavorite(r.id, 'restaurant');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-red-50 text-neutral-400 hover:text-red-500"
                  >
                    <Heart size={16} className="fill-current" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dishes Section */}
        {savedDishes.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-neutral-500 flex items-center gap-2 px-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Dishes
            </h4>
            <div className="space-y-2">
              {savedDishes.map((d) => (
                <div key={`sd-${d.id}`} className="group relative">
                  <button
                    type="button"
                    onClick={() => navigate(`/dish/${d.slug ?? d.id}`)}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-all duration-200 hover:shadow-sm w-full text-left"
                    aria-label={`View details for ${d.name}`}
                  >
                    <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                      {d.image_url ? (
                        <img 
                          src={d.image_url} 
                          alt={d.name} 
                          className="h-full w-full object-cover transform group-hover:scale-105 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-neutral-100">
                          <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <h3 className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors mb-1">
                        {d.name}
                      </h3>
                      {d.municipality_name && (
                        <div className="flex items-center gap-1.5 text-neutral-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="text-xs truncate">{d.municipality_name}</span>
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    aria-label={`Remove ${d.name} from favorites`}
                    title={`Remove ${d.name}`}
                    onClick={() => {
                      if (!user) {
                        addToast('Please log in to manage favorites.', 'error');
                        return;
                      }
                      handleRemoveFavorite(d.id, 'dish');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-red-50 text-neutral-400 hover:text-red-500"
                  >
                    <Heart size={16} className="fill-current" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {favorites.length === 0 && (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-50 flex items-center justify-center">
              <Heart size={24} className="text-rose-400" />
            </div>
            <h3 className="text-neutral-600 font-medium mb-2">No Favorites Yet</h3>
            <p className="text-neutral-500 text-sm mb-4 max-w-[240px] mx-auto">
              Start adding your favorite restaurants and dishes to create your personal collection.
            </p>
            <a 
              href="/map" 
              className="inline-flex items-center gap-2 text-sm text-rose-600 hover:text-rose-700 font-medium bg-rose-50 px-4 py-2 rounded-full hover:bg-rose-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start Exploring
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
