import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import { workouts, workoutExercises, exercises, sets } from '@/src/db/schema'
import { and, eq, gte, lt, desc, max, inArray } from 'drizzle-orm'
import { format } from 'date-fns'

function toDatetimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export async function createWorkout(data: { name: string; startedAt?: Date }) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  const today = new Date()
  const yyyy = today.getUTCFullYear()
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(today.getUTCDate()).padStart(2, '0')
  const dayStart = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`)
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  const [existing] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(
      eq(workouts.userId, session.userId),
      eq(workouts.name, data.name),
      gte(workouts.createdAt, dayStart),
      lt(workouts.createdAt, dayEnd),
    ))
    .limit(1)

  if (existing) {
    throw new Error(`A workout named "${data.name}" already exists for today.`)
  }

  const [workout] = await db
    .insert(workouts)
    .values({ name: data.name, startedAt: data.startedAt, userId: session.userId })
    .returning()

  return workout
}

export interface WorkoutSet {
  id: string
  order: number
  reps: number | null
  weightKg: string | null
}

export interface WorkoutExercise {
  workoutExerciseId: string
  name: string
  sets: WorkoutSet[]
}

export interface WorkoutSummary {
  id: string
  name: string
  createdAt: Date
  startedAt: string | null
  completedAt: string | null
  startedAtRaw?: string | null
  completedAtRaw?: string | null
  completedAtDate: Date | null
  exercises: WorkoutExercise[]
}

// ---------------------------------------------------------------------------
// Shared row-grouping logic used by multiple queries
// ---------------------------------------------------------------------------

type WorkoutRow = {
  workoutId: string
  workoutName: string
  workoutCreatedAt: Date
  startedAt: Date | null
  completedAt: Date | null
  workoutExerciseId: string | null
  exerciseName: string | null
  exerciseOrder: number | null
  setId: string | null
  setOrder: number | null
  reps: number | null
  weightKg: string | null
}

function groupRowsIntoWorkouts(rows: WorkoutRow[]): Map<string, WorkoutSummary> {
  const workoutMap = new Map<string, WorkoutSummary>()

  for (const row of rows) {
    if (!row.workoutId) continue

    let workout = workoutMap.get(row.workoutId)
    if (!workout) {
      workout = {
        id: row.workoutId,
        name: row.workoutName,
        createdAt: row.workoutCreatedAt,
        startedAt: row.startedAt ? format(row.startedAt, 'h:mm aa') : null,
        completedAt: row.completedAt ? format(row.completedAt, 'h:mm aa') : null,
        completedAtDate: row.completedAt ?? null,
        exercises: [],
      }
      workoutMap.set(row.workoutId, workout)
    }

    if (row.exerciseName && row.workoutExerciseId) {
      let exercise = workout.exercises.find((ex) => ex.workoutExerciseId === row.workoutExerciseId)
      if (!exercise) {
        exercise = { workoutExerciseId: row.workoutExerciseId, name: row.exerciseName, sets: [] }
        workout.exercises.push(exercise)
      }
      if (row.setOrder !== null && row.setOrder !== undefined && row.setId) {
        exercise.sets.push({ id: row.setId, order: row.setOrder, reps: row.reps, weightKg: row.weightKg })
      }
    }
  }

  return workoutMap
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getWorkoutById(id: string): Promise<WorkoutSummary | null> {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  const rows = await db
    .select({
      workoutId: workouts.id,
      workoutName: workouts.name,
      workoutCreatedAt: workouts.createdAt,
      startedAt: workouts.startedAt,
      completedAt: workouts.completedAt,
      workoutExerciseId: workoutExercises.id,
      exerciseName: exercises.name,
      exerciseOrder: workoutExercises.order,
      setId: sets.id,
      setOrder: sets.orderIndex,
      reps: sets.reps,
      weightKg: sets.weightKg,
    })
    .from(workouts)
    .leftJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
    .leftJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .leftJoin(sets, eq(sets.workoutExerciseId, workoutExercises.id))
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.userId)))
    .orderBy(workoutExercises.order, sets.orderIndex)

  if (rows.length === 0) return null

  const workoutMap = groupRowsIntoWorkouts(rows)
  const summary = workoutMap.get(rows[0].workoutId)
  if (!summary) return null

  // Attach raw datetime-local strings for form inputs
  const first = rows[0]
  summary.startedAtRaw = first.startedAt ? toDatetimeLocal(first.startedAt) : null
  summary.completedAtRaw = first.completedAt ? toDatetimeLocal(first.completedAt) : null

  return summary
}

export async function getWorkoutsForDate(date: string): Promise<WorkoutSummary[]> {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  const dayStart = new Date(`${date}T00:00:00.000Z`)
  const dayEnd = new Date(`${date}T00:00:00.000Z`)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  const rows = await db
    .select({
      workoutId: workouts.id,
      workoutName: workouts.name,
      workoutCreatedAt: workouts.createdAt,
      startedAt: workouts.startedAt,
      completedAt: workouts.completedAt,
      workoutExerciseId: workoutExercises.id,
      exerciseName: exercises.name,
      exerciseOrder: workoutExercises.order,
      setId: sets.id,
      setOrder: sets.orderIndex,
      reps: sets.reps,
      weightKg: sets.weightKg,
    })
    .from(workouts)
    .leftJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
    .leftJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .leftJoin(sets, eq(sets.workoutExerciseId, workoutExercises.id))
    .where(
      and(
        eq(workouts.userId, session.userId),
        gte(workouts.createdAt, dayStart),
        lt(workouts.createdAt, dayEnd),
      ),
    )
    .orderBy(desc(workouts.createdAt), workoutExercises.order, sets.orderIndex)

  const workoutMap = groupRowsIntoWorkouts(rows)

  const result = Array.from(workoutMap.values())
  for (const workout of result) {
    workout.exercises.sort((a, b) => {
      const aOrder = rows.find((r) => r.workoutId === workout.id && r.workoutExerciseId === a.workoutExerciseId)?.exerciseOrder ?? 0
      const bOrder = rows.find((r) => r.workoutId === workout.id && r.workoutExerciseId === b.workoutExerciseId)?.exerciseOrder ?? 0
      return aOrder - bOrder
    })
    for (const exercise of workout.exercises) {
      exercise.sets.sort((a, b) => a.order - b.order)
    }
  }

  return result
}

export async function getRecentWorkouts(limit: number = 3): Promise<WorkoutSummary[]> {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  // Step 1: get the most recent N workout IDs (limit works correctly on this simple query)
  const recentIds = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(eq(workouts.userId, session.userId))
    .orderBy(desc(workouts.createdAt))
    .limit(limit)

  if (recentIds.length === 0) return []

  const ids = recentIds.map((w) => w.id)

  // Step 2: fetch full details for those IDs (joins fan out rows per set — can't limit here)
  const rows = await db
    .select({
      workoutId: workouts.id,
      workoutName: workouts.name,
      workoutCreatedAt: workouts.createdAt,
      startedAt: workouts.startedAt,
      completedAt: workouts.completedAt,
      workoutExerciseId: workoutExercises.id,
      exerciseName: exercises.name,
      exerciseOrder: workoutExercises.order,
      setId: sets.id,
      setOrder: sets.orderIndex,
      reps: sets.reps,
      weightKg: sets.weightKg,
    })
    .from(workouts)
    .leftJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
    .leftJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .leftJoin(sets, eq(sets.workoutExerciseId, workoutExercises.id))
    .where(and(eq(workouts.userId, session.userId), inArray(workouts.id, ids)))
    .orderBy(desc(workouts.createdAt), workoutExercises.order, sets.orderIndex)

  const workoutMap = groupRowsIntoWorkouts(rows)

  // Return in the original most-recent-first order from recentIds
  return ids.map((id) => workoutMap.get(id)).filter((w): w is WorkoutSummary => w !== undefined)
}

export async function updateWorkout(
  id: string,
  data: { name: string; startedAt?: Date | null; completedAt?: Date | null },
) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  // Only include fields that were explicitly provided — Drizzle throws for undefined in .set()
  const updates: { name: string; startedAt?: Date | null; completedAt?: Date | null } = {
    name: data.name,
  }
  if (data.startedAt !== undefined) updates.startedAt = data.startedAt
  if (data.completedAt !== undefined) updates.completedAt = data.completedAt

  const [updated] = await db
    .update(workouts)
    .set(updates)
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.userId)))
    .returning()

  if (!updated) throw new Error('Not found')
  return updated
}

export async function logWorkout(data: {
  name: string
  startedAt: Date | null
  completedAt: Date | null
  exercises: Array<{
    exerciseId: string
    sets: Array<{ reps: number | null; weightKg: string | null }>
  }>
}) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  const [workout] = await db
    .insert(workouts)
    .values({
      name: data.name,
      userId: session.userId,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
    })
    .returning()

  for (let i = 0; i < data.exercises.length; i++) {
    const ex = data.exercises[i]
    const [we] = await db
      .insert(workoutExercises)
      .values({ workoutId: workout.id, exerciseId: ex.exerciseId, order: i })
      .returning()

    for (let j = 0; j < ex.sets.length; j++) {
      const s = ex.sets[j]
      await db.insert(sets).values({
        workoutExerciseId: we.id,
        orderIndex: j,
        reps: s.reps,
        weightKg: s.weightKg,
      })
    }
  }

  return workout
}

export async function completeWorkout(id: string, completedAt: Date) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  const [updated] = await db
    .update(workouts)
    .set({ completedAt })
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.userId)))
    .returning()

  if (!updated) throw new Error('Not found')
  return updated
}

export async function addExerciseToWorkout(workoutId: string, exerciseId: string) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  const [workout] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, session.userId)))

  if (!workout) throw new Error('Not found')

  const [maxRow] = await db
    .select({ maxOrder: max(workoutExercises.order) })
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId))

  const nextOrder = (maxRow?.maxOrder ?? -1) + 1

  const [newEntry] = await db
    .insert(workoutExercises)
    .values({ workoutId, exerciseId, order: nextOrder })
    .returning()

  return newEntry
}

export async function removeExerciseFromWorkout(workoutExerciseId: string, workoutId: string) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  const [workout] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, session.userId)))

  if (!workout) throw new Error('Not found')

  await db
    .delete(workoutExercises)
    .where(
      and(
        eq(workoutExercises.id, workoutExerciseId),
        eq(workoutExercises.workoutId, workoutId),
      ),
    )
}

export async function addSet(
  workoutExerciseId: string,
  data: { reps: number | null; weightKg: string | null },
) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  // Verify ownership through the exercise → workout chain
  const [we] = await db
    .select({ id: workoutExercises.id })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workoutExercises.id, workoutExerciseId), eq(workouts.userId, session.userId)))

  if (!we) throw new Error('Not found')

  const [maxRow] = await db
    .select({ maxOrder: max(sets.orderIndex) })
    .from(sets)
    .where(eq(sets.workoutExerciseId, workoutExerciseId))

  const nextOrder = (maxRow?.maxOrder ?? -1) + 1

  const [newSet] = await db
    .insert(sets)
    .values({ workoutExerciseId, reps: data.reps, weightKg: data.weightKg, orderIndex: nextOrder })
    .returning()

  return newSet
}

export async function updateWorkoutStartedAt(id: string, startedAt: Date | null) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  const [updated] = await db
    .update(workouts)
    .set({ startedAt })
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.userId)))
    .returning()

  if (!updated) throw new Error('Not found')
  return updated
}

export async function removeSet(setId: string, workoutExerciseId: string) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  // Verify ownership through the exercise → workout chain
  const [we] = await db
    .select({ id: workoutExercises.id })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workoutExercises.id, workoutExerciseId), eq(workouts.userId, session.userId)))

  if (!we) throw new Error('Not found')

  await db
    .delete(sets)
    .where(and(eq(sets.id, setId), eq(sets.workoutExerciseId, workoutExerciseId)))
}
