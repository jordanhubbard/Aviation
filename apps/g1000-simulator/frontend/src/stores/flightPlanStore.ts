import create from 'zustand'

export type FlightPlanWaypointType =
  | 'airport'
  | 'navaid'
  | 'intersection'
  | 'user'
  | 'airway'
  | 'procedure'

export type FlightPlanWaypoint = {
  id: string
  type: FlightPlanWaypointType
  name?: string
  airway?: string
  altitude_ft?: number
  speed_kt?: number
  latitude_deg?: number
  longitude_deg?: number
}

export type FlightPlanDraft = {
  id: string
  name: string
  origin: string
  destination: string
  alternate: string
  waypoints: FlightPlanWaypoint[]
  activeLegIndex: number
}

export type FlightPlanNavigation = {
  isActive: boolean
  isSuspended: boolean
  cdiSource: 'FPL' | 'DIR'
  directToTargetId: string | null
  directToResumeLegIndex: number | null
  directToPanelOpen: boolean
}

type FlightPlanState = {
  plan: FlightPlanDraft
  nextWaypointIndex: number
  navigation: FlightPlanNavigation
}

type FlightPlanActions = {
  setField: (field: 'name' | 'origin' | 'destination' | 'alternate', value: string) => void
  addWaypoint: (waypoint: Partial<FlightPlanWaypoint>, insertAfterIndex?: number) => void
  updateWaypoint: (index: number, patch: Partial<FlightPlanWaypoint>) => void
  removeWaypoint: (index: number) => void
  resetPlan: () => void
  loadSamplePlan: () => void
  setActiveLegIndex: (index: number) => void
  activatePlan: () => void
  invertPlan: () => void
  suspendPlan: () => void
  resumePlan: () => void
  activateDirectTo: (targetId: string, targetLegIndex: number) => void
  cancelDirectTo: () => void
  setDirectToPanelOpen: (open: boolean) => void
}

const buildPlan = (): FlightPlanDraft => ({
  id: 'active',
  name: 'Active Plan',
  origin: 'KSFO',
  destination: 'KMOD',
  alternate: '',
  waypoints: [
    { id: 'BOSDY', type: 'intersection', name: 'BOSDY', altitude_ft: 4500, speed_kt: 110 },
    { id: 'HADLY', type: 'intersection', name: 'HADLY', altitude_ft: 5500, speed_kt: 115 },
  ],
  activeLegIndex: 0,
})

const buildSamplePlan = (): FlightPlanDraft => ({
  id: 'sample',
  name: 'Demo Route',
  origin: 'KOAK',
  destination: 'KSAC',
  alternate: 'KSCK',
  waypoints: [
    { id: 'CCR', type: 'navaid', name: 'CCR', altitude_ft: 4000, speed_kt: 105 },
    { id: 'SAC', type: 'navaid', name: 'SAC', altitude_ft: 5000, speed_kt: 115 },
  ],
  activeLegIndex: 0,
})

const buildNavigation = (): FlightPlanNavigation => ({
  isActive: false,
  isSuspended: false,
  cdiSource: 'FPL',
  directToTargetId: null,
  directToResumeLegIndex: null,
  directToPanelOpen: false,
})

const buildWaypoint = (
  state: FlightPlanState,
  waypoint: Partial<FlightPlanWaypoint>,
): FlightPlanWaypoint => {
  const id = (waypoint.id?.trim() || `WP${state.nextWaypointIndex}`).toUpperCase()
  return {
    id,
    type: waypoint.type ?? 'intersection',
    name: waypoint.name ?? id,
    airway: waypoint.airway?.toUpperCase(),
    altitude_ft: waypoint.altitude_ft,
    speed_kt: waypoint.speed_kt,
    latitude_deg: waypoint.latitude_deg,
    longitude_deg: waypoint.longitude_deg,
  }
}

const clampIndex = (index: number, max: number) => Math.max(0, Math.min(max, index))

