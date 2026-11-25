import { describe, expect, it } from "vitest";
import { buildInvitationGmailUrl, buildInvitationMailto } from "./invitation-email";

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

it("builds a Gmail compose URL with the invitation prefilled", () => {
  const gmailUrl = buildInvitationGmailUrl(
    "friend@example.com",
    "http://localhost:3000/invitations/real-token",
  );
  const params = new URL(gmailUrl).searchParams;

  expect(gmailUrl).toContain("https://mail.google.com/mail/");
  expect(params.get("to")).toBe("friend@example.com");
  expect(params.get("su")).toBe("Invitation to plan a trip on Vacation Together");
  expect(params.get("body")).toContain("http://localhost:3000/invitations/real-token");
});
