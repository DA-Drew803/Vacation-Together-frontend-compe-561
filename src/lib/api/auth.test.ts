import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAccessToken, getAccessToken } from "@/lib/auth/session";
import { apiFetch } from "@/lib/api/client";
import { getCurrentUser, login, register } from "./auth";

vi.mock("@/lib/api/client", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

afterEach(() => {
  clearAccessToken();
  apiFetchMock.mockReset();
});

const user = {
  id: "user-1",
  email: "joy@example.com",
  display_name: "Joy",
};

describe("authentication API", () => {
  it("stores the login token and validates the current user", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        access_token: "login-token",
        token_type: "bearer",
        user,
      })
      .mockResolvedValueOnce(user);

    await expect(
      login("joy@example.com", "password"),
    ).resolves.toEqual(user);

    expect(getAccessToken()).toBe("login-token");

    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: "joy@example.com",
          password: "password",
        }),
      },
    );

    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      "/auth/me",
    );
  });

  it("uses the register contract without sending confirmation password", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        access_token: "register-token",
        token_type: "bearer",
        user,
      })
      .mockResolvedValueOnce(user);

    await expect(
      register("Joy", "joy@example.com", "password"),
    ).resolves.toEqual(user);

    expect(getAccessToken()).toBe("register-token");

    const registerCall = apiFetchMock.mock.calls[0];

    expect(registerCall[0]).toBe("/auth/register");

    expect(JSON.parse(registerCall[1]?.body as string)).toEqual({
      display_name: "Joy",
      email: "joy@example.com",
      password: "password",
    });

    expect(
      JSON.parse(registerCall[1]?.body as string),
    ).not.toHaveProperty("confirmPassword");
  });

  it("propagates errors from the current-user request", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new Error("Could not validate credentials"),
    );

    await expect(getCurrentUser()).rejects.toThrow(
      "Could not validate credentials",
    );
  });
});