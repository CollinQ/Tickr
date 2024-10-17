import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, where, Timestamp } from 'firebase/firestore';

interface TimeEntry {
  start: Timestamp;
  end: Timestamp | null;
}

interface Obligation {
  id: string;
  obligationName: string;
  goal: number;
  userId: string;
  timeEntries: TimeEntry[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    const obligationsRef = collection(db, 'obligations');
    const q = query(obligationsRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const obligations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Obligation));

    return NextResponse.json(obligations);
  } catch (error) {
    console.error("Error fetching obligations:", error);
    return NextResponse.json({ error: 'Failed to fetch obligations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newObligation = await request.json();
    newObligation.timeEntries = [];  // Ensure timeEntries is initialized
    newObligation.goal = newObligation.goal * 60; // Convert hours to minutes

    const docRef = await addDoc(collection(db, 'obligations'), newObligation);
    return NextResponse.json({ id: docRef.id, ...newObligation }, { status: 201 });
  } catch (error) {
    console.error("Error adding obligation:", error);
    return NextResponse.json({ error: 'Failed to add obligation' }, { status: 500 });
  }
}
