import { apiFetch, apiUrl } from "@/lib/api/client";

export type ItineraryStatus = "GENERATING" | "DRAFT" | "REVISING" | "FINALIZED" | "FAILED";
export type RevisionStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "NO_CHANGE";

export type ItineraryActivity = {
  id: string;
  position: number;
  title: string;
  estimated_cost: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  place_id?: string;
  photo_url?: string;
  rating?: number;
  rating_count?: number;
  purpose?: string;
  about?: string;
  website_uri?: string;
  google_maps_uri?: string;
  reviews?: Array<{ text: string; author?: string; rating?: number; relative_time?: string }>;
};

export type ItineraryDay = {
  day_number: number;
  activities: ItineraryActivity[];
};

export type ItineraryWeather = {
  date: string;
  condition: string;
  temperature_high?: number | null;
  temperature_low?: number | null;
  precipitation_probability?: number | null;
};

export type Itinerary = {
  id: string;
  trip_id: string;
  destination_id: string;
  destination_name?: string | null;
  destination_place_id?: string | null;
  destination_formatted_address?: string | null;
  destination_latitude?: number | null;
  destination_longitude?: number | null;
  destination_photo_url?: string | null;
  version: number;
  status: ItineraryStatus;
  days: ItineraryDay[];
  estimated_total_cost: {
    max_amount: number;
    currency: string;
  };
  weather?: ItineraryWeather[] | null;
};

export function getDestinationPhotoUrl(itinerary: Itinerary) {
  return itinerary.destination_photo_url ? apiUrl(itinerary.destination_photo_url) : null;
}

export function getActivityPhotoUrl(activity: ItineraryActivity) {
  return activity.photo_url ? apiUrl(activity.photo_url) : null;
}

export type Revision = {
  id: string;
  status: RevisionStatus;
  requested_version: number;
  failure_reason?: string | null;
};

export function getItinerary(tripId: string) {
  return apiFetch<Itinerary>(`/trips/${tripId}/itinerary`);
}

export function requestRevision(tripId: string, instruction: string) {
  return apiFetch<Revision>(`/trips/${tripId}/itinerary/revisions`, {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });
}

export function getRevision(tripId: string, revisionId: string) {
  return apiFetch<Revision>(`/trips/${tripId}/itinerary/revisions/${revisionId}`);
}

export function moveActivity(tripId: string, activityId: string, dayNumber: number, position: number) {
  return apiFetch<Itinerary>(`/trips/${tripId}/itinerary/items/${activityId}/position`, {
    method: "PATCH",
    body: JSON.stringify({ day_number: dayNumber, position }),
  });
}

export function swapActivities(tripId: string, sourceActivityId: string, targetActivityId: string) {
  return apiFetch<Itinerary>(`/trips/${tripId}/itinerary/items/${sourceActivityId}/swap`, {
    method: "PATCH",
    body: JSON.stringify({ target_activity_id: targetActivityId }),
  });
}
