import { fireEvent, render, screen, within } from '@testing-library/react'

import App from './App'

class MockWebSocket {
  static OPEN = 1
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  sent: string[] = []

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.onopen?.(new Event('open'))
    }, 0)
  }

  close() {
    const event = typeof CloseEvent === 'undefined' ? new Event('close') : new CloseEvent('close')
    this.onclose?.(event as CloseEvent)
  }

  send(data: string) {
    this.sent.push(data)
  }
}

describe('App', () => {
  beforeEach(() => {
    window.WebSocket = MockWebSocket as unknown as typeof WebSocket
  })

  it('renders the simulator header', () => {
    render(<App />)
    expect(screen.getByText(/G1000 Simulator/i)).toBeInTheDocument()
  })

  it('shows telemetry placeholders', () => {
    render(<App />)
    expect(screen.getByText('Live Telemetry')).toBeInTheDocument()
    expect(screen.getAllByText('---').length).toBeGreaterThan(0)
  })

  it('renders the primary flight display panel', () => {
    render(<App />)
    const panelHeading = screen.getByText('Primary Flight Display')
    const panel = panelHeading.closest('section')
    expect(panel).not.toBeNull()
    const panelQueries = within(panel as HTMLElement)
    expect(panelQueries.getByText('Airspeed')).toBeInTheDocument()
    expect(panelQueries.getByText('Altitude')).toBeInTheDocument()
    expect(panelQueries.getByText('Heading')).toBeInTheDocument()
  })

  it('renders the multi-function display panel', () => {
    render(<App />)
    const panelHeading = screen.getByText('Multi-Function Display')
    const panel = panelHeading.closest('section')
    expect(panel).not.toBeNull()
    const panelQueries = within(panel as HTMLElement)
    expect(panelQueries.getByText(/Map - Navigation/i)).toBeInTheDocument()
    expect(panelQueries.getByText('Engine')).toBeInTheDocument()
  })

  it('renders the input controls panel', () => {
    render(<App />)
    expect(screen.getByText('Input Controls')).toBeInTheDocument()
    expect(screen.getByText('Heading Bug')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'RESET' })).toBeInTheDocument()
  })

  it('allows softkey menu navigation', () => {
    render(<App />)
    const mfdPanel = screen.getByText('Multi-Function Display').closest('section')
    const panelQueries = within(mfdPanel as HTMLElement)
    fireEvent.click(panelQueries.getByRole('button', { name: 'MENU' }))
    expect(panelQueries.getByRole('button', { name: 'BACK' })).toBeInTheDocument()
  })
})
