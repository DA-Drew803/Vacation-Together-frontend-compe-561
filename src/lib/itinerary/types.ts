export type ItineraryStatus =
  | "GENERATING"
  | "DRAFT"
  | "REVISING"
  | "FINALIZED"
  | "FAILED";

export type RevisionStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "NO_CHANGE";

export interface Money {
  max_amount: number;
  currency: string;
}

export interface ItineraryActivity {
  day_number?: number;
  position?: number;
  title?: string;
  estimated_cost?: number;
  [key: string]: unknown;
}

export interface ItineraryDay {
  day_number?: number;
  activities?: ItineraryActivity[];
  [key: string]: unknown;
}

export interface Itinerary {
  id: string;
  trip_id: string;
  destination_id: string;
  version: number;
  status: ItineraryStatus;
  days: ItineraryDay[];
  estimated_total_cost: Money;
}

export interface RevisionAccepted {
  id: string;
  status: RevisionStatus;
  requested_version: number;
}