export const useFlightPlanStore = create<FlightPlanState & FlightPlanActions>((set) => ({
  plan: buildPlan(),
  nextWaypointIndex: 1,
  navigation: buildNavigation(),
  setField: (field, value) => {
    set((state) => ({ plan: { ...state.plan, [field]: value } }))
  },
  addWaypoint: (waypoint, insertAfterIndex) => {
    set((state) => {
      const nextWaypoint = buildWaypoint(state, waypoint)
      const insertIndex = Number.isFinite(insertAfterIndex)
        ? clampIndex(insertAfterIndex + 1, state.plan.waypoints.length)
        : state.plan.waypoints.length
      const waypoints = [...state.plan.waypoints]
      waypoints.splice(insertIndex, 0, nextWaypoint)
      return {
        plan: { ...state.plan, waypoints },
        nextWaypointIndex: state.nextWaypointIndex + 1,
      }
    })
  },
  updateWaypoint: (index, patch) => {
    set((state) => {
      const waypoints = state.plan.waypoints.map((waypoint, waypointIndex) =>
        waypointIndex === index ? { ...waypoint, ...patch } : waypoint,
      )
      return { plan: { ...state.plan, waypoints } }
    })
  },
  removeWaypoint: (index) => {
    set((state) => {
      const removed = state.plan.waypoints[index]
      const waypoints = state.plan.waypoints.filter((_, waypointIndex) => waypointIndex !== index)
      const activeLegIndex = clampIndex(state.plan.activeLegIndex, Math.max(0, waypoints.length))
      const navigation =
        removed && removed.id === state.navigation.directToTargetId
          ? {
              ...state.navigation,
              directToTargetId: null,
              directToResumeLegIndex: null,
              cdiSource: 'FPL',
              directToPanelOpen: false,
            }
          : state.navigation
      return { plan: { ...state.plan, waypoints, activeLegIndex }, navigation }
    })
  },
  resetPlan: () => set({ plan: buildPlan(), nextWaypointIndex: 1, navigation: buildNavigation() }),
  loadSamplePlan: () =>
    set({ plan: buildSamplePlan(), nextWaypointIndex: 1, navigation: buildNavigation() }),
  setActiveLegIndex: (index) =>
    set((state) => ({
      plan: {
        ...state.plan,
        activeLegIndex: clampIndex(index, Math.max(0, state.plan.waypoints.length)),
      },
      navigation: {
        ...state.navigation,
        directToTargetId: null,
        directToResumeLegIndex: null,
        cdiSource: 'FPL',
      },
    })),
  activatePlan: () =>
    set((state) => ({
      plan: {
        ...state.plan,
        activeLegIndex: clampIndex(0, Math.max(0, state.plan.waypoints.length)),
      },
      navigation: {
        ...state.navigation,
        isActive: true,
        isSuspended: false,
        directToTargetId: null,
        directToResumeLegIndex: null,
        cdiSource: 'FPL',
        directToPanelOpen: false,
      },
    })),
  invertPlan: () =>
    set((state) => {
      const waypoints = [...state.plan.waypoints].reverse()
      return {
        plan: {
          ...state.plan,
          origin: state.plan.destination,
          destination: state.plan.origin,
          waypoints,
          activeLegIndex: 0,
        },
        navigation: {
          ...state.navigation,
          isSuspended: false,
          directToTargetId: null,
          directToResumeLegIndex: null,
          cdiSource: 'FPL',
          directToPanelOpen: false,
        },
      }
    }),
  suspendPlan: () =>
    set((state) => ({
      navigation: {
        ...state.navigation,
        isActive: true,
        isSuspended: true,
      },
    })),
  resumePlan: () =>
    set((state) => ({
      navigation: {
        ...state.navigation,
        isActive: true,
        isSuspended: false,
      },
    })),
  activateDirectTo: (targetId, targetLegIndex) =>
    set((state) => ({
      plan: {
        ...state.plan,
        activeLegIndex: clampIndex(targetLegIndex, Math.max(0, state.plan.waypoints.length)),
      },
      navigation: {
        ...state.navigation,
        isActive: true,
        isSuspended: false,
        cdiSource: 'DIR',
        directToTargetId: targetId,
        directToResumeLegIndex: state.plan.activeLegIndex,
        directToPanelOpen: false,
      },
    })),
  cancelDirectTo: () =>
    set((state) => {
      if (!state.navigation.directToTargetId) return state
      const resumeIndex = state.navigation.directToResumeLegIndex ?? state.plan.activeLegIndex
      return {
        plan: {
          ...state.plan,
          activeLegIndex: clampIndex(resumeIndex, Math.max(0, state.plan.waypoints.length)),
        },
        navigation: {
          ...state.navigation,
          directToTargetId: null,
          directToResumeLegIndex: null,
          cdiSource: 'FPL',
          directToPanelOpen: false,
        },
      }
    }),
  setDirectToPanelOpen: (open) =>
    set((state) => ({
      navigation: {
        ...state.navigation,
        directToPanelOpen: open,
      },
    })),
}))
