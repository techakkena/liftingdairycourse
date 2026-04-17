import { getAllExercises } from '@/data/exercises'
import LogWorkoutForm from './_components/LogWorkoutForm'

export default async function NewWorkoutPage() {
  const allExercises = await getAllExercises()

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 flex flex-col items-start gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Log a Workout</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add exercises and sets, then save. You can complete the workout from the detail page.
        </p>
      </div>
      <LogWorkoutForm allExercises={allExercises} />
    </main>
  )
}
