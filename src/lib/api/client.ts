import axios from "axios";
import { clearAccessToken, getAccessToken } from "@/lib/auth/session";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAccessToken();
    }

    const detail = error.response?.data?.detail;

    const message =
      typeof detail === "string"
        ? detail
        : detail?.message ??
          `Request failed with status ${
            error.response?.status ?? "unknown"
          }`;

    return Promise.reject(new Error(message));
  },
);

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  let data: unknown = undefined;

  if (options.body) {
    try {
      data = JSON.parse(options.body.toString());
    } catch {
      data = options.body;
    }
  }

  const response = await api.request<T>({
    url: path,
    method: options.method ?? "GET",
    headers: Object.fromEntries(headers.entries()),
    data,
  });

  return response.data;
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const response = await api.get<Blob>(path, {
    responseType: "blob",
    headers: {
      Accept: "image/*",
    },
  });

  return response.data;
}