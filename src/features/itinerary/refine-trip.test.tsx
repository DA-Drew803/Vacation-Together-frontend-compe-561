import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Itinerary } from "@/lib/itinerary/types";
import { RefineTrip } from "./refine-trip";

const draft: Itinerary = {
  id: "i", trip_id: "t", destination_id: "d", version: 1, status: "DRAFT",
  days: [{ day_number: 1, activities: [{ title: "Museum", estimated_cost: 20 }] }],
  estimated_total_cost: { max_amount: 100, currency: "USD" },
};

describe("RefineTrip", () => {
  it("requires a day and submits a structured cheaper-day request", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(<RefineTrip itinerary={draft} isSubmitting={false} feedback={null} onSubmitCheaperDay={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "MAKE IT CHEAPER" }));
    const requestButton = screen.getByRole("button", { name: "REQUEST REVISION" });
    expect(requestButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Choose a day to make cheaper"), { target: { value: "1" } });
    fireEvent.click(requestButton);
    expect(submit).toHaveBeenCalledWith(1);
  });

  it("exposes unsupported actions as disabled with accessible explanations", () => {
    render(<RefineTrip itinerary={draft} isSubmitting={false} feedback={null} onSubmitCheaperDay={vi.fn()} />);
    expect(screen.getByRole("button", { name: "REDUCE WALKING" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "SWAP ACTIVITY" })).toBeDisabled();
    expect(screen.getByText(/trusted metadata required to apply them safely/i)).toBeInTheDocument();
  });

  it("prevents revisions for a finalized itinerary", () => {
    render(<RefineTrip itinerary={{ ...draft, status: "FINALIZED" }} isSubmitting={false} feedback={null} onSubmitCheaperDay={vi.fn()} />);
    expect(screen.getByRole("button", { name: "MAKE IT CHEAPER" })).toBeDisabled();
    expect(screen.getByText(/finalized and can no longer be revised/i)).toBeInTheDocument();
  });

  it("announces processing and error feedback", () => {
    render(<RefineTrip itinerary={{ ...draft, status: "REVISING" }} isSubmitting feedback={{ kind: "error", message: "Request failed." }} onSubmitCheaperDay={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("already processing");
    expect(screen.getByRole("alert")).toHaveTextContent("Request failed");
  });
});
