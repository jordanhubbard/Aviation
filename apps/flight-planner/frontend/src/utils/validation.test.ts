import { describe, expect, it } from 'vitest'

import { normalizeAirportCode, validateAirportCode } from './validation'

describe('normalizeAirportCode', () => {
  it('extracts airport code before dash', () => {
    expect(normalizeAirportCode('KPAO - Palo Alto Airport')).toBe('KPAO')
  })

  it('extracts airport code before em dash', () => {
    expect(normalizeAirportCode('ksfo — San Francisco')).toBe('KSFO')
  })

  it('supports FAA/local identifiers with digits', () => {
    expect(normalizeAirportCode('7s5 - Independence')).toBe('7S5')
  })
})

describe('validateAirportCode', () => {
  it('validates airport code with description', () => {
    const res = validateAirportCode('KPAO - Palo Alto Airport')
    expect(res.valid).toBe(true)
    expect(res.normalized).toBe('KPAO')
  })

  it('validates FAA/local identifiers with digits', () => {
    const res = validateAirportCode('7S5')
    expect(res.valid).toBe(true)
    expect(res.normalized).toBe('7S5')
  })
})
