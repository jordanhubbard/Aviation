import React, { useCallback, useEffect, useState } from 'react'
import type { ServiceCategory, ServiceStatus } from '../types'
import { SERVICE_REGISTRY } from '../registry'
import { ServiceCard } from './ServiceCard'

export type ConfigPanelProps = {
  services?: string[]
  apiBase?: string
  title?: string
}

const CATEGORY_ORDER: ServiceCategory[] = [
  'weather',
  'navigation',
  'auth',
  'monitoring',
  'streaming',
  'database',
]

export function ConfigPanel({
  services: serviceFilter,
  apiBase = '',
  title = 'Aviation Suite Settings',
}: ConfigPanelProps) {
  const [statusMap, setStatusMap] = useState<Map<string, ServiceStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)

  const visibleServices = SERVICE_REGISTRY.filter(
    (s) => !serviceFilter || serviceFilter.includes(s.id)
  )

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/api/settings`)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const data = await res.json() as { services: ServiceStatus[] }
      const map = new Map<string, ServiceStatus>()
      for (const s of data.services) {
        map.set(s.id, s)
      }
      setStatusMap(map)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings, refreshCount])

  async function handleSave(serviceId: string, key: string, value: string) {
    const res = await fetch(`${apiBase}/api/settings/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: serviceId, key, value }),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Save failed (HTTP ${res.status}): ${body}`)
    }
    // Optimistically update local status
    setStatusMap((prev) => {
      const next = new Map(prev)
      const existing = next.get(serviceId)
      if (existing) {
        const fields = existing.fields.map((f) =>
          f.key === key ? { ...f, configured: true } : f
        )
        const configured = fields.every((f) => f.configured)
        next.set(serviceId, { ...existing, fields, configured })
      }
      return next
    })
  }

  const configuredCount = visibleServices.filter((s) => {
    const st = statusMap.get(s.id)
    return st?.configured ?? false
  }).length
  const needsSetupCount = visibleServices.length - configuredCount

  const panelStyle: React.CSSProperties = {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '800px',
    margin: '0 auto',
    padding: '1.5rem',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#111827',
  }

  const summaryStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    color: '#6b7280',
    marginBottom: '1.5rem',
  }

  const refreshButtonStyle: React.CSSProperties = {
    padding: '0.375rem 0.875rem',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
    color: '#374151',
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#9ca3af',
    marginTop: '1.25rem',
    marginBottom: '0.5rem',
  }

  const errorStyle: React.CSSProperties = {
    color: '#dc2626',
    padding: '0.75rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  }

  // Group visible services by category in defined order
  const grouped = new Map<ServiceCategory, typeof visibleServices>()
  for (const cat of CATEGORY_ORDER) {
    const inCat = visibleServices.filter((s) => s.category === cat)
    if (inCat.length > 0) grouped.set(cat, inCat)
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>{title}</h2>
        <button
          style={refreshButtonStyle}
          onClick={() => setRefreshCount((c) => c + 1)}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {!loading && !error && (
        <p style={summaryStyle}>
          {configuredCount} of {visibleServices.length} services configured
          {needsSetupCount > 0 && ` — ${needsSetupCount} need setup`}
        </p>
      )}

      {error && <div style={errorStyle}>{error}</div>}

      {Array.from(grouped.entries()).map(([category, catServices]) => (
        <div key={category}>
          <div style={sectionTitleStyle}>{category}</div>
          {catServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              status={statusMap.get(service.id) ?? null}
              onSave={handleSave}
              isLoading={loading}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
