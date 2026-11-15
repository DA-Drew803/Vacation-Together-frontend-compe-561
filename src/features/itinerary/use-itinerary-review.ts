"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getItinerary, ItineraryApiError, requestRevision } from "@/lib/itinerary/api";
import { pollRevision } from "@/lib/itinerary/poll-revision";
import type { Itinerary } from "@/lib/itinerary/types";

export type ReviewFeedback =
  | { kind: "success" | "error" | "warning"; message: string }
  | null;

export interface UseItineraryReviewOptions {
  tripId: string;
  accessToken?: string | null;
  initialItinerary?: Itinerary | null;
  onItineraryChange?: (itinerary: Itinerary) => void;
  onUnauthorized?: () => void;
  pollIntervalMs?: number;
  pollMaxAttempts?: number;
}

interface ReviewState {
  contextKey: string;
  itinerary: Itinerary | null;
  isLoading: boolean;
  isSubmitting: boolean;
  feedback: ReviewFeedback;
}

interface ActiveOperation {
  id: number;
  contextKey: string;
  kind: "load" | "refresh" | "revision";
  controller: AbortController;
}

function contextIdentifier(tripId: string, accessToken?: string | null): string {
  return `${tripId}\u0000${accessToken ?? ""}`;
}

export function useItineraryReview({
  tripId,
  accessToken,
  initialItinerary = null,
  onItineraryChange,
  onUnauthorized,
  pollIntervalMs,
  pollMaxAttempts,
}: UseItineraryReviewOptions) {
  const contextKey = useMemo(
    () => contextIdentifier(tripId, accessToken),
    [accessToken, tripId],
  );
  const matchingInitial = initialItinerary?.trip_id === tripId ? initialItinerary : null;
  const [state, setState] = useState<ReviewState>({
    contextKey,
    itinerary: matchingInitial,
    isLoading: !matchingInitial,
    isSubmitting: false,
    feedback: null,
  });
  const mountedRef = useRef(false);
  const contextKeyRef = useRef(contextKey);
  const latestItineraryRef = useRef<Itinerary | null>(matchingInitial);
  const operationSequenceRef = useRef(0);
  const activeOperationRef = useRef<ActiveOperation | null>(null);
  const previousLifecycleRef = useRef<{ tripId: string; accessToken?: string | null } | null>(null);
  const previousInitialRef = useRef<Itinerary | null>(matchingInitial);
  const onItineraryChangeRef = useRef(onItineraryChange);
  const onUnauthorizedRef = useRef(onUnauthorized);

  const invalidateActiveOperation = useCallback(() => {
    operationSequenceRef.current += 1;
    activeOperationRef.current?.controller.abort();
    activeOperationRef.current = null;
  }, []);

  const beginOperation = useCallback((kind: ActiveOperation["kind"], key: string) => {
    invalidateActiveOperation();
    const operation: ActiveOperation = {
      id: operationSequenceRef.current,
      contextKey: key,
      kind,
      controller: new AbortController(),
    };
    activeOperationRef.current = operation;
    return operation;
  }, [invalidateActiveOperation]);

  const isCurrentOperation = useCallback((operation: ActiveOperation) => (
    mountedRef.current &&
    !operation.controller.signal.aborted &&
    contextKeyRef.current === operation.contextKey &&
    activeOperationRef.current?.id === operation.id
  ), []);

  const publish = useCallback((next: Itinerary, operation: ActiveOperation) => {
    if (!isCurrentOperation(operation) || next.trip_id !== tripId) return false;
    const current = latestItineraryRef.current;
    if (current?.trip_id === next.trip_id && next.version < current.version) return false;

    latestItineraryRef.current = next;
    setState((previous) => {
      if (previous.contextKey !== operation.contextKey) return previous;
      if (
        previous.itinerary?.trip_id === next.trip_id &&
        previous.itinerary.version > next.version
      ) return previous;
      return { ...previous, itinerary: next };
    });
    onItineraryChangeRef.current?.(next);
    return true;
  }, [isCurrentOperation, tripId]);

  const setOperationError = useCallback((error: unknown, operation: ActiveOperation) => {
    if (!isCurrentOperation(operation)) return;
    if (error instanceof DOMException && error.name === "AbortError") return;
    const message = error instanceof ItineraryApiError
      ? error.message
      : "Something went wrong. Please try again.";
    if (error instanceof ItineraryApiError && error.status === 401) {
      onUnauthorizedRef.current?.();
    }
    setState((previous) => previous.contextKey === operation.contextKey
      ? { ...previous, feedback: { kind: "error", message } }
      : previous);
  }, [isCurrentOperation]);

  useEffect(() => {
    onItineraryChangeRef.current = onItineraryChange;
    onUnauthorizedRef.current = onUnauthorized;
  }, [onItineraryChange, onUnauthorized]);

  // This cleanup is independent of initialItinerary so every integration path aborts.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      contextKeyRef.current = "";
      invalidateActiveOperation();
    };
  }, [invalidateActiveOperation]);

  // A parent snapshot is authoritative when it is newer, or at the same version. Equal versions
  // are accepted so backend-controlled status/content transitions can be synchronized.
  useEffect(() => {
    if (!matchingInitial || previousInitialRef.current === matchingInitial) return;
    previousInitialRef.current = matchingInitial;
    const current = latestItineraryRef.current;
    if (current?.trip_id === tripId && matchingInitial.version < current.version) return;

    latestItineraryRef.current = matchingInitial;
    invalidateActiveOperation();
    setState((previous) => ({
      contextKey,
      itinerary: matchingInitial,
      isLoading: false,
      isSubmitting: false,
      feedback: previous.contextKey === contextKey ? previous.feedback : null,
    }));
  }, [contextKey, invalidateActiveOperation, matchingInitial, tripId]);

  useEffect(() => {
    const previousLifecycle = previousLifecycleRef.current;
    const authChanged = Boolean(
      previousLifecycle &&
      previousLifecycle.tripId === tripId &&
      previousLifecycle.accessToken !== accessToken,
    );
    previousLifecycleRef.current = { tripId, accessToken };
    contextKeyRef.current = contextKey;
    invalidateActiveOperation();

    const current = latestItineraryRef.current;
    const seed = current?.trip_id === tripId ? current : null;
    latestItineraryRef.current = seed;
    setState({
      contextKey,
      itinerary: seed,
      isLoading: authChanged || !seed,
      isSubmitting: false,
      feedback: null,
    });

    if (!authChanged && seed) return () => invalidateActiveOperation();

    const operation = beginOperation("load", contextKey);
    void getItinerary(tripId, { accessToken, signal: operation.controller.signal })
      .then((next) => {
        if (publish(next, operation)) {
          setState((previous) => previous.contextKey === operation.contextKey
            ? { ...previous, feedback: null }
            : previous);
        }
      })
      .catch((error: unknown) => setOperationError(error, operation))
      .finally(() => {
        if (!isCurrentOperation(operation)) return;
        activeOperationRef.current = null;
        setState((previous) => previous.contextKey === operation.contextKey
          ? { ...previous, isLoading: false }
          : previous);
      });

    return () => invalidateActiveOperation();
  }, [accessToken, beginOperation, contextKey, invalidateActiveOperation, isCurrentOperation, publish, setOperationError, tripId]);

  const refresh = useCallback(async () => {
    const operation = beginOperation("refresh", contextKey);
    setState((previous) => previous.contextKey === contextKey
      ? { ...previous, isLoading: true }
      : previous);
    try {
      const next = await getItinerary(tripId, {
        accessToken,
        signal: operation.controller.signal,
      });
      if (publish(next, operation)) {
        setState((previous) => previous.contextKey === contextKey
          ? { ...previous, feedback: null }
          : previous);
        return next;
      }
      return null;
    } catch (error) {
      setOperationError(error, operation);
      return null;
    } finally {
      if (isCurrentOperation(operation)) {
        activeOperationRef.current = null;
        setState((previous) => previous.contextKey === contextKey
          ? { ...previous, isLoading: false }
          : previous);
      }
    }
  }, [accessToken, beginOperation, contextKey, isCurrentOperation, publish, setOperationError, tripId]);

  const visibleItinerary = state.contextKey === contextKey
    ? state.itinerary
    : matchingInitial;

  const submitCheaperDay = useCallback(async (dayNumber: number) => {
    if (activeOperationRef.current?.kind === "revision" || (state.contextKey === contextKey && state.isSubmitting)) {
      return false;
    }
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || !visibleItinerary?.days.some(
      (day, index) => (day.day_number ?? index + 1) === dayNumber,
    )) {
      setState((previous) => previous.contextKey === contextKey
        ? { ...previous, feedback: { kind: "error", message: "Choose a valid itinerary day." } }
        : previous);
      return false;
    }
    if (visibleItinerary.status === "FINALIZED") {
      setState((previous) => previous.contextKey === contextKey
        ? { ...previous, feedback: { kind: "error", message: "Finalized itineraries cannot be revised." } }
        : previous);
      return false;
    }
    if (visibleItinerary.status === "REVISING") {
      setState((previous) => previous.contextKey === contextKey
        ? { ...previous, feedback: { kind: "warning", message: "A revision is already in progress." } }
        : previous);
      return false;
    }

    const operation = beginOperation("revision", contextKey);
    setState((previous) => previous.contextKey === contextKey ? {
      ...previous,
      isSubmitting: true,
      feedback: { kind: "warning", message: "Revision accepted. Checking for the updated itinerary…" },
    } : previous);

    try {
      const accepted = await requestRevision(tripId, `Make day ${dayNumber} cheaper`, {
        accessToken,
        signal: operation.controller.signal,
      });
      if (!isCurrentOperation(operation)) return false;
      const resolution = await pollRevision(tripId, accepted.requested_version, {
        accessToken,
        signal: operation.controller.signal,
        intervalMs: pollIntervalMs,
        maxAttempts: pollMaxAttempts,
      });
      if (!isCurrentOperation(operation)) return false;

      const published = resolution.itinerary
        ? publish(resolution.itinerary, operation)
        : true;
      if (!published) return false;

      if (resolution.outcome === "changed") {
        setState((previous) => previous.contextKey === contextKey ? {
          ...previous,
          feedback: {
            kind: "success",
            message: `Revision complete. Itinerary version ${resolution.itinerary.version} is ready for review. Refresh approval progress to see the authoritative approval state.`,
          },
        } : previous);
      } else if (resolution.outcome === "timeout") {
        setState((previous) => previous.contextKey === contextKey ? {
          ...previous,
          feedback: {
            kind: "warning",
            message: "The revision is still processing or could not be resolved. Refresh the itinerary before trying again.",
          },
        } : previous);
      } else {
        setState((previous) => previous.contextKey === contextKey ? {
          ...previous,
          feedback: {
            kind: "warning",
            message: "Processing ended without a new version. The API cannot distinguish no change from a failed revision; the current itinerary was preserved.",
          },
        } : previous);
      }
      return resolution.outcome === "changed";
    } catch (error) {
      setOperationError(error, operation);
      return false;
    } finally {
      if (isCurrentOperation(operation)) {
        activeOperationRef.current = null;
        setState((previous) => previous.contextKey === contextKey
          ? { ...previous, isSubmitting: false }
          : previous);
      }
    }
  }, [accessToken, beginOperation, contextKey, isCurrentOperation, pollIntervalMs, pollMaxAttempts, publish, setOperationError, state.contextKey, state.isSubmitting, tripId, visibleItinerary]);

  const setFeedback = useCallback((feedback: ReviewFeedback) => {
    setState((previous) => previous.contextKey === contextKey
      ? { ...previous, feedback }
      : previous);
  }, [contextKey]);

  return {
    itinerary: visibleItinerary,
    isLoading: state.contextKey === contextKey ? state.isLoading : !matchingInitial,
    isSubmitting: state.contextKey === contextKey ? state.isSubmitting : false,
    feedback: state.contextKey === contextKey ? state.feedback : null,
    refresh,
    submitCheaperDay,
    setFeedback,
  };
}
