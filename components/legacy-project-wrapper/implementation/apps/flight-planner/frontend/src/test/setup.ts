import '@testing-library/jest-dom'

// Keep Vitest output clean while still surfacing real errors.
// React/MUI warnings sometimes come through as printf-style format strings, so we
// join all args before filtering.
const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => String(a)).join(' ')

  if (msg.includes('ReactDOMTestUtils.act')) return
  if (msg.includes('not wrapped in act') && msg.includes('TouchRipple')) return

  originalConsoleError(...(args as Parameters<typeof originalConsoleError>))
}
