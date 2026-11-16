import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser, login, register } from "./auth";
import { clearAccessToken, getAccessToken } from "@/lib/auth/session";

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

const user = { id: "user-1", email: "joy@example.com", display_name: "Joy" };

describe("authentication API", () => {
  it("stores the login token and validates the current user", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "login-token", token_type: "bearer", user }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(user), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(login("joy@example.com", "password")).resolves.toEqual(user);
    expect(getAccessToken()).toBe("login-token");
    expect((fetchMock.mock.calls[1][1].headers as Headers).get("Authorization")).toBe("Bearer login-token");
  });

  it("uses the register contract without sending confirmation password", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "register-token", token_type: "bearer", user }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(user), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await register("Joy", "joy@example.com", "password");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      display_name: "Joy",
      email: "joy@example.com",
      password: "password",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("confirmPassword");
  });

  it("clears an invalid token on a 401 but keeps it for a temporary server error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Could not validate credentials" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "temporarily unavailable" }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    localStorage.setItem("vacation-together-token", "expired-token");
    await expect(getCurrentUser()).rejects.toThrow();
    expect(getAccessToken()).toBeNull();

    localStorage.setItem("vacation-together-token", "valid-token");
    await expect(getCurrentUser()).rejects.toThrow();
    expect(getAccessToken()).toBe("valid-token");
  });
});
