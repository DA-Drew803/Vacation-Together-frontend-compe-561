import { apiFetch } from "@/lib/api/client";

export type Trip = {
  id: string;
  name: string;
  state: string;
  selected_destination_id: string | null;
  voting_started_at: string | null;
  voting_closed_at: string | null;
};

export type GroupMatch = {
  common_date_ranges: {
    ranges: Array<{ start_date: string; end_date: string }>;
  };
  group_max_budget: { max_amount: string | number; currency: string };
  interests: string[];
  ready: boolean;
  reason: string | null;
};

export function getTrip(tripId: string) {
  return apiFetch<Trip>(`/trips/${tripId}`);
}

export function getGroupMatch(tripId: string) {
  return apiFetch<GroupMatch>(`/trips/${tripId}/group_match`);
}
