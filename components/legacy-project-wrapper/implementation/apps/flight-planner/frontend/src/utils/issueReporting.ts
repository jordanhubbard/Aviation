type IssueReportingEnabledResponse = {
  enabled: boolean
}

type FrontendErrorContext = {
  kind:
    | 'window.onerror'
    | 'unhandledrejection'
    | 'react-error-boundary'
    | 'api-client'
    | 'missing-route'
  componentStack?: string
  extra?: Record<string, unknown>
}

type IssueErrorReport = {
  source: 'frontend'
  message: string
  stack?: string | null
  url?: string | null
  user_agent?: string | null
  context?: Record<string, unknown>
}

let enabledPromise: Promise<boolean> | null = null
const recent = new Map<string, number>()

const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return String(hash)
}

export const issueReportingEnabled = async () => {
  if (enabledPromise) return enabledPromise

  enabledPromise = fetch('/api/issues/enabled', { method: 'GET' })
    .then(async (response) => {
      if (!response.ok) return false
      const json = (await response.json()) as IssueReportingEnabledResponse
      return Boolean(json.enabled)
    })
    .catch(() => false)

  return enabledPromise
}

const shouldSend = (signature: string, ttlMs = 15 * 60 * 1000) => {
  const now = Date.now()
  const last = recent.get(signature)
  if (last && now - last < ttlMs) return false
  recent.set(signature, now)
  return true
}

export const reportFrontendError = async (
  error: unknown,
  context: FrontendErrorContext,
): Promise<void> => {
  if (!(await issueReportingEnabled())) return

  const err = error instanceof Error ? error : new Error(String(error))
  const message = err.message || String(error)
  const stack = err.stack || null

  const signature = hashString(`${context.kind}\n${message}\n${stack ?? ''}`)
  if (!shouldSend(signature)) return

  const payload: IssueErrorReport = {
    source: 'frontend',
    message,
    stack,
    url: window.location?.href ?? null,
    user_agent: navigator.userAgent,
    context: {
      kind: context.kind,
      componentStack: context.componentStack,
      ...context.extra,
    },
  }

  try {
    await fetch('/api/issues/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Don't throw from an error reporter.
  }
}

export const installFrontendIssueErrorReporting = () => {
  window.addEventListener('error', (event) => {
    void reportFrontendError(event.error ?? event.message, { kind: 'window.onerror' })
  })

  window.addEventListener('unhandledrejection', (event) => {
    void reportFrontendError(event.reason, { kind: 'unhandledrejection' })
  })
}
