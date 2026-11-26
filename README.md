# ✈️ Vacation Together

## COMPE 561 Final Project

Vacation Together is a collaborative group travel planning platform that helps friends plan trips together, compare preferences, generate personalized itineraries, revise plans with AI, and finalize a trip through group approval.

## About

### Description and Purpose

Planning a group trip can become complicated when travelers have different budgets, schedules, interests, and activity preferences.

Vacation Together brings the planning process into one shared experience. Group members can contribute their preferences, compare destinations, build an itinerary, request AI-assisted changes in natural language, reorganize activities, and approve the final plan together.

The application combines deterministic travel-planning logic with an AI-assisted itinerary workflow so that important operations such as approvals, versioning, and itinerary state remain predictable while AI handles flexible requests such as:

- “Make Day 4 cheaper.”
- “It’s raining. Give us something indoors on Day 2.”
- “We’re tired from walking. Find something relaxing for Day 5.”

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Google Maps JavaScript API
- Bun
- Axios
- Vitest and React Testing Library

### Backend

- Python
- FastAPI
- PostgreSQL
- SQLAlchemy
- Pydantic
- JWT authentication

### AI & Travel Services

- OpenAI
- LangGraph
- Google Places API
- Weather API

---

This repository contains the web pages and user interactions for Vacation Together. The backend API is maintained separately in [Vacation-Together-backend-compe-561](https://github.com/DA-Drew803/Vacation-Together-backend-compe-561).

See [the web functional specification](docs/web-functional-spec.md) for the four-page flow, control behavior, and proposed API boundary.

## Folder Structure

```text
src/
├── app/                # Next.js routes and page-level layouts
├── components/         # Reusable feature and page components
│   └── ui/             # shadcn/ui primitives
├── features/           # Feature-specific modules and hooks
├── Context/             # Authentication context/provider
└── lib/
    ├── api/            # Axios client and API modules
    ├── auth/           # Authentication helpers
    └── itinerary/      # Itinerary types and utilities
tests and *.test.*       # Component and feature tests near their source files
```

## Run locally

Requires Node.js 20.9 or newer and Bun. Start the backend first, then install the dependencies recorded in `bun.lock`:

```bash
bun install
bun run dev
```

Open `http://localhost:3000`. Use the following commands to verify changes:

```bash
bun run test
bun run lint
bun run typecheck
bun run build
```

Create `.env.local` when the services are not using their defaults:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

The Maps key is optional for the core planning and voting workflow. Without it, map content is unavailable. The backend can use curated destination recommendations without OpenAI credentials; AI itinerary generation and revision require backend provider configuration.

## Main workflow

Register or sign in, create a trip, invite another account, and have each member save availability, budget, and preferences. Group Match then connects to destination results, voting, itinerary review, and group approval.
