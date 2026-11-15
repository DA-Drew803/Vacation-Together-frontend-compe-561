import { describe, expect, it } from "vitest";
import { revisionFailureMessage } from "./revision-failure";

describe("revision failure messaging", () => {
  it("suggests a more specific request for invalid instructions", () => {
    expect(revisionFailureMessage("Revision instruction must not be blank")).toMatch(/more specific/i);
  });

  it("explains revision conflicts", () => {
    expect(revisionFailureMessage("A revision is already running")).toMatch(/already being processed/i);
  });

  it("explains finalized itinerary conflicts", () => {
    expect(revisionFailureMessage("Finalized itinerary cannot be revised")).toMatch(/finalized/i);
  });

  it("gives a safe fallback for provider or server failures", () => {
    const message = revisionFailureMessage("Request failed with status 500");
    expect(message).toMatch(/temporarily unavailable/i);
    expect(message).not.toMatch(/stack|exception|api key/i);
  });

  it("preserves a concise safe backend validation detail", () => {
    expect(revisionFailureMessage("Day 3 must retain one outdoor activity")).toMatch(/Day 3 must retain one outdoor activity/);
  });
});
