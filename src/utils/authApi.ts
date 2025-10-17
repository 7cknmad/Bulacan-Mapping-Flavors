// src/utils/authApi.ts
const BASE = (import.meta as any).env?.VITE_ADMIN_API_URL?.replace(/\/$/, "") || "";

async function http(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(text || `${res.status} ${res.statusText}`);
  try { return JSON.parse(text); } catch { return text; }
}

// API
export function me() {
  return http("/auth/me"); // -> { user: { id, email, name, role } }
}
export function login(payload: { email: string; password: string }) {
  return http("/auth/login", { method: "POST", body: JSON.stringify(payload) });
}
export function logout() {
  return http("/auth/logout", { method: "POST" });
}
