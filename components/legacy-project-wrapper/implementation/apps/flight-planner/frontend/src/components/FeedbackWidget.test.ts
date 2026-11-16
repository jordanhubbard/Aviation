import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import widgetSource from '../../../../meta-app/public/feedback-widget.js?raw'

function mount(request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
  number: 123, url: 'https://github.com/jordanhubbard/Aviation/issues/123',
}), { status: 201 }))) {
  new Function('document', 'location', 'fetch', widgetSource)(document, {
    hostname: 'flight-planner.example.test', pathname: '/planner',
  }, request)
  return request
}

beforeEach(() => {
  document.head.replaceChildren()
  document.body.replaceChildren()
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  }
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
})
afterEach(() => vi.restoreAllMocks())

describe('shared feedback completion in Flight Planner', () => {
  it('offers Close after success, prevents duplicate submission and opens an explicit fresh form', async () => {
    const request = mount(), user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }))
    await user.type(screen.getByLabelText('Feedback'), 'Synthetic test feedback')
    await user.click(screen.getByRole('button', { name: 'Submit issue' }))
    expect(await screen.findByRole('link', { name: '#123' })).toHaveAttribute('href', 'https://github.com/jordanhubbard/Aviation/issues/123')
    expect(screen.queryByRole('button', { name: 'Submit issue' })).not.toBeInTheDocument()
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()
    expect(screen.getByLabelText('Feedback')).toBeDisabled()
    fireEvent.submit(document.querySelector('form')!)
    expect(request).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toMatchObject({ app: 'flight-planner', page: '/planner', message: 'Synthetic test feedback' })
    await user.click(close)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }))
    expect(screen.getByLabelText('Feedback')).toHaveValue('')
    expect(screen.getByLabelText('Feedback')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Submit issue' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('keeps a pending submission single and preserves its state when the dialog is closed and reopened', async () => {
    let release!: (response: Response) => void
    const pending = new Promise<Response>(resolve => { release = resolve })
    const request = vi.fn<typeof fetch>(() => pending), user = userEvent.setup()
    mount(request)
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }))
    await user.type(screen.getByLabelText('Feedback'), 'Pending test feedback')
    await user.click(screen.getByRole('button', { name: 'Submit issue' }))
    expect(screen.getByLabelText('Feedback')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }))
    expect(screen.getByRole('button', { name: 'Submit issue' })).toBeDisabled()
    fireEvent.submit(document.querySelector('form')!)
    expect(request).toHaveBeenCalledTimes(1)
    release(new Response(JSON.stringify({ number: 123, url: 'https://github.com/jordanhubbard/Aviation/issues/123' }), { status: 201 }))
    expect(await screen.findByRole('link', { name: '#123' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit issue' })).not.toBeInTheDocument()
  })

  it('preserves the draft and explicit retry after failure without fabricating an issue receipt', async () => {
    const request = vi.fn<typeof fetch>(async () => new Response('', { status: 503 })), user = userEvent.setup()
    mount(request)
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }))
    await user.type(screen.getByLabelText('Feedback'), 'Retained test feedback')
    await user.click(screen.getByRole('button', { name: 'Submit issue' }))
    expect(await screen.findByText(/Submission failed \(503\)/)).toBeInTheDocument()
    expect(screen.getByLabelText('Feedback')).toHaveValue('Retained test feedback')
    expect(screen.getByLabelText('Feedback')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Submit issue' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(request).toHaveBeenCalledTimes(1)
  })
})
