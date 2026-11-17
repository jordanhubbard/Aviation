import type { FlightPlan } from '../types'

// One explicit, same-tab handoff. No browser storage or pilot/aircraft defaults.
let pending: Record<string, string> | null = null
export function stageFilingInputs(plan: FlightPlan) {
  pending = {}
  if (plan.origin) pending.departure = plan.origin
  if (plan.destination) pending.destination = plan.destination
  if (plan.departure_time_utc) pending.departure_instant = plan.departure_time_utc
  if (plan.route.length) pending.route = plan.route.join(' ')
}
export function peekFilingInputs() {
  return pending
}
export function consumeFilingInputs(expected: Record<string, string> | null) {
  if (pending === expected) pending = null
}
