export interface ValidationResult {
  valid: boolean
  error?: string
  normalized?: string
}

// Accept inputs like "KPAO - Palo Alto Airport" and keep only the leading token.
const extractAirportCodeToken = (value: string): string => {
  const trimmed = value.trim().toUpperCase()
  if (!trimmed) return ''

  const beforeDash = trimmed.split(/[-–—]/)[0]?.trim() || ''
  return beforeDash.split(/\s+/)[0]?.trim() || ''
}

export const normalizeAirportCode = (value: string): string => {
  const token = extractAirportCodeToken(value)
  return /^[A-Z0-9]{3,5}$/.test(token) ? token : ''
}

export const validateAirportCode = (code: string): ValidationResult => {
  // Validate the raw token rather than the normalized code: normalization
  // collapses every malformed input to '', which would report everything as
  // missing and make the checks below unreachable.
  const token = extractAirportCodeToken(code)

  if (!token) {
    return { valid: false, error: 'Airport code is required' }
  }

  if (!/^[A-Z0-9]+$/.test(token)) {
    return {
      valid: false,
      error: 'Airport code must contain only letters and numbers',
    }
  }

  if (token.length < 3 || token.length > 5) {
    return {
      valid: false,
      error: 'Airport code must be 3-5 characters',
    }
  }

  return { valid: true, normalized: token }
}

export const validateRequired = (value: string, fieldName: string): ValidationResult => {
  if (!value || value.trim() === '') {
    return { valid: false, error: `${fieldName} is required` }
  }
  return { valid: true }
}
