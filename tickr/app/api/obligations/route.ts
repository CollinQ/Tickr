import { NextResponse } from 'next/server';

let obligations = [
  { id: 1, name: "Part-time Internship", icon: "Briefcase", timeSpent: 15, goal: 20 },
  { id: 2, name: "Study", icon: "BookOpen", timeSpent: 10, goal: 15 },
  { id: 3, name: "Exercise", icon: "Dumbbell", timeSpent: 3, goal: 5 },
  { id: 4, name: "Personal Project", icon: "PenTool", timeSpent: 8, goal: 10 },
];

export async function GET() {
  return NextResponse.json(obligations);
}

export async function POST(request: Request) {
  const newObligation = await request.json();
  newObligation.id = obligations.length + 1;
  obligations.push(newObligation);
  return NextResponse.json(newObligation, { status: 201 });
}
