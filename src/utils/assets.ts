// src/utils/assets.ts
/** Build a correct asset URL under GitHub Pages (or any BASE_URL). */
export function assetUrl(p: string): string {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;           // already absolute (CDN/external)
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const origin = (typeof window !== "undefined" && window.location?.origin) ? window.location.origin : "";
  const clean = String(p).replace(/^\/+/, "");     // strip leading slash to avoid base//
  const prefix = base.endsWith("/") ? base : base + "/";
  return `${origin}${prefix}${clean}`;
}
