# Vacation Together Web Functional Specification

## Purpose and scope

Vacation Together is a collaborative group travel planner. This specification defines the MVP web journey and translates the existing [Figma design](https://www.figma.com/design/eAUzix6NADXsGdHoWowikE/Vacation-home?node-id=0-1&p=f) into functional behavior. It covers Landing, authentication, Trip membership, Planning, Destination Matches, Destination Voting, and the Itinerary lifecycle. No mobile design revisions are included.

The architecture described here is confirmed. Details under **Implementation dependencies and unresolved decisions** remain open and must not be invented during implementation.

## Repository boundary

The project uses separate frontend and backend repositories.

| Frontend | Backend |
| --- | --- |
| Next.js, React, TypeScript, Tailwind CSS, and ShadCN UI. | FastAPI, Pydantic, SQL, and PostgreSQL. |
| Owns pages, navigation, forms, voting controls, English website copy, accessibility, and feedback states. | Owns authentication, authorization, persistence, aggregation, destination matching, weather retrieval, deterministic voting, itinerary generation, revisions, and approval rules. |
| Displays only weather and recommendation data returned by the backend. | Retrieves structured weather through a backend integration with an approved online weather API or service. AI must not invent weather. |
| Never calculates the winner or grants permissions. | Uses deterministic code for membership, voting, and approval decisions. |

The frontend must not contain database, AI, or weather-provider credentials or duplicate backend matching, voting, or approval logic.

## Confirmed MVP architecture

### Accounts and membership

- Every traveler has their own User account.
- Users participate in one shared Trip through TripMember.
- The Trip creator becomes OWNER.
- OWNER is a group administrator, not the final travel decision-maker.
- OWNER may create the Trip, create and share invitation links, and remove members.
- OWNER has the same voting weight as every other active TripMember.
- OWNER cannot override destination voting, approve the itinerary alone, or edit another member's preferences.
- Invitation links are not assumed to be single-use.

### Planning data

- A Trip has one shared final date range.
- A Trip has one shared budget per person and a currency.
- Each TripMember manages only their own interests and private free-text ideas or preferences.
- Raw private free text is not displayed to other members by default.
- The MVP has no per-member Availability, per-member Budget, or lowest-member-budget logic.

### Recommendations, voting, and itinerary

- The backend aggregates member preferences into group-level recommendation input.
- The backend produces weather-enriched DestinationCandidates.
- A DestinationCandidate represents a destination recommendation, not a complete itinerary.
- All active TripMembers see the same DestinationCandidates and vote with equal weight.
- Deterministic backend logic selects the winning destination and sets `selected_destination_id`.
- No user manually selects the winning destination.
- The winning destination automatically starts AI generation of a draft itinerary.
- All active TripMembers review the same itinerary.
- Approved structured revision requests may produce revised itinerary content.
- The itinerary becomes final only after group approval under a rule still to be decided.
- General chatbot behavior is outside this specification.

## Main journey

`Landing → Authentication / Trip → Planning → Destination Matches → Destination Voting → Draft Itinerary → Review / Revisions → Group Approval → Final Itinerary`

| Stage | Proposed route | Purpose |
| --- | --- | --- |
| Landing | `/` | Explain the product and invite visitors to begin. |
| Register | `/register` | Create a User account. |
| Login | `/login` | Authenticate an existing User. |
| Trips | `/trips` | Create or open a Trip. |
| Invitation | `/invitations/{invitation_token}` | Join a Trip through an available invitation. |
| Planning | `/trips/{trip_id}/plan` | View shared settings and manage the current member's preferences. |
| Results and voting | `/trips/{trip_id}/results` | Review DestinationCandidates, vote, and see the allowed result state. |
| Itinerary | `/trips/{trip_id}/itinerary` | Review generation, draft/revised content, approval progress, and the final itinerary. |

Protected pages require an authenticated active TripMember. Signed-out users should be sent to authentication with a safe return destination. Authenticated non-members receive a clear forbidden or invitation-required state.

## Shared navigation

| Control | Expected action |
| --- | --- |
| **Vacation Together** logo | Return to `/`. |
| **Destinations** | Open the active Trip's results when available; otherwise open Planning with an explanation. |
| **Plan a Trip** | Open Planning or Trip creation when no Trip is active. |
| **My Trip** | Open the active Trip at its current stage. |
| **About** | Go to the English About section on the Landing page (`/#about`). |
| Account control | Show authentication or account/sign-out behavior appropriate to session state. |

Do not display a control that appears functional but has no implemented action.

## Landing

The Landing page introduces collaborative trip planning. **Start Planning** opens the appropriate authentication or Trip entry flow. The logo, About link, and primary action must have real destinations.

## Authentication and Trip membership

Users may register and log in. Login issues the JWT used for protected requests. To restore a session, the frontend sends its stored JWT to `GET /api/auth/me`, which validates the token and returns the current authenticated User. Expired, malformed, or invalid tokens receive `401 Unauthorized`.

For the stateless JWT MVP, sign-out removes the stored token and other local authentication state. There is no `POST /logout` endpoint unless server-side token revocation is adopted later. Token lifetime and any refresh-token strategy remain unresolved; the frontend must not assume refresh tokens exist.

Trip membership UI includes the active member list. OWNER may create and share invitation links and request removal of members. OWNER controls must not imply additional recommendation, voting, or approval authority.

Invitation error states use neutral language: invalid, expired, revoked, unavailable, or already a member. Reuse, expiration, revocation, acceptance limits, and rejoining remain unresolved.

## Planning

The design shows five example travelers (Alex, Jordan, Taylor, Casey, and Morgan). These are neutral sample UI names, not permanent accounts or a five-person limit. Actual travelers come from TripMember records rather than manually toggled traveler chips.

### Shared Trip settings

Planning displays one shared final date range, one shared budget per person, and currency. The interaction for proposing, editing, and finalizing these values remains unresolved. The frontend must not assume OWNER controls the shared settings.

### My preferences

Every active TripMember, including OWNER, may retrieve and update only their own interests and private free-text ideas or preferences. The UI may show submission status but must not reveal another member's raw private text. No per-member Availability or Budget fields are included.

### Recommendation readiness

The interface may display readiness and generation status after the team defines required submissions, who may trigger generation, and regeneration behavior. These rules must not be inferred from role labels.

## Destination Matches

The backend returns multiple DestinationCandidates based on shared dates, shared budget per person, aggregated member preferences, and structured weather.

Each candidate may display:

- destination name and image
- match score and explanation
- estimated cost per person and currency
- recommendation data status such as sample or calculated
- weather conditions and represented period
- forecast, historical average, or seasonal average data type
- partial-weather status when only some supported fields are available
- provider/source metadata when available

Climate averages must never be labeled as a forecast. The frontend must distinguish forecast, historical average, seasonal average, partial weather, and unavailable weather states. In a partial-weather state, it displays only fields supplied by the backend; missing fields must not be presented as estimated or AI-generated values. Unavailable weather receives an unavailable state rather than invented values. All active members retrieve the same candidates. A candidate is a destination option, not a complete itinerary.

## Destination Voting

Every active TripMember, including OWNER, votes with equal weight. The frontend submits only the current authenticated member's ballot and displays only information allowed by finalized rules.

The frontend does not count votes, determine eligibility, resolve ties, choose the winner, or let OWNER override the outcome. Deterministic backend logic sets `selected_destination_id`.

After a winner is finalized, the UI transitions automatically to draft-itinerary generation. There is no manual destination-selection control and no user-facing initial **Generate Itinerary** button.

## Itinerary lifecycle

The itinerary progresses conceptually through:

`draft → under review → revised → pending approval → approved`

Exact names may change in the API contract, but the lifecycle must preserve these stages.

### Initial generation

Setting `selected_destination_id` automatically starts AI draft generation. The frontend retrieves status and content from the itinerary endpoint and supports pending, generating, completed, and failed states.

### Review and structured revisions

All active TripMembers may review the itinerary. Revision controls use approved structured operations such as making a day cheaper, replacing an activity, or reducing walking on a selected day. Allowed users, operations, and effects on existing approvals remain unresolved.

AI may generate revised content. It may not make membership, authorization, voting, or approval decisions.

### Group approval and final itinerary

Final approval belongs to the group. OWNER has no special approval weight or override. The frontend displays the current member's approval and group progress after the rule is finalized. Deterministic backend logic changes the itinerary to approved/final when the eventual group rule is satisfied.

## Data needed between pages

- **Session:** authenticated User identity and session state.
- **Trip:** Trip ID, role, shared dates, budget per person, currency, and selected destination ID.
- **TripMember:** member ID, safe display information, role, and submission status.
- **MemberPreference:** current member's interests and private free text.
- **DestinationCandidate:** stable ID, destination, score, explanation, cost estimate, data status, and structured weather.
- **Vote/ballot:** current member's selections and permitted group state.
- **Itinerary:** lifecycle status, selected destination, days, activities, costs, revisions, and approval state.

## Frontend-backend interface

Field names use `snake_case`.

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/trips
POST   /api/trips
GET    /api/trips/{trip_id}

GET    /api/trips/{trip_id}/members
DELETE /api/trips/{trip_id}/members/{trip_member_id}

POST   /api/trips/{trip_id}/invitations
POST   /api/invitations/{invitation_token}/accept

GET    /api/trips/{trip_id}/settings
PATCH  /api/trips/{trip_id}/settings

GET    /api/trips/{trip_id}/preferences/me
PUT    /api/trips/{trip_id}/preferences/me

POST   /api/trips/{trip_id}/destination_candidates/generate
GET    /api/trips/{trip_id}/destination_candidates

GET    /api/trips/{trip_id}/votes/me
PUT    /api/trips/{trip_id}/votes/me
GET    /api/trips/{trip_id}/voting_state

GET    /api/trips/{trip_id}/itinerary
POST   /api/trips/{trip_id}/itinerary/revisions

GET    /api/trips/{trip_id}/itinerary/approval
PUT    /api/trips/{trip_id}/itinerary/approval/me
```

There is no client endpoint for manual destination selection, direct assignment of `selected_destination_id`, or initial itinerary generation.

## Implementation dependencies and unresolved decisions

These details do not contradict the architecture, but affected implementation work must wait for them.

### Invitations

- Single-use or reusable links; expiration, revocation, acceptance/member limits, and rejoining after removal.

### Shared settings

- Who proposes, edits, and finalizes dates and budget per person; included costs; supported currency behavior.

### Destination generation

- Readiness threshold, trigger permission, regeneration, and treatment of existing votes.

### Weather

- Approved provider, reliable forecast horizon, historical/seasonal fallback, and supported units.

### Destination voting

- One or multiple selections; vote changes; closing; participation requirements; result visibility; ties; membership changes; removed-member votes; reopening.

### Itinerary revisions

- Authorization, supported revision types, whether revision requests need group approval, and effects on existing approvals.

### Group itinerary approval

- Majority, unanimity, percentage, or another threshold; participation requirement; approval reset after revision; finalization behavior.

## Out of scope

Booking, payment, live travel inventory, mobile Figma redesign, and the separate general AI chatbot are outside this specification.
