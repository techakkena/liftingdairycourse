import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// exercises — reusable exercise library
// ---------------------------------------------------------------------------

export const exercises = pgTable(
  'exercises',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    name:      varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('exercises_name_unique_idx').on(t.name),
  ],
);

export type Exercise    = InferSelectModel<typeof exercises>;
export type NewExercise = InferInsertModel<typeof exercises>;

// ---------------------------------------------------------------------------
// workouts — one session per user (Clerk user_id)
// ---------------------------------------------------------------------------

export const workouts = pgTable(
  'workouts',
  {
    id:          uuid('id').primaryKey().defaultRandom(),
    userId:      text('user_id').notNull(),
    name:        varchar('name', { length: 255 }).notNull(),
    startedAt:   timestamp('started_at',   { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt:   timestamp('created_at',   { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp('updated_at',   { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('workouts_user_id_idx').on(t.userId),
  ],
);

export type Workout    = InferSelectModel<typeof workouts>;
export type NewWorkout = InferInsertModel<typeof workouts>;

// ---------------------------------------------------------------------------
// workout_exercises — ordered exercises within a workout
// ---------------------------------------------------------------------------

export const workoutExercises = pgTable(
  'workout_exercises',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    workoutId:  uuid('workout_id').notNull().references(() => workouts.id,   { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'restrict' }),
    order:      integer('order').notNull(),
    createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('workout_exercises_workout_id_idx').on(t.workoutId),
    index('workout_exercises_exercise_id_idx').on(t.exerciseId),
    uniqueIndex('workout_exercises_workout_order_unique_idx').on(t.workoutId, t.order),
  ],
);

export type WorkoutExercise    = InferSelectModel<typeof workoutExercises>;
export type NewWorkoutExercise = InferInsertModel<typeof workoutExercises>;

// ---------------------------------------------------------------------------
// sets — individual sets within a workout_exercise
// ---------------------------------------------------------------------------

export const sets = pgTable(
  'sets',
  {
    id:                uuid('id').primaryKey().defaultRandom(),
    workoutExerciseId: uuid('workout_exercise_id').notNull().references(() => workoutExercises.id, { onDelete: 'cascade' }),
    orderIndex:        integer('order_index').notNull(),
    reps:              integer('reps'),
    weightKg:          numeric('weight_kg', { precision: 8, scale: 3 }),
    createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sets_workout_exercise_id_idx').on(t.workoutExerciseId),
    uniqueIndex('sets_workout_exercise_order_unique_idx').on(t.workoutExerciseId, t.orderIndex),
  ],
);

export type WorkoutSet    = InferSelectModel<typeof sets>;
export type NewWorkoutSet = InferInsertModel<typeof sets>;

// ---------------------------------------------------------------------------
// Relations — for db.query.* relational API (TypeScript only, no DDL)
// ---------------------------------------------------------------------------

export const exercisesRelations = relations(exercises, ({ many }) => ({
  workoutExercises: many(workoutExercises),
}));

export const workoutsRelations = relations(workouts, ({ many }) => ({
  workoutExercises: many(workoutExercises),
}));

export const workoutExercisesRelations = relations(workoutExercises, ({ one, many }) => ({
  workout:  one(workouts,   { fields: [workoutExercises.workoutId],  references: [workouts.id] }),
  exercise: one(exercises,  { fields: [workoutExercises.exerciseId], references: [exercises.id] }),
  sets:     many(sets),
}));

export const setsRelations = relations(sets, ({ one }) => ({
  workoutExercise: one(workoutExercises, {
    fields:     [sets.workoutExerciseId],
    references: [workoutExercises.id],
  }),
}));
