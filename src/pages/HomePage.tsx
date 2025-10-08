// src/pages/HomePage.tsx
import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight as ChevronRightIcon,
  Map as MapIcon,
  Utensils as UtensilsIcon,
  Search as SearchIcon,
} from "lucide-react";

import InteractiveMap from "../components/map/InteractiveMap";
import DishCard from "../components/cards/DishCard";
import RestaurantCard from "../components/cards/RestaurantCard";
import { fetchDishes, fetchRestaurants, type Dish, type Restaurant } from "../utils/api";

export default function HomePage() {
  // Top dishes: sort by popularity then rating, take 3
  const topDishesQ = useQuery<Dish[]>({
    queryKey: ["top-dishes-home"],
    queryFn: () => fetchDishes(),
    select: (rows) =>
      [...rows]
        .sort(
          (a, b) =>
            (Number(b.popularity ?? 0) - Number(a.popularity ?? 0)) ||
            (Number(b.rating ?? 0) - Number(a.rating ?? 0))
        )
        .slice(0, 3),
    staleTime: 60_000,
  });

  // Top restaurants: sort by rating then name, take 3
  const topRestaurantsQ = useQuery<Restaurant[]>({
    queryKey: ["top-restaurants-home"],
    queryFn: () => fetchRestaurants(),
    select: (rows) =>
      [...rows]
        .sort(
          (a, b) =>
            Number(b.rating ?? 0) - Number(a.rating ?? 0) || a.name.localeCompare(b.name)
        )
        .slice(0, 3),
    staleTime: 60_000,
  });

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative h-[500px] md:h-[600px] bg-hero-pattern bg-cover bg-center">
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-center px-4 max-w-3xl">
            <h1 className="text-white mb-4">Bulacan Mapping Flavors</h1>
            <p className="text-white text-lg md:text-xl mb-8">
              Discover the rich culinary heritage of Bulacan Province through our
              interactive map and guide to local dishes and restaurants.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/map"
                className="btn btn-primary px-6 py-3 flex items-center justify-center"
              >
                <MapIcon size={20} className="mr-2" />
                Explore the Map
              </Link>
              <Link
                to="/restaurants"
                className="btn btn-outline bg-white/10 text-white border-white hover:bg-white/20 px-6 py-3 flex items-center justify-center"
              >
                <UtensilsIcon size={20} className="mr-2" />
                Browse Restaurants
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Introduction Section */}
      <section className="py-16 bg-neutral-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4">Experience Bulacan&apos;s Culinary Heritage</h2>
            <p className="text-neutral-700 mb-8">
              Bulacan Province is home to 24 municipalities, each with its own unique
              culinary traditions and signature dishes. Our platform helps you discover
              these flavors through an interactive map, detailed dish information, and
              restaurant recommendations.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="p-6 bg-white rounded-lg shadow-md">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapIcon size={24} className="text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Interactive Map</h3>
                <p className="text-neutral-600">
                  Explore all 24 municipalities of Bulacan and discover their signature
                  dishes.
                </p>
              </div>
              <div className="p-6 bg-white rounded-lg shadow-md">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UtensilsIcon size={24} className="text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Local Dishes</h3>
                <p className="text-neutral-600">
                  Learn about the history, cultural significance, and ingredients of each
                  dish.
                </p>
              </div>
              <div className="p-6 bg-white rounded-lg shadow-md">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <SearchIcon size={24} className="text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Restaurant Guide</h3>
                <p className="text-neutral-600">
                  Find the best restaurants serving authentic Bulacan cuisine with reviews
                  and ratings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Preview Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8">
            <h2>Explore Bulacan&apos;s Municipalities</h2>
            <Link
              to="/map"
              className="flex items-center text-primary-600 font-medium mt-4 md:mt-0 hover:text-primary-700 transition-colors"
            >
              View Full Map <ChevronRightIcon size={20} className="ml-1" />
            </Link>
          </div>
          <p className="text-neutral-700 max-w-3xl mb-8">
            Click on any of the 24 municipalities to discover their signature dishes and
            learn about their culinary heritage.
          </p>
          <div className="rounded-lg overflow-hidden shadow-lg">
            <InteractiveMap />
          </div>
        </div>
      </section>

      {/* Featured Dishes Section */}
      <section className="py-16 bg-neutral-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8">
            <h2>Featured Dishes</h2>
            <Link
              to="/dishes"
              className="flex items-center text-primary-600 font-medium mt-4 md:mt-0 hover:text-primary-700 transition-colors"
            >
              View All Dishes <ChevronRightIcon size={20} className="ml-1" />
            </Link>
          </div>
          <p className="text-neutral-700 max-w-3xl mb-8">
            Discover the most popular and highly-rated traditional dishes from across
            Bulacan Province.
          </p>

          {topDishesQ.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="skeleton rounded h-40" />
              <div className="skeleton rounded h-40" />
              <div className="skeleton rounded h-40" />
            </div>
          ) : topDishesQ.error ? (
            <div className="text-red-600">Failed to load dishes.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topDishesQ.data?.map((dish) => (
                <DishCard key={dish.id} dish={dish} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Top Restaurants Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8">
            <h2>Top Rated Restaurants</h2>
            <Link
              to="/restaurants"
              className="flex items-center text-primary-600 font-medium mt-4 md:mt-0 hover:text-primary-700 transition-colors"
            >
              View All Restaurants <ChevronRightIcon size={20} className="ml-1" />
            </Link>
          </div>
          <p className="text-neutral-700 max-w-3xl mb-8">
            Experience authentic Bulacan cuisine at these highly-rated local restaurants.
          </p>

          {topRestaurantsQ.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="skeleton rounded h-32" />
              <div className="skeleton rounded h-32" />
              <div className="skeleton rounded h-32" />
            </div>
          ) : topRestaurantsQ.error ? (
            <div className="text-red-600">Failed to load restaurants.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topRestaurantsQ.data?.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-white mb-4">Ready to Explore Filipino Flavors?</h2>
          <p className="text-white/90 max-w-2xl mx-auto mb-8">
            Start your culinary journey through Bulacan&apos;s 24 municipalities and
            discover the rich flavors and traditions of Filipino cuisine.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link className="btn bg-white text-primary-700 hover:bg-neutral-100 px-6 py-3" to="/map">
              Explore the Interactive Map
            </Link>
            <Link className="btn border border-white text-white hover:bg-white/10 px-6 py-3" to="/restaurants">
              Browse Restaurants
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
