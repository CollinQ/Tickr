import { NextResponse } from 'next/server';

let timerState = {
  isRunning: false,
  obligationId: null,
  startTime: null,
};

export async function POST(request: Request) {
  const { action, obligationId } = await request.json();

  if (action === 'start') {
    timerState = {
      isRunning: true,
      obligationId,
      startTime: Date.now(),
    };
  } else if (action === 'stop') {
    if (timerState.isRunning && timerState.obligationId === obligationId) {
      const duration = (Date.now() - timerState.startTime) / 1000 / 60 / 60; // Convert to hours
      timerState = {
        isRunning: false,
        obligationId: null,
        startTime: null,
      };
      return NextResponse.json({ duration });
    }
  }

  return NextResponse.json(timerState);
}
