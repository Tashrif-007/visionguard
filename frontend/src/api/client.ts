import axios from "axios";

export const TOKEN_KEY = "visionguard_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // /auth/login's 401 means bad credentials, and /auth/password's 401 means
    // "current password is wrong" (see auth_service.change_password) — neither
    // means the session token itself is invalid, so neither should force a
    // logout/redirect. Only an authenticated request rejected as unauthorized
    // indicates an actually expired/invalid token.
    const url = error.config?.url as string | undefined;
    const isSessionExempt =
      url?.includes("/auth/login") || url?.includes("/auth/password");
    if (error.response?.status === 401 && !isSessionExempt) {
      clearToken();
      window.location.assign("/login");
    }
    return Promise.reject(error);
  },
);

export default client;
