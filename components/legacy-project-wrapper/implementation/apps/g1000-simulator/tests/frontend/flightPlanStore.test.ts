/**
 * Unit tests for the flight plan Zustand store.
 *
 * The store is imported directly; no DOM or React rendering is required because
 * Zustand's `create` works in a Node/Jest environment.
 *
 * File under test: apps/g1000-simulator/frontend/src/stores/flightPlanStore.ts
 */

import { useFlightPlanStore } from '../../frontend/src/stores/flightPlanStore'

// ---------------------------------------------------------------------------
// Helper: reset the store to its initial state between tests.
// ---------------------------------------------------------------------------
beforeEach(() => {
  useFlightPlanStore.getState().resetPlan()
})

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
describe('initial state', () => {
  it('has an active plan with default origin and destination', () => {
    const { plan } = useFlightPlanStore.getState()
    expect(plan.origin).toBe('KSFO')
    expect(plan.destination).toBe('KMOD')
    expect(plan.id).toBe('active')
  })

  it('has two default waypoints', () => {
    const { plan } = useFlightPlanStore.getState()
    expect(plan.waypoints).toHaveLength(2)
    expect(plan.waypoints[0].id).toBe('BOSDY')
    expect(plan.waypoints[1].id).toBe('HADLY')
  })

  it('starts with navigation inactive', () => {
    const { navigation } = useFlightPlanStore.getState()
    expect(navigation.isActive).toBe(false)
    expect(navigation.isSuspended).toBe(false)
    expect(navigation.directToTargetId).toBeNull()
    expect(navigation.cdiSource).toBe('FPL')
  })
})

// ---------------------------------------------------------------------------
// setField
// ---------------------------------------------------------------------------
describe('setField', () => {
  it('updates the origin field', () => {
    useFlightPlanStore.getState().setField('origin', 'KSCK')
    expect(useFlightPlanStore.getState().plan.origin).toBe('KSCK')
  })

  it('updates the destination field', () => {
    useFlightPlanStore.getState().setField('destination', 'KLAX')
    expect(useFlightPlanStore.getState().plan.destination).toBe('KLAX')
  })

  it('updates the alternate field', () => {
    useFlightPlanStore.getState().setField('alternate', 'KOAK')
    expect(useFlightPlanStore.getState().plan.alternate).toBe('KOAK')
  })

  it('updates the plan name', () => {
    useFlightPlanStore.getState().setField('name', 'Test Route')
    expect(useFlightPlanStore.getState().plan.name).toBe('Test Route')
  })
})

// ---------------------------------------------------------------------------
// addWaypoint
// ---------------------------------------------------------------------------
describe('addWaypoint', () => {
  it('appends a waypoint to the end of the list', () => {
    useFlightPlanStore.getState().addWaypoint({ id: 'FIXXX', type: 'intersection' })
    const { plan } = useFlightPlanStore.getState()
    expect(plan.waypoints).toHaveLength(3)
    expect(plan.waypoints[2].id).toBe('FIXXX')
  })

  it('converts the waypoint id to uppercase', () => {
    useFlightPlanStore.getState().addWaypoint({ id: 'lax', type: 'airport' })
    const { plan } = useFlightPlanStore.getState()
    const added = plan.waypoints.find((w) => w.id === 'LAX')
    expect(added).toBeDefined()
  })

  it('inserts a waypoint after a given index', () => {
    useFlightPlanStore.getState().addWaypoint({ id: 'MID', type: 'navaid' }, 0)
    const { plan } = useFlightPlanStore.getState()
    expect(plan.waypoints[1].id).toBe('MID')
  })

  it('generates an auto id when no id is provided', () => {
    useFlightPlanStore.getState().addWaypoint({ type: 'user' })
    const { plan } = useFlightPlanStore.getState()
    expect(plan.waypoints[2].id).toMatch(/^WP\d+$/)
  })

  it('increments nextWaypointIndex after each add', () => {
    const before = useFlightPlanStore.getState().nextWaypointIndex
    useFlightPlanStore.getState().addWaypoint({ id: 'X', type: 'user' })
    const after = useFlightPlanStore.getState().nextWaypointIndex
    expect(after).toBe(before + 1)
  })

  it('defaults type to intersection when not specified', () => {
    useFlightPlanStore.getState().addWaypoint({ id: 'INTR' })
    const { plan } = useFlightPlanStore.getState()
    const wp = plan.waypoints.find((w) => w.id === 'INTR')
    expect(wp?.type).toBe('intersection')
  })
})

