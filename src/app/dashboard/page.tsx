export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Dumbbell, Plus, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button-variants'
import DatePicker from './_components/DatePicker'
import { getWorkoutsForDate, getRecentWorkouts } from '@/data/workouts'
import { formatDate } from '@/src/lib/dates'
import type { WorkoutSummary } from '@/data/workouts'

interface PageProps {
  searchParams: Promise<{ date?: string }>
}

function toDateString(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function WorkoutCard({ workout, showDate = false }: { workout: WorkoutSummary; showDate?: boolean }) {
  return (
    <Link href={`/dashboard/workout/${workout.id}`} className="block hover:opacity-80 transition-opacity">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base">{workout.name}</CardTitle>
              {showDate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(workout.createdAt)}
                </p>
              )}
            </div>
            {(workout.startedAt || workout.completedAt) && (
              <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                <Clock className="size-3 mr-1" />
                {workout.startedAt}
                {workout.completedAt && ` → ${workout.completedAt}`}
              </Badge>
            )}
          </div>
        </CardHeader>
        {workout.exercises.length > 0 && (
          <CardContent>
            <ul className="space-y-3">
              {workout.exercises.map((ex) => (
                <li key={ex.workoutExerciseId}>
                  <p className="text-sm font-medium mb-1">{ex.name}</p>
                  <div className="text-xs text-muted-foreground">
                    {ex.sets.map((s) => (
                      <span key={s.order} className="inline-block mr-3 mb-1">
                        <span className="font-mono text-[10px]">{s.order + 1}:</span>
                        <span className="ml-1 text-[10px]">{s.reps ?? '—'}×{s.weightKg ?? '—'}kg</span>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </Link>
  )
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { date } = await searchParams
  const selectedDate = date ?? toDateString(new Date())

  const [recentWorkouts, dateWorkouts] = await Promise.all([
    getRecentWorkouts(3),
    getWorkoutsForDate(selectedDate),
  ])

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link href="/dashboard/workout/new" className={buttonVariants()}>
          <Plus className="size-4" />
          Log New Workout
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Recent Workouts */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Workouts</h2>

          {recentWorkouts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Dumbbell className="size-10 opacity-30" />
              <p className="text-sm">No workouts logged yet. Start your first one!</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {recentWorkouts.map((workout) => (
                <li key={workout.id}>
                  <WorkoutCard workout={workout} showDate />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Browse by Date */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Browse by Date</h2>

          <DatePicker value={selectedDate} />

          {dateWorkouts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Dumbbell className="size-8 opacity-30" />
              <p className="text-sm">No workouts logged for {formatDate(new Date(selectedDate + 'T12:00:00'))}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {dateWorkouts.map((workout) => (
                <li key={workout.id}>
                  <WorkoutCard workout={workout} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
