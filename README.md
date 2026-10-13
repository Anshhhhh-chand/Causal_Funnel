# Funnel Lens — CausalFunnel User Analytics

Funnel Lens is a small, full-stack user analytics application for the CausalFunnel take-home assignment. A framework-independent browser tracker records page views and clicks, a Node.js API stores them in MongoDB, and a React dashboard shows sessions, journeys, and click coordinates.

## Tech stack

- React 18, TypeScript, Vite, and Tailwind CSS
- Node.js 20+, Express, TypeScript, Zod, and the MongoDB driver
- Vanilla TypeScript tracking SDK, built as ESM and browser IIFE bundles
- Vitest, Supertest, and Testing Library
- MongoDB (local server or MongoDB Atlas)

## Prerequisites

- Node.js 20 or newer and npm
- MongoDB 6+ running locally, or a MongoDB Atlas connection string

Docker is not required. If MongoDB is installed locally, the default URI is `mongodb://127.0.0.1:27017`. Atlas works by setting `MONGODB_URI` in `.env`.

## Setup

From this directory:

```bash
npm install
cp .env.example .env
npm run build:tracker
```

If using local MongoDB, start it in a separate terminal. A simple macOS/Homebrew setup is:

```bash
brew services start mongodb-community
```

The API remains online with a degraded `/health` response if MongoDB is unavailable, but events cannot be stored until the database is running.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | MongoDB connection string |
| `MONGODB_DB` | `causalfunnel` | Database name |
| `CLIENT_ORIGINS` | localhost dashboard/demo origins | CORS allowlist |
| `MAX_EVENT_AGE_HOURS` | `168` | Accepted client clock-skew window |
| `VITE_API_BASE_URL` | `http://localhost:4000/api` | Dashboard API base URL |

Never commit `.env` or credentials. The checked-in `.env.example` contains no secrets.

## Run locally

Start the API:

```bash
npm run dev:api
```

Start the dashboard in a second terminal:

```bash
npm run dev:dashboard
```

The dashboard is available at `http://localhost:5173`.

To serve the demo page, build the tracker first, then serve this directory with any static server. For example, using the one-off `serve` package:

```bash
npm run build:tracker
npx --yes serve . -l 4173
```

Open `http://localhost:4173/demo/`. The page loads the built IIFE tracker, emits a page view, and records clicks on the navigation, product cards, links, buttons, and other page elements. The tracker uses `http://localhost:4000/api/events` by default. An alternative endpoint can be supplied as `?endpoint=https%3A%2F%2Fexample.test%2Fapi%2Fevents`.

Return to the dashboard and use **Sessions** to inspect the session timeline or **Heatmap** to select `/demo/` and inspect click locations.

## API endpoints

- `GET /health` — database/readiness status
- `POST /api/events` — validate and store one event; retries are idempotent by `clientEventId`
- `GET /api/sessions` — session summaries with event counts and cursors
- `GET /api/sessions/:sessionId/events` — ordered journey events
- `GET /api/pages` — tracked page URL catalog for the selector
- `GET /api/heatmap?url=<encoded-url>` — click points and document dimensions

## Tests and builds

```bash
npm test
npm run typecheck
npm run build
```

The API tests use an in-memory repository to exercise HTTP contracts quickly. The Mongo repository creates its production indexes on connection. A local end-to-end smoke test should still be run with MongoDB and the three local servers running, as described below.

## Actual smoke test

1. Start MongoDB.
2. Start `npm run dev:api` and confirm `curl http://localhost:4000/health` reports `{"status":"ok","database":"connected"}`.
3. Run `npm run build:tracker` and serve the directory on port 4173.
4. Open `http://localhost:4173/demo/`, click at least three controls, and leave the page open briefly so requests complete.
5. Open `http://localhost:5173`, confirm the session's event count includes the page view and clicks, and open that session's timeline.
6. Open **Heatmap**, select the demo URL, and confirm the dots appear over the matching preview locations.
7. Resize the dashboard window. The coordinate surface and dots scale together; CSS `devicePixelRatio` is not applied a second time.

## Architecture and trade-offs

The tracker keeps a UUID in localStorage, records CSS-pixel page coordinates (`clientX + scrollX` and `clientY + scrollY`), and includes viewport/document dimensions with each event. The API validates a bounded payload, stores both the client event time and server ingestion time, and uses a unique client event ID to make retries safe. MongoDB uses one append-oriented `events` collection with indexes for sessions, journeys, heatmaps, and page discovery.

The dashboard is a Vite SPA because it has no server-rendering requirement and can remain a separate, easy-to-run client of the Node API. Heatmap dots are scaled from the most common document dimensions returned for a page. The demo has a matching visual preview; arbitrary external pages use a coordinate grid because the original DOM/layout is not available. Mixed page versions can therefore be compared only as coordinate data, not as pixel-perfect screenshots.

The SDK is intentionally small and framework-independent. It sends events immediately, uses a bounded in-memory retry queue for transient failures, and flushes queued data with `sendBeacon` during page exit where supported. Analytics failures are swallowed so a tracked webpage continues to work.

## Known limitations

- localStorage can be unavailable or cleared, which creates a new session.
- A page URL does not identify a particular page layout/version; heatmaps for materially different versions should be interpreted as coordinate data.
- The dashboard caps one session response at 1,000 events and one heatmap response at 10,000 clicks; the API reports cursors/truncation for larger data sets.
- No authentication or personal identity resolution is included because it is outside the assignment scope.

See `docs/IMPLEMENTATION_PLAN.md`, `docs/ARCHITECTURE.md`, and `docs/REQUIREMENTS_CHECKLIST.md` for the detailed design and verification record.
