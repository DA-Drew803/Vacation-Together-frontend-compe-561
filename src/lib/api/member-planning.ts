import { apiFetch } from "@/lib/api/client";

export type DateRange = {
  start_date: string;
  end_date: string;
};

export type Availability = {
  member_id: string;
  ranges: DateRange[];
};

export type Budget = {
  member_id: string;
  max_amount: number | string;
  currency: string;
};

export function getMyAvailability(tripId: string) {
  return apiFetch<Availability>(`/trips/${tripId}/availability/me`);
}

export function updateMyAvailability(
  tripId: string,
  ranges: DateRange[],
) {
  return apiFetch<Availability>(`/trips/${tripId}/availability/me`, {
    method: "PUT",
    body: JSON.stringify({ ranges }),
  });
}

export function getMyBudget(tripId: string) {
  return apiFetch<Budget>(`/trips/${tripId}/budget/me`);
}

export function updateMyBudget(
  tripId: string,
  maxAmount: number,
  currency: string,
) {
  return apiFetch<Budget>(`/trips/${tripId}/budget/me`, {
    method: "PUT",
    body: JSON.stringify({ max_amount: maxAmount, currency }),
  });
}
