import { apiFetch } from "@/lib/api/client";

export type MemberPreference = {
  member_id: string;
  interests: string[];
  private_notes: string | null;
};

export type PreferenceUpdate = {
  interests: string[];
  private_notes: string | null;
};

export function getMyPreferences(tripId: string) {
  return apiFetch<MemberPreference>(
    `/trips/${tripId}/preferences/me`,
  );
}

export function updateMyPreferences(
  tripId: string,
  data: PreferenceUpdate,
) {
  return apiFetch<MemberPreference>(
    `/trips/${tripId}/preferences/me`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}