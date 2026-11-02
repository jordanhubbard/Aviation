import { useEffect, useRef } from 'react';
import { registerDecisionContext } from '@aviation/ai-explainer/browser';

export interface ExplanationEvent {
  registration: string;
  dateZ: string;
  category: string;
  aircraftType?: string;
  operator?: string;
  country?: string;
  fatalities?: number;
  injuries?: number;
  summary?: string;
  narrative?: string;
}
export function AccidentExplanation({ event }: { event: ExplanationEvent }) {
  const current = useRef(event);
  current.current = event;
  useEffect(() => registerDecisionContext(() => {
    const selected = current.current;
    return {
      application: 'Aviation Accident Tracker',
      decision: 'Classification and recorded contributing factors of the selected event',
      registration: selected.registration, date: selected.dateZ, category: selected.category,
      aircraft: selected.aircraftType, operator: selected.operator, country: selected.country,
      fatalities: selected.fatalities, injuries: selected.injuries,
      summary: selected.summary?.slice(0, 1000), narrative: selected.narrative?.slice(0, 2000),
    };
  }, 'Explain the recorded facts and classification. Distinguish evidence from speculation; do not invent an official cause.'), []);
  return <p>AI explanations are not official findings.</p>;
}
