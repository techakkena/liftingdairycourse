# Data Mutation Standards

## Rule #1 — Mutations via `/data` Helper Functions

**All database mutations must go through helper functions in the `src/data` directory.**

- Do NOT write raw SQL anywhere. Use **Drizzle ORM** exclusively.
- Do NOT call the database client directly from Server Actions, pages, layouts, or components.
- Every mutation (insert, update, delete) must be encapsulated in a named helper function inside `src/data`.

```
src/data/
  workouts.ts      ← e.g. createWorkout(), updateWorkout(), deleteWorkout()
  users.ts         ← e.g. updateUserProfile()
  courses.ts       ← e.g. enrollInCourse()
```

```ts
// ✅ CORRECT — src/data/workouts.ts
import { db } from "@/lib/db"
import { workouts } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"

export async function createWorkout(data: { name: string; date: Date }) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const [workout] = await db
    .insert(workouts)
    .values({ ...data, userId: session.user.id })
    .returning()

  return workout
}

export async function deleteWorkout(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  await db
    .delete(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.user.id)))
}

// ❌ WRONG — raw SQL
export async function createWorkout(name: string) {
  return db.execute(sql`INSERT INTO workouts (name) VALUES (${name})`)
}

// ❌ WRONG — calling the DB directly from a Server Action instead of /data
// app/dashboard/actions.ts
import { db } from "@/lib/db"
await db.insert(workouts).values({ name }) // must go through /data instead
```

---

## Rule #2 — Mutations via Server Actions in `actions.ts`

**All data mutations must be triggered through Server Actions.**

- Server Actions must live in a colocated `actions.ts` file next to the route that uses them (not in a global shared file).
- Every `actions.ts` file must have `'use server'` at the top.
- Server Actions call `/data` helper functions — they do NOT call the database directly.
- Do NOT use Route Handlers (`route.ts`) for mutations.

```
src/app/
  dashboard/
    _components/
      workout-form.tsx     ← Client Component that calls the action
    actions.ts             ← Server Actions for this route
    page.tsx
```

```ts
// ✅ CORRECT — src/app/dashboard/actions.ts
'use server'

import { createWorkout } from "@/data/workouts"

export async function createWorkoutAction(params: { name: string; date: Date }) {
  // validate, then delegate to /data helper
  return createWorkout(params)
}

// ❌ WRONG — mutation placed in a route handler
// src/app/api/workouts/route.ts
export async function POST(req: Request) {
  const body = await req.json()
  await db.insert(workouts).values(body) // use a Server Action instead
}

// ❌ WRONG — Server Action in a shared global file
// src/lib/actions.ts — actions must be colocated with their route
```

---

## Rule #3 — Typed Parameters, No `FormData`

**Server Action parameters must be explicitly typed. `FormData` is forbidden as a parameter type.**

- Define a plain TypeScript type or interface for each action's input.
- Callers must pass a typed object, not a raw `FormData` instance.
- This keeps the action's contract explicit and makes Zod validation straightforward.

```ts
// ✅ CORRECT — typed params
'use server'

export async function updateWorkoutAction(params: {
  id: string
  name: string
  completedAt: Date
}) { ... }

// ❌ WRONG — FormData parameter
export async function updateWorkoutAction(formData: FormData) {
  const name = formData.get("name") // untyped, bypasses validation
}
```

---

## Rule #4 — Zod Validation on Every Server Action

**Every Server Action must validate its arguments with Zod before doing anything else.**

- Define a Zod schema for each action's input at the top of the file or inline.
- Call `schema.parse(params)` as the very first statement in the action body.
- Never trust the caller to pass correct data — Server Actions are reachable via direct POST requests from anywhere.

```ts
// ✅ CORRECT — src/app/dashboard/actions.ts
'use server'

import { z } from "zod"
import { createWorkout } from "@/data/workouts"

const createWorkoutSchema = z.object({
  name: z.string().min(1).max(100),
  date: z.coerce.date(),
})

export async function createWorkoutAction(params: {
  name: string
  date: Date
}) {
  const validated = createWorkoutSchema.parse(params)
  return createWorkout(validated)
}

// ❌ WRONG — no validation
export async function createWorkoutAction(params: { name: string; date: Date }) {
  return createWorkout(params) // malformed input goes straight to the DB
}

// ❌ WRONG — validation after side effects
export async function createWorkoutAction(params: { name: string; date: Date }) {
  await sendNotification(params.name) // side effect before validation
  createWorkoutSchema.parse(params)   // too late
  return createWorkout(params)
}
```

---

## Rule #5 — Users Can Only Mutate Their Own Data

**Every `/data` mutation helper must scope the operation to the authenticated user's ID.**

This mirrors the scoping requirement for data fetching (see `data-fetching.md`). In addition:

- Updates and deletes must include the `userId` in the `WHERE` clause — not just the record's own `id`.
- Never accept an arbitrary `userId` from the action's parameters as the owner.

```ts
// ✅ CORRECT — ownership enforced in the /data helper
export async function updateWorkout(id: string, data: { name: string }) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  await db
    .update(workouts)
    .set(data)
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.user.id)))
}

// ❌ WRONG — update by id only; any authenticated user can overwrite any row
export async function updateWorkout(id: string, data: { name: string }) {
  await db.update(workouts).set(data).where(eq(workouts.id, id))
}
```

---

## Rule #6 — No `redirect()` Inside Server Actions

**Never call `redirect()` from `next/navigation` inside a Server Action.** Redirects must happen client-side after the action resolves.

`redirect()` works by throwing a special internal error. When a Server Action is called from a Client Component wrapped in `try/catch`, that thrown error is caught before it can take effect — silently eating the redirect. Keeping navigation on the client keeps error handling and routing clearly separated.

```ts
// ✅ CORRECT — action returns, client navigates
// src/app/dashboard/workout/new/actions.ts
'use server'
export async function createWorkoutAction(params: { name: string }) {
  const validated = schema.parse(params)
  const workout = await createWorkout(validated)
  return workout  // return the result; let the client decide where to go
}

// src/app/dashboard/workout/new/_components/workout-form.tsx
'use client'
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  try {
    await createWorkoutAction({ name })
    router.push('/dashboard')  // ✅ redirect on the client after success
  } catch (err) {
    setError('Something went wrong')
  }
}

// ❌ WRONG — redirect inside the action; caught by try/catch on the client
'use server'
export async function createWorkoutAction(params: { name: string }) {
  const workout = await createWorkout(params)
  redirect('/dashboard')  // throws internally — will be swallowed by client catch
}
```

---

## Summary

| Concern                      | Required                                        | Forbidden                                              |
|------------------------------|-------------------------------------------------|--------------------------------------------------------|
| Where mutations live         | `src/data` helper functions                     | Direct DB calls in actions, pages, or components       |
| How to trigger mutations     | Server Actions in colocated `actions.ts`        | Route Handlers, client-side fetch/mutation libraries   |
| Action parameter types       | Explicit TypeScript types (plain objects)       | `FormData`                                             |
| Input validation             | Zod — first line of every Server Action         | No validation, or validation after side effects        |
| Data ownership               | Always filter mutations by authenticated userId | Unscoped updates/deletes, trusting caller-supplied ids |
| Post-mutation navigation     | `router.push()` on the client after action resolves | `redirect()` inside a Server Action             |
