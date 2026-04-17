# Auth Coding Standards

## Authentication Provider — Clerk (Required)

**This app uses [Clerk](https://clerk.com) exclusively for authentication.** Do not add or use any other auth library (NextAuth, Auth.js, Lucia, custom JWT, etc.).

---

## Setup

### Provider

`ClerkProvider` wraps the entire app in `src/app/layout.tsx`. Do not remove it or add a second provider.

### Middleware

Clerk middleware is registered in `src/proxy.ts` via `clerkMiddleware()` from `@clerk/nextjs/server`. This protects all routes matching the configured `matcher`. Do not bypass or replace this middleware.

```ts
// src/proxy.ts
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()
```

---

## Getting the Current User

### In Server Components and `/data` helpers

Always use `auth()` from `@clerk/nextjs/server`. Never call this from a Client Component.

```ts
import { auth } from '@clerk/nextjs/server'

const session = await auth()
if (!session?.userId) throw new Error('Unauthorized')

const userId = session.userId
```

### In Client Components

Use the `useUser` or `useAuth` hooks from `@clerk/nextjs`. Do not import from `@clerk/nextjs/server` in any `'use client'` file.

```tsx
'use client'
import { useUser } from '@clerk/nextjs'

export function ProfileBadge() {
  const { user } = useUser()
  return <span>{user?.firstName}</span>
}
```

---

## UI Components

Use Clerk's pre-built UI components for all auth-related UI. Do not build custom sign-in/sign-up forms.

| Purpose              | Component           | Import                  |
|----------------------|---------------------|-------------------------|
| Sign-in button       | `<SignInButton>`     | `@clerk/nextjs`         |
| Sign-up button       | `<SignUpButton>`     | `@clerk/nextjs`         |
| User avatar / menu   | `<UserButton>`       | `@clerk/nextjs`         |
| Conditional rendering| `<Show when="...">`  | `@clerk/nextjs`         |

Use `mode="modal"` on `SignInButton`/`SignUpButton` to avoid full-page redirects.

```tsx
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs'

<Show when="signed-out">
  <SignInButton mode="modal"><button>Sign In</button></SignInButton>
  <SignUpButton mode="modal"><button>Sign Up</button></SignUpButton>
</Show>
<Show when="signed-in">
  <UserButton />
</Show>
```

---

## Auth in `/data` Helpers

Every `/data` helper that returns user-specific data **must** call `auth()` internally and throw if unauthenticated. Never accept a `userId` from a URL param or request body as a substitute for the session.

```ts
// ✅ CORRECT
import { auth } from '@clerk/nextjs/server'

export async function getWorkoutsForDate(date: string) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  return db.select().from(workouts).where(eq(workouts.userId, session.userId))
}

// ❌ WRONG — never trust a caller-supplied userId
export async function getWorkoutsForDate(userId: string, date: string) {
  return db.select().from(workouts).where(eq(workouts.userId, userId))
}
```

See `docs/data-fetching.md` Rule #3 for the full data-scoping requirements.

---

## Server Functions

Every Server Function (`'use server'`) that touches user data must call `auth()` at the top and reject unauthenticated requests. Clerk middleware alone is not sufficient — always re-verify inside the function.

```ts
'use server'
import { auth } from '@clerk/nextjs/server'

export async function createWorkout(data: WorkoutInput) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')
  // ...
}
```

---

## Prohibited Patterns

| Pattern                                      | Why forbidden                                      |
|----------------------------------------------|----------------------------------------------------|
| `import { auth } from '@clerk/nextjs/server'` in a Client Component | Server-only module — will break at runtime |
| Custom sign-in/sign-up forms                 | Duplicates Clerk's hardened UI; maintenance burden |
| Trusting `userId` from URL params or body    | IDOR vulnerability — always read from session      |
| Other auth libraries (NextAuth, Lucia, etc.) | Only Clerk is supported                            |
| Skipping `auth()` check in Server Functions  | Middleware can be bypassed; always verify in-function |

---

## Summary

| Concern                        | Required                          | Forbidden                                  |
|--------------------------------|-----------------------------------|--------------------------------------------|
| Auth provider                  | Clerk only                        | Any other auth library                     |
| Server-side user ID            | `auth()` from `@clerk/nextjs/server` | URL params, cookies, custom JWT         |
| Client-side user info          | `useUser` / `useAuth` hooks       | `@clerk/nextjs/server` in client files     |
| Auth UI                        | Clerk components (`SignInButton`, `UserButton`) | Custom auth forms            |
| Data helper auth check         | `auth()` + throw on missing userId | Unauthenticated helpers, trusted params   |
