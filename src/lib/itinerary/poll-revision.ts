import { getItinerary, ItineraryApiError, type ItineraryApiOptions } from "./api";
import type { Itinerary } from "./types";

export type RevisionResolution =
  | { outcome: "changed"; itinerary: Itinerary }
  | { outcome: "unresolved"; itinerary: Itinerary }
  | { outcome: "timeout"; itinerary: Itinerary | null };

export interface PollRevisionOptions extends ItineraryApiOptions {
  intervalMs?: number;
  maxAttempts?: number;
  loadItinerary?: typeof getItinerary;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

export function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    }, { once: true });
  });
}

export async function pollRevision(
  tripId: string,
  requestedVersion: number,
  options: PollRevisionOptions = {},
): Promise<RevisionResolution> {
  const {
    intervalMs = 1500,
    maxAttempts = 20,
    loadItinerary = getItinerary,
    wait = abortableDelay,
    ...apiOptions
  } = options;
  let latest: Itinerary | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    apiOptions.signal?.throwIfAborted();
    if (attempt > 0) await wait(intervalMs, apiOptions.signal);
    latest = await loadItinerary(tripId, apiOptions);
    if (latest.version < requestedVersion) {
      throw new ItineraryApiError(
        "The itinerary service returned an older version while resolving the revision.",
        502,
        "VERSION_REGRESSION",
      );
    }
    if (latest.version > requestedVersion) return { outcome: "changed", itinerary: latest };
    if (latest.status !== "REVISING") return { outcome: "unresolved", itinerary: latest };
  }
  return { outcome: "timeout", itinerary: latest };
}
