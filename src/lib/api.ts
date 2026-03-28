import axios, { AxiosError } from "axios";

/**
 * Shared API client for calling the backend.
 * - Uses `withCredentials` so the browser automatically sends the httpOnly JWT cookie.
 * - Optionally also supports a localStorage Bearer token fallback for debugging/dev.
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;

  const token = window.localStorage.getItem("token");
  if (token) {
    // Avoid replacing the entire AxiosHeaders instance (it has methods/types).
    // We only set the Authorization header value.
    (config.headers as unknown as Record<string, string>).Authorization =
      `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

export default api;

