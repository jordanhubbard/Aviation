type WindBarbOptions = {
  size?: number
  backgroundFill?: string
  backgroundStroke?: string
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const line = (x1: number, y1: number, x2: number, y2: number) => {
  const p = `x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`
  return [
    `<line ${p} stroke="#fff" stroke-width="4" stroke-linecap="round" />`,
    `<line ${p} stroke="#111" stroke-width="2" stroke-linecap="round" />`,
  ].join('')
}

const polygon = (points: Array<[number, number]>) => {
  const pts = points.map(([x, y]) => `${x},${y}`).join(' ')
  return [
    `<polygon points="${pts}" fill="#111" stroke="#fff" stroke-width="3" stroke-linejoin="round" />`,
    `<polygon points="${pts}" fill="#111" stroke="#111" stroke-width="1" stroke-linejoin="round" />`,
  ].join('')
}

/**
 * Returns SVG markup for a standard meteorological/aviation wind barb.
 * Assumes `directionDeg` is the METAR-style direction (degrees wind is coming FROM).
 */
export const windBarbSvg = (directionDeg: number, speedKt: number, opts: WindBarbOptions = {}) => {
  const size = clamp(Math.round(opts.size ?? 40), 24, 64)

  const bgFill = opts.backgroundFill
  const bgStroke = opts.backgroundStroke ?? '#ffffff'

  const dir = Number.isFinite(directionDeg) ? directionDeg : 0
  const spd = Number.isFinite(speedKt) ? speedKt : 0
  const rounded = Math.max(0, Math.round(spd / 5) * 5)

  const cx = 20
  const cy = 20
  const endY = 4

  const background = bgFill
    ? `<circle cx="${cx}" cy="${cy}" r="10" fill="${bgFill}" stroke="${bgStroke}" stroke-width="3" opacity="0.95" />`
    : ''

  if (rounded < 3) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
        <g>
          ${background}
          <circle cx="${cx}" cy="${cy}" r="7" fill="#fff" stroke="#111" stroke-width="2" />
        </g>
      </svg>
    `.trim()
  }

  let remaining = rounded
  const flags = Math.floor(remaining / 50)
  remaining = remaining % 50
  const fullBarbs = Math.floor(remaining / 10)
  remaining = remaining % 10
  const halfBarbs = remaining >= 5 ? 1 : 0

  const dxFull = 12
  const dyFull = 6
  const dxHalf = dxFull / 2
  const dyHalf = dyFull / 2

  const barbSpacing = 4
  let y = endY

  let shapes = ''

  for (let i = 0; i < flags; i++) {
    shapes += polygon([
      [cx, y],
      [cx, y + barbSpacing * 2],
      [cx + dxFull, y + barbSpacing],
    ])
    y += barbSpacing * 2
  }

  for (let i = 0; i < fullBarbs; i++) {
    shapes += line(cx, y, cx + dxFull, y + dyFull)
    y += barbSpacing
  }

  if (halfBarbs) {
    shapes += line(cx, y, cx + dxHalf, y + dyHalf)
  }

  const staff = line(cx, cy, cx, endY)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
      ${background}
      <g transform="rotate(${dir} ${cx} ${cy})">
        ${staff}
        ${shapes}
      </g>
    </svg>
  `.trim()
}
