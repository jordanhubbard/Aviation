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
 * Color palette for a theme
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
  fontWeightSemibold: number;
  fontWeightBold: number;
  
  // Line heights
  lineHeightTight: number;
  lineHeightNormal: number;
  lineHeightRelaxed: number;
}

/**
 * Spacing settings for a theme
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
 * Shadow settings for a theme
 */
export interface ThemeShadows {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

/**
 * Border radius settings
 */
export interface ThemeBorderRadius {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

/**
 * Transition settings
 */
export interface ThemeTransitions {
  fast: string;
  normal: string;
  slow: string;
}

/**
 * Complete theme definition
 */
export interface Theme {
  name: string;
  mode: ThemeMode;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  shadows: ThemeShadows;
  borderRadius: ThemeBorderRadius;
  transitions: ThemeTransitions;
}

/**
 * Theme context value for React context
 */
export interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

/**
 * Theme provider props
 */
export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  storageKey?: string;
}
