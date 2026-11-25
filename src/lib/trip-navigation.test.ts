import { describe, expect, it } from "vitest";
import { getTripHref } from "./trip-navigation";

describe("My Trips navigation", () => {
  it("opens the itinerary for a closed trip", () => {
    expect(getTripHref({ id: "trip-1", state: "CLOSED" })).toBe(
      "/trips/trip-1/itinerary",
    );
  });

  it("opens planning for an active trip", () => {
    expect(getTripHref({ id: "trip-2", state: "PLANNING" })).toBe(
      "/trips/trip-2/plan",
    );
  });
});
