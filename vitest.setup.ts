import "@testing-library/jest-dom/vitest";
import axios, { type AxiosAdapter } from "axios";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

if (typeof window !== "undefined" && !window.localStorage) {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() { return values.size; },
    } satisfies Storage,
  });
}

afterEach(cleanup);

const fetchAdapter: AxiosAdapter = async (config) => {
  const headers = new Headers(config.headers as HeadersInit);
  const response = await fetch(`${config.baseURL ?? ""}${config.url ?? ""}`, {
    method: String(config.method ?? "GET").toUpperCase(),
    headers,
    body: typeof config.data === "string" ? config.data : config.data ? JSON.stringify(config.data) : undefined,
    signal: config.signal as AbortSignal | undefined,
    credentials: config.withCredentials ? "include" : "same-origin",
  });
  const text = await response.text();
  let data: unknown = text;
  try { data = text ? JSON.parse(text) : undefined; } catch { /* Preserve non-JSON responses. */ }
  return {
    config,
    data,
    headers: Object.fromEntries(response.headers.entries()),
    status: response.status,
    statusText: response.statusText,
  };
};

axios.defaults.adapter = fetchAdapter;
