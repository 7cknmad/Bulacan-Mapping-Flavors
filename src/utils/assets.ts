export const assetUrl = (p: string) =>
  new URL(p.replace(/^\//, ''), import.meta.env.BASE_URL).toString();
