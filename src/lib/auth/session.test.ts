import { afterEach, describe, expect, it } from "vitest";
import { clearAccessToken, getAccessToken, setAccessToken } from "./session";

afterEach(() => clearAccessToken());

describe("auth session storage", () => {
  it("stores, reads, and clears the access token", () => {
    expect(getAccessToken()).toBeNull();

    setAccessToken("token-123");
    expect(getAccessToken()).toBe("token-123");

    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });
});
