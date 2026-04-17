import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/src/db';
import { workouts, workoutExercises, exercises, sets } from '@/src/db/schema';
import { and, eq, gte, lt, desc } from 'drizzle-orm';

// GET /api/workouts - Get workouts for a specific date or all workouts
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    // Build where condition first
    let whereCondition: any;
    if (date) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T00:00:00.000Z`);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      whereCondition = and(
        eq(workouts.userId, userId),
        gte(workouts.createdAt, dayStart),
        lt(workouts.createdAt, dayEnd),
      );
    } else {
      whereCondition = eq(workouts.userId, userId);
    }

    const query = db
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
      .where(whereCondition);

    const rows = await query
      .orderBy(desc(workouts.createdAt), workoutExercises.order, sets.orderIndex);

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

    const workoutsData = Array.from(workoutMap.values());

    return NextResponse.json({ workouts: workoutsData });
  } catch (error) {
    console.error('Error fetching workouts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/workouts - Create a new workout
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, exercises: workoutExercisesData } = body;

    if (!name || !workoutExercisesData || !Array.isArray(workoutExercisesData)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Start a transaction to create workout with exercises and sets
    const result = await db.transaction(async (tx) => {
      // Create the workout
      const [newWorkout] = await tx
        .insert(workouts)
        .values({
          userId,
          name,
          startedAt: new Date(),
        })
        .returning();

      // Create exercises and sets
      for (let i = 0; i < workoutExercisesData.length; i++) {
        const exerciseData = workoutExercisesData[i];
        const exercise = await tx
          .select()
          .from(exercises)
          .where(eq(exercises.name, exerciseData.name))
          .limit(1);

        let exerciseId: string;
        if (exercise.length > 0) {
          exerciseId = exercise[0].id;
        } else {
          // Create new exercise if it doesn't exist
          const [newExercise] = await tx
            .insert(exercises)
            .values({ name: exerciseData.name })
            .returning();
          exerciseId = newExercise.id;
        }

        // Create workout exercise
        const [newWorkoutExercise] = await tx
          .insert(workoutExercises)
          .values({
            workoutId: newWorkout.id,
            exerciseId,
            order: i,
          })
          .returning();

        // Create sets
        if (exerciseData.sets && Array.isArray(exerciseData.sets)) {
          for (let j = 0; j < exerciseData.sets.length; j++) {
            const setData = exerciseData.sets[j];
            await tx.insert(sets).values({
              workoutExerciseId: newWorkoutExercise.id,
              orderIndex: j,
              reps: setData.reps,
              weightKg: setData.weightKg,
            });
          }
        }
      }

      return newWorkout;
    });

    return NextResponse.json({ workout: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating workout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}