'use server'

import { z } from 'zod'
import {
  logWorkout,
  createWorkout,
  addExerciseToWorkout,
  removeExerciseFromWorkout,
  addSet,
  removeSet,
  updateWorkout,
} from '@/data/workouts'
import { createExercise } from '@/data/exercises'

const createWorkoutSchema = z.object({
  name: z.string().min(1, 'Workout name is required').max(255),
  startedAt: z.coerce.date().optional(),
})

export async function createWorkoutAction(params: { name: string; startedAt?: Date }) {
  const validated = createWorkoutSchema.parse(params)
  return createWorkout({ name: validated.name, startedAt: validated.startedAt })
}

const logWorkoutSchema = z.object({
  name: z.string().min(1, 'Workout name is required').max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  startTime: z.string().optional(),
  exercises: z.array(
    z.object({
      exerciseId: z.string().uuid(),
      sets: z.array(
        z.object({
          reps: z.number().int().min(1).nullable(),
          weightKg: z.string().nullable(),
        }),
      ),
    }),
  ),
})

export async function logWorkoutAction(params: {
  name: string
  date: string
  startTime?: string
  exercises: Array<{
    exerciseId: string
    sets: Array<{ reps: number | null; weightKg: string | null }>
  }>
}) {
  const validated = logWorkoutSchema.parse(params)

  const startedAt = validated.startTime
    ? new Date(`${validated.date}T${validated.startTime}`)
    : null

  return logWorkout({
    name: validated.name,
    startedAt,
    completedAt: null,
    exercises: validated.exercises,
  })
}

const createExerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name is required').max(255),
})

export async function createExerciseAction(params: { name: string }) {
  const validated = createExerciseSchema.parse(params)
  return createExercise(validated.name)
}

const addExerciseSchema = z.object({
  workoutId: z.string().uuid(),
  exerciseId: z.string().uuid(),
})

export async function addExerciseAction(params: { workoutId: string; exerciseId: string }) {
  const validated = addExerciseSchema.parse(params)
  return addExerciseToWorkout(validated.workoutId, validated.exerciseId)
}

const removeExerciseSchema = z.object({
  workoutExerciseId: z.string().uuid(),
  workoutId: z.string().uuid(),
})

export async function removeExerciseAction(params: { workoutExerciseId: string; workoutId: string }) {
  const validated = removeExerciseSchema.parse(params)
  return removeExerciseFromWorkout(validated.workoutExerciseId, validated.workoutId)
}

const addSetSchema = z.object({
  workoutExerciseId: z.string().uuid(),
  reps: z.number().int().min(1).nullable(),
  weightKg: z.string().nullable(),
})

export async function addSetAction(params: {
  workoutExerciseId: string
  reps: number | null
  weightKg: string | null
}) {
  const validated = addSetSchema.parse(params)
  return addSet(validated.workoutExerciseId, { reps: validated.reps, weightKg: validated.weightKg })
}

const removeSetSchema = z.object({
  setId: z.string().uuid(),
  workoutExerciseId: z.string().uuid(),
})

export async function removeSetAction(params: { setId: string; workoutExerciseId: string }) {
  const validated = removeSetSchema.parse(params)
  return removeSet(validated.setId, validated.workoutExerciseId)
}

const updateWorkoutStartSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  startedAt: z.coerce.date(),
})

export async function updateWorkoutStartAction(params: { id: string; name: string; startedAt: Date }) {
  const validated = updateWorkoutStartSchema.parse(params)
  return updateWorkout(validated.id, { name: validated.name, startedAt: validated.startedAt })
}
