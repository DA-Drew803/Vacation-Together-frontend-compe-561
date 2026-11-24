import { describe, expect, it } from "vitest";
import { buildInvitationMailto } from "./invitation-email";

describe("buildInvitationMailto", () => {
  it("encodes the invitee, subject, and real invitation URL", () => {
    const mailto = buildInvitationMailto(
      "friend@example.com",
      "http://localhost:3000/invitations/real-token?source=trip",
    );

    expect(mailto).toContain("mailto:friend%40example.com");
    expect(mailto).toContain(
      `subject=${encodeURIComponent("Invitation to plan a trip on Vacation Together")}`,
    );
    expect(mailto).toContain(
      `body=${encodeURIComponent(
        "Hi,\n\nYou’re invited to plan a trip with me on Vacation Together.\n\nOpen this invitation:\nhttp://localhost:3000/invitations/real-token?source=trip",
      )}`,
    );
  });
});
