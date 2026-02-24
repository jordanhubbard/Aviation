/**
 * Aviation UI Framework - Theme Types
 * 
 * Type definitions for the theming system supporting:
 * - Day mode (default light theme)
 * - Night mode (red tint for night vision preservation)
 * - High-contrast mode (WCAG AAA accessibility)
 */

/**
 * Available theme modes
 */
export type ThemeMode = 'day' | 'night' | 'high-contrast';

/**
 * Color palette definition for a theme
 */
export interface ThemeColors {
  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  
  // Secondary/accent colors
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  backgroundElevated: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  
  // Semantic colors
  success: string;
  successLight: string;
  successDark: string;
  
  warning: string;
  warningLight: string;
  warningDark: string;
  
  error: string;
  errorLight: string;
  errorDark: string;
  
  info: string;
  infoLight: string;
  infoDark: string;
  
  // Border colors
  border: string;
  borderLight: string;
  borderDark: string;
  
  // Focus indicator
  focus: string;
  focusRing: string;
}

/**
 * Typography settings for a theme
 */
export interface ThemeTypography {
  fontFamily: string;
  fontFamilyMono: string;
  
  // Font sizes
  fontSizeXs: string;
  fontSizeSm: string;
  fontSizeBase: string;
  fontSizeLg: string;
  fontSizeXl: string;
  fontSize2xl: string;
  fontSize3xl: string;
  
  // Font weights
  fontWeightNormal: number;
  fontWeightMedium: number;
  fontWeightBold: number;
  
  // Line heights
  lineHeightTight: number;
  lineHeightNormal: number;
  lineHeightRelaxed: number;
}

/**
 * Spacing scale for a theme
 */
export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
}

/**
 * Complete theme definition
 */
export interface Theme {
  mode: ThemeMode;
  name: string;
  description: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  
  // Accessibility metadata
  accessibility: {
    minContrastRatio: number;
    supportsReducedMotion: boolean;
    supportsHighContrast: boolean;
  };
}

/**
 * Theme context for React components
 */
export interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

/**
 * Theme preference storage
 */
export interface ThemePreference {
  mode: ThemeMode;
  autoDetect: boolean;
  lastUpdated: string;
}
