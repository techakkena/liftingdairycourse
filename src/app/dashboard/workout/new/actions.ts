'use server'

import { z } from 'zod'
import { logWorkout } from '@/data/workouts'
import { createExercise } from '@/data/exercises'

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
