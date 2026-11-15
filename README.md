# Vacation Together Frontend

This repository contains the web pages and user interactions for Vacation Together. The backend API is maintained separately in [backend-compe-561](https://github.com/DA-Drew803/backend-compe-561).

See [the web functional specification](docs/web-functional-spec.md) for the four-page flow, control behavior, and proposed API boundary.

## Run locally

Requires Node.js 20.9 or newer and Bun.

```bash
bun install
bun run dev
```

Open `http://localhost:3000`. Use `bun run lint`, `bun run typecheck`, and `bun run build` to verify changes.

For the itinerary vertical slice, set the real backend URL and a development trip ID before starting Next.js:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api \
NEXT_PUBLIC_DEV_TRIP_ID=<backend-trip-uuid> \
bun run dev
```

Open `/dev/itinerary` to enter the feature, or use `/trips/<backend-trip-uuid>/itinerary` directly. The API layer reads the real JWT from `localStorage["vacation-together-token"]`; authenticate with the backend first, then store the returned `access_token` under that key. The backend’s current approval API returns aggregate progress, not per-member approval records, so the UI does not invent individual approval labels.

The `/plan` route is a temporary destination for the Landing page's planning links. The Planning page will be built separately.
