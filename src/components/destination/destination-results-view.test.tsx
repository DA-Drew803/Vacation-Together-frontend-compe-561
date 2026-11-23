import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DestinationCandidate } from "@/lib/api/destination";
import { DestinationResultsView } from "./destination-results-view";

const mocks = vi.hoisted(() => ({
  getDestinationCandidates: vi.fn(),
  getCandidatePhotoUrl: vi.fn(),
  apiFetchBlob: vi.fn(),
}));

vi.mock("@/lib/api/destination", () => ({
  getDestinationCandidates: mocks.getDestinationCandidates,
  getCandidatePhotoUrl: mocks.getCandidatePhotoUrl,
}));

vi.mock("@/lib/api/client", () => ({
  apiFetchBlob: mocks.apiFetchBlob,
}));

vi.mock("@/lib/destination-image", () => ({
  genericTravelFallback: "/images/travel-hero-fallback.svg",
}));

const candidates: DestinationCandidate[] = [
  {
    id: "seoul",
    destination_id: "seoul",
    name: "Seoul, South Korea",
    match_score: 0.82,
    estimated_cost: {
      amount: 1080,
      currency: "USD",
    },
    weather: null,
    reason: "Strong culture and food match.",
  },
  {
    id: "tokyo",
    destination_id: "tokyo",
    name: "Tokyo, Japan",
    match_score: 0.86,
    estimated_cost: {
      amount: 1150,
      currency: "USD",
    },
    weather: null,
    reason: "Best overall match.",
  },
  {
    id: "bangkok",
    destination_id: "bangkok",
    name: "Bangkok, Thailand",
    match_score: 0.78,
    estimated_cost: {
      amount: 950,
      currency: "USD",
    },
    weather: null,
    reason: "Strong value and food match.",
  },
];

beforeEach(() => {
  vi.clearAllMocks();

  mocks.getDestinationCandidates.mockResolvedValue(candidates);

  // Let the component fall back to the project's generic image.
  mocks.apiFetchBlob.mockRejectedValue(new Error("Photo unavailable"));

  mocks.getCandidatePhotoUrl.mockImplementation(
    (tripId: string, candidateId: string) =>
      `/trips/${tripId}/destination_candidates/${candidateId}/photo`,
  );
});

describe("DestinationResultsView", () => {
  it("loads destination candidates for the routed trip", async () => {
    render(<DestinationResultsView tripId="trip-1" />);

    expect(
      screen.getByText("Finding your group's best matches."),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", {
        name: "Where your group aligns.",
      }),
    ).toBeInTheDocument();

    expect(mocks.getDestinationCandidates).toHaveBeenCalledWith("trip-1");
  });

  it("ranks destinations by match score", async () => {
    render(<DestinationResultsView tripId="trip-1" />);

    await screen.findByRole("heading", {
      name: "Where your group aligns.",
    });

    const destinationHeadings = screen.getAllByRole("heading", {
      level: 2,
    });

    expect(destinationHeadings[0]).toHaveTextContent("Tokyo, Japan");
    expect(destinationHeadings[1]).toHaveTextContent("Seoul, South Korea");
    expect(destinationHeadings[2]).toHaveTextContent("Bangkok, Thailand");
  });

  it("displays match percentages and estimated costs", async () => {
    render(<DestinationResultsView tripId="trip-1" />);

    expect(await screen.findByText("86% GROUP MATCH")).toBeInTheDocument();
    expect(screen.getByText("82% match")).toBeInTheDocument();
    expect(screen.getByText("78% match")).toBeInTheDocument();

    expect(screen.getByText("About $1,150 / person")).toBeInTheDocument();
    expect(screen.getByText("$1,080 / person")).toBeInTheDocument();
    expect(screen.getByText("$950 / person")).toBeInTheDocument();
  });

  it("shows an empty state when no candidates are available", async () => {
    mocks.getDestinationCandidates.mockResolvedValue([]);

    render(<DestinationResultsView tripId="trip-1" />);

    expect(
      await screen.findByText("NO DESTINATIONS YET"),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "No destination matches have been generated for this trip.",
      ),
    ).toBeInTheDocument();
  });

  it("shows an error state when candidate loading fails", async () => {
    mocks.getDestinationCandidates.mockRejectedValue(
      new Error("Destination request failed"),
    );

    render(<DestinationResultsView tripId="trip-1" />);

    expect(
      await screen.findByText("DESTINATIONS UNAVAILABLE"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Destination request failed"),
    ).toBeInTheDocument();
  });

  it("links to voting using the encoded trip id", async () => {
    render(<DestinationResultsView tripId="trip/one" />);

    const link = await screen.findByRole("link", {
      name: "CONTINUE TO VOTING",
    });

    expect(link).toHaveAttribute(
      "href",
      "/trips/trip%2Fone/voting",
    );
  });

  it("requests candidate photos and falls back when unavailable", async () => {
    render(<DestinationResultsView tripId="trip-1" />);

    await waitFor(() => {
      expect(mocks.getCandidatePhotoUrl).toHaveBeenCalledWith(
        "trip-1",
        "tokyo",
      );
    });

    expect(mocks.getCandidatePhotoUrl).toHaveBeenCalledWith(
      "trip-1",
      "seoul",
    );

    expect(mocks.getCandidatePhotoUrl).toHaveBeenCalledWith(
      "trip-1",
      "bangkok",
    );
  });
});