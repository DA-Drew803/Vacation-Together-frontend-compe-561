import type { Itinerary, RevisionAccepted } from "./types";

const DEFAULT_API_URL = "http://localhost:8000/api";

function requestUrl(path: string, options: ItineraryApiOptions): string {
  const baseUrl = (options.apiUrl
    ?? process.env.NEXT_PUBLIC_API_BASE_URL
    ?? process.env.NEXT_PUBLIC_API_URL
    ?? DEFAULT_API_URL).replace(/\/+$/, "");
  const normalizedPath = baseUrl.endsWith("/api") && path.startsWith("/api")
    ? path.slice("/api".length)
    : path;
  return `${baseUrl}${normalizedPath}`;
}

export class ItineraryApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ItineraryApiError";
  }
}

export interface ItineraryApiOptions {
  apiUrl?: string;
  accessToken?: string | null;
  signal?: AbortSignal;
}

interface ContractError {
  code?: unknown;
  message?: unknown;
  detail?: unknown;
}

function safeMessage(status: number, payload: ContractError | null): string {
  const messages: Record<number, string> = {
    400: "That revision request is not valid.",
    401: "Your session has expired. Please sign in again.",
    403: "You do not have access to this trip.",
    409: "The itinerary cannot be revised in its current state.",
  };
  const contractMessage = typeof payload?.message === "string" ? payload.message : null;
  const fastApiDetail = typeof payload?.detail === "string" ? payload.detail : null;
  const detail = contractMessage ?? fastApiDetail;
  if (detail && detail.length <= 180 && status < 500) return detail;
  return messages[status] ?? "The itinerary service is unavailable. Please try again.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1;
}

function isFiniteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

const ITINERARY_STATUSES = new Set(["GENERATING", "DRAFT", "REVISING", "FINALIZED", "FAILED"]);
const REVISION_STATUSES = new Set(["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "NO_CHANGE"]);

export function parseItinerary(value: unknown): Itinerary {
  if (!isRecord(value)) throw new ItineraryApiError("The itinerary service returned invalid data.", 502, "INVALID_RESPONSE");
  const budget = value.estimated_total_cost;
  if (
    typeof value.id !== "string" || typeof value.trip_id !== "string" ||
    typeof value.destination_id !== "string" || !isPositiveInteger(value.version) ||
    typeof value.status !== "string" || !ITINERARY_STATUSES.has(value.status) ||
    !isRecord(budget) || !isFinitePositive(budget.max_amount) ||
    typeof budget.currency !== "string" || !/^[A-Za-z]{3}$/.test(budget.currency) ||
    !Array.isArray(value.days)
  ) {
    throw new ItineraryApiError("The itinerary service returned invalid data.", 502, "INVALID_RESPONSE");
  }

  const days = value.days.map((day) => {
    if (!isRecord(day) || !isPositiveInteger(day.day_number) || !Array.isArray(day.activities)) {
      throw new ItineraryApiError("The itinerary service returned invalid day data.", 502, "INVALID_RESPONSE");
    }
    const activities = day.activities.map((activity) => {
      if (
        !isRecord(activity) || !isPositiveInteger(activity.position) ||
        typeof activity.title !== "string" || !activity.title.trim() ||
        !isFiniteNonnegative(activity.estimated_cost)
      ) {
        throw new ItineraryApiError("The itinerary service returned invalid activity data.", 502, "INVALID_RESPONSE");
      }
      return { ...activity, position: activity.position, title: activity.title, estimated_cost: activity.estimated_cost };
    });
    return { ...day, day_number: day.day_number, activities };
  });

  return {
    id: value.id,
    trip_id: value.trip_id,
    destination_id: value.destination_id,
    version: value.version,
    status: value.status as Itinerary["status"],
    days,
    estimated_total_cost: { max_amount: budget.max_amount, currency: budget.currency.toUpperCase() },
  };
}

export function parseRevision(value: unknown): RevisionAccepted {
  if (
    !isRecord(value) || typeof value.id !== "string" ||
    typeof value.status !== "string" || !REVISION_STATUSES.has(value.status) ||
    !isPositiveInteger(value.requested_version)
  ) {
    throw new ItineraryApiError("The itinerary service returned invalid revision data.", 502, "INVALID_RESPONSE");
  }
  return value as unknown as RevisionAccepted;
}

async function request(
  path: string,
  init: RequestInit,
  options: ItineraryApiOptions,
  expectedStatus?: number,
  invalidResponseMessage = "The itinerary service returned invalid data.",
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (options.accessToken) headers.set("Authorization", `Bearer ${options.accessToken}`);

  let response: Response;
  try {
    response = await fetch(requestUrl(path, options), {
      ...init,
      headers,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ItineraryApiError("Unable to reach the itinerary service. Check your connection and try again.", null);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ContractError | null;
    const code = typeof payload?.code === "string" ? payload.code : null;
    throw new ItineraryApiError(safeMessage(response.status, payload), response.status, code);
  }
  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    throw new ItineraryApiError(
      `The itinerary service returned unexpected HTTP ${response.status}.`,
      response.status,
      "UNEXPECTED_STATUS",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ItineraryApiError(invalidResponseMessage, 502, "INVALID_RESPONSE");
  }
}

export async function getItinerary(tripId: string, options: ItineraryApiOptions = {}): Promise<Itinerary> {
  return parseItinerary(await request(`/api/trips/${encodeURIComponent(tripId)}/itinerary`, { method: "GET" }, options));
}

export function requestRevision(
  tripId: string,
  instruction: string,
  options: ItineraryApiOptions = {},
): Promise<RevisionAccepted> {
  return request(
    `/api/trips/${encodeURIComponent(tripId)}/itinerary/revisions`,
    { method: "POST", body: JSON.stringify({ instruction }) },
    options,
    202,
    "The itinerary service returned invalid revision data.",
  ).then(parseRevision);
}
