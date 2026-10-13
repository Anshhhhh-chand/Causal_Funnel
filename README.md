# Funnel Lens — CausalFunnel User Analytics

Funnel Lens is a full-stack user analytics application for the CausalFunnel take-home assignment. A framework-independent browser tracker records page views and clicks, a Node.js API stores them in MongoDB, and a React dashboard displays sessions, user journeys, and an interactive click heatmap.

The complete codebase is organized inside the [`docs/`](./docs) directory.

## Tech stack

- **Frontend Dashboard**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend API**: Node.js 20+, Express, TypeScript, Zod, MongoDB driver
- **Tracking SDK**: Vanilla TypeScript SDK, built as ESM and browser IIFE bundles
- **Testing**: Vitest, Supertest, Testing Library
- **Database**: MongoDB (local or MongoDB Atlas)

## Quick Start

```bash
cd docs
npm install
cp .env.example .env
npm run build:tracker
```

### Run Locally

1. **Start MongoDB**:
   ```bash
   brew services start mongodb-community
   ```
2. **Start Backend API** (port 4000):
   ```bash
   cd docs
   npm run dev:api
   ```
3. **Start Dashboard** (port 5173):
   ```bash
   cd docs
   npm run dev:dashboard
   ```
4. **Serve Demo Storefront** (port 4173):
   ```bash
   cd docs
   npx --yes serve . -l 4173
   ```

Open `http://localhost:4173/demo/` to generate events, and inspect them live on the dashboard at `http://localhost:5173`.

## Documentation & Architecture

Detailed technical architecture and system design specifications are available in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
