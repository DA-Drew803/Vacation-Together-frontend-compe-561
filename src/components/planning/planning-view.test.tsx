import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanningView } from "./planning-view";

const mocks = vi.hoisted(() => ({
  createInvitation: vi.fn(),
  getCurrentUser: vi.fn(),
  getGroupMatch: vi.fn(),
  getMyAvailability: vi.fn(),
  getMyBudget: vi.fn(),
  getMyPreferences: vi.fn(),
  getTrip: vi.fn(),
  getTripMembers: vi.fn(),
  removeTripMember: vi.fn(),
  updateMyAvailability: vi.fn(),
  updateMyBudget: vi.fn(),
  updateMyPreferences: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/api/approval", () => ({
  getTripMembers: mocks.getTripMembers,
  removeTripMember: mocks.removeTripMember,
}));
vi.mock("@/lib/api/invitation", () => ({ createInvitation: mocks.createInvitation }));
vi.mock("@/lib/api/member-planning", () => ({
  getMyAvailability: mocks.getMyAvailability,
  getMyBudget: mocks.getMyBudget,
  updateMyAvailability: mocks.updateMyAvailability,
  updateMyBudget: mocks.updateMyBudget,
}));
vi.mock("@/lib/api/preferences", () => ({
  getMyPreferences: mocks.getMyPreferences,
  updateMyPreferences: mocks.updateMyPreferences,
}));
vi.mock("@/lib/api/trip", () => ({
  getGroupMatch: mocks.getGroupMatch,
  getTrip: mocks.getTrip,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "user-1", email: "joy@example.com", display_name: "Joy" });
  mocks.getTrip.mockResolvedValue({ id: "trip-1", name: "Tokyo", state: "PLANNING" });
  mocks.getTripMembers.mockResolvedValue([
    { id: "member-1", user_id: "user-1", display_name: "Joy", role: "OWNER", status: "ACTIVE", voting_eligible: true },
  ]);
  mocks.getMyAvailability.mockResolvedValue({ member_id: "member-1", ranges: [] });
  mocks.getMyBudget.mockRejectedValue(new Error("Budget not set"));
  mocks.getMyPreferences.mockResolvedValue({ member_id: "member-1", interests: [], private_notes: null });
  mocks.getGroupMatch.mockRejectedValue(new Error("All eligible members must provide availability"));
  mocks.updateMyAvailability.mockResolvedValue({ member_id: "member-1", ranges: [{ start_date: "2027-01-01", end_date: "2027-01-05" }] });
  mocks.updateMyBudget.mockResolvedValue({ member_id: "member-1", max_amount: "1200.00", currency: "USD" });
});

describe("PlanningView", () => {
  it("lets the creator save member availability and budget", async () => {
    render(<PlanningView tripId="trip-1" />);

    const start = await screen.findByLabelText("START");
    fireEvent.change(start, { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByLabelText("END"), { target: { value: "2027-01-05" } });
    fireEvent.change(screen.getByLabelText("MAX BUDGET / PERSON"), { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "SAVE DATES & BUDGET" }));

    await waitFor(() => {
      expect(mocks.updateMyAvailability).toHaveBeenCalledWith("trip-1", [
        { start_date: "2027-01-01", end_date: "2027-01-05" },
      ]);
      expect(mocks.updateMyBudget).toHaveBeenCalledWith("trip-1", 1200, "USD");
    });
  });

  it("shows the backend readiness message while planning is incomplete", async () => {
    render(<PlanningView tripId="trip-1" />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "All eligible members must provide availability",
    );
    expect(screen.getByRole("link", { name: "VIEW GROUP MATCH →" })).toHaveAttribute(
      "href",
      "/trips/trip-1/group_match",
    );
  });
});
