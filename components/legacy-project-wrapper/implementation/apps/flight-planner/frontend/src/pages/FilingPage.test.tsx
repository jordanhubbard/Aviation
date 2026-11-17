import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import FilingPage from './FilingPage'

const key = 'private-fixture-flight-service-key-32'
const account = 'pilot@example.test'
const saved = {
  id: 'draft_fixture',
  revision: 1,
  account,
  plan: {
    flight_rules: 'VFR',
    aircraft_identifier: 'N123AB',
    departure: 'KPAO',
    destination: 'KSQL',
  },
}
const receipt = {
  id: 'operation_fixture',
  action: 'file',
  environment: 'lab',
  status: 'accepted',
  filing_id: 'filing_fixture',
  response: { returnMessage: ['Fixture receipt'] },
}

function fixture() {
  const calls: { path: string; method: string; body: Record<string, unknown> | null }[] = []
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ path, method, body })
    let value: unknown
    if (path.endsWith('/capabilities'))
      value = {
        environment: 'lab',
        configured: true,
        private_api_configured: true,
        production_approval_attested: false,
      }
    else if (path.includes('/drafts?')) value = [saved]
    else if (
      path.includes('/filings?') ||
      path.includes('/operations?') ||
      path.includes('/audit/')
    )
      value = []
    else if (path.endsWith('/drafts/draft_fixture/filing')) value = null
    else if (path.endsWith('/actions/prepare'))
      value = {
        confirmation_token: 'confirmation-fixture-opaque-token',
        expires_at: '2026-11-18T13:00:00Z',
        action: 'file',
        environment: 'lab',
        plan: saved.plan,
        warnings: ['Fixture provider eligibility warning'],
        provider_state: null,
        provider_fields: {},
        changed_fields: [],
      }
    else if (path.endsWith('/actions/execute')) value = receipt
    else if (path.endsWith('/drafts') && method === 'POST') value = { ...saved, plan: body?.plan }
    else throw new Error('Unexpected fixture path: ' + path)
    return { ok: true, json: async () => value } as Response
  })
  vi.stubGlobal('fetch', fetcher)
  return { calls, fetcher }
}

async function connect() {
  fireEvent.change(screen.getByLabelText('Private Flight Service access key'), {
    target: { value: key },
  })
  fireEvent.change(screen.getByLabelText('Pilot Flight Service account'), {
    target: { value: account },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Load private records' }))
  })
}

async function selectSaved() {
  await act(async () => {
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Saved draft' }))
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('option', { name: /N123AB/ }))
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('starts with public capability discovery and no private or provider reads', async () => {
  const { calls } = fixture()
  render(<FilingPage />)
  await screen.findByText(/Vendor configuration: present/)
  expect(calls.map((value) => value.path)).toEqual(['/api/filing/capabilities'])
  expect(screen.getByRole('button', { name: 'Load private records' })).toBeDisabled()
})

it('requires an exact environment/action confirmation before executing once', async () => {
  const { calls } = fixture()
  render(<FilingPage />)
  await connect()
  await selectSaved()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Review file action' }))
  })
  expect(calls.some((value) => value.path.endsWith('/actions/execute'))).toBe(false)
  expect(screen.getByRole('button', { name: 'Confirm file in lab' })).toBeDisabled()
  expect(screen.getByRole('heading', { name: 'Confirm file in lab' })).toBeVisible()
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'I confirm this file action in lab using the exact reviewed information.',
    }),
  )
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Confirm file in lab' }))
  })
  const mutations = calls.filter((value) => value.path.endsWith('/actions/execute'))
  expect(mutations).toHaveLength(1)
  expect(mutations[0].body).toMatchObject({
    action: 'file',
    environment: 'lab',
    confirmation_token: 'confirmation-fixture-opaque-token',
  })
  expect(String(mutations[0].body?.idempotency_key)).toHaveLength(36)
  expect(screen.getByText('Fixture receipt')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Confirm file in lab' })).toBeNull()
})

it('editing a reviewed draft removes confirmation and requires saving', async () => {
  fixture()
  render(<FilingPage />)
  await connect()
  await selectSaved()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Review file action' }))
  })
  fireEvent.change(screen.getByLabelText('ICAO route'), { target: { value: 'DCT OSI DCT' } })
  expect(screen.queryByRole('button', { name: 'Confirm file in lab' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Review file action' })).toBeDisabled()
  expect(screen.getByText('Save changes before reviewing a provider action.')).toBeVisible()
})

it('account/key changes erase private plan, receipts and reviews without browser storage', async () => {
  fixture()
  const write = vi.spyOn(Storage.prototype, 'setItem')
  render(<FilingPage />)
  await connect()
  await selectSaved()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Review file action' }))
  })
  fireEvent.change(screen.getByLabelText('Pilot Flight Service account'), {
    target: { value: 'other@example.test' },
  })
  expect(screen.queryByLabelText('Aircraft callsign')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Confirm file in lab' })).toBeNull()
  expect(screen.queryByRole('combobox', { name: 'Saved draft' })).toBeNull()
  expect(write).not.toHaveBeenCalled()
})

it('late responses cannot repopulate a cleared private session', async () => {
  const { fetcher } = fixture()
  let release!: (value: unknown) => void
  const delayed = new Promise((resolve) => {
    release = resolve
  })
  fetcher.mockImplementationOnce(
    async () =>
      ({ ok: true, json: async () => ({ environment: 'lab', configured: true }) }) as Response,
  )
  render(<FilingPage />)
  await screen.findByText(/Vendor configuration: present/)
  fetcher.mockImplementation(async () => ({ ok: true, json: async () => delayed }) as Response)
  fireEvent.change(screen.getByLabelText('Private Flight Service access key'), {
    target: { value: key },
  })
  fireEvent.change(screen.getByLabelText('Pilot Flight Service account'), {
    target: { value: account },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Load private records' }))
  fireEvent.click(screen.getByRole('button', { name: 'Clear private session' }))
  await act(async () => {
    release([saved])
    await delayed
  })
  expect(screen.queryByRole('combobox', { name: 'Saved draft' })).toBeNull()
  expect(screen.getByLabelText('Private Flight Service access key')).toHaveValue('')
})
