# Server Components Standards

## Rule #1 — `params` and `searchParams` Are Promises — Always `await` Them

**In Next.js 15+, `params` and `searchParams` are Promises.** You must `await` them before accessing any property. Accessing them synchronously will give you the Promise object, not the values — TypeScript will not always catch this.

This applies to every dynamic page, layout, and route segment.

```tsx
// ✅ CORRECT — params is awaited before use
// app/dashboard/workout/[workoutId]/page.tsx
export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ workoutId: string }>
}) {
  const { workoutId } = await params
  const workout = await getWorkout(workoutId)
  return <WorkoutDetail workout={workout} />
}

// ✅ CORRECT — searchParams is awaited before use
// app/dashboard/page.tsx
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  const workouts = await getWorkouts({ filter })
  return <WorkoutList workouts={workouts} />
}

// ❌ WRONG — params destructured without awaiting (returns Promise object)
export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ workoutId: string }>
}) {
  const { workoutId } = params // BUG: params is still a Promise here
  const workout = await getWorkout(workoutId) // workoutId is undefined
}

// ❌ WRONG — old Next.js 13/14 synchronous signature (does not work in Next.js 15)
export default async function WorkoutPage({
  params,
}: {
  params: { workoutId: string } // WRONG TYPE — params is Promise<{...}> in Next.js 15
}) {
  const workout = await getWorkout(params.workoutId)
}
```

---

## Rule #2 — Always Type `params` as a Promise

**The type signature must reflect that `params` is a Promise.** Using the old synchronous type (`params: { id: string }`) is a type error in Next.js 15.

```tsx
// ✅ CORRECT type signatures
type Props = {
  params: Promise<{ workoutId: string }>
  searchParams: Promise<{ tab?: string; page?: string }>
}

// ❌ WRONG — legacy synchronous types from Next.js 13/14
type Props = {
  params: { workoutId: string }        // missing Promise wrapper
  searchParams: { tab?: string }       // missing Promise wrapper
}
```

---

## Rule #3 — Layouts With Dynamic Segments Must Also Await `params`

Layouts that receive `params` from a dynamic segment follow the same rule.

```tsx
// ✅ CORRECT — layout awaiting params
// app/dashboard/workout/[workoutId]/layout.tsx
export default async function WorkoutLayout({
  params,
  children,
}: {
  params: Promise<{ workoutId: string }>
  children: React.ReactNode
}) {
  const { workoutId } = await params
  return (
    <div>
      <WorkoutNav workoutId={workoutId} />
      {children}
    </div>
  )
}
```

---

## Rule #4 — Server Components Are the Default; Add `'use client'` Only When Necessary

All pages and layouts are Server Components by default. A component needs `'use client'` only if it uses:

- React state (`useState`, `useReducer`)
- Side effects (`useEffect`)
- Event handlers (`onClick`, `onChange`, etc.)
- Browser-only APIs (`window`, `localStorage`, etc.)
- Context consumers that depend on the above

**Keep `'use client'` boundaries as deep in the tree as possible** to minimise the client-side JS bundle.

```tsx
// ✅ CORRECT — only the interactive leaf is a Client Component
// app/dashboard/workout/[workoutId]/page.tsx (Server Component)
export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ workoutId: string }>
}) {
  const { workoutId } = await params
  const workout = await getWorkout(workoutId)
  return <WorkoutActions workout={workout} /> // Client Component, below
}

// app/dashboard/workout/[workoutId]/_components/workout-actions.tsx
'use client'
export function WorkoutActions({ workout }: { workout: Workout }) {
  // state, handlers, etc.
}

// ❌ WRONG — making the whole page a Client Component just for one button
'use client'
export default function WorkoutPage() {
  // now params cannot be awaited here either — Client Components cannot be async
}
```

---

## Rule #5 — Client Components Cannot Be `async`

`async` / `await` is only valid in Server Components. Client Components must be synchronous functions.

```tsx
// ✅ CORRECT — async stays in the Server Component
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await fetchData(id)
  return <ClientChild data={data} />
}

// ❌ WRONG — async Client Component (runtime error)
'use client'
export default async function ClientPage() { // INVALID
  const data = await fetchData()
}
```

---

## Summary

| Concern                        | Required                                         | Forbidden                                              |
|-------------------------------|--------------------------------------------------|--------------------------------------------------------|
| `params` / `searchParams` type | `Promise<{ ... }>`                               | Synchronous `{ ... }` type from Next.js 13/14          |
| Accessing `params` values      | `const { id } = await params`                    | `const { id } = params` (no `await`)                  |
| `'use client'` placement       | Deepest necessary leaf component                 | Wrapping whole pages/layouts unnecessarily             |
| `async` functions              | Server Components only                           | `async` Client Components                              |
