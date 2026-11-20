import { apiFetch } from "@/lib/api/client";

export type Invitation = {
  id: string;
  trip_id: string;
  inviter_id: string;
  invitee_email: string;
  status: string;
  created_at: string;
  expires_at: string;
  token?: string;
};

export function listInvitations(tripId: string) {
  return apiFetch<Invitation[]>(`/trips/${tripId}/invitations`);
}

export function createInvitation(tripId: string, inviteeEmail: string) {
  return apiFetch<Invitation>(`/trips/${tripId}/invitations`, {
    method: "POST",
    body: JSON.stringify({
      invitee_email: inviteeEmail,
    }),
  });
}

export function revokeInvitation(
  tripId: string,
  invitationId: string,
) {
  return apiFetch<Invitation>(
    `/trips/${tripId}/invitations/${invitationId}/revoke`,
    {
      method: "POST",
    },
  );
}

export function acceptInvitation(token: string) {
  return apiFetch<{
    id: string;
    trip_id: string;
    role: string;
  }>(
    `/invitations/${encodeURIComponent(token)}/accept`,
    {
      method: "POST",
    },
  );
}