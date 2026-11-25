import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TripMember } from "@/lib/api/approval";
import type { GroupMatch } from "@/lib/api/trip";
import { GroupMatchView } from "./group-match-view";

const mocks = vi.hoisted(() => ({
  generateDestinationCandidates: vi.fn(),
  getGroupMatch: vi.fn(),
  getTripMembers: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api/approval", () => ({ getTripMembers: mocks.getTripMembers }));
vi.mock("@/lib/api/destination", () => ({
  generateDestinationCandidates: mocks.generateDestinationCandidates,
}));
vi.mock("@/lib/api/trip", () => ({ getGroupMatch: mocks.getGroupMatch }));

const readyMatch: GroupMatch = {
  common_date_ranges: {
    ranges: [
      { start_date: "2026-12-10", end_date: "2026-12-14" },
      { start_date: "2027-01-08", end_date: "2027-01-10" },
    ],
  },
  group_max_budget: { max_amount: "1200", currency: "USD" },
  interests: ["food", "museums"],
  ready: true,
  reason: null,
};

const members: TripMember[] = [
  { id: "member-1", user_id: "user-1", display_name: "Avery", role: "OWNER", status: "ACTIVE", voting_eligible: true },
  { id: "member-2", user_id: "user-2", display_name: "Blake", role: "MEMBER", status: "ACTIVE", voting_eligible: true },
  { id: "member-3", user_id: "user-3", display_name: "Removed traveler", role: "MEMBER", status: "REMOVED", voting_eligible: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getGroupMatch.mockResolvedValue(readyMatch);
  mocks.getTripMembers.mockResolvedValue(members);
  mocks.generateDestinationCandidates.mockResolvedValue([]);
});

describe("GroupMatchView", () => {
  it("loads group data for the routed trip and displays every shared date range", async () => {
    render(<GroupMatchView tripId="trip-1" />);
    expect(screen.getByRole("status")).toHaveTextContent("LOADING GROUP MATCH");

    expect(await screen.findByRole("heading", { name: "Where your group aligns." })).toBeInTheDocument();
    expect(mocks.getGroupMatch).toHaveBeenCalledWith("trip-1");
    expect(mocks.getTripMembers).toHaveBeenCalledWith("trip-1");
    expect(screen.getByText(/Dec 10 — Dec 14 · Jan 8 — Jan 10/)).toBeInTheDocument();
    expect(screen.getByText("$1,200 / person")).toBeInTheDocument();
    expect(screen.getByText("food · museums")).toBeInTheDocument();
  });

  it("shows active members and excludes removed members", async () => {
    render(<GroupMatchView tripId="trip-1" />);
    expect(await screen.findByText("Avery")).toBeInTheDocument();
    expect(screen.getByText("Blake")).toBeInTheDocument();
    expect(screen.queryByText("Removed traveler")).not.toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("explains when destination generation is not ready", async () => {
    mocks.getGroupMatch.mockResolvedValue({
      ...readyMatch,
      ready: false,
      reason: "Every eligible traveler must complete their preferences.",
    });
    render(<GroupMatchView tripId="trip-1" />);

    expect(await screen.findByText("Every eligible traveler must complete their preferences.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "FIND DESTINATIONS" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.generateDestinationCandidates).not.toHaveBeenCalled();
  });

  it("generates candidates once and continues to destination results", async () => {
    let finishGeneration: (() => void) | undefined;
    mocks.generateDestinationCandidates.mockImplementation(() => new Promise<void>((resolve) => {
      finishGeneration = resolve;
    }));
    render(<GroupMatchView tripId="trip/one" />);
    const button = await screen.findByRole("button", { name: "FIND DESTINATIONS" });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.generateDestinationCandidates).toHaveBeenCalledTimes(1);
    expect(mocks.generateDestinationCandidates).toHaveBeenCalledWith("trip/one");
    expect(screen.getByRole("button", { name: "FINDING DESTINATIONS…" })).toBeDisabled();

    await act(async () => finishGeneration?.());
    expect(mocks.push).toHaveBeenCalledWith("/trips/trip%2Fone/results");
  });

  it("continues to existing results when voting has already started", async () => {
    mocks.generateDestinationCandidates.mockRejectedValue(
      new Error("Candidates cannot change after voting starts"),
    );
    render(<GroupMatchView tripId="trip/one" />);

    fireEvent.click(await screen.findByRole("button", { name: "FIND DESTINATIONS" }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith("/trips/trip%2Fone/results");
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("preserves loaded content when candidate generation fails", async () => {
    mocks.generateDestinationCandidates.mockRejectedValue(new Error("Generation service unavailable"));
    render(<GroupMatchView tripId="trip-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "FIND DESTINATIONS" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Generation service unavailable");
    expect(screen.getByRole("heading", { name: "Where your group aligns." })).toBeInTheDocument();
    expect(screen.getByText("Avery")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("offers retry after a data-loading failure", async () => {
    mocks.getGroupMatch.mockRejectedValueOnce(new Error("Group match request failed"));
    render(<GroupMatchView tripId="trip-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Group match request failed");
    expect(screen.getByRole("link", { name: "RETURN TO PLANNING →" })).toHaveAttribute(
      "href",
      "/trips/trip-1/plan",
    );
    fireEvent.click(screen.getByRole("button", { name: "TRY AGAIN" }));
    expect(await screen.findByRole("heading", { name: "Where your group aligns." })).toBeInTheDocument();
    expect(mocks.getGroupMatch).toHaveBeenCalledTimes(2);
  });

  it("displays empty states for dates, interests, and active members", async () => {
    mocks.getGroupMatch.mockResolvedValue({
      ...readyMatch,
      common_date_ranges: { ranges: [] },
      interests: [],
    });
    mocks.getTripMembers.mockResolvedValue([{ ...members[2] }]);
    render(<GroupMatchView tripId="trip-1" />);

    expect(await screen.findByText("No shared dates yet")).toBeInTheDocument();
    expect(screen.getByText("No shared interests yet.")).toBeInTheDocument();
    expect(screen.getByText("No active travelers are available yet.")).toBeInTheDocument();
  });

  it("presents authentication failures accessibly and allows another attempt", async () => {
    mocks.getGroupMatch.mockRejectedValueOnce(new Error("Your session has expired. Please sign in again."));
    render(<GroupMatchView tripId="trip-1" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your session has expired. Please sign in again.");
    fireEvent.click(screen.getByRole("button", { name: "TRY AGAIN" }));
    await waitFor(() => expect(mocks.getGroupMatch).toHaveBeenCalledTimes(2));
  });
});
