import React, { useState, useEffect } from 'react';
import { fetchTopDishes, fetchTopRestaurants } from '../utils/api';
import { Dish, Restaurant } from '../utils/api';

const TopItems: React.FC = () => {
  const [municipalityId, setMunicipalityId] = useState<number>(1); // Default to municipality 1
  const [topDishes, setTopDishes] = useState<Dish[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<Restaurant[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const dishes = await fetchTopDishes(municipalityId);
        setTopDishes(dishes);

        const restaurants = await fetchTopRestaurants(municipalityId);
        setTopRestaurants(restaurants);
      } catch (error) {
        console.error('Error fetching top items:', error);
      }
    }
    loadData();
  }, [municipalityId]);

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Top Dishes and Restaurants</h1>

      <div className="mb-6">
        <label htmlFor="municipality">Filter by Municipality:</label>
        <select
          id="municipality"
          value={municipalityId}
          onChange={(e) => setMunicipalityId(Number(e.target.value))}
          className="ml-2 px-2 py-1 border"
        >
          <option value={1}>Municipality 1</option>
          <option value={2}>Municipality 2</option>
          <option value={3}>Municipality 3</option>
        </select>
      </div>

      <h2 className="text-xl font-semibold mb-3">Top Dishes</h2>
      <ul className="mb-6">
        {topDishes.map((dish) => (
          <li key={dish.id} className="border-b py-2">
            <p className="font-medium">{dish.name}</p>
            <p className="text-sm text-gray-600">Rating: {dish.avg_rating} ⭐</p>
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-semibold mb-3">Top Restaurants</h2>
      <ul>
        {topRestaurants.map((restaurant) => (
          <li key={restaurant.id} className="border-b py-2">
            <p className="font-medium">{restaurant.name}</p>
            <p className="text-sm text-gray-600">Rating: {restaurant.avg_rating} ⭐</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TopItems;