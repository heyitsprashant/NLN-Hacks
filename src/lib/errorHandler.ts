import type { AxiosError } from "axios";

export function handleApiError(error: unknown): string {
  const err = error as AxiosError<{ message?: string }>;

  if (err.response) {
    const { status, data } = err.response;

    if (status === 401) return "Your session has expired. Please log in again.";
    if (status === 403) return "You do not have permission for this action.";
    if (status === 404) return "Requested resource was not found.";
    if (status === 429) return "Too many requests. Please slow down and retry.";
    if (status >= 500) return "Server error. Please try again in a moment.";

    return data?.message || "Request failed.";
  }

  if (err.request) return "Network error. Check your connection and try again.";

  return err.message || "Unexpected error.";
}
