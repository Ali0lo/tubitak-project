import { API_BASE_URL } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/types/api";

type QueryParams = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  params?: QueryParams;
  /** Skip attaching the Authorization header (login/register/refresh). */
  skipAuth?: boolean;
}

// Coalesces concurrent 401s into a single refresh call rather than
// firing one refresh request per failed request.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          useAuthStore.getState().clearSession();
          return null;
        }
        const data = (await response.json()) as { access_token: string };
        useAuthStore.getState().setAccessToken(data.access_token);
        return data.access_token;
      } catch {
        useAuthStore.getState().clearSession();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function buildPath(path: string, params?: QueryParams): string {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data && typeof data.detail === "string") return data.detail;
  } catch {
    // Response body wasn't JSON; fall through to the generic message.
  }
  return `Request failed with status ${response.status}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, skipAuth = false } = options;
  const url = `${API_BASE_URL}${buildPath(path, params)}`;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!skipAuth) {
      const token = useAuthStore.getState().accessToken;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return fetch(url, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await doFetch();

  if (response.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await doFetch();
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string, params?: QueryParams) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown, options?: Partial<RequestOptions>) =>
    request<T>(path, { method: "POST", body, ...options }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
