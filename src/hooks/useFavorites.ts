import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { fetchUserFavorites, addFavorite as addFavoriteApi, removeFavorite as removeFavoriteApi, checkMultipleFavorites, UserFavorite } from '../utils/favorites';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type FavoriteItem = {
  id: number;
  type: 'restaurant' | 'dish';
  name?: string;
  lat?: number;
  lng?: number;
  image_url?: string;
  municipality_name?: string;
  saved_at: string;
};

// Convert from API response to internal format
function convertFavorite(fav: UserFavorite): FavoriteItem {
  return {
    id: fav.favoriteable_id,
    type: fav.favoriteable_type,
    name: fav.name,
    lat: fav.lat,
    lng: fav.lng,
    image_url: fav.image_url,
    municipality_name: fav.municipality_name,
    saved_at: fav.created_at
  };
}

export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [guestFavorites, setGuestFavorites] = useState<FavoriteItem[]>([]);
  const [favoritesCache, setFavoritesCache] = useState<Record<string, boolean>>({});

  // Load guest favorites from localStorage on mount
  useEffect(() => {
    if (!user) {
      try {
        const stored = localStorage.getItem('bulacan_guest_favorites');
        if (stored) {
          const favorites = JSON.parse(stored);
          setGuestFavorites(favorites);
          // Update cache with guest favorites
          const cache = favorites.reduce((acc: Record<string, boolean>, item: FavoriteItem) => {
            acc[`${item.type}-${item.id}`] = true;
            return acc;
          }, {});
          setFavoritesCache(cache);
        }
      } catch (err) {
        console.warn('Failed to load guest favorites:', err);
      }
    }
  }, [user]);

  // Save guest favorites to localStorage whenever they change
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem('bulacan_guest_favorites', JSON.stringify(guestFavorites));
      } catch (err) {
        console.warn('Failed to save guest favorites:', err);
      }
    }
  }, [guestFavorites, user]);

  // Query for user favorites when logged in
  const favoritesQuery = useQuery({
    queryKey: ['user', 'favorites'],
    queryFn: fetchUserFavorites,
    enabled: !!user && !user.guest,
    onSuccess: (data) => {
      // Update cache with fetched favorites
      const cache = data.reduce((acc: Record<string, boolean>, item) => {
        acc[`${item.favoriteable_type}-${item.favoriteable_id}`] = true;
        return acc;
      }, {});
      setFavoritesCache(cache);
    }
  });

  // Mutations for adding/removing favorites
  const addFavoriteMutation = useMutation({
    mutationFn: addFavoriteApi,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', 'favorites'] });
      // Update local cache optimistically
      setFavoritesCache(prev => ({
        ...prev,
        [`${variables.favoriteable_type}-${variables.favoriteable_id}`]: true
      }));
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: ({ id, type }: { id: number, type: 'restaurant' | 'dish' }) => 
      removeFavoriteApi(id, type),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', 'favorites'] });
      // Update local cache optimistically
      setFavoritesCache(prev => {
        const newCache = { ...prev };
        delete newCache[`${variables.type}-${variables.id}`];
        return newCache;
      });
    },
  });

  const addFavorite = async (item: Omit<FavoriteItem, 'saved_at'>) => {
    if (!user || user.guest) {
      // Guest mode: use localStorage
      setGuestFavorites(prev => {
        if (prev.some(f => f.id === item.id && f.type === item.type)) {
          return prev;
        }
        return [...prev, { ...item, saved_at: new Date().toISOString() }];
      });
      // Update local cache
      setFavoritesCache(prev => ({
        ...prev,
        [`${item.type}-${item.id}`]: true
      }));
    } else {
      // Logged in: use API
      await addFavoriteMutation.mutateAsync({
        favoriteable_id: item.id,
        favoriteable_type: item.type,
        metadata: {
          name: item.name,
          lat: item.lat,
          lng: item.lng,
          image_url: item.image_url,
          municipality_name: item.municipality_name,
        }
      });
    }
  };

  const removeFavorite = async (id: number, type: 'restaurant' | 'dish') => {
    if (!user || user.guest) {
      // Guest mode: use localStorage
      setGuestFavorites(prev => prev.filter(f => !(f.id === id && f.type === type)));
      // Update local cache
      setFavoritesCache(prev => {
        const newCache = { ...prev };
        delete newCache[`${type}-${id}`];
        return newCache;
      });
    } else {
      // Logged in: use API
      await removeFavoriteMutation.mutateAsync({ id, type });
    }
  };

  const isFavorite = (id: number, type: 'restaurant' | 'dish'): boolean => {
    // First check local cache for fast response
    const cacheKey = `${type}-${id}`;
    if (cacheKey in favoritesCache) {
      return favoritesCache[cacheKey];
    }

    // Fallback to checking lists
    if (!user || user.guest) {
      return guestFavorites.some(f => f.id === id && f.type === type);
    } else {
      return (favoritesQuery.data || []).some(f => 
        f.favoriteable_id === id && f.favoriteable_type === type
      );
    }
  };

  // Batch check multiple items' favorite status
  const checkFavorites = async (items: Array<{id: number, type: 'restaurant' | 'dish'}>) => {
    if (!user || user.guest) {
      // For guest mode, use local cache/state
      return items.reduce((acc, { id, type }) => {
        acc[`${type}-${id}`] = isFavorite(id, type);
        return acc;
      }, {} as Record<string, boolean>);
    }

    try {
      const status = await checkMultipleFavorites(items);
      // Update local cache with new information
      setFavoritesCache(prev => ({ ...prev, ...status }));
      return status;
    } catch (err) {
      console.error('Error checking favorites status:', err);
      return {};
    }
  };

  const clearAllFavorites = async () => {
    if (!user || user.guest) {
      // Guest mode: clear localStorage
      setGuestFavorites([]);
      setFavoritesCache({});
      localStorage.removeItem('bulacan_guest_favorites');
    } else {
      // Logged in: clear via API
      // Note: You'll need to add a clearFavorites API endpoint if needed
      for (const fav of favoritesQuery.data || []) {
        await removeFavoriteMutation.mutateAsync({
          id: fav.favoriteable_id,
          type: fav.favoriteable_type
        });
      }
      setFavoritesCache({});
    }
  };

  // Get the current favorites list
  const favorites = user && !user.guest
    ? (favoritesQuery.data?.map(convertFavorite) || [])
    : guestFavorites;

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    checkFavorites,
    clearAllFavorites,
    isLoading: favoritesQuery.isLoading
  };
}