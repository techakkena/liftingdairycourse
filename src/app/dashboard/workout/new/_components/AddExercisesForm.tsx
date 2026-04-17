'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  addExerciseAction,
  removeExerciseAction,
  addSetAction,
  removeSetAction,
  createExerciseAction,
  updateWorkoutStartAction,
} from '../actions'
import type { WorkoutSummary } from '@/data/workouts'
import type { Exercise } from '@/src/db/schema'

interface Props {
  workout: WorkoutSummary
  allExercises: Exercise[]
}

function AddSetRow({ workoutExerciseId, onAdd }: { workoutExerciseId: string; onAdd: () => void }) {
  const [reps, setReps] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    startTransition(async () => {
      await addSetAction({
        workoutExerciseId,
        reps: reps ? Number(reps) : null,
        weightKg: weightKg || null,
      })
      setReps('')
      setWeightKg('')
      onAdd()
    })
  }

  return (
    <div className="flex items-end gap-2 pt-1">
      <div className="space-y-1">
        <Label className="text-xs">Reps</Label>
        <Input
          type="number"
          min={1}
          placeholder="10"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          disabled={isPending}
          className="w-20 h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">kg</Label>
        <Input
          type="number"
          min={0}
          step={0.5}
          placeholder="80"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          disabled={isPending}
          className="w-24 h-8 text-sm"
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending || (!reps && !weightKg)}
        onClick={handleAdd}
        className="h-8"
      >
        <Plus className="size-3 mr-1" />
        {isPending ? 'Adding…' : 'Add Set'}
      </Button>
    </div>
  )
}

function CreateExerciseCard({
  workoutId,
  allExercises,
  onCreated,
}: {
  workoutId: string
  allExercises: Exercise[]
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    if (!name.trim()) return
    const trimmed = name.trim()
    const duplicate = allExercises.some(
      (ex) => ex.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicate) {
      setError(`"${trimmed}" already exists in the exercise library.`)
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const newEx = await createExerciseAction({ name: trimmed })
        await addExerciseAction({ workoutId, exerciseId: newEx.id })
        setName('')
        onCreated()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create exercise')
      }
    })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">Create New Exercise</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-exercise-name">Exercise name</Label>
          <Input
            id="new-exercise-name"
            placeholder="e.g. Bulgarian Split Squat"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" onClick={handleCreate} disabled={!name.trim() || isPending}>
          <Plus className="size-4" />
          {isPending ? 'Creating…' : 'Create & Add'}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function AddExercisesForm({ workout, allExercises }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [addReps, setAddReps] = useState('')
  const [addWeightKg, setAddWeightKg] = useState('')
  const [addDateVal, setAddDateVal] = useState(() => workout.startedAtRaw?.split('T')[0] ?? '')
  const [addTimeVal, setAddTimeVal] = useState(() => workout.startedAtRaw?.split('T')[1]?.slice(0, 5) ?? '')
  const [addExError, setAddExError] = useState<string | null>(null)

  const usedNames = new Set(workout.exercises.map((ex) => ex.name))
  const availableExercises = allExercises.filter((ex) => !usedNames.has(ex.name))

  function handleAddExercise() {
    if (!selectedExerciseId) return
    setAddExError(null)
    startTransition(async () => {
      try {
        if (addDateVal) {
          await updateWorkoutStartAction({
            id: workout.id,
            name: workout.name,
            startedAt: new Date(`${addDateVal}T${addTimeVal || '00:00'}`),
          })
        }
        const we = await addExerciseAction({ workoutId: workout.id, exerciseId: selectedExerciseId })
        if (addReps || addWeightKg) {
          await addSetAction({
            workoutExerciseId: we.id,
            reps: addReps ? Number(addReps) : null,
            weightKg: addWeightKg || null,
          })
        }
        setSelectedExerciseId('')
        setAddReps('')
        setAddWeightKg('')
        router.refresh()
      } catch (err) {
        setAddExError(err instanceof Error ? err.message : 'Failed to add exercise')
      }
    })
  }

  function handleRemoveExercise(workoutExerciseId: string) {
    startTransition(async () => {
      try {
        await removeExerciseAction({ workoutExerciseId, workoutId: workout.id })
        router.refresh()
      } catch {
        setAddExError('Failed to remove exercise')
      }
    })
  }

  function handleRemoveSet(setId: string, workoutExerciseId: string) {
    startTransition(async () => {
      try {
        await removeSetAction({ setId, workoutExerciseId })
        router.refresh()
      } catch {
        setAddExError('Failed to remove set')
      }
    })
  }

  return (
    <div className="w-full space-y-6">
      {/* Inline add-exercise row */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-medium">Add Exercise</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 min-w-[160px] flex-1">
            <Label htmlFor="exercise-select" className="text-xs">Exercise</Label>
            <select
              id="exercise-select"
              value={selectedExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
              disabled={isPending}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select…</option>
              {availableExercises.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 w-20">
            <Label htmlFor="add-reps" className="text-xs">Reps</Label>
            <Input
              id="add-reps"
              type="number"
              min={1}
              placeholder="10"
              value={addReps}
              onChange={(e) => setAddReps(e.target.value)}
              disabled={isPending}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1 w-24">
            <Label htmlFor="add-weight" className="text-xs">kg</Label>
            <Input
              id="add-weight"
              type="number"
              min={0}
              step={0.5}
              placeholder="80"
              value={addWeightKg}
              onChange={(e) => setAddWeightKg(e.target.value)}
              disabled={isPending}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1 w-36">
            <Label htmlFor="add-date" className="text-xs">Date</Label>
            <Input
              id="add-date"
              type="date"
              value={addDateVal}
              onChange={(e) => setAddDateVal(e.target.value)}
              disabled={isPending}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1 w-28">
            <Label htmlFor="add-time" className="text-xs">Start time</Label>
            <Input
              id="add-time"
              type="time"
              value={addTimeVal}
              onChange={(e) => setAddTimeVal(e.target.value)}
              disabled={isPending}
              className="h-9 text-sm"
            />
          </div>

          <Button
            type="button"
            onClick={handleAddExercise}
            disabled={!selectedExerciseId || isPending}
            className="h-9"
          >
            <Plus className="size-4" />
            {isPending ? 'Adding…' : 'Add Exercise'}
          </Button>
        </div>
        {addExError && <p className="text-sm text-destructive">{addExError}</p>}
      </div>

      {/* Exercise list with sets */}
      {workout.exercises.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exercises added yet.</p>
      ) : (
        <ul className="space-y-4">
          {workout.exercises.map((ex) => (
            <li key={ex.workoutExerciseId}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{ex.name}</CardTitle>
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
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {ex.sets.length > 0 && (
                    <div className="space-y-1.5">
                      {ex.sets.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 text-sm">
                          <span className="font-mono text-xs text-muted-foreground w-6">{s.order + 1}.</span>
                          <span className="text-foreground">
                            {s.reps ?? '—'} reps × {s.weightKg ?? '—'} kg
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            disabled={isPending}
                            onClick={() => handleRemoveSet(s.id, ex.workoutExerciseId)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <AddSetRow
                    workoutExerciseId={ex.workoutExerciseId}
                    onAdd={() => router.refresh()}
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Create a brand-new exercise */}
      <CreateExerciseCard
        workoutId={workout.id}
        allExercises={allExercises}
        onCreated={() => router.refresh()}
      />

      {/* Done */}
      <Button onClick={() => router.push('/dashboard')} variant="default" className="gap-2">
        <Check className="size-4" />
        Done — go to Dashboard
      </Button>
    </div>
  )
}
