const env = (import.meta as any).env || {};
const BASE =
  (env.VITE_ADMIN_API_URL && env.VITE_ADMIN_API_URL.replace(/\/$/, "")) ||
  (env.VITE_API_URL && env.VITE_API_URL.replace(/\/$/, "")) ||
  "";
if (!BASE) console.error("[authApi] VITE_ADMIN_API_URL/VITE_API_URL is empty; requests will hit the page origin.");
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
