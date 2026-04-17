import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/src/db';
import { exercises } from '@/src/db/schema';
import { eq, ilike } from 'drizzle-orm';

// GET /api/exercises - Get all exercises or search by name
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const query = search
      ? db.select().from(exercises).where(ilike(exercises.name, `%${search}%`))
      : db.select().from(exercises);

    const exercisesList = await query.orderBy(exercises.name);

    return NextResponse.json({ exercises: exercisesList });
  } catch (error) {
    console.error('Error fetching exercises:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/exercises - Create a new exercise
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Exercise name is required' }, { status: 400 });
    }

    // Check if exercise already exists
    const existingExercise = await db
      .select()
      .from(exercises)
      .where(eq(exercises.name, name.trim()))
      .limit(1);

    if (existingExercise.length > 0) {
      return NextResponse.json({ error: 'Exercise already exists' }, { status: 409 });
    }

    const [newExercise] = await db
      .insert(exercises)
      .values({ name: name.trim() })
      .returning();

    return NextResponse.json({ exercise: newExercise }, { status: 201 });
  } catch (error) {
    console.error('Error creating exercise:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}