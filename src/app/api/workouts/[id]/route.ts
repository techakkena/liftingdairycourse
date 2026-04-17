import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/src/db';
import { workouts, workoutExercises, exercises, sets } from '@/src/db/schema';
import { and, eq } from 'drizzle-orm';

// GET /api/workouts/[id] - Get a specific workout
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const rows = await db
      .select({
        workoutId: workouts.id,
        workoutName: workouts.name,
        startedAt: workouts.startedAt,
        completedAt: workouts.completedAt,
        exerciseName: exercises.name,
        exerciseOrder: workoutExercises.order,
        setOrder: sets.orderIndex,
        reps: sets.reps,
        weightKg: sets.weightKg,
      })
      .from(workouts)
      .leftJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
      .leftJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
      .leftJoin(sets, eq(sets.workoutExerciseId, workoutExercises.id))
      .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
      .orderBy(workoutExercises.order, sets.orderIndex);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    // Group rows into nested structure
    const workoutMap = new Map();

    for (const row of rows) {
      if (!row.workoutId) continue;

      let workout = workoutMap.get(row.workoutId);
      if (!workout) {
        workout = {
          id: row.workoutId,
          name: row.workoutName,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          exercises: [],
        };
        workoutMap.set(row.workoutId, workout);
      }

      if (row.exerciseName) {
        let exercise = workout.exercises.find((ex: any) => ex.name === row.exerciseName);
        if (!exercise) {
          exercise = {
            name: row.exerciseName,
            sets: [],
          };
          workout.exercises.push(exercise);
        }

        if (row.setOrder !== null && row.setOrder !== undefined) {
          exercise.sets.push({
            order: row.setOrder,
            reps: row.reps,
            weightKg: row.weightKg,
          });
        }
      }
    }

    // Sort exercises and sets
    for (const workout of workoutMap.values()) {
      workout.exercises.sort((a: any, b: any) => {
        const aRow = rows.find(r => r.workoutId === workout.id && r.exerciseName === a.name);
        const bRow = rows.find(r => r.workoutId === workout.id && r.exerciseName === b.name);
        const aOrder = aRow?.exerciseOrder ?? 0;
        const bOrder = bRow?.exerciseOrder ?? 0;
        return aOrder - bOrder;
      });

      for (const exercise of workout.exercises) {
        exercise.sets.sort((a: any, b: any) => a.order - b.order);
      }
    }

    const workout = Array.from(workoutMap.values())[0];

    return NextResponse.json({ workout });
  } catch (error) {
    console.error('Error fetching workout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/workouts/[id] - Update a workout (mark as completed)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { completedAt } = body;

    const [updatedWorkout] = await db
      .update(workouts)
      .set({
        completedAt: completedAt ? new Date(completedAt) : new Date(),
      })
      .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
      .returning();

    if (!updatedWorkout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    return NextResponse.json({ workout: updatedWorkout });
  } catch (error) {
    console.error('Error updating workout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/workouts/[id] - Delete a workout
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if workout exists and belongs to user
    const existingWorkout = await db
      .select()
      .from(workouts)
      .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
      .limit(1);

    if (existingWorkout.length === 0) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    // Delete workout (cascade will handle related records)
    await db.delete(workouts).where(eq(workouts.id, id));

    return NextResponse.json({ message: 'Workout deleted successfully' });
  } catch (error) {
    console.error('Error deleting workout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}