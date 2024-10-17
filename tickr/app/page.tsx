"use client"

import { useState, useEffect, useCallback } from "react"
import { User as FirebaseUser } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, arrayUnion, deleteDoc, getDoc } from "firebase/firestore";
import { 
  auth, 
  db, 
  signOut, 
  onAuthStateChanged,
  signInWithPopup
} from "@/lib/firebase";
import { Button } from "@/components/ui/button"
import { GoogleAuthProvider } from "firebase/auth";
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { ObligationForm } from "@/components/ObligationForm"
import { Clock, Plus, Settings, Trash2, LogOut } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, TooltipProps } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { useRouter } from 'next/navigation';
import { Timestamp } from "firebase/firestore";
import { FirebaseError } from 'firebase/app';

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

interface FirestoreTimeEntry {
  start: Timestamp;
  end: Timestamp | null;
}

interface FirestoreObligation {
  obligationName: string;
  goal: number;
  userId: string;
  timeEntries: FirestoreTimeEntry[];
  lastResetDate: Timestamp;
}

// Add this near the top of your file, with other interfaces
interface CustomError {
  message: string;
}

export default function Home() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingObligation, setEditingObligation] = useState<Obligation | null>(null);
  const [view, setView] = useState('dashboard');
  const router = useRouter();
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [timerProgress, setTimerProgress] = useState(0);

  const getMostRecentMonday = useCallback(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() + 6) % 7);
    monday.setHours(0, 1, 0, 0); // Set to 12:01 AM
    return monday;
  }, []);

  const checkAndResetHours = useCallback(async (obligation: Obligation) => {
    const now = new Date();
    const lastReset = obligation.lastResetDate.toDate();
    const nextResetDate = new Date(lastReset);
    nextResetDate.setDate(nextResetDate.getDate() + 7);

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
  }, [getMostRecentMonday]);

  const fetchObligations = useCallback(async (userId: string) => {
    try {
      const q = query(collection(db, "obligations"), where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      const fetchedObligations = await Promise.all(querySnapshot.docs.map(async doc => {
        const data = doc.data() as FirestoreObligation | undefined;
        if (!data) {
          throw new Error(`No data found for obligation with ID: ${doc.id}`);
        }
        const obligation: Obligation = {
          id: doc.id,
          ...data,
          timeEntries: data.timeEntries.map((entry: FirestoreTimeEntry) => ({
            start: entry.start,
            end: entry.end
          })),
          lastResetDate: data.lastResetDate || Timestamp.fromDate(getMostRecentMonday())
        };
        return await checkAndResetHours(obligation);
      }));
      console.log("Fetched obligations:", fetchedObligations);
      setObligations(fetchedObligations);
    } catch (error) {
      console.error("Error fetching obligations: ", error);
      setError("Failed to fetch obligations. Please try again.");
    }
  }, [checkAndResetHours]); // Add checkAndResetHours to the dependency array

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      const result = await signInWithPopup(auth, provider);
      console.log("Google Sign-In successful", result.user);
      setError("");
      router.push('/'); // Redirect to home page after successful sign-in
    } catch (error: unknown) {
      console.error("Google Sign-In Error:", error);
      if (error instanceof FirebaseError || (error as CustomError).message) {
        setError((error as CustomError).message);
      } else {
        setError("An unknown error occurred");
      }
    }
  }, [router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed", user);
      setUser(user);
      if (user) {
        fetchObligations(user.uid);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [fetchObligations]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timerStart) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsedSeconds = Math.floor((now.getTime() - timerStart.getTime()) / 1000);
        setSessionTime(elapsedSeconds);
        setTimerProgress((elapsedSeconds % 60) / 60);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerStart]);

  const handleSignOut = async () => {
    if (isTimerRunning) {
      await stopTimer();
    }
    try {
      await signOut(auth);
    } catch (error: unknown) {
      if (error instanceof FirebaseError || (error as CustomError).message) {
        setError((error as CustomError).message);
      } else {
        setError("An unknown error occurred during sign out");
      }
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
      setError("Failed to update obligation. Please try again.");
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
          timeEntries: data.timeEntries.map((entry: TimeEntry) => ({
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
              .filter((entry: TimeEntry) => {
                const entryDate = entry.start.toDate();
                return entryDate >= weekStart && entryDate < weekEnd;
              })
              .reduce((sum: number, entry: TimeEntry) => {
                const startTime = entry.start.toDate();
                const endTime = entry.end ? entry.end.toDate() : new Date();
                const duration = endTime.getTime() - startTime.getTime();
                return sum + (startTime.toDateString() === date.toDateString() ? duration : 0);
              }, 0)
          : 0;
        dayData[obligation.obligationName] = timeSpentMs / (1000 * 60 * 60);
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
    return obligations.reduce((config: Record<string, { label: string; color: string }>, obligation, index) => {
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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-background">
      {user ? (
        <>
          <aside className="w-64 bg-card shadow-md">
            <div className="p-4">
              <Button 
                className="w-full" 
                variant="primary" 
                size="sm" 
                onClick={() => setIsAddModalOpen(true)}
              >
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
            <header className="flex h-16 items-center justify-between bg-card px-6 shadow-sm">
              <h1 className="text-2xl font-bold cursor-pointer text-foreground" onClick={resetView}>Tickr</h1>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-5 w-5" />
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
                          <Tooltip 
                            content={(props: TooltipProps<number, string>) => {
                              const { active, payload, label } = props;
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white p-2 border border-gray-300 rounded shadow">
                                    <p className="font-bold">{label}</p>
                                    {payload.map((entry, index) => (
                                      <p key={index} style={{ color: entry.color }}>
                                        {entry.name}: {entry.value?.toFixed(2)} hours
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
                    <div className="flex space-x-2"> {/* Added flex and space-x-2 for button alignment */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingObligation(selectedObligation);
                          setIsEditModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteObligation(selectedObligation.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="relative h-64 w-64">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        {/* Background circle */}
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="#e6e6e6"
                          strokeWidth="10"
                        />
                        {/* Progress circle */}
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="10"
                          strokeDasharray={`${2 * Math.PI * 45}`}
                          strokeDashoffset={`${2 * Math.PI * 45 * (1 - timerProgress)}`}
                          className="transition-all duration-1000 ease-linear"
                        />
                      </svg>
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
        <div className="w-full flex items-center justify-center bg-background">
          <div className="w-96 space-y-4">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Welcome to Tickr</h2>
            <Button onClick={handleGoogleSignIn} className="w-full flex items-center justify-center" variant="primary">
              <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign In with Google
            </Button>
            {error && <p className="text-destructive mt-4">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}