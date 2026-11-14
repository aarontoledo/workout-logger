# Workout Logger

A mobile-first app for logging 6-station strength sessions: pick an exercise per station, log sets with a rest timer, and review past workouts.

Live at **https://workout-logger.aarontoledo.com**

## Features

- **160-exercise library** in 13 movement-pattern categories, with search that understands abbreviations (DB, KB, RDL) and nicknames ("cart"/"prowler" → sled)
- **Tracking per exercise**: weight × reps, reps, time, distance, calories, weight × distance, or weight × time. Some exercises can switch (e.g. bike by time, distance, or calories), and the app remembers your last choice
- **Units that match the equipment**: yards for sleds and carries, meters for rower/SkiErg, miles for air bike and treadmill
- **Rest timer**, presets for the gym and a home gym (dumbbells, bench, ab wheel, battle ropes, bodyweight), and repeating any past session (or "Last Session")
- **History** with full summaries, copy-to-clipboard, and per-workout delete
- **Progress**: workouts per week and streak, a chart of each exercise's best set per session (estimated 1-rep max for weighted lifts), and personal records, with PR badges on workout summaries
- **Backup & transfer**: export/import history as a JSON file, or share one workout as a link

History is stored in the browser's `localStorage` (key `workout_history`); there is no server-side storage. On iPhone, add the app to the Home Screen: Safari may clear data for sites in a regular tab that go unvisited for 7 days.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev -- --host  # also reachable from a phone on the same Wi-Fi
npm run build        # type-check + production build
npm run preview      # build and serve the production version
npm run lint
```

## Deployment

Hosted on Cloudflare Workers as a static single-page app ([wrangler.jsonc](wrangler.jsonc)). Every push to `main` deploys automatically through Cloudflare Workers Builds (build: `npm run build`, deploy: `npx wrangler deploy`). To deploy manually: `npm run deploy`.

## Project layout

| Path | Purpose |
|---|---|
| `src/App.tsx` | Screens (setup, workout, summary, history) and app state |
| `src/exercises.ts` | Exercise library, tracking types, units, presets, search |
| `src/ExercisePicker.tsx` | Exercise search dropdown (replaces `<datalist>`, which iOS handles poorly) |
| `src/transfer.ts` | Backup export/import and share-link encoding |
| `src/progress.ts` | Progress calculations: best set per session, PRs, weekly counts |
| `src/ProgressView.tsx` | Progress screen and its SVG charts |
| `src/format.ts` | Shared helpers for reading and formatting saved sets |
| `src/types.ts` | Saved workout data types |
| `worker/` | Worker entry point, currently unused. Kept for a future sync API (`main` is not set in `wrangler.jsonc`) |
