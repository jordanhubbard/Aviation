// RecentFlightPlans.tsx
import React, { useState, useEffect } from 'react';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

interface RecentFlightPlan {
  id: string;
  name: string;
  origin: string;
  destination: string;
  timestamp: number;
}

const RecentFlightPlans: React.FC = () => {
  const [recentPlans, setRecentPlans] = useState<RecentFlightPlan[]>([]);
  const { plan } = useFlightPlanStore((state) => ({ plan: state.plan }));

  // Load recent plans from localStorage on mount
  useEffect(() => {
    const storedPlans = JSON.parse(localStorage.getItem('recentFlightPlans') || '[]');
    setRecentPlans(storedPlans);
  }, []);

  // Track recently used plans
  useEffect(() => {
    if (!plan || !plan.origin || !plan.destination) return;

    const updatedPlans = [...recentPlans];
    const existingIndex = updatedPlans.findIndex(p => p.id === plan.id);
    if (existingIndex !== -1) {
      updatedPlans.splice(existingIndex, 1);
    }
    updatedPlans.unshift({
      id: plan.id,
      name: plan.name,
      origin: plan.origin,
      destination: plan.destination,
      timestamp: Date.now(),
    });
    if (updatedPlans.length > 5) {
      updatedPlans.pop();
    }
    setRecentPlans(updatedPlans);
    localStorage.setItem('recentFlightPlans', JSON.stringify(updatedPlans));
  }, [plan]);

  const clearHistory = () => {
    setRecentPlans([]);
    localStorage.removeItem('recentFlightPlans');
  };

  return (
    <div>
      <h2>Recent Flight Plans</h2>
      <ul>
        {recentPlans.map(plan => (
          <li key={plan.id}>
            {plan.name || `${plan.origin} to ${plan.destination}`}
          </li>
        ))}
      </ul>
      <button onClick={clearHistory}>Clear History</button>
    </div>
  );
};

export default RecentFlightPlans;
