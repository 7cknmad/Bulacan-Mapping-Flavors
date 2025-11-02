// Municipality types
export interface Municipality {
  id: string;
  name: string;
  description: string;
  coordinates: [number, number]; // [latitude, longitude]
  image: string;
  dishes: string[]; // IDs of signature dishes
}
// Dish types
export interface Dish {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  municipality_id: number;
  category?: 'food' | 'delicacy' | 'drink';
  signature?: boolean;
  panel_rank?: number;
  popularity?: number;
  rating?: number;
  avg_rating?: number;
  total_ratings?: number;
  is_featured?: boolean;
  flavor_profile?: string[];
  ingredients?: string[];
}
// Restaurant types
export interface Restaurant {
  id: string;
  name: string;
  description: string;
  address: string;
  coordinates: [number, number]; // [latitude, longitude]
  contactNumber: string;
  website?: string;
  openingHours: {
    [key: string]: string; // e.g., "Monday": "9:00 AM - 10:00 PM"
  };
  priceRange: '₱' | '₱₱' | '₱₱₱' | '₱₱₱₱'; // Budget to Luxury
  cuisineType: string[];
  dishIds: string[]; // IDs of dishes served
  images: string[];
  rating: number;
  reviews: Review[];
}
// Review types
export interface Review {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
  restaurantId: string;
}
// User types
export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: 'user' | 'admin';
  favorites: {
    dishes: string[];
    restaurants: string[];
  };
}
// Filter types
export interface FilterOptions {
  priceRange?: ('₱' | '₱₱' | '₱₱₱' | '₱₱₱₱')[];
  rating?: number;
  cuisineType?: string[];
  distance?: number;
}
// Search types
export interface SearchResult {
  type: 'dish' | 'restaurant' | 'municipality';
  id: string;
  name: string;
  image: string;
  description: string;
}