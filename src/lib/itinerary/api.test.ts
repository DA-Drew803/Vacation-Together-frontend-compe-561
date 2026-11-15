import { afterEach, describe, expect, it, vi } from "vitest";
import { getItinerary, ItineraryApiError, parseItinerary, requestRevision } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("itinerary API", () => {
  it("retrieves itinerary data with bearer authentication", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "itinerary-1",
      trip_id: "trip/one",
      destination_id: "destination-1",
      version: 1,
      status: "DRAFT",
      days: [{ day_number: 1, activities: [{ position: 1, title: "Museum", estimated_cost: 20 }] }],
      estimated_total_cost: { max_amount: 20, currency: "USD" },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getItinerary("trip/one", { apiUrl: "https://api.example", accessToken: "token" }))
      .resolves.toMatchObject({ version: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example/api/trips/trip%2Fone/itinerary",
      expect.objectContaining({ headers: expect.any(Headers), method: "GET" }),
    );
    expect((fetchMock.mock.calls[0][1].headers as Headers).get("Authorization")).toBe("Bearer token");
  });

  it("submits a valid instruction and accepts HTTP 202", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "revision-1", status: "RUNNING", requested_version: 2,
    }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestRevision("trip-1", "Make day 2 cheaper", { apiUrl: "https://api.example" }))
      .resolves.toMatchObject({ status: "RUNNING", requested_version: 2 });
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ instruction: "Make day 2 cheaper" }));
  });

  it.each([200, 201, 204])("rejects unexpected revision success status HTTP %i", async (status) => {
    const body = status === 204
      ? null
      : JSON.stringify({ id: "revision-1", status: "RUNNING", requested_version: 2 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })));
    await expect(requestRevision("trip-1", "Make day 2 cheaper", { apiUrl: "https://api.example" }))
      .rejects.toMatchObject({ status, code: "UNEXPECTED_STATUS" });
  });

  it("rejects invalid JSON from HTTP 202 safely", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 202 })));
    await expect(requestRevision("trip-1", "Make day 2 cheaper", { apiUrl: "https://api.example" }))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE", message: "The itinerary service returned invalid revision data." });
  });

  it("rejects an invalid revision payload from HTTP 202", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "RUNNING" }), { status: 202 })));
    await expect(requestRevision("trip-1", "Make day 2 cheaper", { apiUrl: "https://api.example" }))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it.each([
    [401, "Your session has expired"],
    [403, "You do not have access"],
    [409, "already running"],
  ])("maps HTTP %i to safe feedback", async (status, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: status === 409 ? "A revision is already running" : undefined }),
      { status },
    )));
    await expect(getItinerary("trip-1", { apiUrl: "https://api.example" })).rejects.toMatchObject({
      status,
      message: expect.stringContaining(expected),
    } satisfies Partial<ItineraryApiError>);
  });

  it("does not expose a raw server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: "secret database traceback" }), { status: 500 },
    )));
    await expect(getItinerary("trip-1", { apiUrl: "https://api.example" }))
      .rejects.toThrow("itinerary service is unavailable");
  });

  it("supports the final contract error envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "REVISION_CONFLICT", message: "A revision is already running",
    }), { status: 409 })));
    await expect(requestRevision("trip-1", "Make day 1 cheaper", { apiUrl: "https://api.example" }))
      .rejects.toMatchObject({
        status: 409,
        code: "REVISION_CONFLICT",
        message: "A revision is already running",
      });
  });

  it("rejects malformed open-ended day and activity data at runtime", () => {
    expect(() => parseItinerary({
      id: "i", trip_id: "t", destination_id: "d", version: 1, status: "DRAFT",
      days: [{ arbitrary: "contract permits this, UI cannot safely render it" }],
      estimated_total_cost: { max_amount: 10, currency: "USD" },
    })).toThrow("invalid day data");
    expect(() => parseItinerary({
      id: "i", trip_id: "t", destination_id: "d", version: 1, status: "draft",
      days: [], estimated_total_cost: { max_amount: 10, currency: "USD" },
    })).toThrow("invalid data");
  });

  it("passes an abort signal to fetch", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);
    const pending = getItinerary("trip-1", { apiUrl: "https://api.example", signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
