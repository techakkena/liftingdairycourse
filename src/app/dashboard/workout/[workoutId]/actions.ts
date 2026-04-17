'use server'

import { z } from 'zod'
import { updateWorkout, addExerciseToWorkout, removeExerciseFromWorkout, completeWorkout, addSet, updateWorkoutStartedAt } from '@/data/workouts'

const updateWorkoutSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(255),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
})

export async function updateWorkoutAction(params: {
  id: string
  name: string
  startedAt?: Date | null
  completedAt?: Date | null
}) {
  const validated = updateWorkoutSchema.parse(params)
  const workout = await updateWorkout(validated.id, {
    name: validated.name,
    startedAt: validated.startedAt,
    completedAt: validated.completedAt,
  })
  return workout
}

const addExerciseSchema = z.object({
  workoutId: z.string().uuid(),
  exerciseId: z.string().uuid(),
})

export async function addExerciseToWorkoutAction(params: {
  workoutId: string
  exerciseId: string
}) {
  const validated = addExerciseSchema.parse(params)
  return addExerciseToWorkout(validated.workoutId, validated.exerciseId)
}

const completeWorkoutSchema = z.object({
  id: z.string().uuid(),
  completedAt: z.coerce.date(),
})

export async function completeWorkoutAction(params: { id: string; completedAt: Date }) {
  const validated = completeWorkoutSchema.parse(params)
  return completeWorkout(validated.id, validated.completedAt)
}

const addExerciseWithSetsSchema = z.object({
  workoutId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  startedAt: z.coerce.date().nullable().optional(),
  sets: z.array(
    z.object({
      reps: z.number().int().positive().nullable(),
      weightKg: z.string().nullable(),
    }),
  ),
})

export async function addExerciseWithSetsAction(params: {
  workoutId: string
  exerciseId: string
  startedAt?: Date | null
  sets: Array<{ reps: number | null; weightKg: string | null }>
}) {
  const validated = addExerciseWithSetsSchema.parse(params)
  const we = await addExerciseToWorkout(validated.workoutId, validated.exerciseId)
  for (const set of validated.sets) {
    await addSet(we.id, { reps: set.reps, weightKg: set.weightKg })
  }
  if (validated.startedAt !== undefined) {
    await updateWorkoutStartedAt(validated.workoutId, validated.startedAt ?? null)
  }
  return we
}

const removeExerciseSchema = z.object({
  workoutExerciseId: z.string().uuid(),
  workoutId: z.string().uuid(),
})

export async function removeExerciseFromWorkoutAction(params: {
  workoutExerciseId: string
  workoutId: string
}) {
  const validated = removeExerciseSchema.parse(params)
  return removeExerciseFromWorkout(validated.workoutExerciseId, validated.workoutId)
}
