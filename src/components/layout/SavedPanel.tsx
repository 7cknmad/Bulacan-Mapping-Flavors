import { useEffect, useState } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';

export default function SavedPanel() {
  const { favorites, getFavoritesByType, removeFavorite, clearAllFavorites } = useFavorites();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Heart size={18} />
          <div>
            <h3 className="text-base font-semibold">Favorites</h3>
            <p className="text-xs text-neutral-500">Your favorite restaurants and dishes</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-l border-neutral-100 pl-3 ml-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-700">
            {favorites.length}
          </span>
          {!confirmClearOpen ? (
            <div className="flex items-center gap-2">
              <button
                onClick={clearSaved}
                className="btn btn-square btn-ghost btn-sm text-neutral-600"
                aria-haspopup="dialog"
                aria-expanded="false"
                aria-label="Clear all favorites"
                title="Clear all favorites"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600">Clear all?</span>
              <button onClick={confirmClearSaved} className="btn btn-sm btn-primary">Yes</button>
              <button onClick={cancelClear} className="btn btn-ghost btn-sm">No</button>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y">
        {savedRestaurants.length > 0 && (
          <div className="pt-2 pb-4">
            <h4 className="text-sm font-medium mb-3">Restaurants</h4>
            <ul className="flex flex-col gap-3">
              {savedRestaurants.map((r) => (
                <li key={`sr-${r.id}`} className="flex items-center gap-3">
                  <a href={`/restaurant/${r.id}`} className="flex items-center gap-3 flex-1 p-2 rounded-md hover:bg-neutral-50 transition-colors">
                    <div className="relative h-12 w-12 rounded-md overflow-hidden bg-neutral-100 flex-shrink-0">
                      {r.image_url ? (
                        <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-neutral-500">No image</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.name}</div>
                      {r.municipality_name && (
                        <div className="text-xs text-neutral-500 truncate">{r.municipality_name}</div>
                      )}
                    </div>
                  </a>
                  <button
                    aria-label={`Remove ${r.name} from favorites`}
                    title={`Remove ${r.name}`}
                    onClick={() => removeFavorite(r.id, 'restaurant')}
                    className="p-1 rounded hover:bg-neutral-100 text-red-500"
                  >
                    <Heart size={14} className="fill-current" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {savedDishes.length > 0 && (
          <div className="pt-4">
            <h4 className="text-sm font-medium mb-3">Dishes</h4>
            <ul className="flex flex-col gap-3">
              {savedDishes.map((d) => (
                <li key={`sd-${d.id}`} className="flex items-center gap-3">
                  <a href={`/dish/${d.id}`} className="flex items-center gap-3 flex-1 p-2 rounded-md hover:bg-neutral-50 transition-colors">
                    <div className="relative h-12 w-12 rounded-md overflow-hidden bg-neutral-100 flex-shrink-0">
                      {d.image_url ? (
                        <img src={d.image_url} alt={d.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-neutral-500">No image</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{d.name}</div>
                      {d.municipality_name && (
                        <div className="text-xs text-neutral-500 truncate">{d.municipality_name}</div>
                      )}
                    </div>
                  </a>
                  <button
                    aria-label={`Remove ${d.name} from favorites`}
                    title={`Remove ${d.name}`}
                    onClick={() => removeFavorite(d.id, 'dish')}
                    className="p-1 rounded hover:bg-neutral-100 text-red-500"
                  >
                    <Heart size={14} className="fill-current" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {favorites.length === 0 && (
          <div className="p-4 text-center text-neutral-600">
            <p>No favorites yet</p>
            <p className="text-sm mt-2">Click the heart icon on any restaurant or dish to save it here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