// ---------------------------------------------------------------------------
// updateWaypoint
// ---------------------------------------------------------------------------
describe('updateWaypoint', () => {
  it('updates the altitude of a waypoint at the given index', () => {
    useFlightPlanStore.getState().updateWaypoint(0, { altitude_ft: 8000 })
    const { plan } = useFlightPlanStore.getState()
    expect(plan.waypoints[0].altitude_ft).toBe(8000)
  })

  it('does not affect other waypoints', () => {
    useFlightPlanStore.getState().updateWaypoint(0, { altitude_ft: 8000 })
    const { plan } = useFlightPlanStore.getState()
    expect(plan.waypoints[1].altitude_ft).toBe(5500)
  })

  it('updates multiple fields in one call', () => {
    useFlightPlanStore.getState().updateWaypoint(1, { speed_kt: 130, altitude_ft: 9000 })
    const wp = useFlightPlanStore.getState().plan.waypoints[1]
    expect(wp.speed_kt).toBe(130)
    expect(wp.altitude_ft).toBe(9000)
  })
})

// ---------------------------------------------------------------------------
// removeWaypoint
// ---------------------------------------------------------------------------
describe('removeWaypoint', () => {
  it('removes the waypoint at the given index', () => {
    useFlightPlanStore.getState().removeWaypoint(0)
    const { plan } = useFlightPlanStore.getState()
    expect(plan.waypoints).toHaveLength(1)
    expect(plan.waypoints[0].id).toBe('HADLY')
  })

  it('clamps activeLegIndex to the new waypoint count', () => {
    // activeLegIndex is 0; after removing both waypoints it should stay 0
    useFlightPlanStore.getState().removeWaypoint(0)
    useFlightPlanStore.getState().removeWaypoint(0)
    const { plan } = useFlightPlanStore.getState()
    expect(plan.activeLegIndex).toBe(0)
    expect(plan.waypoints).toHaveLength(0)
  })

  it('cancels a directTo when the removed waypoint is the directTo target', () => {
    // Set up a directTo on BOSDY (index 0)
    useFlightPlanStore.getState().activatePlan()
    useFlightPlanStore.getState().activateDirectTo('BOSDY', 0)
    expect(useFlightPlanStore.getState().navigation.directToTargetId).toBe('BOSDY')

    useFlightPlanStore.getState().removeWaypoint(0)
    const { navigation } = useFlightPlanStore.getState()
    expect(navigation.directToTargetId).toBeNull()
    expect(navigation.cdiSource).toBe('FPL')
  })

  it('does not cancel directTo when a different waypoint is removed', () => {
    useFlightPlanStore.getState().activatePlan()
    useFlightPlanStore.getState().activateDirectTo('HADLY', 1)
    useFlightPlanStore.getState().removeWaypoint(0) // remove BOSDY, not HADLY
    const { navigation } = useFlightPlanStore.getState()
    expect(navigation.directToTargetId).toBe('HADLY')
  })
})

