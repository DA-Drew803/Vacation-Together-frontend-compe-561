import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Itinerary } from "@/lib/itinerary/types";
import { useItineraryReview } from "./use-itinerary-review";

function itinerary(
  tripId: string,
  version: number,
  title: string,
  status: Itinerary["status"] = "DRAFT",
): Itinerary {
  return {
    id: `${tripId}-${version}`,
    trip_id: tripId,
    destination_id: "destination-1",
    version,
    status,
    days: [{ day_number: 1, activities: [{ position: 1, title, estimated_cost: 20 }] }],
    estimated_total_cost: { max_amount: 100, currency: "USD" },
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

interface HarnessProps {
  tripId: string;
  accessToken?: string;
  initialItinerary?: Itinerary | null;
  onItineraryChange?: (next: Itinerary) => void;
}

function HookHarness(props: HarnessProps) {
  const review = useItineraryReview({ ...props, pollIntervalMs: 0, pollMaxAttempts: 2 });
  return (
    <div>
      <span data-testid="version">{review.itinerary?.version ?? "none"}</span>
      <span data-testid="title">{review.itinerary?.days[0]?.activities?.[0]?.title ?? "none"}</span>
      <span data-testid="submitting">{String(review.isSubmitting)}</span>
      <span data-testid="feedback">{review.feedback?.message ?? "none"}</span>
      <button type="button" onClick={() => void review.refresh()}>Refresh</button>
      <button type="button" disabled={review.isSubmitting} onClick={() => void review.submitCheaperDay(1)}>Revise</button>
    </div>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("useItineraryReview lifecycle", () => {
  it("aborts and invalidates a revision on unmount even with initial itinerary", async () => {
    const post = deferred<Response>();
    let postSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      postSignal = init.signal as AbortSignal;
      return post.promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    const view = render(
      <HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 1, "Version one")} onItineraryChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    expect(screen.getByTestId("submitting")).toHaveTextContent("true");
    view.unmount();
    expect(postSignal?.aborted).toBe(true);

    await act(async () => post.resolve(response({ id: "revision-1", status: "RUNNING", requested_version: 1 }, 202)));
    expect(onChange).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts a newer same-trip parent snapshot", async () => {
    const view = render(<HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 1, "Version one")} />);
    view.rerender(<HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 2, "Version two")} />);
    await waitFor(() => expect(screen.getByTestId("version")).toHaveTextContent("2"));
    expect(screen.getByTestId("title")).toHaveTextContent("Version two");
  });

  it("does not replace a newer internal version with a stale parent snapshot", async () => {
    const view = render(<HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 2, "Version two")} />);
    view.rerender(<HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 1, "Stale version one")} />);
    await act(async () => undefined);
    expect(screen.getByTestId("version")).toHaveTextContent("2");
    expect(screen.getByTestId("title")).toHaveTextContent("Version two");
  });

  it("accepts equal-version parent updates as authoritative status and content transitions", async () => {
    const view = render(<HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 2, "Reviewing", "REVISING")} />);
    view.rerender(<HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 2, "No-change result", "DRAFT")} />);
    await waitFor(() => expect(screen.getByTestId("title")).toHaveTextContent("No-change result"));
    expect(screen.getByTestId("version")).toHaveTextContent("2");
  });

  it("uses an authoritative prop update to supersede an active revision", async () => {
    const post = deferred<Response>();
    let postSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      postSignal = init.signal as AbortSignal;
      return post.promise;
    }));
    const onChange = vi.fn();
    const view = render(
      <HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 1, "Version one")} onItineraryChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    view.rerender(
      <HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 2, "Parent version two")} onItineraryChange={onChange} />,
    );
    await waitFor(() => expect(screen.getByTestId("submitting")).toHaveTextContent("false"));
    expect(postSignal?.aborted).toBe(true);
    expect(screen.getByTestId("version")).toHaveTextContent("2");
    await act(async () => post.resolve(response({ id: "revision-1", status: "RUNNING", requested_version: 1 }, 202)));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the newest result when same-trip refreshes resolve in reverse order", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      return fetchMock.mock.calls.length === 1 ? first.promise : second.promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    render(<HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 1, "Initial")} onItineraryChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(signals[0].aborted).toBe(true);

    await act(async () => second.resolve(response(itinerary("trip-1", 2, "Newest"))));
    expect(screen.getByTestId("version")).toHaveTextContent("2");
    await act(async () => first.resolve(response(itinerary("trip-1", 1, "Late stale"))));
    expect(screen.getByTestId("title")).toHaveTextContent("Newest");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ignores stale revision polling after a newer parent update", async () => {
    const poll = deferred<Response>();
    let pollSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      if (init.method === "POST") {
        return Promise.resolve(response({ id: "revision-1", status: "RUNNING", requested_version: 1 }, 202));
      }
      pollSignal = init.signal as AbortSignal;
      return poll.promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    const view = render(
      <HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 1, "Initial")} onItineraryChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    view.rerender(
      <HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 2, "Parent newest")} onItineraryChange={onChange} />,
    );
    await waitFor(() => expect(pollSignal?.aborted).toBe(true));
    await act(async () => poll.resolve(response(itinerary("trip-1", 3, "Stale operation result"))));
    expect(screen.getByTestId("version")).toHaveTextContent("2");
    expect(screen.getByTestId("title")).toHaveTextContent("Parent newest");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("resets submission state when the trip changes during a pending POST", async () => {
    const post = deferred<Response>();
    let oldSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      oldSignal = init.signal as AbortSignal;
      return post.promise;
    }));
    const view = render(<HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 1, "Trip one")} />);
    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    expect(screen.getByTestId("submitting")).toHaveTextContent("true");
    view.rerender(<HookHarness tripId="trip-2" initialItinerary={itinerary("trip-2", 1, "Trip two")} />);
    await waitFor(() => expect(screen.getByTestId("submitting")).toHaveTextContent("false"));
    expect(oldSignal?.aborted).toBe(true);
    expect(screen.getByTestId("title")).toHaveTextContent("Trip two");
    expect(screen.getByTestId("feedback")).toHaveTextContent("none");
    expect(screen.getByRole("button", { name: "Revise" })).toBeEnabled();
  });

  it("resets submission state when the trip changes during polling", async () => {
    const poll = deferred<Response>();
    let pollSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      if (init.method === "POST") {
        return Promise.resolve(response({ id: "revision-1", status: "RUNNING", requested_version: 1 }, 202));
      }
      pollSignal = init.signal as AbortSignal;
      return poll.promise;
    }));
    const view = render(<HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 1, "Trip one")} />);
    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    await waitFor(() => expect(pollSignal).toBeDefined());
    view.rerender(<HookHarness tripId="trip-2" initialItinerary={itinerary("trip-2", 1, "Trip two")} />);
    await waitFor(() => expect(screen.getByTestId("submitting")).toHaveTextContent("false"));
    expect(pollSignal?.aborted).toBe(true);
    expect(screen.getByTestId("title")).toHaveTextContent("Trip two");
    expect(screen.getByRole("button", { name: "Revise" })).toBeEnabled();
  });

  it("aborts old authentication work and resets submission state when the token changes", async () => {
    const post = deferred<Response>();
    let oldSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      if (init.method === "POST") {
        oldSignal = init.signal as AbortSignal;
        return post.promise;
      }
      return Promise.resolve(response(itinerary("trip-1", 1, "Authenticated again")));
    });
    vi.stubGlobal("fetch", fetchMock);
    const initial = itinerary("trip-1", 1, "Initial");
    const view = render(<HookHarness tripId="trip-1" accessToken="token-a" initialItinerary={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    view.rerender(<HookHarness tripId="trip-1" accessToken="token-b" initialItinerary={initial} />);
    await waitFor(() => expect(screen.getByTestId("submitting")).toHaveTextContent("false"));
    expect(oldSignal?.aborted).toBe(true);
    expect(await screen.findByText("Authenticated again")).toBeInTheDocument();
  });

  it("does not begin polling after an unexpected revision success status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      id: "revision-1", status: "RUNNING", requested_version: 1,
    }, 200));
    vi.stubGlobal("fetch", fetchMock);
    render(<HookHarness tripId="trip-1" initialItinerary={itinerary("trip-1", 1, "Initial")} />);
    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    await waitFor(() => expect(screen.getByTestId("feedback")).toHaveTextContent("unexpected HTTP 200"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("submitting")).toHaveTextContent("false");
  });
});
