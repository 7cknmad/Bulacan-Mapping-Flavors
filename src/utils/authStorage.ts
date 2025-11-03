const USER_TOKEN_KEY = "auth_token";
const ADMIN_TOKEN_KEY = "bmf_admin_token";
const USER_DATA_KEY = "auth_user";

export function setUserToken(token: string | null) {
  if (token) {
    localStorage.setItem(USER_TOKEN_KEY, token);
    // Clear any admin token when setting user token
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } else {
    localStorage.removeItem(USER_TOKEN_KEY);
  }
}

export function setAdminToken(token: string | null) {
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    // Clear any user token when setting admin token
    localStorage.removeItem(USER_TOKEN_KEY);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

export function getActiveToken(isAdminRoute: boolean): string | null {
  return isAdminRoute ? 
    localStorage.getItem(ADMIN_TOKEN_KEY) : 
    localStorage.getItem(USER_TOKEN_KEY);
}

export function clearAllTokens() {
  localStorage.removeItem(USER_TOKEN_KEY);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(USER_DATA_KEY);
}

export function storeUserData(user: any) {
  try {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  } catch {}
}

export function getUserData() {
  try {
    const data = localStorage.getItem(USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function clearUserData() {
  localStorage.removeItem(USER_DATA_KEY);
}