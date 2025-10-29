import React from "react";
import { useSearchParams } from "react-router-dom";
import InteractiveMap from "../components/map/InteractiveMap";

const MapExplorer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const municipalitySlug = searchParams.get("municipality"); // optional ?municipality=<slug>
  
  // Handle restaurant highlighting from URL params
  const highlightedRestaurant = searchParams.get("highlight") === "restaurant" ? {
    id: Number(searchParams.get("id")),
    lat: Number(searchParams.get("lat")),
    lng: Number(searchParams.get("lng")),
  } : undefined;

  // Create marker array for highlighted restaurant
  const restaurantMarkers = highlightedRestaurant && !isNaN(highlightedRestaurant.lat) && !isNaN(highlightedRestaurant.lng) 
    ? [{ 
        id: highlightedRestaurant.id, 
        lat: highlightedRestaurant.lat, 
        lng: highlightedRestaurant.lng,
        name: searchParams.get("name") || `Restaurant ${highlightedRestaurant.id}`,
        kind: (searchParams.get("kind") as any) || 'restaurant',
        address: searchParams.get("address") || undefined
      }] 
    : [];

  return (
    <>
      {/* Fullscreen map background */}
      <InteractiveMap
        highlightedMunicipality={municipalitySlug ?? undefined}
        restaurantMarkers={restaurantMarkers}
        fullScreen
      />

      {/* Overlay UI intentionally removed to keep the map unobstructed */}
    </>
  );
};

export default MapExplorer;
