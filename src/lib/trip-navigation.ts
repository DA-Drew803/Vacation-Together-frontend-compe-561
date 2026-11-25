import type { Trip } from "@/lib/api/trip";

export function getTripHref(trip: Pick<Trip, "id" | "state">) {
  const destination = trip.state.toUpperCase() === "CLOSED"
    ? "itinerary"
    : "plan";

  return `/trips/${trip.id}/${destination}`;
}
