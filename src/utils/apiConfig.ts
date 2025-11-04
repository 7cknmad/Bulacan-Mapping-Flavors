// Get the base API URL based on environment
const getBaseUrl = () => {
  // In development, return empty string to use Vite's proxy
  if (import.meta.env.DEV) {
    return '';
  }

  // In production, use environment variables or fallback URL
  const env = import.meta.env;
  return (
    env.VITE_ADMIN_API_URL ||  // prefer admin base in admin builds
    env.VITE_API_URL ||        // public base otherwise
    ''  // empty string to use relative URLs
  ).replace(/\/+$/, "");
};

export const API = getBaseUrl();

// Log the API base URL during initialization
console.log('[API Config] Using base URL:', {
  VITE_ADMIN_API_URL: (import.meta as any).env?.VITE_ADMIN_API_URL,
  VITE_API_URL: (import.meta as any).env?.VITE_API_URL,
  finalUrl: API
});