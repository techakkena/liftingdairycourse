import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import { exercises } from '@/src/db/schema'
import { asc, eq } from 'drizzle-orm'

export async function getAllExercises() {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  return db.select().from(exercises).orderBy(asc(exercises.name))
}

export async function createExercise(name: string) {
  const session = await auth()
  if (!session?.userId) throw new Error('Unauthorized')

  const [existing] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.name, name))
    .limit(1)

  if (existing) {
    throw new Error(`Exercise "${name}" already exists in the library.`)
  }

  const [exercise] = await db
    .insert(exercises)
    .values({ name })
    .returning()

  return exercise
}
