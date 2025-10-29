import { get, post, del } from './api';

export interface UserFavorite {
  id?: number;
  favoriteable_id: number;
  favoriteable_type: 'restaurant' | 'dish';
  created_at: string;
  // Include additional metadata when available
  name?: string;
  lat?: number;
  lng?: number;
  image_url?: string;
  municipality_name?: string;
}

// Fetch all favorites for the logged-in user
export const fetchUserFavorites = async (): Promise<UserFavorite[]> => {
  const response = await get<Array<{item_id: number, item_type: string, metadata?: any, created_at: string}>>('/api/user/favorites');
  return response.map(item => ({
    favoriteable_id: item.item_id,
    favoriteable_type: item.item_type as 'restaurant' | 'dish',
    ...item.metadata,
    created_at: item.created_at
  }));
};

// Add a new favorite
export const addFavorite = (data: {
  favoriteable_id: number;
  favoriteable_type: 'restaurant' | 'dish';
  metadata?: {
    name?: string;
    lat?: number;
    lng?: number;
    image_url?: string;
    municipality_name?: string;
  }
}) => post('/api/user/favorites', {
  itemId: data.favoriteable_id,
  itemType: data.favoriteable_type,
  metadata: data.metadata
});

// Remove a favorite
export const removeFavorite = (favoriteable_id: number, favoriteable_type: 'restaurant' | 'dish') => 
  del(`/api/user/favorites/${favoriteable_type}/${favoriteable_id}`);

// Batch check multiple items' favorite status
export const checkMultipleFavorites = (items: Array<{id: number, type: 'restaurant' | 'dish'}>) =>
  post<Record<string, boolean>>('/api/user/favorites/check', {
    items: items.map(({ id, type }) => ({ itemId: id, itemType: type }))
  });

// Check if a single item is favorited (using the batch endpoint for consistency)
export const checkIsFavorite = async (favoriteable_id: number, favoriteable_type: 'restaurant' | 'dish') => {
  const result = await checkMultipleFavorites([{ id: favoriteable_id, type: favoriteable_type }]);
  return { is_favorite: result[`${favoriteable_type}-${favoriteable_id}`] || false };
};