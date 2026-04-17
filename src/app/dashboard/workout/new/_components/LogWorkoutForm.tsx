'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { logWorkoutAction, createExerciseAction } from '../actions'
import type { Exercise } from '@/src/db/schema'

interface SetEntry {
  id: string
  reps: string
  weightKg: string
}

interface ExerciseEntry {
  id: string
  exerciseId: string
  name: string
  sets: SetEntry[]
}

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function newSet(): SetEntry {
  return { id: crypto.randomUUID(), reps: '', weightKg: '' }
}

export default function LogWorkoutForm({ allExercises }: { allExercises: Exercise[] }) {
  const router = useRouter()

  const [name, setName] = useState('')
  const [date, setDate] = useState(todayString)
  const [startTime, setStartTime] = useState('')
  const [addedExercises, setAddedExercises] = useState<ExerciseEntry[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [newExName, setNewExName] = useState('')
  const [localExercises, setLocalExercises] = useState<Exercise[]>(allExercises)
  const [error, setError] = useState<string | null>(null)
  const [createExError, setCreateExError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const usedIds = new Set(addedExercises.map((e) => e.exerciseId))
  const availableExercises = localExercises.filter((e) => !usedIds.has(e.id))

  function addExerciseFromLibrary() {
    if (!selectedExerciseId) return
    const ex = localExercises.find((e) => e.id === selectedExerciseId)
    if (!ex) return
    setAddedExercises((prev) => [
      ...prev,
      { id: crypto.randomUUID(), exerciseId: ex.id, name: ex.name, sets: [newSet()] },
    ])
    setSelectedExerciseId('')
  }

  function removeExercise(id: string) {
    setAddedExercises((prev) => prev.filter((e) => e.id !== id))
  }

  function addSet(exerciseId: string) {
    setAddedExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, sets: [...e.sets, newSet()] } : e)),
    )
  }

  function removeSet(exerciseId: string, setId: string) {
    setAddedExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e,
      ),
    )
  }

  function updateSet(exerciseId: string, setId: string, field: 'reps' | 'weightKg', value: string) {
    setAddedExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)) }
          : e,
      ),
    )
  }

  function handleCreateAndAdd() {
    const trimmed = newExName.trim()
    if (!trimmed) return
    setCreateExError(null)
    startTransition(async () => {
      try {
        const created = await createExerciseAction({ name: trimmed })
        setLocalExercises((prev) => [...prev, created])
        setAddedExercises((prev) => [
          ...prev,
          { id: crypto.randomUUID(), exerciseId: created.id, name: created.name, sets: [newSet()] },
        ])
        setNewExName('')
      } catch (err) {
        setCreateExError(err instanceof Error ? err.message : 'Failed to create exercise')
      }
    })
  }

  function handleSubmit() {
    if (!name.trim()) {
      setError('Workout name is required')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const workout = await logWorkoutAction({
          name: name.trim(),
          date,
          startTime: startTime || undefined,
          exercises: addedExercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: e.sets.map((s) => ({
              reps: s.reps ? Number(s.reps) : null,
              weightKg: s.weightKg || null,
            })),
          })),
        })
        router.push(`/dashboard/workout/${workout.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to log workout')
      }
    })
  }

  return (
    <div className="w-full space-y-6">

      {/* ── Workout details ───────────────────────────────── */}
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Workout Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Workout name</Label>
            <Input
              id="name"
              placeholder="e.g. Push Day"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Start time (optional)</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Exercises ────────────────────────────────────── */}
      <section className="w-full max-w-2xl space-y-4">
        <h2 className="text-lg font-semibold">Exercises</h2>

        {addedExercises.length === 0 && (
          <p className="text-sm text-muted-foreground">No exercises added yet.</p>
        )}

        {addedExercises.map((ex) => (
          <Card key={ex.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{ex.name}</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeExercise(ex.id)}
                  disabled={isPending}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-2">
              {/* Column headers */}
              <div className="grid grid-cols-[1.5rem_1fr_1fr_2rem] gap-2 px-1 text-xs text-muted-foreground font-medium">
                <span>#</span>
                <span>Reps</span>
                <span>kg</span>
                <span />
              </div>

              {ex.sets.map((s, idx) => (
                <div key={s.id} className="grid grid-cols-[1.5rem_1fr_1fr_2rem] gap-2 items-center">
                  <span className="text-xs text-muted-foreground font-mono text-center">
                    {idx + 1}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    placeholder="10"
                    value={s.reps}
                    onChange={(e) => updateSet(ex.id, s.id, 'reps', e.target.value)}
                    disabled={isPending}
                    className="h-8 text-sm"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="80"
                    value={s.weightKg}
                    onChange={(e) => updateSet(ex.id, s.id, 'weightKg', e.target.value)}
                    disabled={isPending}
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSet(ex.id, s.id)}
                    disabled={isPending || ex.sets.length <= 1}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSet(ex.id)}
                disabled={isPending}
                className="mt-1"
              >
                <Plus className="size-3 mr-1" />
                Add Set
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* ── Add from library ─────────────────────── */}
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-base">Add Exercise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableExercises.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={selectedExerciseId}
                  onChange={(e) => setSelectedExerciseId(e.target.value)}
                  disabled={isPending}
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select an exercise…</option>
                  {availableExercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={addExerciseFromLibrary}
                  disabled={!selectedExerciseId || isPending}
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All library exercises added.</p>
            )}

            {/* Create new exercise */}
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Or create new
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Bulgarian Split Squat"
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
                  disabled={isPending}
                  className="h-9 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCreateAndAdd}
                  disabled={!newExName.trim() || isPending}
                >
                  Create & Add
                </Button>
              </div>
              {createExError && <p className="text-sm text-destructive">{createExError}</p>}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Submit ───────────────────────────────────────── */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button
          type="button"
          size="lg"
          onClick={handleSubmit}
          disabled={!name.trim() || !date || isPending}
        >
          <Save className="size-4" />
          {isPending ? 'Saving…' : 'Save Workout'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
