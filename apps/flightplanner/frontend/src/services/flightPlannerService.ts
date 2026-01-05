import { apiClient } from './apiClient'
import type { FlightPlanRequest } from '../types'

type StreamProgressEvent = {
  phase?: string | null
  message?: string | null
  percent?: number | null
}

type StreamErrorEvent = {
  status_code?: number | null
  detail?: string | null
}

type PlanStreamHandlers<TPlan> = {
  onProgress?: (ev: StreamProgressEvent) => void
  onPartialPlan?: (plan: TPlan) => void
  onDone?: (plan: TPlan) => void
  onError?: (ev: StreamErrorEvent) => void
}

const parseSseBlock = (block: string): { event?: string; data?: string } => {
  const lines = block
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)

  let event: string | undefined
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim())
  }

  const data = dataLines.length ? dataLines.join('\n') : undefined
  return { event, data }
}

export const flightPlannerService = {
  plan: async <TResponse>(data: FlightPlanRequest): Promise<TResponse> => {
    const response = await apiClient.post<TResponse>('/plan', data)
    return response.data
  },

  planStream: async <TPlan>(
    data: FlightPlanRequest,
    handlers: PlanStreamHandlers<TPlan>,
    signal?: AbortSignal,
  ): Promise<void> => {
    const resp = await fetch('/api/plan/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    })

    if (!resp.ok) {
      let detail: string | undefined
      try {
        const body = (await resp.json()) as { detail?: unknown }
        if (body && body.detail != null) detail = String(body.detail)
      } catch {
        // ignore
      }
      throw new Error(detail || `Request failed (${resp.status})`)
    }

    const reader = resp.body?.getReader()
    if (!reader) throw new Error('Streaming unsupported')
    const decoder = new TextDecoder('utf-8')

    let buffer = ''
    let done = false
    while (!done) {
      const chunk = await reader.read()
      done = chunk.done
      if (done) break
      const value = chunk.value
      buffer += decoder.decode(value, { stream: true })

      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() || ''

      for (const block of blocks) {
        if (!block.trim()) continue
        const { event, data: payload } = parseSseBlock(block)
        if (!event || !payload) continue

        if (event === 'progress') {
          handlers.onProgress?.(JSON.parse(payload) as StreamProgressEvent)
        } else if (event === 'partial_plan') {
          const parsed = JSON.parse(payload) as { plan?: TPlan }
          if (parsed.plan) handlers.onPartialPlan?.(parsed.plan)
        } else if (event === 'done') {
          const parsed = JSON.parse(payload) as { plan?: TPlan }
          if (parsed.plan) handlers.onDone?.(parsed.plan)
          return
        } else if (event === 'cancelled') {
          handlers.onError?.({ status_code: 499, detail: 'cancelled' })
          return
        } else if (event === 'error') {
          handlers.onError?.(JSON.parse(payload) as StreamErrorEvent)
          return
        }
      }
    }
  },
}
