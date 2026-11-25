import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getItinerary, ItineraryApiError, parseItinerary, requestRevision } from "./api";

const itineraryPayload = {
  id: "itinerary-1", trip_id: "trip/one", destination_id: "destination-1", version: 1,
  status: "DRAFT", days: [{ day_number: 1, activities: [{ position: 1, title: "Museum", estimated_cost: 20 }] }],
  estimated_total_cost: { max_amount: 20, currency: "USD" },
};

function mockResponse(status: number, data: unknown) {
  return vi.spyOn(axios, "request").mockResolvedValue({ status, data } as never);
}

afterEach(() => vi.restoreAllMocks());

describe("itinerary API", () => {
  it("retrieves itinerary data with bearer authentication", async () => {
    const request = mockResponse(200, itineraryPayload);
    await expect(getItinerary("trip/one", { apiUrl: "https://api.example", accessToken: "token" }))
      .resolves.toMatchObject({ version: 1 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://api.example/api/trips/trip%2Fone/itinerary", method: "GET",
      headers: expect.objectContaining({ authorization: "Bearer token" }),
    }));
  });

  it("submits a valid instruction and accepts HTTP 202", async () => {
    const request = mockResponse(202, { id: "revision-1", status: "RUNNING", requested_version: 2 });
    await expect(requestRevision("trip-1", "Make day 2 cheaper", { apiUrl: "https://api.example" }))
      .resolves.toMatchObject({ status: "RUNNING", requested_version: 2 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ data: { instruction: "Make day 2 cheaper" } }));
  });

  it.each([200, 201, 204])("rejects unexpected revision success status HTTP %i", async (status) => {
    mockResponse(status, status === 204 ? undefined : { id: "revision-1", status: "RUNNING", requested_version: 2 });
    await expect(requestRevision("trip-1", "Make day 2 cheaper", { apiUrl: "https://api.example" }))
      .rejects.toMatchObject({ status, code: "UNEXPECTED_STATUS" });
  });

  it("rejects invalid response data safely", async () => {
    mockResponse(202, "not-json");
    await expect(requestRevision("trip-1", "Make day 2 cheaper", { apiUrl: "https://api.example" }))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE", message: "The itinerary service returned invalid revision data." });
  });

  it("rejects an invalid revision payload from HTTP 202", async () => {
    mockResponse(202, { status: "RUNNING" });
    await expect(requestRevision("trip-1", "Make day 2 cheaper", { apiUrl: "https://api.example" }))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it.each([[401, "Your session has expired"], [403, "You do not have access"], [409, "already running"]])(
    "maps HTTP %i to safe feedback", async (status, expected) => {
      mockResponse(status, { detail: status === 409 ? "A revision is already running" : undefined });
      await expect(getItinerary("trip-1", { apiUrl: "https://api.example" })).rejects.toMatchObject({
        status, message: expect.stringContaining(expected),
      } satisfies Partial<ItineraryApiError>);
    },
  );

  it("does not expose a raw server error", async () => {
    mockResponse(500, { detail: "secret database traceback" });
    await expect(getItinerary("trip-1", { apiUrl: "https://api.example" }))
      .rejects.toThrow("itinerary service is unavailable");
  });

  it("supports the final contract error envelope", async () => {
    mockResponse(409, { code: "REVISION_CONFLICT", message: "A revision is already running" });
    await expect(requestRevision("trip-1", "Make day 1 cheaper", { apiUrl: "https://api.example" }))
      .rejects.toMatchObject({ status: 409, code: "REVISION_CONFLICT", message: "A revision is already running" });
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

  it("passes an abort signal to Axios and preserves AbortError semantics", async () => {
    const controller = new AbortController();
    const request = vi.spyOn(axios, "request").mockRejectedValue({ code: "ERR_CANCELED", __CANCEL__: true });
    vi.spyOn(axios, "isCancel").mockReturnValue(true);
    const pending = getItinerary("trip-1", { apiUrl: "https://api.example", signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
  });

  it("maps connection failures without exposing Axios internals", async () => {
    vi.spyOn(axios, "request").mockRejectedValue(new Error("ECONNREFUSED secret host"));
    await expect(getItinerary("trip-1")).rejects.toThrow("Unable to reach the itinerary service");
  });
});
