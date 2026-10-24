import type { FlightPlan } from '../types';

export async function loadSavedFlightPlans(request: typeof fetch = fetch): Promise<FlightPlan[]> {
  const response = await request('/flight-plans/');
  if (!response.ok) throw new Error(`Flight plans unavailable (HTTP ${response.status})`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Flight plans response is not a list');
  return data as FlightPlan[];
}
