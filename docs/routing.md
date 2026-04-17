# Routing Standards

## Rule #1 — All App Routes Live Under `/dashboard`

**Every page in this application is nested under `/dashboard`.** Do not create top-level app routes for authenticated features (e.g., `/profile`, `/settings`, `/workouts`). All such pages must be placed under `src/app/dashboard/`.

```
src/app/
├── page.tsx                          ← public landing page only
└── dashboard/
    ├── page.tsx                      ← main dashboard (/dashboard)
    ├── workout/
    │   ├── new/page.tsx              ← /dashboard/workout/new
    │   └── [workoutId]/page.tsx      ← /dashboard/workout/:id
    └── ...
```

---

## Rule #2 — `/dashboard` and All Sub-Routes Are Protected

**Every route under `/dashboard` must be accessible only to signed-in users.** Unauthenticated visitors must be redirected to the sign-in page automatically — never render dashboard UI for unauthenticated requests.

---

## Rule #3 — Route Protection Is Done in Next.js Middleware

**Use Clerk middleware in `src/proxy.ts` to enforce authentication on `/dashboard` routes.** Do not rely on per-page `auth()` checks as the sole protection mechanism — the middleware is the authoritative gate.

Use `createRouteMatcher` to identify protected routes and call `auth.protect()` inside the `clerkMiddleware` callback:

```ts
// src/proxy.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

`auth.protect()` automatically redirects unauthenticated users to Clerk's sign-in page. Do not implement manual redirects.

---

## Rule #4 — Per-Route `auth()` Checks Are Still Required in Data Helpers

Middleware protection prevents unauthenticated page loads, but **every `/data` helper and Server Function must still call `auth()` internally**. Middleware can be bypassed via direct API calls — in-function checks are mandatory.

See `docs/auth.md` for the full requirement.

---

## Prohibited Patterns

| Pattern | Why forbidden |
|---|---|
| App routes outside `/dashboard` for authenticated features | Breaks the route contract and scatters auth boundaries |
| Using bare `clerkMiddleware()` without `auth.protect()` for dashboard routes | Loads Clerk but does not enforce sign-in |
| Per-page redirect logic as a substitute for middleware | Duplicates protection logic; misses edge cases |
| Trusting middleware alone without in-function `auth()` checks | Middleware can be bypassed by direct POST/fetch |

---

## Summary

| Concern | Required | Forbidden |
|---|---|---|
| Authenticated page location | Under `src/app/dashboard/` | Top-level routes like `/profile` |
| Route protection mechanism | `createRouteMatcher` + `auth.protect()` in `src/proxy.ts` | Bare `clerkMiddleware()` with no route guard |
| Unauthenticated redirect | Automatic via `auth.protect()` | Manual `redirect()` per page |
| Data helper auth | `auth()` check in every helper | Relying on middleware alone |
