import { notFound } from 'next/navigation'
import { getWorkoutById } from '@/data/workouts'
import { getAllExercises } from '@/data/exercises'
import EditWorkoutForm from './_components/EditWorkoutForm'
import { formatDate } from '@/src/lib/dates'

export default async function EditWorkoutPage({
  params,
}: {
  params: Promise<{ workoutId: string }>
}) {
  const { workoutId } = await params
  const [workout, allExercises] = await Promise.all([
    getWorkoutById(workoutId),
    getAllExercises(),
  ])

  if (!workout) notFound()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const completedDate = workout.completedAtDate
    ? new Date(workout.completedAtDate)
    : null
  if (completedDate) completedDate.setHours(0, 0, 0, 0)

  const isReadOnly = completedDate !== null && completedDate < today

  const workoutDate = workout.startedAtRaw
    ? formatDate(new Date(workout.startedAtRaw))
    : null

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 flex flex-col items-start gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{workout.name}</h1>
        {workoutDate && (
          <p className="text-sm text-muted-foreground mt-1">{workoutDate}</p>
        )}
      </div>
      <EditWorkoutForm
        workout={workout}
        isReadOnly={isReadOnly}
        allExercises={allExercises}
      />
    </main>
  )
}
