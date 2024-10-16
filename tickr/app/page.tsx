"use client"

import { useState, useEffect } from "react"
import { User as FirebaseUser } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
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
import { Clock, Plus, Settings, User } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useRouter } from 'next/navigation';

interface TimeEntry {
  date: string;
  duration: number;
}

interface Obligation {
  id: string;
  name: string;
  icon: string;
  timeEntries: TimeEntry[];
  goal: number;
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
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSessionTime((prevTime) => prevTime + 1);
      }, 1000);
    } else if (!isTimerRunning && sessionTime !== 0) {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, sessionTime]);

  const fetchObligations = async (userId: string) => {
    try {
      const q = query(collection(db, "obligations"), where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      const fetchedObligations = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Obligation));
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
    try {
      await signOut(auth);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleTimerToggle = async () => {
    if (!selectedObligation) return;

    const action = isTimerRunning ? 'stop' : 'start';
    const response = await fetch('/api/timer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, obligationId: selectedObligation.id }),
    });
    const data = await response.json();

    if (action === 'stop' && data.duration) {
      const sessionHours = sessionTime / 3600;
      const updatedObligations = obligations.map(ob =>
        ob.id === selectedObligation.id
          ? { 
              ...ob, 
              timeEntries: [
                ...ob.timeEntries, 
                { date: new Date().toISOString().split('T')[0], duration: sessionHours }
              ]
            }
          : ob
      );
      setObligations(updatedObligations);
      setSelectedObligation({ 
        ...selectedObligation, 
        timeEntries: [
          ...selectedObligation.timeEntries, 
          { date: new Date().toISOString().split('T')[0], duration: sessionHours }
        ]
      });
      setSessionTime(0);
    } else if (action === 'start') {
      setSessionTime(0);
    }

    setIsTimerRunning(!isTimerRunning);
  };

  const addObligation = async (name: string, goal: number) => {
    if (!user) return;

    const newObligation = {
      name,
      icon: "Clock",
      timeEntries: [],
      goal: goal,
      userId: user.uid
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
      name,
      goal
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

  const selectObligation = (obligation: Obligation) => {
    setSelectedObligation(obligation);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const resetView = () => {
    setSelectedObligation(null);
    setView('dashboard');
  };

  const generateWeeklyData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay() + 1));
    
    return days.map((day, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      const dateString = date.toISOString().split('T')[0];

      const dayData: { [key: string]: string | number } = { name: day };
      obligations.forEach(obligation => {
        const timeSpent = obligation.timeEntries
          .filter(entry => entry.date === dateString)
          .reduce((sum, entry) => sum + entry.duration, 0);
        dayData[obligation.name] = timeSpent;
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
      config[obligation.name] = {
        label: obligation.name,
        color: colors[index % colors.length],
      };
      return config;
    }, {});
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
                    {obligation.name}
                    <span className="ml-auto">{Math.floor(obligation.timeEntries.reduce((sum, entry) => sum + entry.duration, 0))}h</span>
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
                    <ChartContainer
                      config={generateChartConfig()}
                      className="h-[300px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={generateWeeklyData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          {obligations.map((obligation) => (
                            <Bar 
                              key={obligation.id}
                              dataKey={obligation.name}
                              stackId="a"
                              fill={`var(--color-${obligation.name.replace(/\s+/g, '-')})`}
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
                        {obligations.reduce((sum, ob) => sum + ob.timeEntries.reduce((subSum, entry) => subSum + entry.duration, 0), 0).toFixed(2)} hours
                      </p>
                      <p className="text-sm text-gray-500">this week</p>
                    </div>
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                      <h3 className="mb-2 text-xl font-semibold">Active Obligations</h3>
                      <p className="text-3xl font-bold">{obligations.length}</p>
                    </div>
                  </div>
                </div>
              ) : selectedObligation ? (
                <div className="space-y-6">
                  <h2 className="text-3xl font-bold">{selectedObligation.name}</h2>
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
                      <span>Goal: {selectedObligation.goal} hours/week</span>
                      <span>
                        {selectedObligation.timeEntries.reduce((sum, entry) => sum + entry.duration, 0).toFixed(2)}/{selectedObligation.goal} hours
                      </span>
                    </div>
                    <Progress value={(selectedObligation.timeEntries.reduce((sum, entry) => sum + entry.duration, 0) / selectedObligation.goal) * 100} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-lg font-semibold">Recent Time Entries</h3>
                    <div className="space-y-2">
                      {selectedObligation.timeEntries.slice(-3).reverse().map((entry, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
                          <div className="flex items-center">
                            <Clock className="mr-2 h-4 w-4 text-gray-500" />
                            <span>{entry.duration.toFixed(2)} hours</span>
                          </div>
                          <span className="text-sm text-gray-500">{entry.date}</span>
                        </div>
                      ))}
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
                  initialName={editingObligation.name}
                  initialGoal={editingObligation.goal}
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
