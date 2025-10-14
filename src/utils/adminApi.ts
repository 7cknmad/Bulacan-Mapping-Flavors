const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `${res.status}`);
  return text ? (JSON.parse(text) as T) : (null as T);
}

export const adminGet = <T,>(path: string) => req<T>(path);
export const adminPost = <T,>(path: string, body: any) =>
  req<T>(path, { method: "POST", body: JSON.stringify(body) });
export const adminPatch = <T,>(path: string, body: any) =>
  req<T>(path, { method: "PATCH", body: JSON.stringify(body) });