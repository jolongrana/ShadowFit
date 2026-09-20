# ShadowFit

ShadowFit is a mobile-first calisthenics fitness PWA for guided workouts, progress tracking, nutrition ideas, reminders, and goals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/shadowfit/src/App.tsx` — application shell, routes, local state, workout session logic, timer, settings, and screens
- `artifacts/shadowfit/src/data/shadowfit.ts` — starter workouts, exercises, goals, and meal ideas
- `artifacts/shadowfit/src/index.css` — ShadowFit blackout theme and responsive UI tokens
- `artifacts/shadowfit/public/manifest.webmanifest` — installable PWA metadata
- `artifacts/shadowfit/public/sw.js` — core offline shell caching

## Architecture decisions

- The first release is local-first: workout state, progress history, preferences, hydration, meal swaps, and reminder times are stored in the browser.
- Workout and nutrition content are separated from UI so future sync or content updates can be added without rewriting screens.
- Weather and notification APIs are progressive enhancements with explicit fallback states; neither is required to use the core app.
- The web app is installable as a standalone PWA and caches its core shell for offline use where the browser supports service workers.

## Product

- Onboarding captures a name and one of five non-extreme fitness goals.
- Home shows the current workout, date-based streak, weekly target, hydration, weather fallback/location check, and indoor/outdoor recommendation.
- Workout includes seven starter sessions, set-level checklist progress, start/pause/resume, previous/next, skip exercise, finish/finish-early, and a real countdown rest timer with presets/custom duration.
- Progress aggregates logged sessions, time, sets, current streak, weekly activity, completion, personal records, and session history.
- Nutrition provides goal context, practical meal ideas, meal swaps, and hydration tracking.
- Settings manage goal, workout/hydration/meal reminder times, notification permission status, units, theme, rest default, reset, and about information.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
