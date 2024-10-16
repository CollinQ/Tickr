import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  const { action, obligationId } = await request.json();
  const user = auth.currentUser;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const obligationRef = doc(db, 'obligations', obligationId);
  const obligationSnap = await getDoc(obligationRef);

  if (!obligationSnap.exists()) {
    return NextResponse.json({ error: 'Obligation not found' }, { status: 404 });
  }

  const obligation = obligationSnap.data();

  if (obligation.user_id !== user.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (action === 'start') {
    await updateDoc(obligationRef, { timerStartTime: Date.now() });
  } else if (action === 'stop') {
    if (obligation.timerStartTime) {
      const duration = (Date.now() - obligation.timerStartTime) / 1000 / 60 / 60; // Convert to hours
      const newTimeEntry = { date: new Date().toISOString().split('T')[0], duration };
      await updateDoc(obligationRef, { 
        timerStartTime: null,
        timeEntries: [...(obligation.timeEntries || []), newTimeEntry]
      });
      return NextResponse.json({ duration });
    }
  }

  return NextResponse.json({ success: true });
}
