import React, { useState, Component } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboardIcon, BookOpenIcon, UtensilsIcon, UsersIcon, MessageSquareIcon, BarChartIcon, SettingsIcon, LogOutIcon, ChevronRightIcon, PlusIcon, SearchIcon, FilterIcon } from 'lucide-react';
import { mockDishes, mockRestaurants } from '../data/mockData';
// Admin sub-components
const AdminOverview: React.FC = () => {
  return <div>
      <h2 className="mb-6">Dashboard Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Total Dishes</h3>
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <BookOpenIcon size={20} className="text-primary-600" />
            </div>
          </div>
          <p className="text-3xl font-bold">{mockDishes.length}</p>
          <p className="text-sm text-neutral-500 mt-2">
            Across{' '}
            {mockDishes.reduce((acc, dish) => {
            if (!acc.includes(dish.municipalityId)) acc.push(dish.municipalityId);
            return acc;
          }, [] as string[]).length}{' '}
            municipalities
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Total Restaurants</h3>
            <div className="w-10 h-10 rounded-full bg-secondary-100 flex items-center justify-center">
              <UtensilsIcon size={20} className="text-secondary-600" />
            </div>
          </div>
          <p className="text-3xl font-bold">{mockRestaurants.length}</p>
          <p className="text-sm text-neutral-500 mt-2">
            With{' '}
            {mockRestaurants.reduce((acc, restaurant) => acc + restaurant.reviews.length, 0)}{' '}
            reviews
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Users</h3>
            <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center">
              <UsersIcon size={20} className="text-accent-600" />
            </div>
          </div>
          <p className="text-3xl font-bold">127</p>
          <p className="text-sm text-neutral-500 mt-2">12 new this month</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Page Views</h3>
            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
              <BarChartIcon size={20} className="text-neutral-600" />
            </div>
          </div>
          <p className="text-3xl font-bold">5,382</p>
          <p className="text-sm text-neutral-500 mt-2">+18% from last month</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Recent Reviews</h3>
            <Link to="/admin/reviews" className="text-primary-600 text-sm hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {mockRestaurants.flatMap(restaurant => restaurant.reviews.map(review => ({
            ...review,
            restaurantName: restaurant.name
          }))).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3).map(review => <div key={review.id} className="border-b border-neutral-100 pb-3">
                  <div className="flex items-start">
                    <img src={review.userImage || 'https://via.placeholder.com/40'} alt={review.userName} className="w-10 h-10 rounded-full mr-3" />
                    <div>
                      <div className="flex items-center">
                        <h4 className="font-medium text-sm mr-2">
                          {review.userName}
                        </h4>
                        <span className="text-xs text-neutral-500">
                          {review.date}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">
                        Review for{' '}
                        <span className="font-medium">
                          {(review as any).restaurantName}
                        </span>
                      </p>
                      <div className="flex items-center mt-1">
                        {[...Array(5)].map((_, i) => <StarIcon key={i} size={14} className={`${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-300'} mr-0.5`} />)}
                      </div>
                    </div>
                  </div>
                </div>)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Popular Dishes</h3>
            <Link to="/admin/dishes" className="text-primary-600 text-sm hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {[...mockDishes].sort((a, b) => b.rating - a.rating).slice(0, 5).map(dish => <div key={dish.id} className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="flex items-center">
                    <img src={dish.image} alt={dish.name} className="w-12 h-12 object-cover rounded-md mr-3" />
                    <div>
                      <h4 className="font-medium">{dish.name}</h4>
                      <p className="text-xs text-neutral-500">
                        {mockMunicipalities.find(m => m.id === dish.municipalityId)?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <StarIcon size={16} className="text-yellow-500 fill-yellow-500 mr-1" />
                    <span className="font-medium">
                      {dish.rating.toFixed(1)}
                    </span>
                  </div>
                </div>)}
          </div>
        </div>
      </div>
    </div>;
};
// Admin Dishes Management
const AdminDishes: React.FC = () => {
  return <div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <h2>Manage Dishes</h2>
        <button className="btn btn-primary flex items-center mt-4 md:mt-0">
          <PlusIcon size={18} className="mr-2" />
          Add New Dish
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon size={18} className="text-neutral-500" />
            </div>
            <input type="text" className="input pl-10" placeholder="Search dishes..." />
          </div>
          <button className="flex items-center justify-center px-4 py-2 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors">
            <FilterIcon size={18} className="mr-2" />
            <span>Filters</span>
          </button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Dish
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Municipality
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Rating
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Restaurants
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {mockDishes.map(dish => <tr key={dish.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img src={dish.image} alt={dish.name} className="w-10 h-10 rounded-md object-cover mr-3" />
                      <div>
                        <div className="font-medium text-neutral-900">
                          {dish.name}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {dish.ingredients.slice(0, 3).join(', ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span>
                      {mockMunicipalities.find(m => m.id === dish.municipalityId)?.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <StarIcon size={16} className="text-yellow-500 fill-yellow-500 mr-1" />
                      <span>{dish.rating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span>{dish.restaurantIds.length}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-800 mr-3">
                      Edit
                    </button>
                    <button className="text-red-600 hover:text-red-800">
                      Delete
                    </button>
                  </td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
};
// Admin Restaurants Management
const AdminRestaurants: React.FC = () => {
  return <div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <h2>Manage Restaurants</h2>
        <button className="btn btn-primary flex items-center mt-4 md:mt-0">
          <PlusIcon size={18} className="mr-2" />
          Add New Restaurant
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon size={18} className="text-neutral-500" />
            </div>
            <input type="text" className="input pl-10" placeholder="Search restaurants..." />
          </div>
          <button className="flex items-center justify-center px-4 py-2 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors">
            <FilterIcon size={18} className="mr-2" />
            <span>Filters</span>
          </button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Restaurant
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Location
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Rating
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Price
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {mockRestaurants.map(restaurant => <tr key={restaurant.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img src={restaurant.images[0]} alt={restaurant.name} className="w-10 h-10 rounded-md object-cover mr-3" />
                      <div>
                        <div className="font-medium text-neutral-900">
                          {restaurant.name}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {restaurant.cuisineType.join(', ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span>{restaurant.address.split(',')[0]}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <StarIcon size={16} className="text-yellow-500 fill-yellow-500 mr-1" />
                      <span>{restaurant.rating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span>{restaurant.priceRange}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-800 mr-3">
                      Edit
                    </button>
                    <button className="text-red-600 hover:text-red-800">
                      Delete
                    </button>
                  </td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
};
// Admin Reviews Management
const AdminReviews: React.FC = () => {
  return <div>
      <h2 className="mb-6">Manage Reviews</h2>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon size={18} className="text-neutral-500" />
            </div>
            <input type="text" className="input pl-10" placeholder="Search reviews..." />
          </div>
          <div className="flex items-center">
            <label htmlFor="status" className="mr-2 text-sm font-medium">
              Status:
            </label>
            <select id="status" className="input py-2">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  User
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Restaurant
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Rating
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {mockRestaurants.flatMap(restaurant => restaurant.reviews.map(review => ({
              ...review,
              restaurantName: restaurant.name
            }))).map(review => <tr key={review.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img src={review.userImage || 'https://via.placeholder.com/40'} alt={review.userName} className="w-8 h-8 rounded-full mr-3" />
                        <span className="font-medium">{review.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span>{(review as any).restaurantName}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => <StarIcon key={i} size={14} className={`${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-300'} mr-0.5`} />)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span>{review.date}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-primary-600 hover:text-primary-800 mr-3">
                        View
                      </button>
                      <button className="text-green-600 hover:text-green-800 mr-3">
                        Approve
                      </button>
                      <button className="text-red-600 hover:text-red-800">
                        Reject
                      </button>
                    </td>
                  </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
};
// Admin Analytics
const AdminAnalytics: React.FC = () => {
  return <div>
      <h2 className="mb-6">Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Page Views</h3>
            <div className="text-green-600 text-sm font-medium">+12%</div>
          </div>
          <p className="text-3xl font-bold">5,382</p>
          <p className="text-sm text-neutral-500 mt-2">Last 30 days</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Search Queries</h3>
            <div className="text-green-600 text-sm font-medium">+8%</div>
          </div>
          <p className="text-3xl font-bold">1,245</p>
          <p className="text-sm text-neutral-500 mt-2">Last 30 days</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Map Interactions</h3>
            <div className="text-green-600 text-sm font-medium">+15%</div>
          </div>
          <p className="text-3xl font-bold">3,724</p>
          <p className="text-sm text-neutral-500 mt-2">Last 30 days</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">New Users</h3>
            <div className="text-red-600 text-sm font-medium">-3%</div>
          </div>
          <p className="text-3xl font-bold">267</p>
          <p className="text-sm text-neutral-500 mt-2">Last 30 days</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium mb-4">Most Viewed Dishes</h3>
          <div className="space-y-4">
            {[...mockDishes].sort(() => 0.5 - Math.random()).slice(0, 5).map((dish, index) => <div key={dish.id} className="flex items-center">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-xs font-medium text-primary-700">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{dish.name}</div>
                    <div className="text-xs text-neutral-500">
                      {mockMunicipalities.find(m => m.id === dish.municipalityId)?.name}
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    {Math.floor(Math.random() * 1000) + 100} views
                  </div>
                </div>)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium mb-4">Most Viewed Restaurants</h3>
          <div className="space-y-4">
            {[...mockRestaurants].sort(() => 0.5 - Math.random()).slice(0, 5).map((restaurant, index) => <div key={restaurant.id} className="flex items-center">
                  <div className="w-6 h-6 bg-secondary-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-xs font-medium text-secondary-700">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{restaurant.name}</div>
                    <div className="text-xs text-neutral-500">
                      {restaurant.address.split(',')[0]}
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    {Math.floor(Math.random() * 800) + 200} views
                  </div>
                </div>)}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium mb-4">Search Trends</h3>
        <div className="space-y-4">
          <div className="flex items-center">
            <div className="flex-1">
              <div className="font-medium">"Best restaurants in Malolos"</div>
            </div>
            <div className="text-sm font-medium">124 searches</div>
          </div>
          <div className="flex items-center">
            <div className="flex-1">
              <div className="font-medium">"Pancit Malolos"</div>
            </div>
            <div className="text-sm font-medium">98 searches</div>
          </div>
          <div className="flex items-center">
            <div className="flex-1">
              <div className="font-medium">"Longganisang Baliuag"</div>
            </div>
            <div className="text-sm font-medium">87 searches</div>
          </div>
          <div className="flex items-center">
            <div className="flex-1">
              <div className="font-medium">"Bulacan food map"</div>
            </div>
            <div className="text-sm font-medium">76 searches</div>
          </div>
          <div className="flex items-center">
            <div className="flex-1">
              <div className="font-medium">"Traditional Bulacan dishes"</div>
            </div>
            <div className="text-sm font-medium">65 searches</div>
          </div>
        </div>
      </div>
    </div>;
};
// Admin Settings
const AdminSettings: React.FC = () => {
  return <div>
      <h2 className="mb-6">Settings</h2>
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-medium mb-4">General Settings</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="siteName" className="block mb-1 font-medium">
              Site Name
            </label>
            <input type="text" id="siteName" className="input" value="Mapping Filipino Flavors" />
          </div>
          <div>
            <label htmlFor="siteDescription" className="block mb-1 font-medium">
              Site Description
            </label>
            <textarea id="siteDescription" className="input min-h-[100px]" value="Discover the rich culinary heritage of Bulacan Province through our interactive map and guide to local dishes and restaurants." />
          </div>
          <div>
            <label htmlFor="contactEmail" className="block mb-1 font-medium">
              Contact Email
            </label>
            <input type="email" id="contactEmail" className="input" value="info@filipinoflavors.com" />
          </div>
        </div>
        <div className="mt-6">
          <button className="btn btn-primary">Save Changes</button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-medium mb-4">Map Settings</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="defaultZoom" className="block mb-1 font-medium">
              Default Zoom Level
            </label>
            <input type="number" id="defaultZoom" className="input" value="10" min="1" max="20" />
          </div>
          <div>
            <label htmlFor="defaultCenter" className="block mb-1 font-medium">
              Default Center Coordinates
            </label>
            <div className="flex space-x-2">
              <input type="text" id="defaultCenterLat" className="input" placeholder="Latitude" value="14.8527" />
              <input type="text" id="defaultCenterLng" className="input" placeholder="Longitude" value="120.8160" />
            </div>
          </div>
        </div>
        <div className="mt-6">
          <button className="btn btn-primary">Save Changes</button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium mb-4">User Management</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="allowRegistration" className="flex items-center cursor-pointer">
              <input type="checkbox" id="allowRegistration" className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 mr-2" checked />
              <span>Allow User Registration</span>
            </label>
          </div>
          <div>
            <label htmlFor="moderateReviews" className="flex items-center cursor-pointer">
              <input type="checkbox" id="moderateReviews" className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 mr-2" checked />
              <span>Moderate Reviews Before Publishing</span>
            </label>
          </div>
          <div>
            <label htmlFor="userContributions" className="flex items-center cursor-pointer">
              <input type="checkbox" id="userContributions" className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 mr-2" />
              <span>Allow User Contributions (Dishes & Restaurants)</span>
            </label>
          </div>
        </div>
        <div className="mt-6">
          <button className="btn btn-primary">Save Changes</button>
        </div>
      </div>
    </div>;
};
// Star icon component
const StarIcon: React.FC<{
  size: number;
  className: string;
}> = ({
  size,
  className
}) => {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>;
};
// Main Admin Dashboard Component
const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  return <div className="pt-16 bg-neutral-50 min-h-screen">
      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-10 w-64 bg-white border-r border-neutral-200 pt-20 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
          <div className="p-4">
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <img src="https://via.placeholder.com/40" alt="Admin" className="w-10 h-10 rounded-full mr-3" />
                <div>
                  <div className="font-medium">Admin User</div>
                  <div className="text-xs text-neutral-500">Administrator</div>
                </div>
              </div>
            </div>
            <nav className="space-y-1">
              <Link to="/admin" className={`flex items-center px-4 py-2 rounded-md ${location.pathname === '/admin' ? 'bg-primary-50 text-primary-600' : 'text-neutral-700 hover:bg-neutral-100'}`}>
                <LayoutDashboardIcon size={20} className="mr-3" />
                <span>Dashboard</span>
              </Link>
              <Link to="/admin/dishes" className={`flex items-center px-4 py-2 rounded-md ${location.pathname === '/admin/dishes' ? 'bg-primary-50 text-primary-600' : 'text-neutral-700 hover:bg-neutral-100'}`}>
                <BookOpenIcon size={20} className="mr-3" />
                <span>Dishes</span>
              </Link>
              <Link to="/admin/restaurants" className={`flex items-center px-4 py-2 rounded-md ${location.pathname === '/admin/restaurants' ? 'bg-primary-50 text-primary-600' : 'text-neutral-700 hover:bg-neutral-100'}`}>
                <UtensilsIcon size={20} className="mr-3" />
                <span>Restaurants</span>
              </Link>
              <Link to="/admin/reviews" className={`flex items-center px-4 py-2 rounded-md ${location.pathname === '/admin/reviews' ? 'bg-primary-50 text-primary-600' : 'text-neutral-700 hover:bg-neutral-100'}`}>
                <MessageSquareIcon size={20} className="mr-3" />
                <span>Reviews</span>
              </Link>
              <Link to="/admin/analytics" className={`flex items-center px-4 py-2 rounded-md ${location.pathname === '/admin/analytics' ? 'bg-primary-50 text-primary-600' : 'text-neutral-700 hover:bg-neutral-100'}`}>
                <BarChartIcon size={20} className="mr-3" />
                <span>Analytics</span>
              </Link>
              <Link to="/admin/settings" className={`flex items-center px-4 py-2 rounded-md ${location.pathname === '/admin/settings' ? 'bg-primary-50 text-primary-600' : 'text-neutral-700 hover:bg-neutral-100'}`}>
                <SettingsIcon size={20} className="mr-3" />
                <span>Settings</span>
              </Link>
            </nav>
            <div className="mt-8 pt-4 border-t border-neutral-200">
              <Link to="/" className="flex items-center px-4 py-2 rounded-md text-neutral-700 hover:bg-neutral-100">
                <LogOutIcon size={20} className="mr-3" />
                <span>Back to Site</span>
              </Link>
            </div>
          </div>
        </aside>
        {/* Main Content */}
        <div className="flex-1 p-6 md:ml-64">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center text-sm text-neutral-500">
            <Link to="/admin" className="hover:text-primary-600">
              Admin
            </Link>
            <ChevronRightIcon size={16} className="mx-1" />
            <span className="font-medium text-neutral-700">
              {location.pathname === '/admin' && 'Dashboard'}
              {location.pathname === '/admin/dishes' && 'Dishes'}
              {location.pathname === '/admin/restaurants' && 'Restaurants'}
              {location.pathname === '/admin/reviews' && 'Reviews'}
              {location.pathname === '/admin/analytics' && 'Analytics'}
              {location.pathname === '/admin/settings' && 'Settings'}
            </span>
          </div>
          {/* Content Router */}
          <Routes>
            <Route path="/" element={<AdminOverview />} />
            <Route path="/dishes" element={<AdminDishes />} />
            <Route path="/restaurants" element={<AdminRestaurants />} />
            <Route path="/reviews" element={<AdminReviews />} />
            <Route path="/analytics" element={<AdminAnalytics />} />
            <Route path="/settings" element={<AdminSettings />} />
          </Routes>
        </div>
      </div>
    </div>;
};
export default AdminDashboard;