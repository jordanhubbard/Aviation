import '../../../../meta-app/public/performance-reference.js'
import type { Dataset, PerformanceResult, Condition } from '../pages/performanceTypes'

export type PerformanceReference = {
  warnings: string[]
  notes: string[]
  limitations: string
  schema: 'aviation/performance-reference@1'
  dataset_id: string
  content_sha256: string
  icao: string
  variant: string
  configuration: string
  registration: string | null
  table_id: string
  metric: string
  units: string
  value: number
  conditions: Record<string, Condition>
  source: { document_id: string; sha256: string; revision: string; pages: number[] }
  reviewer: string
  reviewed_at: string
  calculated_at: string
  approved_for_flight: false
}
export type Handoff = { origin: string; session: string }
declare global {
  interface Window {
    AviationPerformanceReference: {
      descriptor(href: string, opener: boolean): Handoff | null
      snapshot(result: PerformanceResult, dataset: Dataset): PerformanceReference
      validate(reference: unknown): PerformanceReference
      compare(
        reference: PerformanceReference,
        context?: Record<string, Condition>,
      ): {
        matched: boolean
        missing: string[]
        mismatched: string[]
      }
    }
  }
}

export function performanceHandoff() {
  return window.AviationPerformanceReference.descriptor(
    window.location.href,
    Boolean(window.opener),
  )
}
export function returnPerformanceReference(
  handoff: Handoff,
  result: PerformanceResult,
  dataset: Dataset,
) {
  if (!window.opener || window.opener.closed) throw new Error('The receiving application closed.')
  const reference = window.AviationPerformanceReference.snapshot(result, dataset)
  window.opener.postMessage(
    { type: 'aviation.performance.reference', session: handoff.session, reference },
    handoff.origin,
  )
}
