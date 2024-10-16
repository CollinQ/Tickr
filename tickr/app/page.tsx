"use client"

import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Bell, BookOpen, Briefcase, ChevronRight, Clock, Dumbbell, Settings, PenTool, Plus, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const weeklyData = [
  { name: "Mon", "Part-time Internship": 3, Study: 2, Exercise: 1, "Personal Project": 1 },
  { name: "Tue", "Part-time Internship": 4, Study: 3, Exercise: 0, "Personal Project": 2 },
  { name: "Wed", "Part-time Internship": 3, Study: 2, Exercise: 1, "Personal Project": 1 },
  { name: "Thu", "Part-time Internship": 5, Study: 3, Exercise: 1, "Personal Project": 2 },
  { name: "Fri", "Part-time Internship": 0, Study: 0, Exercise: 0, "Personal Project": 2 },
  { name: "Sat", "Part-time Internship": 0, Study: 0, Exercise: 0, "Personal Project": 0 },
  { name: "Sun", "Part-time Internship": 0, Study: 0, Exercise: 0, "Personal Project": 0 },
];

export default function Home() {
  const [obligations, setObligations] = useState([])
  const [selectedObligation, setSelectedObligation] = useState(null)
  const [isTimerRunning, setIsTimerRunning] = useState(false)

  useEffect(() => {
    fetchObligations()
  }, [])

  const fetchObligations = async () => {
    const response = await fetch('/api/obligations')
    const data = await response.json()
    setObligations(data)
  }

  const addObligation = async () => {
    const newObligation = {
      name: "New Obligation",
      icon: "PenTool",
      timeSpent: 0,
      goal: 10
    }
    const response = await fetch('/api/obligations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newObligation),
    })
    const data = await response.json()
    setObligations([...obligations, data])
  }

  const handleTimerToggle = async () => {
    if (!selectedObligation) return

    const action = isTimerRunning ? 'stop' : 'start'
    const response = await fetch('/api/timer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, obligationId: selectedObligation.id }),
    })
    const data = await response.json()

    if (action === 'stop' && data.duration) {
      const updatedObligations = obligations.map(ob =>
        ob.id === selectedObligation.id
          ? { ...ob, timeSpent: ob.timeSpent + data.duration }
          : ob
      )
      setObligations(updatedObligations)
      setSelectedObligation({ ...selectedObligation, timeSpent: selectedObligation.timeSpent + data.duration })
    }

    setIsTimerRunning(!isTimerRunning)
  }

  const totalTimeTracked = obligations.reduce((sum, ob) => sum + ob.timeSpent, 0)

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-md">
        <div className="p-4">
          <Button className="w-full" variant="outline" size="sm" onClick={addObligation}>
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
                onClick={() => setSelectedObligation(obligation)}
              >
                <obligation.icon className="mr-2 h-4 w-4" />
                {obligation.name}
                <span className="ml-auto">{obligation.timeSpent}h</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
        <div className="absolute bottom-4 left-4">
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between bg-white px-6 shadow-sm">
          <h1 className="text-2xl font-bold">Tickr</h1>
          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {selectedObligation ? (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">{selectedObligation.name}</h2>
              <div className="flex items-center justify-center">
                <div className="relative h-64 w-64 rounded-full border-8 border-gray-200">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl font-bold">{selectedObligation.timeSpent}:00</div>
                      <div className="text-sm text-gray-500">hours</div>
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
                    {selectedObligation.timeSpent}/{selectedObligation.goal} hours
                  </span>
                </div>
                <Progress value={(selectedObligation.timeSpent / selectedObligation.goal) * 100} />
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Recent Time Entries</h3>
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-4 w-4 text-gray-500" />
                        <span>2 hours</span>
                      </div>
                      <span className="text-sm text-gray-500">Today, 2:00 PM</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">Dashboard</h2>
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-xl font-semibold">Weekly Overview</h3>
                <ChartContainer
                  config={{
                    "Part-time Internship": {
                      label: "Part-time Internship",
                      color: "hsl(var(--chart-1))",
                    },
                    Study: {
                      label: "Study",
                      color: "hsl(var(--chart-2))",
                    },
                    Exercise: {
                      label: "Exercise",
                      color: "hsl(var(--chart-3))",
                    },
                    "Personal Project": {
                      label: "Personal Project",
                      color: "hsl(var(--chart-4))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="Part-time Internship" stackId="a" fill="var(--color-Part-time Internship)" />
                      <Bar dataKey="Study" stackId="a" fill="var(--color-Study)" />
                      <Bar dataKey="Exercise" stackId="a" fill="var(--color-Exercise)" />
                      <Bar dataKey="Personal Project" stackId="a" fill="var(--color-Personal Project)" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-lg bg-white p-6 shadow-sm">
                  <h3 className="mb-2 text-xl font-semibold">Total Time Tracked</h3>
                  <p className="text-3xl font-bold">{totalTimeTracked} hours</p>
                  <p className="text-sm text-gray-500">this week</p>
                </div>
                <div className="rounded-lg bg-white p-6 shadow-sm">
                  <h3 className="mb-2 text-xl font-semibold">Active Obligations</h3>
                  <p className="text-3xl font-bold">{obligations.length}</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
