import { useState, useCallback, useEffect } from 'react';

export type ItemType = 'restaurant' | 'dish';

export interface FavoriteItem {
  id: number;
  type: ItemType;
  name: string;
  lat?: number;
  lng?: number;
  image_url?: string;
  municipality_name?: string;
  saved_at?: number;
}

interface UseFavoritesReturn {
  favorites: FavoriteItem[];
  isFavorite: (id: number, type: ItemType) => boolean;
  addFavorite: (item: Omit<FavoriteItem, 'saved_at'>) => void;
  removeFavorite: (id: number, type: ItemType) => void;
  clearAllFavorites: () => void;
  getFavoritesByType: (type: ItemType) => FavoriteItem[];
  getFavoritesCount: () => number;
  getRecentFavorites: (limit?: number) => FavoriteItem[];
}

const STORAGE_KEY = 'bulacanFlavorsFavorites';

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist favorites to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }, [favorites]);

  // Check if an item is in favorites
  const isFavorite = useCallback(
    (id: number, type: ItemType) => 
      favorites.some(item => item.id === id && item.type === type),
    [favorites]
  );

  // Add an item to favorites
  const addFavorite = useCallback((item: Omit<FavoriteItem, 'saved_at'>) => {
    setFavorites(prev => {
      // Don't add if already exists
      if (prev.some(i => i.id === item.id && i.type === item.type)) {
        return prev;
      }
      const itemWithTimestamp = {
        ...item,
        saved_at: Date.now()
      };
      return [...prev, itemWithTimestamp];
    });
  }, []);

  // Remove an item from favorites
  const removeFavorite = useCallback((id: number, type: ItemType) => {
    setFavorites(prev => 
      prev.filter(item => !(item.id === id && item.type === type))
    );
  }, []);

  // Clear all favorites
  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  // Get favorites filtered by type
  const getFavoritesByType = useCallback(
    (type: ItemType) => favorites.filter(item => item.type === type),
    [favorites]
  );

  // Get total count of favorites
  const getFavoritesCount = useCallback(
    () => favorites.length,
    [favorites]
  );

  // Get recent favorites
  const getRecentFavorites = useCallback(
    (limit = 5) => {
      return [...favorites]
        .sort((a, b) => (b.saved_at || 0) - (a.saved_at || 0))
        .slice(0, limit);
    },
    [favorites]
  );

  // Clear all favorites
  const clearAllFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  return {
    favorites,
    isFavorite,
    addFavorite,
    removeFavorite,
    clearAllFavorites,
    getFavoritesByType,
    getFavoritesCount,
    getRecentFavorites,
  };
}
