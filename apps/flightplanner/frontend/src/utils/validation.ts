export interface ValidationResult {
  valid: boolean
  error?: string
  normalized?: string
}

export const normalizeAirportCode = (value: string): string => {
  const trimmed = value.trim().toUpperCase()
  if (!trimmed) return ''

  // Accept inputs like "KPAO - Palo Alto Airport" and keep only the code before the dash.
  const beforeDash = trimmed.split(/[-–—]/)[0]?.trim() || ''
  const token = beforeDash.split(/\s+/)[0]?.trim() || ''

  const match = token.match(/^[A-Z0-9]{3,5}$/)
  return match ? token : ''
}

export const validateAirportCode = (code: string): ValidationResult => {
  const normalized = normalizeAirportCode(code)

  if (!normalized) {
    return { valid: false, error: 'Airport code is required' }
  }

  if (normalized.length < 3 || normalized.length > 5) {
    return {
      valid: false,
      error: 'Airport code must be 3-5 characters',
    }
  }

  if (!/^[A-Z0-9]+$/.test(normalized)) {
    return {
      valid: false,
      error: 'Airport code must contain only letters and numbers',
    }
  }

  return { valid: true, normalized }
}

export const validateRequired = (value: string, fieldName: string): ValidationResult => {
  if (!value || value.trim() === '') {
    return { valid: false, error: `${fieldName} is required` }
  }
  return { valid: true }
}
