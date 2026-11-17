import { expect, it } from 'vitest'
import { consumeFilingInputs, peekFilingInputs, stageFilingInputs } from './filingInputs'
import type { FlightPlan } from '../types'

it('carries only selected route inputs in memory and consumes the exact handoff', () => {
  const plan = {
    origin: 'KPAO',
    destination: 'KSQL',
    route: ['KPAO', 'OSI', 'KSQL'],
    departure_time_utc: '2026-11-18T16:00:00Z',
    speed: 110,
    altitude: 3500,
    fuel_burn_gph: 10,
    fuel_required_gal: 20,
  } as FlightPlan
  stageFilingInputs(plan)
  const proposal = peekFilingInputs()
  expect(proposal).toEqual({
    departure: 'KPAO',
    destination: 'KSQL',
    route: 'KPAO OSI KSQL',
    departure_instant: '2026-11-18T16:00:00Z',
  })
  // Reading is pure, including React StrictMode's repeated initializers.
  expect(peekFilingInputs()).toBe(proposal)
  consumeFilingInputs(null)
  expect(peekFilingInputs()).toBe(proposal)
  consumeFilingInputs(proposal)
  expect(peekFilingInputs()).toBeNull()
})
