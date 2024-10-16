import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const updatedObligation = await request.json();

  const obligationRef = doc(db, 'obligations', id);
  const obligationSnap = await getDoc(obligationRef);

  if (obligationSnap.exists()) {
    await updateDoc(obligationRef, updatedObligation);
    return NextResponse.json({ id, ...updatedObligation });
  }

  return NextResponse.json({ error: 'Obligation not found' }, { status: 404 });
}
