import React, { useState } from 'react'
import type { ServiceFieldDefinition } from '../types'

export type ApiKeyFieldProps = {
  field: ServiceFieldDefinition
  initialValue?: string
  isConfigured: boolean
  onSave: (value: string) => Promise<void>
  disabled?: boolean
}

export function ApiKeyField({ field, initialValue = '', isConfigured, onSave, disabled = false }: ApiKeyFieldProps) {
  const [value, setValue] = useState(initialValue)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const displayValue = isConfigured && !editing ? '••••••••' : value
  const hasChange = value !== initialValue && value !== '••••••••' && value.length > 0
  const canSave = hasChange && !saving && !disabled

  function handleFocus() {
    if (isConfigured && !editing) {
      setEditing(true)
      setValue('')
    }
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaveResult(null)
    setErrorMessage('')
    try {
      await onSave(value)
      setSaveResult('success')
      setEditing(false)
    } catch (err) {
      setSaveResult('error')
      setErrorMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: 600,
    fontSize: '0.875rem',
    marginBottom: '0.25rem',
    color: '#1f2937',
  }

  const descStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginBottom: '0.375rem',
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '0.375rem 0.625rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
    color: '#111827',
    backgroundColor: disabled ? '#f3f4f6' : '#fff',
  }

  const saveButtonStyle: React.CSSProperties = {
    padding: '0.375rem 0.875rem',
    backgroundColor: canSave ? '#2563eb' : '#93c5fd',
    color: '#fff',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    cursor: canSave ? 'pointer' : 'not-allowed',
    whiteSpace: 'nowrap',
  }

  const badgeStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#16a34a',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }

  const envHintStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    color: '#9ca3af',
    marginTop: '0.2rem',
    fontFamily: 'monospace',
  }

  const fieldWrapStyle: React.CSSProperties = {
    marginBottom: '0.75rem',
  }

  return (
    <div style={fieldWrapStyle}>
      <label style={labelStyle}>
        {field.label}
        {field.required && <span style={{ color: '#dc2626', marginLeft: '0.2rem' }}>*</span>}
      </label>
      <div style={descStyle}>{field.description}</div>
      <div style={rowStyle}>
        <input
          type={field.secret ? 'password' : 'text'}
          value={displayValue}
          onChange={(e) => {
            setValue(e.target.value)
            setSaveResult(null)
            if (!editing) setEditing(true)
          }}
          onFocus={handleFocus}
          disabled={disabled || saving}
          placeholder={isConfigured ? 'Enter new value to update' : `Enter ${field.label}`}
          style={inputStyle}
        />
        {isConfigured && !editing && (
          <span style={badgeStyle}>Configured ✓</span>
        )}
        {(editing || !isConfigured) && (
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={saveButtonStyle}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      <div style={envHintStyle}>env: {field.envVar}</div>
      {saveResult === 'success' && (
        <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.2rem' }}>Saved successfully.</div>
      )}
      {saveResult === 'error' && (
        <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.2rem' }}>{errorMessage || 'Failed to save.'}</div>
      )}
    </div>
  )
}
