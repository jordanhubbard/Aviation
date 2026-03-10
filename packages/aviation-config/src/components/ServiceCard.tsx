import React, { useState } from 'react'
import type { ServiceDefinition, ServiceStatus } from '../types'
import { ApiKeyField } from './ApiKeyField'

export type ServiceCardProps = {
  service: ServiceDefinition
  status: ServiceStatus | null
  onSave: (serviceId: string, key: string, value: string) => Promise<void>
  isLoading?: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  weather: '#0369a1',
  navigation: '#7c3aed',
  auth: '#b45309',
  monitoring: '#dc2626',
  streaming: '#0891b2',
  database: '#16a34a',
}

export function ServiceCard({ service, status, onSave, isLoading = false }: ServiceCardProps) {
  const [expanded, setExpanded] = useState(false)

  const configuredCount = status
    ? status.fields.filter((f) => f.configured).length
    : 0
  const totalCount = service.fields.length
  const allConfigured = configuredCount === totalCount

  const categoryColor = CATEGORY_COLORS[service.category] ?? '#6b7280'

  const cardStyle: React.CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    marginBottom: '0.75rem',
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    overflow: 'hidden',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    userSelect: 'none',
    backgroundColor: expanded ? '#f9fafb' : '#fff',
  }

  const titleGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    flex: 1,
  }

  const titleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  }

  const nameStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: '#111827',
  }

  const categoryBadgeStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    fontWeight: 600,
    padding: '0.1rem 0.4rem',
    borderRadius: '9999px',
    backgroundColor: categoryColor,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const descStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    color: '#6b7280',
  }

  const summaryStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    color: allConfigured ? '#16a34a' : '#b45309',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    marginLeft: '0.75rem',
  }

  const chevronStyle: React.CSSProperties = {
    marginLeft: '0.5rem',
    fontSize: '0.75rem',
    color: '#9ca3af',
  }

  const bodyStyle: React.CSSProperties = {
    padding: '1rem',
    borderTop: '1px solid #f3f4f6',
  }

  const docsLinkStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#2563eb',
    marginBottom: '0.75rem',
    display: 'block',
  }

  function getFieldStatus(key: string): boolean {
    if (!status) return false
    const f = status.fields.find((sf) => sf.key === key)
    return f ? f.configured : false
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle} onClick={() => setExpanded((e) => !e)}>
        <div style={titleGroupStyle}>
          <div style={titleRowStyle}>
            <span style={nameStyle}>{service.name}</span>
            <span style={categoryBadgeStyle}>{service.category}</span>
          </div>
          <span style={descStyle}>{service.description}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={summaryStyle}>
            {isLoading
              ? 'Loading…'
              : allConfigured
              ? 'All configured ✓'
              : `${configuredCount}/${totalCount} configured`}
          </span>
          <span style={chevronStyle}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={bodyStyle}>
          {service.docsUrl && (
            <a
              href={service.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={docsLinkStyle}
            >
              Documentation →
            </a>
          )}
          {service.fields.map((field) => (
            <ApiKeyField
              key={field.key}
              field={field}
              isConfigured={getFieldStatus(field.key)}
              initialValue={getFieldStatus(field.key) ? '••••••••' : ''}
              onSave={(value) => onSave(service.id, field.key, value)}
              disabled={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  )
}
