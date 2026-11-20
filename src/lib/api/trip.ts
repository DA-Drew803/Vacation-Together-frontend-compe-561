import { apiFetch } from "@/lib/api/client";

export type Trip = {
  id: string;
  name: string;
  state: string;
  selected_destination_id: string | null;
  voting_started_at: string | null;
  voting_closed_at: string | null;
  selected_start_date?: string | null;
  selected_end_date?: string | null;
  departure_location?: string | null;
  transportation_preference?:
    | "AUTO"
    | "FLIGHT"
    | "ROAD_TRIP";
};

export type GroupMatch = {
  common_date_ranges: {
    ranges: Array<{
      start_date: string;
      end_date: string;
    }>;
  };
  group_max_budget: {
    max_amount: string | number;
    currency: string;
  };
  interests: string[];
  ready: boolean;
  reason: string | null;
};

export function listTrips() {
  return apiFetch<Trip[]>("/trips");
}

export function createTrip(name: string) {
  return apiFetch<Trip>("/trips", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function getTrip(tripId: string) {
  return apiFetch<Trip>(`/trips/${tripId}`);
}

export function getGroupMatch(tripId: string) {
  return apiFetch<GroupMatch>(
    `/trips/${tripId}/group_match`,
  );
}

export function updateTripDates(
  tripId: string,
  selectedStartDate: string,
  selectedEndDate: string,
) {
  return apiFetch<Trip>(`/trips/${tripId}/dates`, {
    method: "PUT",
    body: JSON.stringify({
      selected_start_date: selectedStartDate,
      selected_end_date: selectedEndDate,
    }),
  });
}

export function updateTravelDetails(
  tripId: string,
  departureLocation: string | null,
  transportationPreference:
    | "AUTO"
    | "FLIGHT"
    | "ROAD_TRIP",
) {
  return apiFetch<Trip>(
    `/trips/${tripId}/travel-details`,
    {
      method: "PUT",
      body: JSON.stringify({
        departure_location: departureLocation,
        transportation_preference:
          transportationPreference,
      }),
    },
  );
}