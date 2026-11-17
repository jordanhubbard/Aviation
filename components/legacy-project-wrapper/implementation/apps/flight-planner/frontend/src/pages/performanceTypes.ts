export type Condition = string | number
export type Citation = { page: number; quote: string }
export type Point = { coordinates: Record<string, number>; value: number; citations: Citation[] }
export type Correction = {
  kind: 'linear_percent' | 'surface_percent'
  percent_of: 'current_result'
  name: string
  variable: string
  reference: Condition
  minimum?: number
  maximum?: number
  match_value?: string
  percent: number
  per_units?: number
  direction: 'increase' | 'decrease'
  citations: Citation[]
}
export type SourceTable = {
  id: string
  metric: string
  source_table: string
  axes: string[]
  interpolation_axes: string[]
  interpolation_citations: Citation[]
  fixed_conditions: Record<string, Condition>
  points: Point[]
  corrections: Correction[]
  correction_order: string[]
  combination_citations: Citation[]
  notes: string[]
}
export type DatasetSummary = {
  id: string
  content_sha256: string
  title: string
  icao: string
  variant: string
  source_revision: string
  configuration: string
  source_document_id: string
  source_sha256: string
  state: 'draft' | 'reviewed' | 'stale' | 'retired'
  usable: boolean
  unavailable_reason: string | null
  reviewed_at: string | null
  reviewer: string | null
  table_ids: string[]
  metrics: string[]
}
export type Dataset = {
  id: string
  content_sha256: string
  content: {
    title: string
    source_document_id: string
    source_sha256: string
    icao: string
    variant: string
    source_revision: string
    configuration: string
    tables: SourceTable[]
  }
  source_metadata: Record<string, string | string[]>
  created_at: string
  reviewed_at: string | null
  reviewer: string | null
  retired_at: string | null
  retirement_reason: string | null
  state: DatasetSummary['state']
  usable: boolean
  unavailable_reason: string | null
}
export type Catalog = { datasets: DatasetSummary[]; total: number; limit: number; offset: number }
export type Capabilities = {
  axes: Record<string, string>
  metrics: Record<string, string>
  limitations: string
  correction_scope: string
}
export type PerformanceResult = {
  dataset_id: string
  content_sha256: string
  table_id: string
  metric: string
  units: string
  value: number
  uncorrected_value: number
  conditions: Record<string, Condition>
  variant: string
  configuration: string
  registration: string | null
  source: {
    document_id: string
    sha256: string
    original_url: string
    revision: string
    metadata: Record<string, string | string[]>
  }
  source_table: string
  interpolation_axes: string[]
  interpolation_citations: Citation[]
  combination_citations: Citation[]
  contributions: (Point & { weight: number })[]
  corrections: { rule: Correction; requested_value: Condition; factor: number }[]
  reviewer: string
  reviewed_at: string
  calculated_at: string
  method: string
  warnings: string[]
  notes: string[]
  approved_for_flight: false
  limitations: string
}
export const conditionLabel = (key: string, units: Record<string, string> = {}) =>
  key.replace(/_/g, ' ') + (units[key] ? ` (${units[key]})` : '')
