---
name: workout-chart
description: Query the PostgreSQL database for workout entries over the past year and generate a bar chart image showing workouts per month. Use this skill whenever the user asks to visualize, chart, plot, or analyze workout frequency, workout history, or monthly activity — even if they don't say "chart" explicitly. Trigger on phrases like "show me my workouts", "how many workouts did I do", "plot my progress", "workout stats", "workout history chart", or any request to see workout data over time.
---

# Workout Chart Skill

Generate a bar chart of workouts per month for the past year by querying the project's PostgreSQL database and running a bundled script. No extra installs required — uses the project's existing `tsx` and `@neondatabase/serverless` packages.

## What this skill does

1. Reads `DATABASE_URL` from `.env` in the project root
2. Runs `scripts/plot_workouts.ts` (bundled) via `tsx`
3. Queries the `workouts` table, grouping by calendar month over the past 12 months
4. Produces `workout_chart.png` in the project root using `sharp` (already in node_modules)
5. Reports the output path and a data summary (total workouts, busiest month)

## Steps

### 1. Locate the project root and .env

The project root is the current working directory (where `package.json` lives). The database URL is in `.env` — verify it exists before running.

```bash
ls .env
```

### 2. Run the bundled TypeScript script

Run from the project root:

```bash
node_modules/.bin/tsx ".claude/skills/workout-chart/scripts/plot_workouts.ts" \
  --env .env \
  --output workout_chart.png
```

On Windows use forward slashes and quotes as shown. If `tsx` isn't found at that path, try:

```bash
npx tsx ".claude/skills/workout-chart/scripts/plot_workouts.ts" --env .env --output workout_chart.png
```

The script generates the SVG chart internally and converts it to PNG via `sharp` (which is already installed as a dependency of Next.js image optimization). If you pass `--output workout_chart.svg` it will save as SVG instead.

### 3. Report results

After the script succeeds, tell the user:
- The absolute path to `workout_chart.png`
- Total workouts found and busiest month
- Any months with zero workouts (worth mentioning if many)

## Edge cases

- **`.env` not found**: If only `.env.local` exists, pass `--env .env.local` instead.
- **No workouts found**: The script produces a chart with all-zero bars. Mention this to the user and check that the `workouts` table has data.
- **`@neondatabase/serverless` import error**: Run `npm install` in the project root to restore node_modules.
- **tsx not in node_modules/.bin**: Fall back to `npx tsx` or `npm exec tsx --`.
