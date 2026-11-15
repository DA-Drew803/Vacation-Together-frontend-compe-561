import { describe, expect, it, vi } from "vitest";
import { pollRevision } from "./poll-revision";
import type { Itinerary } from "./types";

const itinerary = (version: number, status: Itinerary["status"]): Itinerary => ({
  id: "i", trip_id: "t", destination_id: "d", version, status, days: [],
  estimated_total_cost: { max_amount: 100, currency: "USD" },
});

describe("revision polling", () => {
  it("confirms success only after the backend version increases", async () => {
    const loadItinerary = vi.fn()
      .mockResolvedValueOnce(itinerary(1, "REVISING"))
      .mockResolvedValueOnce(itinerary(2, "DRAFT"));
    await expect(pollRevision("t", 1, { loadItinerary, wait: async () => undefined }))
      .resolves.toMatchObject({ outcome: "changed", itinerary: { version: 2 } });
  });

  it("reports same-version completion as unresolved", async () => {
    await expect(pollRevision("t", 1, {
      loadItinerary: vi.fn().mockResolvedValue(itinerary(1, "DRAFT")),
      wait: async () => undefined,
    })).resolves.toMatchObject({ outcome: "unresolved" });
  });

  it("stops after a bounded number of attempts", async () => {
    const loadItinerary = vi.fn().mockResolvedValue(itinerary(1, "REVISING"));
    await expect(pollRevision("t", 1, {
      loadItinerary, maxAttempts: 3, wait: async () => undefined,
    })).resolves.toMatchObject({ outcome: "timeout" });
    expect(loadItinerary).toHaveBeenCalledTimes(3);
  });

  it("aborts while waiting between polls", async () => {
    const controller = new AbortController();
    const loadItinerary = vi.fn().mockResolvedValue(itinerary(1, "REVISING"));
    const pending = pollRevision("t", 1, { loadItinerary, intervalMs: 60_000, signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(loadItinerary).toHaveBeenCalledOnce();
  });

  it("rejects a version regression without treating it as completion", async () => {
    await expect(pollRevision("t", 2, {
      loadItinerary: vi.fn().mockResolvedValue(itinerary(1, "DRAFT")),
      wait: async () => undefined,
    })).rejects.toMatchObject({ code: "VERSION_REGRESSION" });
  });
});
