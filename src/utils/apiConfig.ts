// Get the base API URL based on build-time environment variables
const getBaseUrl = () => {
  const env = (import.meta as any).env || {};
  const apiUrl = env.VITE_ADMIN_API_URL || env.VITE_API_URL;
  if (!apiUrl) {
    throw new Error('API base URL is not set. Please set VITE_API_URL or VITE_ADMIN_API_URL in your build environment.');
  }
  return apiUrl.replace(/\/+$/, "");
};

export const API = getBaseUrl();

// Log the API base URL during initialization
console.log('[API Config] Using base URL:', {
  VITE_ADMIN_API_URL: (import.meta as any).env?.VITE_ADMIN_API_URL,
  VITE_API_URL: (import.meta as any).env?.VITE_API_URL,
  finalUrl: API
});