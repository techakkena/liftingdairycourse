'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, Lock, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { updateWorkoutAction, addExerciseWithSetsAction, removeExerciseFromWorkoutAction, completeWorkoutAction } from '../actions'
import type { WorkoutSummary } from '@/data/workouts'
import type { Exercise } from '@/src/db/schema'

interface SetRow {
  id: string
  reps: string
  weightKg: string
}

interface Props {
  workout: WorkoutSummary
  isReadOnly: boolean
  allExercises: Exercise[]
}

export default function EditWorkoutForm({ workout, isReadOnly, allExercises }: Props) {
  const router = useRouter()
  const [name, setName] = useState(workout.name)
  const [startedAt, setStartedAt] = useState(workout.startedAtRaw ?? '')
  const [completedAt, setCompletedAt] = useState(workout.completedAtRaw ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Exercise checklist
  const [checkedExercises, setCheckedExercises] = useState<Set<string>>(new Set())

  // Add Exercise state
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [newExDate, setNewExDate] = useState('')
  const [newExTime, setNewExTime] = useState('')
  const [newSets, setNewSets] = useState<SetRow[]>([{ id: 'set-0', reps: '', weightKg: '' }])
  const [addError, setAddError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Complete workout state
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [completeDate, setCompleteDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const usedNames = new Set(workout.exercises.map((ex) => ex.name))
  const availableExercises = allExercises.filter((ex) => !usedNames.has(ex.name))

  function toggleCheck(workoutExerciseId: string) {
    // TODO(human): Update checkedExercises using a functional Set updater.
    // Create a new Set from prev, toggle the workoutExerciseId
    // (delete if already present, add if absent), then return the new Set.
  }

  function updateNewSet(setId: string, field: 'reps' | 'weightKg', value: string) {
    setNewSets((prev) => prev.map((s) => (s.id === setId ? { ...s, [field]: value } : s)))
  }

  function addNewSetRow() {
    setNewSets((prev) => [...prev, { id: `set-${Date.now()}`, reps: '', weightKg: '' }])
  }

  function removeNewSetRow(setId: string) {
    setNewSets((prev) => prev.filter((s) => s.id !== setId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await updateWorkoutAction({
        id: workout.id,
        name,
        startedAt: startedAt ? new Date(startedAt) : null,
        completedAt: completedAt ? new Date(completedAt) : null,
      })
      router.refresh()
    } catch (err) {
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message)
          const first = Array.isArray(parsed) ? parsed[0] : null
          setError(first?.message ?? err.message)
        } catch {
          setError(err.message)
        }
      } else {
        setError('Failed to save changes')
      }
    } finally {
      setPending(false)
    }
  }

  function handleAddExercise() {
    if (!selectedExerciseId) return
    setAddError(null)
    startTransition(async () => {
      try {
        let exerciseStartedAt: Date | undefined
        if (newExDate) {
          const datetime = newExTime ? `${newExDate}T${newExTime}` : `${newExDate}T00:00:00`
          exerciseStartedAt = new Date(datetime)
        }
        const sets = newSets.map((s) => ({
          reps: s.reps ? parseInt(s.reps, 10) : null,
          weightKg: s.weightKg || null,
        }))
        await addExerciseWithSetsAction({
          workoutId: workout.id,
          exerciseId: selectedExerciseId,
          startedAt: exerciseStartedAt,
          sets,
        })
        setSelectedExerciseId('')
        setNewExDate('')
        setNewExTime('')
        setNewSets([{ id: 'set-0', reps: '', weightKg: '' }])
        router.refresh()
      } catch {
        setAddError('Failed to add exercise')
      }
    })
  }

  function handleRemoveExercise(workoutExerciseId: string) {
    startTransition(async () => {
      try {
        await removeExerciseFromWorkoutAction({ workoutExerciseId, workoutId: workout.id })
        router.refresh()
      } catch {
        setAddError('Failed to remove exercise')
      }
    })
  }

  async function handleComplete() {
    if (!completeDate) return
    setCompleteError(null)
    setCompleting(true)
    try {
      await completeWorkoutAction({
        id: workout.id,
        completedAt: new Date(`${completeDate}T23:59:59`),
      })
      router.refresh()
    } catch {
      setCompleteError('Failed to mark workout as complete')
    } finally {
      setCompleting(false)
    }
  }

  const checkedCount = checkedExercises.size
  const totalCount = workout.exercises.length

  return (
    <div className="w-full space-y-6">
      {isReadOnly && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          This workout was completed in the past and cannot be edited.
        </div>
      )}

      {!workout.completedAt && !isReadOnly && (
        <Card className="max-w-md w-full border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              Complete Workout
              {totalCount > 0 && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {checkedCount}/{totalCount} exercises done
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="completeDate">Completion date</Label>
              <Input
                id="completeDate"
                type="date"
                value={completeDate}
                onChange={(e) => setCompleteDate(e.target.value)}
                disabled={completing}
              />
            </div>
            {completeError && <p className="text-sm text-destructive">{completeError}</p>}
            <Button
              type="button"
              onClick={handleComplete}
              disabled={completing || !completeDate}
            >
              <CheckCircle2 className="size-4" />
              {completing ? 'Completing…' : 'Mark as Complete'}
            </Button>
          </CardContent>
        </Card>
      )}

      {workout.completedAt && !isReadOnly && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
          <CheckCircle2 className="size-4 shrink-0" />
          Workout completed at {workout.completedAt}
        </div>
      )}

      {/* Workout details form */}
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Workout Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Workout name</Label>
              <Input
                id="name"
                placeholder="e.g. Morning Push Day"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="startedAt">Start time (optional)</Label>
              <Input
                id="startedAt"
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="completedAt">Completed time (optional)</Label>
              <Input
                id="completedAt"
                type="datetime-local"
                value={completedAt}
                onChange={(e) => setCompletedAt(e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {!isReadOnly && (
              <div className="flex gap-3">
                <Button type="submit" disabled={pending}>
                  {pending ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Exercises section */}
      <section className="w-full max-w-2xl space-y-4">
        <h2 className="text-lg font-semibold">Exercises</h2>

        {workout.exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exercises added yet.</p>
        ) : (
          <ul className="space-y-3">
            {workout.exercises.map((ex) => (
              <li key={ex.workoutExerciseId}>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {!isReadOnly && (
                          <input
                            type="checkbox"
                            id={`check-${ex.workoutExerciseId}`}
                            checked={checkedExercises.has(ex.workoutExerciseId)}
                            onChange={() => toggleCheck(ex.workoutExerciseId)}
                            className="size-4 rounded border-input cursor-pointer accent-primary"
                          />
                        )}
                        <CardTitle
                          className={`text-base ${
                            checkedExercises.has(ex.workoutExerciseId)
                              ? 'line-through text-muted-foreground'
                              : ''
                          }`}
                        >
                          {ex.name}
                        </CardTitle>
                      </div>
                      {!isReadOnly && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleRemoveExercise(ex.workoutExerciseId)}
                          className="shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  {ex.sets.length > 0 && (
                    <CardContent>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                        {ex.sets.map((s) => (
                          <span key={s.order} className="inline-flex items-center gap-1">
                            <span className="font-mono text-[10px] text-foreground">{s.order + 1}:</span>
                            <span>{s.reps ?? '—'}×{s.weightKg ?? '—'}kg</span>
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}

        {!isReadOnly && (
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-base">Add Exercise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableExercises.length === 0 ? (
                <p className="text-sm text-muted-foreground">No more exercises to add.</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="exercise-select">Exercise</Label>
                    <select
                      id="exercise-select"
                      value={selectedExerciseId}
                      onChange={(e) => setSelectedExerciseId(e.target.value)}
                      disabled={isPending}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select an exercise…</option>
                      {availableExercises.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="newExDate">Date (optional)</Label>
                      <Input
                        id="newExDate"
                        type="date"
                        value={newExDate}
                        onChange={(e) => setNewExDate(e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="newExTime">Time (optional)</Label>
                      <Input
                        id="newExTime"
                        type="time"
                        value={newExTime}
                        onChange={(e) => setNewExTime(e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Sets</Label>
                    <div className="space-y-2">
                      {newSets.map((set, i) => (
                        <div key={set.id} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                          <Input
                            type="number"
                            placeholder="Reps"
                            value={set.reps}
                            onChange={(e) => updateNewSet(set.id, 'reps', e.target.value)}
                            disabled={isPending}
                            className="w-20"
                            min={1}
                          />
                          <Input
                            type="number"
                            placeholder="kg"
                            value={set.weightKg}
                            onChange={(e) => updateNewSet(set.id, 'weightKg', e.target.value)}
                            disabled={isPending}
                            className="w-20"
                            min={0}
                            step="0.5"
                          />
                          {newSets.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeNewSetRow(set.id)}
                              disabled={isPending}
                              className="shrink-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addNewSetRow}
                      disabled={isPending}
                    >
                      <Plus className="size-4" />
                      Add Set
                    </Button>
                  </div>

                  {addError && <p className="text-sm text-destructive">{addError}</p>}

                  <Button
                    type="button"
                    onClick={handleAddExercise}
                    disabled={!selectedExerciseId || isPending}
                  >
                    <Plus className="size-4" />
                    {isPending ? 'Adding…' : 'Add Exercise'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {isReadOnly && workout.exercises.length === 0 && (
          <Badge variant="secondary">No exercises recorded</Badge>
        )}
      </section>
    </div>
  )
}
