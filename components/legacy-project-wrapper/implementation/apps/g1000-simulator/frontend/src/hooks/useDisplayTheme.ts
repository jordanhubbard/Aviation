/**
 * useDisplayTheme
 *
 * Returns the active display theme and a palette of theme-specific color
 * values for PFD and MFD elements.
 *
 * The theme is read from configStore when available. If the store has not been
 * initialised or returns an unexpected value, the hook defaults to 'day'.
 *
 * Note: configStore uses 'high-contrast' rather than 'bright'. This hook
 * surfaces 'high-contrast' as the third theme option and maps it to a palette
 * suited to bright-sunlight cockpit conditions.
 *
 * Usage:
 *   const { theme, colors } = useDisplayTheme()
 *   <div style={{ background: colors.background }}>…</div>
 */

import { useConfigStore } from '../stores/configStore'

/** The three supported display themes, matching configStore's SimulatorConfig. */
export type DisplayTheme = 'day' | 'night' | 'high-contrast'

/**
 * Color tokens for G1000-style PFD / MFD elements.
 *
 * Naming follows the G1000 NXi color convention where practical:
 *   - background:        outer bezel / display background
 *   - skyColor:          ADI upper (sky) half
 *   - groundColor:       ADI lower (ground / earth) half
 *   - primaryText:       default instrument readouts
 *   - secondaryText:     labels, subtitles, inactive values
 *   - magenta:           active nav target, flight plan active leg
 *   - cyan:              autopilot active mode, selected heading bug
 *   - green:             normal operating range arcs, "in range" values
 *   - yellow:            caution alerts, off-scale tape values
 *   - red:               warning alerts, limit exceedances
 *   - white:             armed autopilot modes, standard readouts
 *   - softkeyBackground: softkey button bar background
 *   - softkeyText:       softkey label text
 *   - softkeyActive:     highlighted / toggled-on softkey label
 *   - tapeBackground:    airspeed / altimeter tape background
 *   - tapeBorder:        tape tick marks and borders
 */
export interface DisplayColorPalette {
  background: string
  skyColor: string
  groundColor: string
  primaryText: string
  secondaryText: string
  magenta: string
  cyan: string
  green: string
  yellow: string
  red: string
  white: string
  softkeyBackground: string
  softkeyText: string
  softkeyActive: string
  tapeBackground: string
  tapeBorder: string
}

const DAY_COLORS: DisplayColorPalette = {
  background: '#1a1a1a',
  skyColor: '#3d7ab5',        // G1000 medium aviation blue
  groundColor: '#7a4a1e',     // G1000 earth brown
  primaryText: '#ffffff',
  secondaryText: '#b0b0b0',
  magenta: '#ff40ff',
  cyan: '#00e5ff',
  green: '#00c000',
  yellow: '#ffbf00',
  red: '#ff2020',
  white: '#ffffff',
  softkeyBackground: '#000000',
  softkeyText: '#ffffff',
  softkeyActive: '#00e5ff',
  tapeBackground: '#111111',
  tapeBorder: '#555555',
}

const NIGHT_COLORS: DisplayColorPalette = {
  background: '#0a0a0a',
  skyColor: '#1a3a5c',        // darker blue for night readability
  groundColor: '#3d2510',     // muted earth for night
  primaryText: '#e0e0e0',
  secondaryText: '#707070',
  magenta: '#cc30cc',
  cyan: '#009aaa',
  green: '#009000',
  yellow: '#cc9a00',
  red: '#cc1a1a',
  white: '#e0e0e0',
  softkeyBackground: '#000000',
  softkeyText: '#c0c0c0',
  softkeyActive: '#009aaa',
  tapeBackground: '#080808',
  tapeBorder: '#3a3a3a',
}

const HIGH_CONTRAST_COLORS: DisplayColorPalette = {
  background: '#000000',
  skyColor: '#5599d0',        // higher saturation for bright sunlight
  groundColor: '#9c6030',
  primaryText: '#ffffff',
  secondaryText: '#cccccc',
  magenta: '#ff60ff',
  cyan: '#40ffff',
  green: '#20e020',
  yellow: '#ffdd00',
  red: '#ff3030',
  white: '#ffffff',
  softkeyBackground: '#000000',
  softkeyText: '#ffffff',
  softkeyActive: '#40ffff',
  tapeBackground: '#0a0a0a',
  tapeBorder: '#888888',
}

const PALETTE_MAP: Record<DisplayTheme, DisplayColorPalette> = {
  'day': DAY_COLORS,
  'night': NIGHT_COLORS,
  'high-contrast': HIGH_CONTRAST_COLORS,
}

const VALID_THEMES = new Set<string>(['day', 'night', 'high-contrast'])

function resolveTheme(raw: string): DisplayTheme {
  if (VALID_THEMES.has(raw)) return raw as DisplayTheme
  return 'day'
}

export interface UseDisplayThemeResult {
  /** The active theme name. */
  theme: DisplayTheme
  /** Color palette for the active theme. */
  colors: DisplayColorPalette
}

/**
 * Returns the current display theme and its associated color palette.
 *
 * Components should use the returned `colors` object rather than hardcoding
 * CSS color values so that all three themes are supported automatically.
 */
export function useDisplayTheme(): UseDisplayThemeResult {
  // Read the theme from configStore. useConfigStore is always safe to call —
  // Zustand initialises synchronously so there is no null/undefined state.
  const rawTheme = useConfigStore((state) => state.currentConfig.theme)
  const theme = resolveTheme(rawTheme)
  const colors = PALETTE_MAP[theme]
  return { theme, colors }
}
