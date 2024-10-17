"use client"

import { useState, useEffect } from "react"
import { User as FirebaseUser } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, arrayUnion, deleteDoc, getDoc } from "firebase/firestore";
import { 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithPopup
} from "@/lib/firebase";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GoogleAuthProvider } from "firebase/auth";
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { ObligationForm } from "@/components/ObligationForm"
import { Clock, Plus, Settings, User, Trash2 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useRouter } from 'next/navigation';
import { Timestamp } from "firebase/firestore";

interface TimeEntry {
  start: Timestamp;
  end: Timestamp | null;
}

interface Obligation {
  id: string;
  obligationName: string;
  goal: number;  // in minutes
  userId: string;
  timeEntries: TimeEntry[];
  lastResetDate: Timestamp;
}

export default function Home() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null);
  const [view, setView] = useState('dashboard');
  const router = useRouter();
  const [timerStart, setTimerStart] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed", user);
      setUser(user);
      if (user) {
        fetchObligations(user.uid);
      } else {
        // Redirect to Google Sign-In if user is not logged in
        handleGoogleSignIn();
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timerStart) {
      interval = setInterval(() => {
        const now = new Date();
        setSessionTime(Math.floor((now.getTime() - timerStart.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerStart]);

  const fetchObligations = async (userId: string) => {
    try {
      const q = query(collection(db, "obligations"), where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      const fetchedObligations = await Promise.all(querySnapshot.docs.map(async doc => {
        const data = doc.data();
        const obligation = {
          id: doc.id,
          ...data,
          timeEntries: data.timeEntries.map((entry: any) => ({
            start: entry.start,
            end: entry.end
          })),
          lastResetDate: data.lastResetDate || Timestamp.fromDate(getMostRecentMonday())
        } as Obligation;
        return await checkAndResetHours(obligation);
      }));
      console.log("Fetched obligations:", fetchedObligations);
      setObligations(fetchedObligations);
    } catch (error) {
      console.error("Error fetching obligations: ", error);
      setError("Failed to fetch obligations. Please try again.");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setError("");
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setError("");
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      const result = await signInWithPopup(auth, provider);
      console.log("Google Sign-In successful", result.user);
      setError("");
      router.push('/'); // Redirect to home page after successful sign-in
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      setError(error.message);
    }
  };

  const handleSignOut = async () => {
    if (isTimerRunning) {
      await stopTimer();
    }
    try {
      await signOut(auth);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleTimerToggle = async () => {
    if (!selectedObligation) return;

    const now = new Date();
    const action = isTimerRunning ? 'stop' : 'start';

    try {
      if (action === 'start') {
        const newTimeEntry: TimeEntry = { start: Timestamp.fromDate(now), end: null };
        await updateDoc(doc(db, "obligations", selectedObligation.id), {
          timeEntries: arrayUnion(newTimeEntry)
        });
        setSelectedObligation({
          ...selectedObligation,
          timeEntries: [...selectedObligation.timeEntries, newTimeEntry]
        });
        setTimerStart(now);
      } else {
        const updatedTimeEntries = selectedObligation.timeEntries.map((entry, index) => {
          if (index === selectedObligation.timeEntries.length - 1 && entry.end === null) {
            return { ...entry, end: Timestamp.fromDate(now) };
          }
          return entry;
        });
        await updateDoc(doc(db, "obligations", selectedObligation.id), {
          timeEntries: updatedTimeEntries
        });
        setSelectedObligation({
          ...selectedObligation,
          timeEntries: updatedTimeEntries
        });
        setTimerStart(null);
        setSessionTime(0);
      }
      setIsTimerRunning(!isTimerRunning);
    } catch (error) {
      console.error("Error updating timer:", error);
      setError("Failed to update timer. Please try again.");
    }
  };

  const addObligation = async (name: string, goal: number) => {
    if (!user) return;

    const newObligation: Omit<Obligation, 'id'> = {
      obligationName: name,
      goal: goal * 60,  // Convert hours to minutes
      userId: user.uid,
      timeEntries: [],
      lastResetDate: Timestamp.fromDate(getMostRecentMonday()) // Set initial reset date to most recent Monday
    };

    try {
      const docRef = await addDoc(collection(db, "obligations"), newObligation);
      const addedObligation = { id: docRef.id, ...newObligation };
      setObligations(prevObligations => [...prevObligations, addedObligation]);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error("Error adding obligation: ", error);
      setError("Failed to add obligation. Please try again.");
    }
  };

  const editObligation = async (name: string, goal: number) => {
    if (!editingObligation || !user) return;

    const updatedObligation = {
      ...editingObligation,
      obligationName: name,
      goal: goal * 60, // Convert hours to minutes
      // Ensure timeEntries is maintained
      timeEntries: editingObligation.timeEntries || []
    };

    try {
      await updateDoc(doc(db, "obligations", editingObligation.id), updatedObligation);
      setObligations(obligations.map(ob => ob.id === editingObligation.id ? updatedObligation : ob));
      setSelectedObligation(prev => prev && prev.id === editingObligation.id ? updatedObligation : prev);
      setEditingObligation(null);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating obligation: ", error);
    }
  };

  const selectObligation = async (obligation: Obligation) => {
    if (isTimerRunning) {
      await stopTimer();
    }
    try {
      const docRef = doc(db, "obligations", obligation.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        let updatedObligation = {
          ...obligation,
          timeEntries: data.timeEntries.map((entry: any) => ({
            start: entry.start,
            end: entry.end
          })),
          lastResetDate: data.lastResetDate || Timestamp.fromDate(new Date())
        };
        updatedObligation = await checkAndResetHours(updatedObligation);
        setSelectedObligation(updatedObligation);
        setView('obligation');
      } else {
        console.log("No such document!");
      }
    } catch (error) {
      console.error("Error fetching obligation: ", error);
      setError("Failed to fetch obligation details. Please try again.");
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const resetView = async () => {
    if (isTimerRunning) {
      await stopTimer();
    }
    setSelectedObligation(null);
    setView('dashboard');
  };

  const generateWeeklyData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const currentDay = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - currentDay);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return days.map((day, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const dayData: { [key: string]: string | number } = { name: day };
      
      obligations.forEach(obligation => {
        const timeSpentMs = obligation.timeEntries
          ? obligation.timeEntries
              .filter(entry => {
                const entryDate = entry.start.toDate();
                return entryDate >= weekStart && entryDate < weekEnd;
              })
              .reduce((sum, entry) => {
                const startTime = entry.start.toDate();
                const endTime = entry.end ? entry.end.toDate() : new Date();
                const duration = endTime.getTime() - startTime.getTime();
                return sum + (startTime.toDateString() === date.toDateString() ? duration : 0);
              }, 0)
          : 0;
        dayData[obligation.obligationName] = timeSpentMs / (1000 * 60 * 60); // Convert to hours
      });
      return dayData;
    });
  };

  const generateChartConfig = () => {
    const colors = [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
      "hsl(var(--chart-6))",
    ];
    return obligations.reduce((config: Record<string, any>, obligation, index) => {
      config[obligation.obligationName] = {
        label: obligation.obligationName,
        color: colors[index % colors.length],
      };
      return config;
    }, {});
  };

  const calculateTotalTime = (timeEntries: TimeEntry[] | undefined): number => {
    if (!timeEntries || !Array.isArray(timeEntries)) {
      return 0;
    }
    return timeEntries.reduce((total, entry) => {
      const end = entry.end || Timestamp.now();
      return total + (end.toMillis() - entry.start.toMillis()) / 60000; // Convert to minutes
    }, 0);
  };

  const deleteObligation = async (obligationId: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, "obligations", obligationId));
      setObligations(prevObligations => prevObligations.filter(ob => ob.id !== obligationId));
      if (selectedObligation?.id === obligationId) {
        setSelectedObligation(null);
        setView('dashboard');
      }
    } catch (error) {
      console.error("Error deleting obligation: ", error);
      setError("Failed to delete obligation. Please try again.");
    }
  };

  // Add this helper function to format duration
  const formatDuration = (durationInMillis: number) => {
    const hours = Math.floor(durationInMillis / (1000 * 60 * 60));
    const minutes = Math.floor((durationInMillis % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationInMillis % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const stopTimer = async () => {
    if (!selectedObligation || !isTimerRunning) return;

    const now = new Date();
    try {
      const updatedTimeEntries = selectedObligation.timeEntries.map((entry, index) => {
        if (index === selectedObligation.timeEntries.length - 1 && entry.end === null) {
          return { ...entry, end: Timestamp.fromDate(now) };
        }
        return entry;
      });
      await updateDoc(doc(db, "obligations", selectedObligation.id), {
        timeEntries: updatedTimeEntries
      });
      setSelectedObligation({
        ...selectedObligation,
        timeEntries: updatedTimeEntries
      });
      setTimerStart(null);
      setSessionTime(0);
      setIsTimerRunning(false);
    } catch (error) {
      console.error("Error stopping timer:", error);
      setError("Failed to stop timer. Please try again.");
    }
  };

  const checkAndResetHours = async (obligation: Obligation) => {
    const now = new Date();
    const lastReset = obligation.lastResetDate.toDate();
    const nextResetDate = new Date(lastReset);
    nextResetDate.setDate(nextResetDate.getDate() + 7); // Next reset should be 7 days after the last reset

    if (now >= nextResetDate) {
      const newResetDate = getMostRecentMonday();

      const updatedObligation = {
        ...obligation,
        timeEntries: [],
        lastResetDate: Timestamp.fromDate(newResetDate)
      };

      try {
        await updateDoc(doc(db, "obligations", obligation.id), updatedObligation);
        return updatedObligation;
      } catch (error) {
        console.error("Error resetting hours:", error);
        return obligation;
      }
    }

    return obligation;
  };

  const getMostRecentMonday = () => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() + 6) % 7);
    monday.setHours(0, 1, 0, 0); // Set to 12:01 AM
    return monday;
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {user ? (
        <>
          <aside className="w-64 bg-white shadow-md">
            <div className="p-4">
              <Button className="w-full" variant="outline" size="sm" onClick={() => setIsAddModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Obligation
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-8rem)]">
              <div className="space-y-2 p-4">
                {obligations.map((obligation) => (
                  <Button
                    key={obligation.id}
                    variant={selectedObligation?.id === obligation.id ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => selectObligation(obligation)}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {obligation.obligationName}
                    <span className="ml-auto">
                      {obligation.timeEntries && Array.isArray(obligation.timeEntries)
                        ? Math.floor(obligation.timeEntries.reduce((sum, entry) => {
                            const duration = entry.end 
                              ? (entry.end.toMillis() - entry.start.toMillis()) / (1000 * 60 * 60) 
                              : 0;
                            return sum + duration;
                          }, 0))
                        : 0}h
                    </span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
            <div className="absolute bottom-4 left-4">
              <Button variant="ghost" size="icon" onClick={resetView}>
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </aside>
          <div className="flex flex-1 flex-col">
            <header className="flex h-16 items-center justify-between bg-white px-6 shadow-sm">
              <h1 className="text-2xl font-bold cursor-pointer" onClick={resetView}>Tickr</h1>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <User className="h-5 w-5" />
              </Button>
            </header>
            <main className="flex-1 overflow-auto p-6">
              {view === 'dashboard' ? (
                <div className="space-y-6">
                  <h2 className="text-3xl font-bold">Dashboard</h2>
                  <div className="rounded-lg bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-xl font-semibold">Weekly Overview</h3>
                    <p className="mb-2 text-sm text-gray-500">
                      {new Date(new Date().setDate(new Date().getDate() - new Date().getDay())).toLocaleDateString()} 
                      - 
                      {new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 6)).toLocaleDateString()}
                    </p>
                    <ChartContainer
                      config={generateChartConfig()}
                      className="h-[300px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={generateWeeklyData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis 
                            tickFormatter={(value) => `${Math.floor(value)}h`} 
                            label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                            domain={[0, 8]}  // Set the domain from 0 to 8 hours
                            ticks={[0, 2, 4, 6, 8]}  // Specify the ticks we want to see
                          />
                          <ChartTooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white p-2 border border-gray-300 rounded shadow">
                                    <p className="font-bold">{label}</p>
                                    {payload.map((entry: any, index: number) => (
                                      <p key={index} style={{ color: entry.color }}>
                                        {entry.name}: {Number(entry.value).toFixed(2)} hours
                                      </p>
                                    ))}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          {obligations.map((obligation) => (
                            <Bar 
                              key={obligation.id}
                              dataKey={obligation.obligationName}
                              stackId="a"
                              fill={`var(--color-${obligation.obligationName.replace(/\s+/g, '-')})`}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                      <h3 className="mb-2 text-xl font-semibold">Total Time Tracked</h3>
                      <p className="text-3xl font-bold">
                        {obligations.reduce((sum, ob) => sum + calculateTotalTime(ob.timeEntries) / 60, 0).toFixed(2)} hours
                      </p>
                      <p className="text-sm text-gray-500">this week</p>
                    </div>
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                      <h3 className="mb-2 text-xl font-semibold">Active Obligations</h3>
                      <p className="text-3xl font-bold">{obligations.length}</p>
                    </div>
                  </div>
                </div>
              ) : selectedObligation && view === 'obligation' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold">{selectedObligation.obligationName}</h2>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteObligation(selectedObligation.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="relative h-64 w-64 rounded-full border-8 border-gray-200">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-4xl font-bold">{formatTime(sessionTime)}</div>
                          <div className="text-sm text-gray-500">current session</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Button size="lg" onClick={handleTimerToggle}>
                      {isTimerRunning ? "Stop" : "Start"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Goal: {selectedObligation.goal / 60} hours/week</span>
                      <span>
                        {(calculateTotalTime(selectedObligation.timeEntries) / 60).toFixed(2)}/{selectedObligation.goal / 60} hours
                      </span>
                    </div>
                    <Progress value={(calculateTotalTime(selectedObligation.timeEntries) / selectedObligation.goal) * 100} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-semibold">Recent Time Entries</h3>
                    <div className="space-y-2">
                      {selectedObligation.timeEntries && selectedObligation.timeEntries.length > 0 ? (
                        selectedObligation.timeEntries
                          .filter(entry => entry.end !== null)
                          .sort((a, b) => b.end!.toMillis() - a.end!.toMillis()) // Sort by end time, most recent first
                          .slice(0, 3) // Take the 3 most recent entries
                          .map((entry, i) => (
                            <div key={i} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
                              <div className="flex items-center">
                                <Clock className="mr-2 h-4 w-4 text-gray-500" />
                                <span>{formatDuration(entry.end!.toMillis() - entry.start.toMillis())}</span>
                              </div>
                              <span className="text-sm text-gray-500">
                                {entry.start.toDate().toLocaleDateString()} {entry.start.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          ))
                      ) : (
                        <p>No completed time entries yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </main>
          </div>
          {isAddModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg w-96">
                <h2 className="text-2xl font-bold mb-4">Add New Obligation</h2>
                <ObligationForm
                  onSubmit={addObligation}
                  onCancel={() => setIsAddModalOpen(false)}
                />
              </div>
            </div>
          )}
          {isEditModalOpen && editingObligation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg w-96">
                <h2 className="text-2xl font-bold mb-4">Edit Obligation</h2>
                <ObligationForm
                  onSubmit={editObligation}
                  onCancel={() => setIsEditModalOpen(false)}
                  initialName={editingObligation.obligationName}
                  initialGoal={editingObligation.goal / 60} // Convert minutes back to hours
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full flex items-center justify-center">
          <div className="w-96 space-y-4">
            <h2 className="text-2xl font-bold mb-4">Sign In or Sign Up</h2>
            <form onSubmit={handleSignIn} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full">Sign In</Button>
            </form>
            <Button onClick={handleSignUp} className="w-full">Sign Up</Button>
            <Button onClick={handleGoogleSignIn} className="w-full">Sign In with Google</Button>
            {error && <p className="text-red-500 mt-4">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}