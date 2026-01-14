/**
 * Wind Barb SVG Generator
 * 
 * Generates SVG wind barb symbols for aviation maps.
 * Extracted from flightplanner for shared use.
 */

export interface WindBarbOptions {
  size?: number;
  backgroundFill?: string;
  backgroundStroke?: string;
  barbColor?: string;
  strokeWidth?: number;
}

/**
 * Generate SVG for a wind barb symbol
 * 
 * @param direction Wind direction in degrees (where wind is from)
 * @param speed Wind speed in knots
 * @param options Styling options
 * @returns SVG string
 */
export function windBarbSvg(
  direction: number,
  speed: number,
  options: WindBarbOptions = {}
): string {
  const {
    size = 40,
    backgroundFill,
    backgroundStroke = '#000000',
    barbColor = '#000000',
    strokeWidth = 2,
  } = options;

  const center = size / 2;
  const radius = size / 2 - 2;

  // Wind direction (meteorological: where wind is FROM)
  // Rotate to point in the direction the wind is blowing TO
  const angle = (direction + 180) % 360;

  // Calculate barbs based on wind speed
  // 50 kt = pennant (triangle)
  // 10 kt = full barb (long line)
  // 5 kt = half barb (short line)
  const pennants = Math.floor(speed / 50);
  const fullBarbs = Math.floor((speed % 50) / 10);
  const halfBarbs = Math.floor((speed % 10) / 5);

  // Generate barb elements
  const barbs: string[] = [];
  let offset = 0;

  // Pennants (triangles)
  for (let i = 0; i < pennants; i++) {
    const y = -radius + offset;
    barbs.push(`
      <polygon
        points="${center},${center + y} ${center + 8},${center + y + 5} ${center},${center + y + 10}"
        fill="${barbColor}"
      />
    `);
    offset += 12;
  }

  // Full barbs
  for (let i = 0; i < fullBarbs; i++) {
    const y = -radius + offset;
    barbs.push(`
      <line
        x1="${center}"
        y1="${center + y}"
        x2="${center + 10}"
        y2="${center + y + 5}"
        stroke="${barbColor}"
        stroke-width="${strokeWidth}"
      />
    `);
    offset += 5;
  }

  // Half barbs
  for (let i = 0; i < halfBarbs; i++) {
    const y = -radius + offset;
    barbs.push(`
      <line
        x1="${center}"
        y1="${center + y}"
        x2="${center + 5}"
        y2="${center + y + 2.5}"
        stroke="${barbColor}"
        stroke-width="${strokeWidth}"
      />
    `);
    offset += 3;
  }

  // Calm winds (< 5 kt): draw a circle
  const calmCircle =
    speed < 5
      ? `<circle cx="${center}" cy="${center}" r="4" fill="none" stroke="${barbColor}" stroke-width="${strokeWidth}" />`
      : '';

  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${angle} ${center} ${center})">
        ${
          backgroundFill
            ? `<circle cx="${center}" cy="${center}" r="${radius}" fill="${backgroundFill}" stroke="${backgroundStroke}" stroke-width="2" />`
            : ''
        }
        ${calmCircle}
        ${speed >= 5 ? `<line x1="${center}" y1="${center}" x2="${center}" y2="${center - radius}" stroke="${barbColor}" stroke-width="${strokeWidth}" />` : ''}
        ${barbs.join('')}
      </g>
    </svg>
  `.trim();
}

/**
 * Get wind barb as data URL for use in Leaflet icon
 */
export function windBarbDataUrl(
  direction: number,
  speed: number,
  options?: WindBarbOptions
): string {
  const svg = windBarbSvg(direction, speed, options);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
