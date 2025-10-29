import { useState, useEffect, useCallback } from 'react';
import type { Restaurant, Dish } from '../types';

const STORAGE_KEY = {
  RESTAURANTS: 'bulacan_saved_restaurants_v1',
  DISHES: 'bulacan_saved_dishes_v1'
};

interface SavedTimestamp {
  timestamp: number;
}

export interface SavedDish extends Dish, SavedTimestamp {
  municipalityName?: string;
  restaurantName?: string;
}

export interface SavedRestaurant extends Restaurant, SavedTimestamp {
  municipalityName?: string;
}

export interface SavedItem {
  type: 'restaurant' | 'dish';
  id: string;
  name: string;
  image?: string;
  category?: string;
  address?: string;
  municipalityName?: string;
  timestamp: number;
}

export function useSavedItems() {
  const [savedRestaurants, setSavedRestaurants] = useState<SavedRestaurant[]>([]);
  const [savedDishes, setSavedDishes] = useState<SavedDish[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedRestaurants = localStorage.getItem(STORAGE_KEY.RESTAURANTS);
      const storedDishes = localStorage.getItem(STORAGE_KEY.DISHES);
      
      if (storedRestaurants) {
        setSavedRestaurants(JSON.parse(storedRestaurants));
      }
      if (storedDishes) {
        setSavedDishes(JSON.parse(storedDishes));
      }
    } catch (err) {
      // Ignore storage errors
    }
  }, []);

  // Save restaurant
  const saveRestaurant = useCallback((restaurant: Restaurant, municipalityName?: string) => {
    setSavedRestaurants(current => {
      const exists = current.some(r => r.id === restaurant.id);
      if (exists) return current;
      const newItem: SavedRestaurant = { 
        ...restaurant, 
        timestamp: Date.now(),
        municipalityName 
      };
      const newList = [newItem, ...current];
      try {
        localStorage.setItem(STORAGE_KEY.RESTAURANTS, JSON.stringify(newList));
      } catch (err) {
        // Ignore storage errors
      }
      return newList;
    });
  }, []);

  // Remove restaurant
  const removeRestaurant = useCallback((id: string) => {
    setSavedRestaurants(current => {
      const newList = current.filter(r => r.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY.RESTAURANTS, JSON.stringify(newList));
      } catch (err) {
        // Ignore storage errors
      }
      return newList;
    });
  }, []);

  // Save dish
  const saveDish = useCallback((dish: Dish, municipalityName?: string, restaurantName?: string) => {
    setSavedDishes(current => {
      const exists = current.some(d => d.id === dish.id);
      if (exists) return current;
      const newItem: SavedDish = { 
        ...dish, 
        timestamp: Date.now(),
        municipalityName,
        restaurantName 
      };
      const newList = [newItem, ...current];
      try {
        localStorage.setItem(STORAGE_KEY.DISHES, JSON.stringify(newList));
      } catch (err) {
        // Ignore storage errors
      }
      return newList;
    });
  }, []);

  // Remove dish
  const removeDish = useCallback((id: string) => {
    setSavedDishes(current => {
      const newList = current.filter(d => d.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY.DISHES, JSON.stringify(newList));
      } catch (err) {
        // Ignore storage errors
      }
      return newList;
    });
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setSavedRestaurants([]);
    setSavedDishes([]);
    try {
      localStorage.removeItem(STORAGE_KEY.RESTAURANTS);
      localStorage.removeItem(STORAGE_KEY.DISHES);
    } catch (err) {
      // Ignore storage errors
    }
  }, []);

  // Get all items sorted by timestamp
  const allItems = useCallback((): SavedItem[] => {
    return [
      ...savedRestaurants.map(r => ({
        type: 'restaurant' as const,
        id: r.id,
        name: r.name,
        image: r.images?.[0],
        address: r.address,
        municipalityName: r.municipalityName,
        timestamp: r.timestamp
      })),
      ...savedDishes.map(d => ({
        type: 'dish' as const,
        id: d.id,
        name: d.name,
        image: d.image,
        category: Array.isArray(d.ingredients) ? d.ingredients[0] : undefined,
        municipalityName: d.municipalityName,
        timestamp: d.timestamp
      }))
    ].sort((a, b) => b.timestamp - a.timestamp);
  }, [savedRestaurants, savedDishes]);

  // Check if an item is saved
  const isSaved = useCallback((type: 'restaurant' | 'dish', id: string): boolean => {
    if (type === 'restaurant') {
      return savedRestaurants.some(r => r.id === id);
    } else {
      return savedDishes.some(d => d.id === id);
    }
  }, [savedRestaurants, savedDishes]);

  return {
    savedRestaurants,
    savedDishes,
    saveRestaurant,
    removeRestaurant,
    saveDish,
    removeDish,
    clearAll,
    allItems,
    isSaved
  };
}