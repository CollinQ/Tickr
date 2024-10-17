import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ObligationFormProps {
  onSubmit: (name: string, goal: number) => void;
  onCancel: () => void;
  initialName?: string;
  initialGoal?: number;
}

export function ObligationForm({ onSubmit, onCancel, initialName = '', initialGoal = 0 }: ObligationFormProps) {
  const [name, setName] = useState(initialName);
  const [goal, setGoal] = useState(initialGoal.toString());

  useEffect(() => {
    setName(initialName);
    setGoal(initialGoal.toString());
  }, [initialName, initialGoal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const goalNumber = parseFloat(goal);
    if (name && !isNaN(goalNumber) && goalNumber > 0) {
      onSubmit(name, goalNumber);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Obligation Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter obligation name"
          required
        />
      </div>
      <div>
        <Label htmlFor="goal">Weekly Goal (hours)</Label>
        <Input
          id="goal"
          type="number"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Enter weekly goal in hours"
          required
          min="0.1"
          step="0.1"
        />
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{initialName ? 'Update' : 'Add'} Obligation</Button>
      </div>
    </form>
  );
}
