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
