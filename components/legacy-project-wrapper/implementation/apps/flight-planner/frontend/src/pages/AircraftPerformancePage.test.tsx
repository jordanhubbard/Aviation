import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AircraftPerformancePage from './AircraftPerformancePage'
import type { Dataset, PerformanceResult } from './performanceTypes'

const token = 'synthetic-performance-operator-key-for-tests'
const quote = 'Synthetic source row: 1000 feet. <img src=x onerror=alert(1)>'
const sourceTable = {
  id: 'takeoff',
  metric: 'takeoff_ground_roll_ft',
  source_table: 'Synthetic takeoff table',
  axes: ['pressure_altitude_ft'],
  interpolation_axes: ['pressure_altitude_ft'],
  interpolation_citations: [{ page: 2, quote: 'Synthetic permission to interpolate.' }],
  fixed_conditions: {
    temperature_c: 15,
    weight_lb: 2400,
    headwind_kt: 0,
    runway_slope_pct: 0,
    runway_surface: 'dry paved',
  },
  points: [
    { coordinates: { pressure_altitude_ft: 0 }, value: 1000, citations: [{ page: 2, quote }] },
    {
      coordinates: { pressure_altitude_ft: 2000 },
      value: 1400,
      citations: [{ page: 2, quote: 'Synthetic row: 2000 ft, 1400 feet.' }],
    },
  ],
  corrections: [],
  correction_order: [],
  combination_citations: [],
  notes: ['Synthetic fixtures prove UI behavior only.'],
}
function makeDataset(): Dataset {
  return {
    id: 'perf_fixture',
    content_sha256: '2'.repeat(64),
    state: 'reviewed',
    usable: true,
    unavailable_reason: null,
    reviewer: 'Fixture reviewer',
    reviewed_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    retired_at: null,
    retirement_reason: null,
    source_metadata: { icao: 'C172' },
    content: {
      title: '<script>Fixture original table</script>',
      source_document_id: 'doc_' + '1'.repeat(32),
      source_sha256: '1'.repeat(64),
      icao: 'C172',
      variant: 'Fixture S',
      source_revision: 'Fixture revision',
      configuration: 'Synthetic test configuration',
      tables: [structuredClone(sourceTable)],
    },
  }
}
let current: Dataset
let seen: { path: string; init?: RequestInit }[]
let pendingDataset: (() => Promise<Dataset>) | undefined
let calculationError: number | undefined
let rejectedIdentity: boolean
let offsetTotal: number
function reply(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => structuredClone(body) }
}
function result(): PerformanceResult {
  return {
    dataset_id: rejectedIdentity ? 'perf_wrong' : current.id,
    content_sha256: current.content_sha256,
    table_id: 'takeoff',
    metric: 'takeoff_ground_roll_ft',
    units: 'ft',
    value: 1200,
    uncorrected_value: 1200,
    conditions: { pressure_altitude_ft: 1000, ...sourceTable.fixed_conditions },
    variant: current.content.variant,
    configuration: current.content.configuration,
    registration: null,
    source: {
      document_id: current.content.source_document_id,
      sha256: current.content.source_sha256,
      original_url: '/api/aircraft-library/documents/original',
      revision: current.content.source_revision,
      metadata: current.source_metadata,
    },
    source_table: sourceTable.source_table,
    interpolation_axes: sourceTable.interpolation_axes,
    interpolation_citations: sourceTable.interpolation_citations,
    combination_citations: [],
    contributions: sourceTable.points.map((point) => ({ ...point, weight: 0.5 })),
    corrections: [],
    notes: [],
    reviewer: 'Fixture reviewer',
    reviewed_at: current.reviewed_at!,
    calculated_at: '2026-01-01T01:00:00Z',
    method: 'Source grid interpolation',
    warnings: [],
    approved_for_flight: false,
    limitations: 'Synthetic research result, not aircraft approval',
  }
}
beforeEach(() => {
  current = makeDataset()
  seen = []
  pendingDataset = undefined
  calculationError = undefined
  rejectedIdentity = false
  offsetTotal = 1
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      seen.push({ path, init })
      if (path.endsWith('/capabilities'))
        return reply({
          axes: { pressure_altitude_ft: 'ft', temperature_c: 'C', weight_lb: 'lb' },
          metrics: { takeoff_ground_roll_ft: 'ft' },
          limitations: 'Operator review is not aircraft approval',
          correction_scope: 'Only source-published corrections',
        })
      if (path.includes('/datasets?')) {
        const query = new URLSearchParams(path.split('?')[1])
        const offset = Number(query.get('offset'))
        return reply({
          datasets: [
            {
              ...current,
              ...current.content,
              title: current.content.title,
              table_ids: ['takeoff'],
              metrics: ['takeoff_ground_roll_ft'],
            },
          ],
          total: offsetTotal,
          offset,
          limit: 25,
        })
      }
      if (path.endsWith('/calculate'))
        return calculationError
          ? reply({ detail: 'Scenario coverage missing' }, calculationError)
          : reply(result())
      if (path.endsWith('/review')) {
        current = {
          ...current,
          state: 'reviewed',
          usable: true,
          reviewer: 'New reviewer',
          reviewed_at: '2026-01-02T00:00:00Z',
        }
        return reply(current)
      }
      if (path.endsWith('/retire')) {
        current = {
          ...current,
          state: 'retired',
          usable: false,
          retirement_reason: 'Source replaced',
        }
        return reply(current)
      }
      if (path.endsWith('/datasets') && init?.method === 'POST') {
        current = { ...current, state: 'draft', usable: false, reviewer: null, reviewed_at: null }
        return reply(current, 201)
      }
      if (path.endsWith('/original'))
        return {
          ok: true,
          status: 200,
          blob: async () => ({
            size: 12,
            arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer,
          }),
        }
      if (pendingDataset) return { ok: true, status: 200, json: pendingDataset }
      return reply(current)
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
async function connect() {
  render(<AircraftPerformancePage />)
  expect(seen).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('Library access key'), { target: { value: token } })
  fireEvent.change(screen.getByLabelText('ICAO type'), { target: { value: 'c172' } })
  fireEvent.click(screen.getByRole('button', { name: 'Connect and list datasets' }))
  await screen.findByRole('button', { name: 'Inspect dataset ' + current.content.title })
}
async function inspect() {
  await connect()
  fireEvent.click(screen.getByRole('button', { name: 'Inspect dataset ' + current.content.title }))
  await screen.findByRole('heading', { level: 2, name: current.content.title })
}
function enterAltitude(value = '1000') {
  fireEvent.change(screen.getByLabelText(/pressure altitude ft/), { target: { value } })
}
async function calculate() {
  enterAltitude()
  fireEvent.click(screen.getByRole('button', { name: 'Calculate from reviewed table' }))
  await screen.findByRole('heading', { name: 'Calculated research result' })
}

it('connects only explicitly, keeps credentials in headers and renders untrusted source text safely', async () => {
  await inspect()
  expect(seen.every((request) => !request.path.includes(token))).toBe(true)
  expect(
    seen.every(
      (request) => new Headers(request.init?.headers).get('Authorization') === 'Bearer ' + token,
    ),
  ).toBe(true)
  expect(document.querySelector('script')).toBeNull()
  expect(document.querySelector('img')).toBeNull()
  expect(screen.getAllByText(quote).length).toBeGreaterThan(0)
  expect(localStorage.getItem('AIRCRAFT_LIBRARY_TOKEN')).toBeNull()
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(token)
  fireEvent.click(screen.getByRole('button', { name: 'Lock and clear' }))
  expect(screen.queryByRole('heading', { level: 2, name: current.content.title })).toBeNull()
  expect(screen.getByLabelText('Library access key')).toHaveValue('')
})

it('requires missing axes, sends explicit units/conditions, displays citations and clears results on edits', async () => {
  await inspect()
  fireEvent.click(screen.getByRole('button', { name: 'Calculate from reviewed table' }))
  await screen.findByText('Enter every required condition; missing values are not zero.')
  expect(seen.some((request) => request.path.endsWith('/calculate'))).toBe(false)
  await calculate()
  expect(screen.getByText('1200 ft')).toBeInTheDocument()
  const request = seen.find((request) => request.path.endsWith('/calculate'))!
  expect(JSON.parse(request.init!.body as string)).toEqual({
    icao: 'C172',
    registration: null,
    variant: 'Fixture S',
    configuration: 'Synthetic test configuration',
    table_id: 'takeoff',
    conditions: { pressure_altitude_ft: 1000, ...sourceTable.fixed_conditions },
  })
  expect(screen.getAllByText(quote).length).toBeGreaterThan(0)
  enterAltitude('1500')
  expect(screen.queryByRole('heading', { name: 'Calculated research result' })).toBeNull()
})

it('retains request ownership through delayed body parsing and rejects an abandoned type response', async () => {
  await connect()
  let release!: (value: Dataset) => void
  const body = new Promise<Dataset>((resolve) => {
    release = resolve
  })
  pendingDataset = () => body
  fireEvent.click(screen.getByRole('button', { name: 'Inspect dataset ' + current.content.title }))
  await waitFor(() =>
    expect(seen.some((request) => request.path.endsWith('/perf_fixture'))).toBe(true),
  )
  const request = seen.find((request) => request.path.endsWith('/perf_fixture'))!
  fireEvent.change(screen.getByLabelText('ICAO type'), { target: { value: 'SR22' } })
  expect(request.init?.signal?.aborted).toBe(true)
  await act(async () => release(current))
  expect(screen.queryByRole('heading', { level: 2, name: current.content.title })).toBeNull()
  expect(screen.queryByText('Loading private performance data…')).toBeNull()
})

it('does not leave a previous successful calculation visible after a request fails', async () => {
  await inspect()
  await calculate()
  calculationError = 400
  fireEvent.click(screen.getByRole('button', { name: 'Calculate from reviewed table' }))
  await screen.findByText('Scenario coverage missing')
  expect(screen.queryByRole('heading', { name: 'Calculated research result' })).toBeNull()
})

it('clears private records and the key after an access rejection', async () => {
  await inspect()
  vi.mocked(fetch).mockImplementation(
    async () => reply({ detail: 'Credential rejected' }, 401) as unknown as Response,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Refresh datasets' }))
  await screen.findByText('Credential rejected')
  expect(screen.getByLabelText('Library access key')).toHaveValue('')
  expect(screen.queryByRole('heading', { level: 2, name: current.content.title })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Refresh datasets' })).toBeNull()
})

it('imports only as a draft and requires deliberate review of its exact identity', async () => {
  await connect()
  fireEvent.click(screen.getByText('Import a transcribed dataset draft'))
  const file = new File([JSON.stringify(current.content)], 'transcription.json', {
    type: 'application/json',
  })
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify(current.content) })
  fireEvent.change(screen.getByLabelText('Dataset JSON file'), { target: { files: [file] } })
  fireEvent.click(await screen.findByRole('button', { name: 'Import draft' }))
  await screen.findByRole('heading', { level: 2, name: current.content.title })
  expect(screen.getByRole('button', { name: 'Calculate from reviewed table' })).toBeDisabled()
  fireEvent.click(screen.getByText('Review source transcription'))
  const review = screen.getByRole('button', { name: 'Attest review of this content identity' })
  expect(review).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Reviewer'), { target: { value: 'New reviewer' } })
  expect(review).toBeDisabled()
  fireEvent.click(
    screen.getByLabelText(
      'I checked the original values, units, conditions and aircraft applicability',
    ),
  )
  fireEvent.click(review)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Calculate from reviewed table' })).toBeEnabled(),
  )
  const request = seen.find((request) => request.path.endsWith('/review'))!
  expect(JSON.parse(request.init!.body as string)).toEqual({
    expected_content_sha256: '2'.repeat(64),
    reviewer: 'New reviewer',
    attest_source_and_applicability: true,
  })
  expect(seen.some((request) => request.path.endsWith('/calculate'))).toBe(false)
})

