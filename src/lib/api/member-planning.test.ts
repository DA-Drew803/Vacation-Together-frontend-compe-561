import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMyAvailability,
  getMyBudget,
  updateMyAvailability,
  updateMyBudget,
} from "./member-planning";

afterEach(() => vi.unstubAllGlobals());

describe("member planning API", () => {
  it("uses the member availability and budget endpoints", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ member_id: "member-1", ranges: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ member_id: "member-1", max_amount: "1200.00", currency: "USD" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ member_id: "member-1", ranges: [{ start_date: "2027-01-01", end_date: "2027-01-05" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ member_id: "member-1", max_amount: "1200.00", currency: "USD" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getMyAvailability("trip-1");
    await getMyBudget("trip-1");
    await updateMyAvailability("trip-1", [{ start_date: "2027-01-01", end_date: "2027-01-05" }]);
    await updateMyBudget("trip-1", 1200, "USD");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:8000/api/trips/trip-1/availability/me",
      "http://localhost:8000/api/trips/trip-1/budget/me",
      "http://localhost:8000/api/trips/trip-1/availability/me",
      "http://localhost:8000/api/trips/trip-1/budget/me",
    ]);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      ranges: [{ start_date: "2027-01-01", end_date: "2027-01-05" }],
    });
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
      max_amount: 1200,
      currency: "USD",
    });
  });
});
