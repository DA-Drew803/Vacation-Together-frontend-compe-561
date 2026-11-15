import { apiFetch, apiUrl } from "@/lib/api/client";

export type DestinationCandidate = {
  id: string;
  destination_id: string;
  name: string;
  match_score: number;
  estimated_cost: { amount: number; currency: string };
  weather: Record<string, unknown> | null;
  reason: string;
};

export type VotingProgress = {
  status: "NOT_STARTED" | "OPEN" | "CLOSED";
  eligible_count: number;
  voted_count: number;
  selected_destination_id: string | null;
  tallies: Record<string, number>;
};

export type MyVote = { candidate_id: string | null; member_id: string };
export type VotingState = { trip_id: string; status: "OPEN" | "CLOSED"; selected_candidate_id: string | null };

export function getDestinationCandidates(tripId: string) { return apiFetch<DestinationCandidate[]>(`/trips/${tripId}/destination_candidates`); }
export function generateDestinationCandidates(tripId: string) { return apiFetch<DestinationCandidate[]>(`/trips/${tripId}/destination_candidates/generate`, { method: "POST" }); }
export function getMyDestinationVote(tripId: string) { return apiFetch<MyVote>(`/trips/${tripId}/votes/me`); }
export function voteForDestination(tripId: string, candidateId: string) { return apiFetch<MyVote>(`/trips/${tripId}/votes/me`, { method: "PUT", body: JSON.stringify({ candidate_id: candidateId }) }); }
export function getVotingProgress(tripId: string) { return apiFetch<VotingProgress>(`/trips/${tripId}/voting_state`); }
export function startVoting(tripId: string) { return apiFetch<VotingState>(`/trips/${tripId}/voting/start`, { method: "POST" }); }
export function closeVoting(tripId: string) { return apiFetch<VotingProgress>(`/trips/${tripId}/votes/close`, { method: "POST" }); }
export function getCandidatePhotoUrl(tripId: string, candidateId: string) {
  return apiUrl(`/trips/${tripId}/destination_candidates/${candidateId}/photo`);
}
