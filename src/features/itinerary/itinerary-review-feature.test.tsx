import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItineraryReviewFeature } from "./itinerary-review-feature";
import type { Itinerary } from "@/lib/itinerary/types";

const draft: Itinerary = {
  id: "i", trip_id: "trip-1", destination_id: "d", version: 1, status: "DRAFT",
  days: [{ day_number: 1, activities: [{ position: 1, title: "Museum", estimated_cost: 20 }] }],
  estimated_total_cost: { max_amount: 100, currency: "USD" },
};

const jsonResponse = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe("ItineraryReviewFeature", () => {
  it("shows loading and then retrieved itinerary content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => jsonResponse(draft)));
    render(<ItineraryReviewFeature tripId="trip-1" accessToken="token" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading itinerary");
    expect(await screen.findByText("Museum")).toBeInTheDocument();
  });

  it("shows failed or missing itinerary retrieval with recovery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => jsonResponse({ detail: "Itinerary has not been generated" }, 409)));
    render(<ItineraryReviewFeature tripId="trip-1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Itinerary has not been generated");
    expect(screen.getByRole("button", { name: "TRY AGAIN" })).toBeInTheDocument();
  });

  it("processes HTTP 202, publishes a new version, and prevents duplicate submissions", async () => {
    let resolvePost: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      if (init.method === "POST") return new Promise<Response>((resolve) => { resolvePost = resolve; });
      return jsonResponse({ ...draft, version: 2 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    render(<ItineraryReviewFeature tripId="trip-1" initialItinerary={draft} onItineraryChange={onChange} pollIntervalMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: "MAKE IT CHEAPER" }));
    fireEvent.change(screen.getByLabelText("Choose a day to make cheaper"), { target: { value: "1" } });
    const submit = screen.getByRole("button", { name: "REQUEST REVISION" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(1);
    await act(async () => resolvePost?.(new Response(JSON.stringify({ id: "r", status: "RUNNING", requested_version: 1 }), { status: 202 })));
    await waitFor(() => expect(screen.getByText(/Revision complete.*version 2/i)).toBeInTheDocument());
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ version: 2 }));
  });

  it("invokes the unauthorized boundary for HTTP 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => jsonResponse({}, 401)));
    const onUnauthorized = vi.fn();
    render(<ItineraryReviewFeature tripId="trip-1" onUnauthorized={onUnauthorized} />);
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
    expect(screen.getByRole("alert")).toHaveTextContent("session has expired");
  });

  it("does not publish a late response from a previous trip", async () => {
    let resolveTripOne: ((response: Response) => void) | undefined;
    let resolveTripTwo: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => new Promise<Response>((resolve) => {
      if (url.includes("trip-1")) resolveTripOne = resolve;
      else resolveTripTwo = resolve;
    })));
    const onChange = vi.fn();
    const view = render(<ItineraryReviewFeature tripId="trip-1" onItineraryChange={onChange} />);
    view.rerender(<ItineraryReviewFeature tripId="trip-2" onItineraryChange={onChange} />);
    await act(async () => resolveTripTwo?.(new Response(JSON.stringify({
      ...draft, id: "i-2", trip_id: "trip-2", days: [{ day_number: 1, activities: [{ position: 1, title: "Trip Two", estimated_cost: 20 }] }],
    }), { status: 200 })));
    expect(await screen.findByText("Trip Two")).toBeInTheDocument();
    await act(async () => resolveTripOne?.(new Response(JSON.stringify({
      ...draft, days: [{ day_number: 1, activities: [{ position: 1, title: "Stale Trip One", estimated_cost: 20 }] }],
    }), { status: 200 })));
    expect(screen.queryByText("Stale Trip One")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ trip_id: "trip-2" }));
  });
});
