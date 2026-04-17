# Data Fetching Standards

## Rule #1 — Server Components Only

**ALL data fetching must happen exclusively in Server Components.**

This is non-negotiable. The following are strictly forbidden:

- **Route Handlers (`route.ts`)** — do not fetch data via API routes and call them from the client
- **Client Components (`'use client'`)** — do not use `fetch`, `useEffect`, SWR, React Query, or any other client-side fetching mechanism
- **Third-party data-fetching hooks** — `useSWR`, `useQuery`, `axios` in client components, etc.

If you need data in a Client Component, fetch it in a Server Component parent and pass it down as props.

```tsx
// ✅ CORRECT — fetch in Server Component, pass as props
// app/dashboard/page.tsx (Server Component)
import { getWorkouts } from "@/data/workouts"

export default async function DashboardPage() {
  const workouts = await getWorkouts()
  return <WorkoutList workouts={workouts} />
}

// ✅ CORRECT — Client Component receives data as props
// app/dashboard/_components/workout-list.tsx
'use client'
export function WorkoutList({ workouts }: { workouts: Workout[] }) {
  // use state, handlers, etc. — but NO fetching here
}

// ❌ WRONG — fetching inside a Client Component
'use client'
export function WorkoutList() {
  const [workouts, setWorkouts] = useState([])
  useEffect(() => {
    fetch('/api/workouts').then(...) // FORBIDDEN
  }, [])
}

// ❌ WRONG — route handler used as a data source for the UI
// app/api/workouts/route.ts — do not create these for UI data needs
```

---

## Rule #2 — Database Queries via `/data` Helper Functions

**All database queries must go through helper functions in the `/data` directory.**

- Do NOT write raw SQL anywhere. Use **Drizzle ORM** exclusively.
- Do NOT import or call the database client directly from pages, layouts, or components.
- Every database operation must be encapsulated in a named helper function inside `/data`.

```
/data
  workouts.ts      ← e.g. getWorkouts(), getWorkoutById()
  users.ts         ← e.g. getUserProfile()
  courses.ts       ← e.g. getEnrolledCourses()
```

```ts
// ✅ CORRECT — /data/workouts.ts
import { db } from "@/lib/db"
import { workouts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function getWorkouts(userId: string) {
  return db.select().from(workouts).where(eq(workouts.userId, userId))
}

// ❌ WRONG — raw SQL
import { sql } from "drizzle-orm"
export async function getWorkouts(userId: string) {
  return db.execute(sql`SELECT * FROM workouts WHERE user_id = ${userId}`)
}

// ❌ WRONG — querying the DB directly from a page
// app/dashboard/page.tsx
import { db } from "@/lib/db"
const data = await db.select().from(workouts) // must go through /data instead
```

---

## Rule #3 — Users Can ONLY Access Their Own Data

**This is a critical security requirement.** Every `/data` helper function that returns user-specific data MUST scope its query to the authenticated user's ID.

- Retrieve the current user's ID from the session inside the helper (or pass it in as a required parameter that the caller gets from the session).
- Never accept an arbitrary user ID from a URL parameter or request body without verifying it matches the authenticated user.
- There are NO admin bypass exceptions unless explicitly reviewed and approved.

```ts
// ✅ CORRECT — always filter by the authenticated userId
import { auth } from "@/lib/auth"

export async function getWorkouts() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  return db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, session.user.id)) // scoped to the logged-in user
}

// ❌ WRONG — no user scoping (exposes every row to every user)
export async function getWorkouts() {
  return db.select().from(workouts)
}

// ❌ WRONG — trusting a user-supplied ID from a URL param
export async function getWorkout(id: string) {
  return db.select().from(workouts).where(eq(workouts.id, id))
  // a logged-in user could enumerate other users' workout IDs
}

// ✅ CORRECT — always verify ownership even when fetching by ID
export async function getWorkout(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.user.id)))

  if (!workout) throw new Error("Not found")
  return workout
}
```

---

## Summary

| Concern                   | Required                              | Forbidden                                              |
|---------------------------|---------------------------------------|--------------------------------------------------------|
| Where to fetch data       | Server Components only                | Client Components, Route Handlers, `useEffect`/SWR    |
| How to query the database | Drizzle ORM via `/data` helpers       | Raw SQL, direct DB calls from pages/components         |
| Data access scope         | Always filter by authenticated userId | Unscoped queries, trusting user-supplied IDs blindly   |
