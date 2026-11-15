import type { DestinationCandidate, MyVote, VotingProgress } from "@/lib/api/destination";

/** Selects only the presentation hero; the backend remains authoritative for the winner. */
export function selectVotingHero(
  candidates: DestinationCandidate[],
  progress: VotingProgress | null,
  myVote: MyVote | null,
) {
  if (progress?.status === "CLOSED" && progress.selected_destination_id) {
    return candidates.find((candidate) => candidate.destination_id === progress.selected_destination_id) ?? null;
  }
  if (progress?.status === "OPEN" && myVote?.candidate_id) {
    return candidates.find((candidate) => candidate.id === myVote.candidate_id) ?? null;
  }
  return candidates[0] ?? null;
}
