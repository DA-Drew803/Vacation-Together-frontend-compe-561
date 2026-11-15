const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function getAccessToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("vacation-together-token");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(apiUrl(path), { ...options, headers });
  if (response.status === 401 && typeof window !== "undefined") {
    window.localStorage.removeItem("vacation-together-token");
  }
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const error = (await response.json()) as { detail?: string | { message?: string } };
      if (typeof error.detail === "string") message = error.detail;
      else if (error.detail?.message) message = error.detail.message;
    } catch {
      // Keep the status-based message when the server response is not JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function apiFetchBlob(path: string) {
  const token = getAccessToken();
  const headers = new Headers({ Accept: "image/*" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path.startsWith("http") ? path : apiUrl(path), { headers });
  if (response.status === 401 && typeof window !== "undefined") {
    window.localStorage.removeItem("vacation-together-token");
  }
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.blob();
}
