export const assetUrl = (p: string) => {
  if (!p) return "";
  // If it's already absolute (http(s), data URIs), just return it.
  if (/^(https?:)?\/\//i.test(p) || /^data:/i.test(p)) return p;

  // Build a relative path using BASE_URL (a path, not an absolute URL).
  const base = import.meta.env.BASE_URL || "/";
  const cleanBase = base.endsWith("/") ? base : base + "/";
  const cleanPath = p.replace(/^\/+/, ""); // strip leading slash in p

  return cleanBase + cleanPath;
};
