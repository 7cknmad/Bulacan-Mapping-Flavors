// Get the base API URL based on environment
const getBaseUrl = () => {
  const env = (import.meta as any).env || {};
  
  // For GitHub Pages deployment, use the production API URL
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    return 'https://existed-bonds-drain-worldcat.trycloudflare.com';
  }
  
  // For development, use local or specified URL
  return (
    env.VITE_ADMIN_API_URL ||  // prefer admin base in admin builds
    env.VITE_API_URL ||        // public base otherwise
    "http://localhost:3002"    // fallback local development URL
  ).replace(/\/+$/, "");
};

export const API = getBaseUrl();

// Log the API base URL during initialization
console.log('[API Config] Using base URL:', {
  VITE_ADMIN_API_URL: (import.meta as any).env?.VITE_ADMIN_API_URL,
  VITE_API_URL: (import.meta as any).env?.VITE_API_URL,
  finalUrl: API
});