// Get the base API URL based on environment
const getBaseUrl = () => {
  // In development, return empty string to use Vite's proxy
  if (import.meta.env.DEV) {
    return '';
  }
  
  // For GitHub Pages deployment, use the production API URL
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    return 'https://bulacan-mapping-api.onrender.com';
  }
  
  // Use environment variable if available
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  
  // Fallback for development
  return '';
};

export const API = getBaseUrl();

// Log the API configuration being used
console.log('[apiConfig] Using API URL:', API || '(using proxy)', {
  isDev: import.meta.env.DEV,
  isGitHubPages: typeof window !== 'undefined' && window.location.hostname.includes('github.io'),
  envApiUrl: import.meta.env.VITE_API_URL
});