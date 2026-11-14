# Itinerary review and revision integration

The review and revision feature is intentionally independent of the shared Itinerary page so it can be composed with the display and approval work without owning that page.

## Recommended integration

Import `ItineraryReviewFeature` from `@/features/itinerary` and render it inside the authenticated `/trips/{trip_id}/itinerary` page.

```tsx
<ItineraryReviewFeature
  tripId={trip.id}
  accessToken={session.accessToken}
  initialItinerary={itinerary}
  onUnauthorized={() => redirectToLogin()}
  onItineraryChange={(nextItinerary) => {
    setItinerary(nextItinerary);
    refreshApprovalProgress();
  }}
/>
```

- `tripId` is required and must come from the authenticated Trip route/context.
- `accessToken` is optional at the component boundary, but the protected backend requires the current session's bearer token. Never hardcode or persist a token in this feature.
- `initialItinerary` lets the shared page pass its existing authoritative data and prevents a duplicate initial request.
- Newer parent snapshots replace older internal versions. Older parent versions are ignored. For equal versions, the parent snapshot is treated as authoritative so legitimate backend-controlled status or content transitions can be reflected without changing the version.
- `onItineraryChange` receives every authoritative itinerary fetched after a revision. Use it to replace shared display state and re-fetch approval progress. Do not calculate or reset approvals in the frontend.
- `onUnauthorized` connects HTTP 401 handling to the application's authentication flow.

For a custom layout, import `useItineraryReview`, `ItineraryReview`, and `RefineTrip` separately. The hook returns `itinerary`, `isLoading`, `isSubmitting`, `feedback`, `refresh`, and `submitCheaperDay`.

## Backend behavior represented in the UI

- `GET /api/trips/{trip_id}/itinerary` is the only source of itinerary content, status, version, and costs.
- `POST /api/trips/{trip_id}/itinerary/revisions` submits only `Make day N cheaper`, a backend-verified operation.
- A `202 Accepted` response starts bounded polling of the GET endpoint. It is processing feedback, not success.
- Initial loads, refreshes, revision POST requests, polling GET requests, and pending polling delays are aborted on unmount, Trip change, or authentication change. Monotonic operation IDs also reject late results from abort-ignorant clients. Aborting a frontend POST does not cancel a revision already accepted by the backend; the next mounted view must retrieve the authoritative itinerary.
- A higher backend version confirms a content-changing revision. The callback then lets the approval UI reload backend-owned approval progress; this feature does not infer or independently verify approval resets.
- If `REVISING` ends without a version change, the current API cannot distinguish `FAILED` from `NO_CHANGE`; the feature says so and preserves current content.
- `REDUCE WALKING` and `SWAP ACTIVITY` remain visibly disabled because the persisted API response does not include the trusted metadata required by backend validation.
- `FINALIZED` disables all revision controls.

Set `NEXT_PUBLIC_API_URL` to the backend origin. Local development defaults to `http://localhost:8000`.

Successful API responses are runtime-validated before they reach the UI. Error parsing accepts both the final contract's `{ code, message }` envelope and FastAPI's current `{ detail }` envelope.
