import type { AxiosAdapter, AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth/session";
import { apiClient, apiFetch, apiFetchBlob, apiUrl } from "./client";

function response(config: Parameters<AxiosAdapter>[0], status: number, data: unknown): AxiosResponse {
  return { config, status, statusText: String(status), headers: {}, data };
}

afterEach(() => {
  clearAccessToken();
  apiClient.defaults.adapter = undefined;
  vi.restoreAllMocks();
});

describe("central Axios client", () => {
  it("builds API URLs without duplicate separators", () => {
    expect(apiUrl("/auth/me")).toBe("http://localhost:8000/api/auth/me");
    expect(apiUrl("https://images.example/photo")).toBe("https://images.example/photo");
  });

  it("injects the bearer token and sends parsed JSON", async () => {
    setAccessToken("test-token");
    let seenConfig: Parameters<AxiosAdapter>[0] | undefined;
    apiClient.defaults.adapter = async (config) => {
      seenConfig = config;
      return response(config, 200, { ok: true });
    };

    await expect(apiFetch<{ ok: boolean }>("/trips", {
      method: "POST", body: JSON.stringify({ name: "Coast trip" }),
    })).resolves.toEqual({ ok: true });
    expect(seenConfig?.headers.get("Authorization")).toBe("Bearer test-token");
    expect(seenConfig?.data).toBe(JSON.stringify({ name: "Coast trip" }));
  });

  it("clears an invalid session and preserves status and error code", async () => {
    setAccessToken("expired-token");
    apiClient.defaults.adapter = async (config) => Promise.reject(Object.assign(
      new Error("Unauthorized"),
      { isAxiosError: true, config, response: response(config, 401, { code: "INVALID_TOKEN", detail: "Session expired" }) },
    ));

    await expect(apiFetch("/auth/me")).rejects.toEqual(expect.objectContaining({
      name: "ApiError", message: "Session expired", status: 401, code: "INVALID_TOKEN",
    }));
    expect(getAccessToken()).toBeNull();
  });

  it("passes cancellation and credential options", async () => {
    const controller = new AbortController();
    let seenConfig: Parameters<AxiosAdapter>[0] | undefined;
    apiClient.defaults.adapter = async (config) => {
      seenConfig = config;
      return response(config, 200, { ok: true });
    };
    await apiFetch("/trips", { signal: controller.signal, credentials: "include" });
    expect(seenConfig?.signal).toBe(controller.signal);
    expect(seenConfig?.withCredentials).toBe(true);
  });

  it("retrieves binary responses through the shared client", async () => {
    const blob = new Blob(["photo"], { type: "image/jpeg" });
    apiClient.defaults.adapter = async (config) => response(config, 200, blob);
    await expect(apiFetchBlob("/photo")).resolves.toBe(blob);
  });
});