it('pages the catalog explicitly with the current type and registration filter', async () => {
  offsetTotal = 26
  await connect()
  fireEvent.change(screen.getByLabelText('Registration (optional)'), {
    target: { value: 'n123ab' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Refresh datasets' }))
  await screen.findByRole('button', { name: 'Next datasets' })
  fireEvent.click(screen.getByRole('button', { name: 'Next datasets' }))
  await waitFor(() => expect(seen.some((request) => request.path.includes('offset=25'))).toBe(true))
  const path = seen.filter((request) => request.path.includes('/datasets?')).at(-1)!.path
  const query = new URLSearchParams(path.split('?')[1])
  expect(query.get('registration')).toBe('N123AB')
  expect(query.get('icao')).toBe('C172')
})

it('rejects a successful HTTP response carrying a different dataset identity', async () => {
  await inspect()
  rejectedIdentity = true
  enterAltitude()
  fireEvent.click(screen.getByRole('button', { name: 'Calculate from reviewed table' }))
  await screen.findByText('Calculation identity or numeric result is invalid')
  expect(screen.queryByRole('heading', { name: 'Calculated research result' })).toBeNull()
})

it('verifies original PDF bytes before making a download URL', async () => {
  await inspect()
  const create = vi.fn()
  const OriginalURL = URL
  vi.stubGlobal(
    'URL',
    class extends OriginalURL {
      static createObjectURL = create
      static revokeObjectURL = vi.fn()
    },
  )
  vi.stubGlobal('crypto', { subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) } })
  fireEvent.click(screen.getByRole('button', { name: 'Download and verify original PDF' }))
  await screen.findByText('Original PDF identity does not match the dataset')
  expect(create).not.toHaveBeenCalled()
  expect(seen.at(-1)!.path).not.toContain(token)
})

it('bounds draft files before reading or sending their contents', async () => {
  await connect()
  fireEvent.click(screen.getByText('Import a transcribed dataset draft'))
  const read = vi.fn()
  fireEvent.change(screen.getByLabelText('Dataset JSON file'), {
    target: { files: [{ size: 1_000_001, text: read }] },
  })
  await screen.findByText('Import a dataset JSON file of at most 1 MB (1,000,000 bytes).')
  expect(read).not.toHaveBeenCalled()
  expect(seen.some((request) => request.init?.method === 'POST')).toBe(false)
})
