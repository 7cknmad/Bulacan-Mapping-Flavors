/**
 * Gets the base URL for assets in the application, handling both development and production environments
 * including GitHub Pages deployment
 */
export function getBaseUrl(): string {
  // Check if we're in GitHub Pages
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    // Return the repository name for GitHub Pages
    const pathParts = window.location.pathname.split('/');
    // The repository name will be the first part after the root
    const repoName = pathParts[1];
    return `/${repoName}`;
  }
  // In development or other environments, use root
  return '';
}

/**
 * Resolves a path against the base URL
 * @param path The path to resolve (should start with /)
 */
export function resolvePath(path: string): string {
  const baseUrl = getBaseUrl();
  // Ensure path starts with / and remove any double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`.replace(/\/+/g, '/');
}