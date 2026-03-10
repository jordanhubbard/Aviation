import type { FlightPlanDraft } from '../stores/flightPlanStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

export async function fetchFlightPlan(id: string): Promise<FlightPlanDraft> {
  const response = await fetch(`${BASE_URL}/api/flight-plans/${encodeURIComponent(id)}`)
  return handleResponse<FlightPlanDraft>(response)
}

export async function saveFlightPlan(plan: FlightPlanDraft): Promise<FlightPlanDraft> {
  const response = await fetch(`${BASE_URL}/api/flight-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  })
  return handleResponse<FlightPlanDraft>(response)
}

export async function updateFlightPlan(
  id: string,
  plan: FlightPlanDraft,
): Promise<FlightPlanDraft> {
  const response = await fetch(`${BASE_URL}/api/flight-plans/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  })
  return handleResponse<FlightPlanDraft>(response)
}

export async function deleteFlightPlan(id: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/flight-plans/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
}

export async function listFlightPlans(): Promise<FlightPlanDraft[]> {
  const response = await fetch(`${BASE_URL}/api/flight-plans`)
  return handleResponse<FlightPlanDraft[]>(response)
}
