import { describe, expect, it } from "vitest";
import { selectVotingHero } from "@/lib/destination-voting";
import type { DestinationCandidate, MyVote, VotingProgress } from "@/lib/api/destination";

const candidates: DestinationCandidate[] = [
  { id: "a", destination_id: "da", name: "First", match_score: 0.9, estimated_cost: { amount: 1, currency: "USD" }, weather: null, reason: "" },
  { id: "b", destination_id: "db", name: "Second", match_score: 0.8, estimated_cost: { amount: 1, currency: "USD" }, weather: null, reason: "" },
];
const progress = (status: VotingProgress["status"], selected_destination_id: string | null = null): VotingProgress => ({ status, eligible_count: 2, voted_count: 1, selected_destination_id, tallies: {} });

describe("selectVotingHero", () => {
  it("uses the backend-selected destination after voting closes", () => expect(selectVotingHero(candidates, progress("CLOSED", "db"), null)?.id).toBe("b"));
  it("uses the current member's vote while voting is open", () => {
    const vote: MyVote = { candidate_id: "b", member_id: "member" };
    expect(selectVotingHero(candidates, progress("OPEN"), vote)?.id).toBe("b");
  });
  it("uses the backend-ranked first candidate when there is no personal vote", () => expect(selectVotingHero(candidates, progress("OPEN"), null)?.id).toBe("a"));
});
