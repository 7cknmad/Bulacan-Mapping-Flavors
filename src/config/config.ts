const isDevelopment = process.env.NODE_ENV === 'development';
const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.includes('github.io');

export const config = {
  // Use localhost in development, your production API URL when deployed
  apiBaseUrl: isDevelopment 
    ? 'http://localhost:3000'  // Development API URL
    : 'https://bulacan-mapping-api.onrender.com',  // Replace this with your production API URL
    
  // Add other configuration as needed
  appBaseUrl: isGitHubPages 
    ? '/Bulacan-Mapping-Flavors'  // GitHub Pages base URL (your repo name)
    : '',
} as const;