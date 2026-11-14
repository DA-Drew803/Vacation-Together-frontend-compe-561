# Itinerary review audit resolution

Contract reviewed: `Vacation_Together_OpenAPI_Final.yaml`, OpenAPI 3.1.0, API version `2.0.0-mvp`.

| Finding | Resolution | Evidence / remaining limitation |
| --- | --- | --- |
| CRITICAL: frontend itinerary response shape conflicts with the API | Resolved — previous finding used an obsolete contract | The final contract and FastAPI both return a direct `Itinerary`. The frontend continues to consume that direct object. |
| Revision request/response mismatch | Resolved | All three sources use `{ instruction: string }`, HTTP 202, and `requested_version`. |
| Itinerary status casing | Resolved | Final YAML, Python schema, and frontend use uppercase `GENERATING`, `DRAFT`, `REVISING`, `FINALIZED`, and `FAILED`. |
| `days[]` is too loosely specified | Mitigated in frontend; contract remains loose | YAML permits arbitrary object properties. Runtime validation requires the actual serializer shape: positive `day_number`, an `activities` array, positive `position`, nonblank `title`, and finite nonnegative `estimated_cost`. |
| Response fields are not marked required in final YAML | Mitigated in frontend; contract discrepancy remains | FastAPI/Pydantic requires every `Itinerary` and `Revision` field, but the final YAML omits `required` arrays for those response schemas. Runtime validation enforces the Python response requirements. |
| Error envelope differs at runtime | Resolved in frontend; backend/contract discrepancy remains | The YAML/Pydantic model specifies `{ code, message }`, while FastAPI `HTTPException` responses use `{ detail }`. The client accepts both, preserves a safe error code, and suppresses 5xx details. |
| HIGH 1: unmount with `initialItinerary` skips cancellation | Resolved and regression-tested | A dedicated unmount cleanup always invalidates the operation ID and aborts POST, polling GET, and polling delay work. Late abort-ignorant results cannot update state or call `onItineraryChange`. Client abort does not undo backend-accepted work. |
| HIGH 2: updated `initialItinerary` is not synchronized | Resolved and regression-tested | Newer versions are accepted, older versions are ignored, different-trip values are rejected, and equal versions are parent-authoritative to preserve legitimate same-version status/content transitions. |
| HIGH 3: same-trip stale responses can overwrite newer data | Resolved and regression-tested | Every operation receives a monotonic ID. Superseded or aborted operations cannot publish, and the version guard rejects regression while allowing equal-version status transitions. Reverse-order refresh and stale-poll tests pass. |
| HIGH 4: submission state survives Trip/auth changes | Resolved and regression-tested | Trip and token changes abort and invalidate old work and reset context-scoped loading, submission, and feedback state. Old finalizers cannot modify the new context. |
| HIGH 5: revision accepts non-202 success statuses | Resolved and regression-tested | Only HTTP 202 with a valid revision payload is accepted. HTTP 200, 201, and 204, invalid JSON, and invalid payloads are rejected before polling. |
| UI components only resemble ShadCN | Resolved | Standard ShadCN Button (`Radix Slot` + `class-variance-authority`) and Alert patterns are configured through `components.json`. |
| Accessibility gaps | Resolved for feature scope | Unique `useId` relationships, labels, live status/error regions, keyboard focus styling, disabled explanations, native select semantics, and duplicate-submit blocking are present. |
| Feature CSS leaks globally | Resolved | All itinerary feature styles are in `itinerary-review.module.css`; shared ShadCN primitives use scoped utility classes. |
| Feature competes with shared Itinerary page | Resolved | No new route/page was created. Components, hook, data callback, and approval-refresh boundary remain integration-ready for Joy's page. |

The backend remains authoritative for version changes, lifecycle, authorization, and approval resets. The frontend cannot conclusively distinguish a failed revision from `NO_CHANGE` when polling returns to the same version because no revision-status GET endpoint exists.
