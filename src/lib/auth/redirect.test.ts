import { describe, expect, it } from "vitest";
import { safeAuthRedirect } from "./redirect";

describe("safeAuthRedirect", () => {
  it("preserves local invitation redirects", () => {
    expect(safeAuthRedirect("/invitations/invite-token")).toBe("/invitations/invite-token");
  });

  it.each([null, "https://evil.example", "//evil.example", "javascript:alert(1)"])(
    "uses the fallback for unsafe destinations",
    (value) => expect(safeAuthRedirect(value)).toBe("/trips"),
  );
});
