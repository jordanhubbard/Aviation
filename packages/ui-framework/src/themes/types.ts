/**
 * Theme Types for Aviation UI Framework
 * 
 * Defines the structure for display themes including:
 * - Day mode (default)
 * - Night mode (red tint for night vision preservation)
 * - High-contrast mode (accessibility)
 */

/**
 * Available theme modes
 */
export type ThemeMode = 'day' | 'night' | 'high-contrast';

/**
 * Color palette structure for themes
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
}

/**
 * Typography settings for themes
 */
export interface ThemeTypography {
  fontFamily: string;
  fontSizeBase: string;
  fontSizeSmall: string;
  fontSizeLarge: string;
  fontSizeXLarge: string;
  fontWeight: number;
  fontWeightBold: number;
  lineHeight: number;
  lineHeightTight: number;
}

/**
 * Spacing settings for themes
 */
export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
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
 * CSS custom properties generated from theme
 */
export type ThemeCSSVariables = Record<string, string>;