// ---------------------------------------------------------------------------
// activatePlan
// ---------------------------------------------------------------------------
describe('activatePlan', () => {
  it('sets navigation.isActive to true', () => {
    useFlightPlanStore.getState().activatePlan()
    expect(useFlightPlanStore.getState().navigation.isActive).toBe(true)
  })

  it('clears isSuspended', () => {
    useFlightPlanStore.getState().suspendPlan()
    useFlightPlanStore.getState().activatePlan()
    expect(useFlightPlanStore.getState().navigation.isSuspended).toBe(false)
  })

  it('clears directTo state', () => {
    useFlightPlanStore.getState().activatePlan()
    useFlightPlanStore.getState().activateDirectTo('BOSDY', 0)
    useFlightPlanStore.getState().activatePlan()
    const { navigation } = useFlightPlanStore.getState()
    expect(navigation.directToTargetId).toBeNull()
    expect(navigation.cdiSource).toBe('FPL')
  })

  it('sets activeLegIndex to 0', () => {
    useFlightPlanStore.getState().setActiveLegIndex(1)
    useFlightPlanStore.getState().activatePlan()
    expect(useFlightPlanStore.getState().plan.activeLegIndex).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// invertPlan
// ---------------------------------------------------------------------------
describe('invertPlan', () => {
  it('swaps origin and destination', () => {
    useFlightPlanStore.getState().invertPlan()
    const { plan } = useFlightPlanStore.getState()
    expect(plan.origin).toBe('KMOD')
    expect(plan.destination).toBe('KSFO')
  })

  it('reverses the waypoint order', () => {
    useFlightPlanStore.getState().invertPlan()
    const { plan } = useFlightPlanStore.getState()
    expect(plan.waypoints[0].id).toBe('HADLY')
    expect(plan.waypoints[1].id).toBe('BOSDY')
  })

  it('resets activeLegIndex to 0', () => {
    useFlightPlanStore.getState().setActiveLegIndex(1)
    useFlightPlanStore.getState().invertPlan()
    expect(useFlightPlanStore.getState().plan.activeLegIndex).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// suspendPlan / resumePlan
// ---------------------------------------------------------------------------
describe('suspendPlan / resumePlan', () => {
  it('suspendPlan sets isSuspended to true', () => {
    useFlightPlanStore.getState().suspendPlan()
    expect(useFlightPlanStore.getState().navigation.isSuspended).toBe(true)
    expect(useFlightPlanStore.getState().navigation.isActive).toBe(true)
  })

  it('resumePlan clears isSuspended', () => {
    useFlightPlanStore.getState().suspendPlan()
    useFlightPlanStore.getState().resumePlan()
    expect(useFlightPlanStore.getState().navigation.isSuspended).toBe(false)
    expect(useFlightPlanStore.getState().navigation.isActive).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// activateDirectTo / cancelDirectTo
// ---------------------------------------------------------------------------
describe('activateDirectTo', () => {
  it('sets directToTargetId and cdiSource', () => {
    useFlightPlanStore.getState().activatePlan()
    useFlightPlanStore.getState().activateDirectTo('HADLY', 1)
    const { navigation } = useFlightPlanStore.getState()
    expect(navigation.directToTargetId).toBe('HADLY')
    expect(navigation.cdiSource).toBe('DIR')
    expect(navigation.isActive).toBe(true)
    expect(navigation.isSuspended).toBe(false)
  })

  it('saves the previous activeLegIndex as directToResumeLegIndex', () => {
    useFlightPlanStore.getState().setActiveLegIndex(0)
    useFlightPlanStore.getState().activateDirectTo('HADLY', 1)
    expect(useFlightPlanStore.getState().navigation.directToResumeLegIndex).toBe(0)
  })
})

describe('cancelDirectTo', () => {
  it('clears directToTargetId and restores cdiSource', () => {
    useFlightPlanStore.getState().activatePlan()
    useFlightPlanStore.getState().activateDirectTo('HADLY', 1)
    useFlightPlanStore.getState().cancelDirectTo()
    const { navigation } = useFlightPlanStore.getState()
    expect(navigation.directToTargetId).toBeNull()
    expect(navigation.cdiSource).toBe('FPL')
  })

  it('does nothing when no directTo is active', () => {
    const before = useFlightPlanStore.getState()
    useFlightPlanStore.getState().cancelDirectTo()
    const after = useFlightPlanStore.getState()
    // State should be unchanged (same reference returned by no-op guard)
    expect(after.navigation.directToTargetId).toBeNull()
  })

  it('restores activeLegIndex from directToResumeLegIndex', () => {
    useFlightPlanStore.getState().setActiveLegIndex(0)
    useFlightPlanStore.getState().activateDirectTo('HADLY', 1)
    useFlightPlanStore.getState().cancelDirectTo()
    expect(useFlightPlanStore.getState().plan.activeLegIndex).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// setDirectToPanelOpen
// ---------------------------------------------------------------------------
describe('setDirectToPanelOpen', () => {
  it('opens the direct-to panel', () => {
    useFlightPlanStore.getState().setDirectToPanelOpen(true)
    expect(useFlightPlanStore.getState().navigation.directToPanelOpen).toBe(true)
  })

  it('closes the direct-to panel', () => {
    useFlightPlanStore.getState().setDirectToPanelOpen(true)
    useFlightPlanStore.getState().setDirectToPanelOpen(false)
    expect(useFlightPlanStore.getState().navigation.directToPanelOpen).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// loadSamplePlan
// ---------------------------------------------------------------------------
describe('loadSamplePlan', () => {
  it('replaces the plan with the sample route', () => {
    useFlightPlanStore.getState().loadSamplePlan()
    const { plan } = useFlightPlanStore.getState()
    expect(plan.id).toBe('sample')
    expect(plan.origin).toBe('KOAK')
    expect(plan.destination).toBe('KSAC')
  })

  it('resets navigation state', () => {
    useFlightPlanStore.getState().activatePlan()
    useFlightPlanStore.getState().loadSamplePlan()
    const { navigation } = useFlightPlanStore.getState()
    expect(navigation.isActive).toBe(false)
    expect(navigation.directToTargetId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// resetPlan
// ---------------------------------------------------------------------------
describe('resetPlan', () => {
  it('restores the default plan after modifications', () => {
    useFlightPlanStore.getState().setField('origin', 'KSFO2')
    useFlightPlanStore.getState().resetPlan()
    expect(useFlightPlanStore.getState().plan.origin).toBe('KSFO')
  })

  it('resets nextWaypointIndex to 1', () => {
    useFlightPlanStore.getState().addWaypoint({ id: 'X' })
    useFlightPlanStore.getState().resetPlan()
    expect(useFlightPlanStore.getState().nextWaypointIndex).toBe(1)
  })
})
