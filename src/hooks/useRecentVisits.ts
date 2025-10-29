import { useState, useEffect, useCallback } from 'react';
import type { Restaurant } from '../utils/api';

const STORAGE_KEY = 'bulacan_recent_restaurants_v1';
const MAX_RECENT_VISITS = 10;

export interface RecentVisit {
  id: number;
  name: string;
  lat?: number | null;
  lng?: number | null;
  timestamp: number;
  municipalityName?: string;
}

export function useRecentVisits() {
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentVisits(parsed.slice(0, MAX_RECENT_VISITS));
        }
      }
    } catch (err) {
      // Ignore storage errors
    }
  }, []);

  // Persist to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentVisits));
    } catch (err) {
      // Ignore storage errors
    }
  }, [recentVisits]);

  // Add a restaurant visit
  const addVisit = useCallback((restaurant: Pick<Restaurant, 'id' | 'name' | 'lat' | 'lng'> & { municipalityName?: string }) => {
    setRecentVisits(current => {
      // Remove any existing entry for this restaurant
      const filtered = current.filter(v => v.id !== restaurant.id);
      
      // Add new visit at the start
      const newVisit: RecentVisit = {
        id: restaurant.id,
        name: restaurant.name,
        lat: restaurant.lat,
        lng: restaurant.lng,
        municipalityName: restaurant.municipalityName,
        timestamp: Date.now()
      };

      // Return new array with latest visit first, limited to max size
      return [newVisit, ...filtered].slice(0, MAX_RECENT_VISITS);
    });
  }, []);

  // Clear all visits
  const clearVisits = useCallback(() => {
    setRecentVisits([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      // Ignore storage errors
    }
  }, []);

  // Remove a specific visit by id
  const removeVisit = useCallback((id: number) => {
    setRecentVisits(current => current.filter(v => v.id !== id));
  }, []);

  return {
    recentVisits,
    addVisit,
    removeVisit,
    clearVisits
  };
}