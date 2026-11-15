import { apiFetch } from "@/lib/api/client";

export type ApprovalProgress = {
  version: number;
  approved_count: number;
  eligible_count: number;
  finalized: boolean;
  members: ApprovalMember[];
  current_member_id?: string | null;
};

export type ApprovalMember = {
  member_id: string;
  display_name: string;
  approved: boolean;
};

export type Approval = {
  member_id: string;
  version: number;
  approved: boolean;
};

export type TripMember = {
  id: string;
  user_id: string;
  display_name: string;
  role: "OWNER" | "MEMBER";
  status: "ACTIVE" | "REMOVED";
  voting_eligible: boolean;
};

export function getApprovalProgress(tripId: string) {
  return apiFetch<ApprovalProgress>(`/trips/${tripId}/itinerary/approval`);
}

export function approveCurrentVersion(tripId: string, version: number) {
  return apiFetch<Approval>(`/trips/${tripId}/itinerary/approval/me`, {
    method: "PUT",
    body: JSON.stringify({ version, approved: true }),
  });
}

export function getTripMembers(tripId: string) {
  return apiFetch<TripMember[]>(`/trips/${tripId}/members`);
}
