// Get the base API URL based on environment
const getBaseUrl = () => {
  const env = import.meta.env;
  
  // In development, return empty string to use Vite's proxy
  if (env.DEV) {
    return '';
  }

  // In production (GitHub Pages), use the production API URL
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    return 'https://bulacan-mapping-api.onrender.com';
  }
  
  // For other environments, use env vars with fallback
  return (
    env.VITE_ADMIN_API_URL ||  // prefer admin base in admin builds
    env.VITE_API_URL ||        // public base otherwise
    'https://bulacan-mapping-api.onrender.com'  // fallback to production URL
  ).replace(/\/+$/, "");
};

export const API = getBaseUrl();

// Log the API base URL during initialization
console.log('[API Config] Using base URL:', {
  VITE_ADMIN_API_URL: (import.meta as any).env?.VITE_ADMIN_API_URL,
  VITE_API_URL: (import.meta as any).env?.VITE_API_URL,
  finalUrl: API
});