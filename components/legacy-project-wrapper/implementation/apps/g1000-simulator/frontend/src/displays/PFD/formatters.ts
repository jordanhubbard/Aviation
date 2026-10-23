export const hasValue = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && !Number.isNaN(value)

export const formatNumber = (
  value: number | null | undefined,
  suffix: string,
  precision = 0,
): string => (hasValue(value) ? `${value.toFixed(precision)}${suffix}` : '---')

export const formatSigned = (value: number | null | undefined, suffix: string): string => {
  if (!hasValue(value)) return '---'
  const rounded = Math.round(value)
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}${suffix}`
}

export const formatCoordinate = (value: number | null | undefined): string =>
  hasValue(value) ? value.toFixed(4) : '---'

export const normalizeHeading = (value: number | null | undefined): number | null => {
  if (!hasValue(value)) return null
  return ((Math.round(value) % 360) + 360) % 360
}
