import axios, { AxiosHeaders, type AxiosError } from "axios";
import { clearAccessToken, getAccessToken } from "@/lib/auth/session";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/+$/, "");

type ErrorPayload = { code?: unknown; detail?: unknown; message?: unknown };

function errorMessage(payload: ErrorPayload | undefined, status: number | undefined): string {
  if (typeof payload?.detail === "string") return payload.detail;
  if (typeof payload?.message === "string") return payload.message;
  if (
    typeof payload?.detail === "object"
    && payload.detail
    && "message" in payload.detail
    && typeof payload.detail.message === "string"
  ) return payload.detail.message;
  return `Request failed with status ${status ?? "unknown"}`;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number | null, public readonly code: string | null = null) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  config.headers = AxiosHeaders.from(config.headers);
  if (token && !config.headers.has("Authorization")) config.headers.set("Authorization", `Bearer ${token}`);

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);
    if (error.response?.status === 401) {
      clearAccessToken();
    }

    const payload = error.response?.data as ErrorPayload | undefined;
    return Promise.reject(new ApiError(
      errorMessage(payload, error.response?.status),
      error.response?.status ?? null,
      typeof payload?.code === "string" ? payload.code : null,
    ));
  },
);

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
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

  const response = await apiClient.request<T>({
    url: path,
    method: options.method ?? "GET",
    headers: Object.fromEntries(headers.entries()),
    data,
    signal: options.signal ?? undefined,
    withCredentials: options.credentials === "include",
  });

  return response.data;
}

export async function apiFetchBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await apiClient.get<Blob>(path, {
    responseType: "blob",
    signal,
    headers: {
      Accept: "image/*",
    },
  });

  return response.data;
}

export function isRequestCanceled(error: unknown): boolean {
  return axios.isCancel(error) || (error as AxiosError | undefined)?.code === "ERR_CANCELED";
}
