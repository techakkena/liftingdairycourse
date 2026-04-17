# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Docs First — Required

**Before generating any code, always read the relevant file(s) in the `/docs` directory.**

The `/docs` directory contains the authoritative coding standards for this project. Every area of the codebase has a corresponding doc that defines required libraries, forbidden patterns, and conventions. Generating code without first consulting the relevant doc is not permitted.

Current docs:

- `docs/ui.md` — UI component and date formatting standards
- `docs/data-fetching.md` — data fetching patterns, Drizzle ORM, and user-scoping rules
- `docs/data-mutations.md` — Server Actions, `/data` mutation helpers, Zod validation, and ownership rules
- `docs/auth.md` — Clerk authentication standards (required reading before any auth-related code)
- `docs/server-components.md` — Server Component rules: awaiting `params`/`searchParams`, `'use client'` placement, async boundaries
- `docs/routing.md` — Route structure, `/dashboard` as the app root, and middleware-based route protection

## Commands

```bash
npm run dev        # Start dev server (uses Turbopack by default)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint (NOT run automatically by build in Next.js 16+)
```

To use Webpack instead of Turbopack: `next dev --webpack` / `next build --webpack`.

## Stack

- **Next.js 16.2.1** — App Router, React 19.2.4, TypeScript 5
- **Tailwind CSS 4** via `@tailwindcss/postcss`
- **Source root**: `src/` — app code lives under `src/app/`
- **Import alias**: `@/*` maps to `./*` (repo root, not `src/`)

## Key Next.js 16 Differences

**Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`.**

Notable breaking changes from earlier versions:

- `next build` no longer runs the linter. Run `npm run lint` separately.
- Turbopack is the default bundler (no `--turbopack` flag needed).
- `params` and `searchParams` in pages/layouts are now **Promises** — always `await` them:
  ```tsx
  export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
  }
  ```
- `fetch` results are **not cached by default**. Use the `use cache` directive or wrap in `<Suspense>` to stream.
- Server Functions (previously "Server Actions") use `'use server'` directive. They are reachable via direct POST requests — always verify auth inside every Server Function.

## Architecture

This is a **Next.js App Router** project. All routing is file-system based under `src/app/`:

- `layout.tsx` — root layout (wraps all routes, must contain `<html>` and `<body>`)
- `page.tsx` — page component (makes a route publicly accessible)
- `route.ts` — API endpoint
- `loading.tsx`, `error.tsx`, `not-found.tsx` — special UI files

**Server vs Client Components**: All layouts and pages are Server Components by default. Add `'use client'` only for components that need state, event handlers, or browser APIs. Keep `'use client'` boundaries as deep in the tree as possible to minimize JS bundle size.

**Colocation**: Non-routing files (components, utilities) can safely live inside `app/` subdirectories — only files named `page.tsx` or `route.ts` become public routes. Use `_folder` prefix to explicitly opt a folder out of routing.
