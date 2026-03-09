// Themes module
// This module will contain implementations for day/night/high-contrast visual themes.

export interface Theme {
  name: string;
  colors: {
    background: string;
    foreground: string;
    accent: string;
    warning: string;
    caution: string;
    safe: string;
  };
}

// G1000-specific theme shape used by PFD/MFD layout
export interface G1000Theme {
  palette: {
    background: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    warning: string;
    sky?: string;
    ground?: string;
    horizon?: string;
    mapRing?: string;
    mapLabel?: string;
    mapAircraft?: string;
    mapAircraftStroke?: string;
  };
  typography: {
    medium: string;
    large?: string;
    small?: string;
    title?: string;
  };
}

export type G1000ThemeSource = string | G1000Theme;

export interface G1000ThemeManager {
  subscribe(callback: (theme: G1000Theme) => void): () => void;
  setTheme(source: G1000ThemeSource): void;
  getTheme(): G1000Theme;
}

export function resolveG1000Theme(source: G1000ThemeSource): G1000Theme {
  if (typeof source === 'object') return source;
  const t = getTheme(source);
  return {
    palette: {
      background: t.colors.background,
      border: t.colors.foreground,
      textPrimary: t.colors.foreground,
      textSecondary: t.colors.foreground,
      accent: t.colors.accent,
      warning: t.colors.warning,
    },
    typography: {
      medium: '12px sans-serif',
      large: '14px sans-serif',
      small: '10px sans-serif',
      title: '16px sans-serif',
    },
  };
}

export const dayTheme: Theme = {
  name: 'day',
  colors: {
    background: '#FFFFFF',
    foreground: '#000000',
    accent: '#0066CC',
    warning: '#FF6600',
    caution: '#FFCC00',
    safe: '#00CC00',
  },
};

export const nightTheme: Theme = {
  name: 'night',
  colors: {
    background: '#000000',
    foreground: '#00FF00',
    accent: '#0099FF',
    warning: '#FF3300',
    caution: '#FFFF00',
    safe: '#00FF00',
  },
};

export const highContrastTheme: Theme = {
  name: 'high-contrast',
  colors: {
    background: '#000000',
    foreground: '#FFFFFF',
    accent: '#FFFF00',
    warning: '#FF0000',
    caution: '#FFFF00',
    safe: '#00FF00',
  },
};

export function getTheme(themeName: string): Theme {
  switch (themeName) {
    case 'day':
      return dayTheme;
    case 'night':
      return nightTheme;
    case 'high-contrast':
      return highContrastTheme;
    default:
      return dayTheme;
  }
}
