export type G1000ThemeId = 'day' | 'night' | 'high-contrast';

export type G1000Palette = {
  background: string;
  panel: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  warning: string;
  caution: string;
  sky: string;
  ground: string;
  horizon: string;
  mapRing: string;
  mapLabel: string;
  mapAircraft: string;
  mapAircraftStroke: string;
};

export type G1000Typography = {
  small: string;
  medium: string;
  large: string;
  title: string;
  data: string;
};

export type G1000Theme = {
  id: G1000ThemeId;
  label: string;
  palette: G1000Palette;
  typography: G1000Typography;
};

export const DEFAULT_G1000_TYPOGRAPHY: G1000Typography = {
  small: '11px "Fira Sans", sans-serif',
  medium: '12px "Fira Sans", sans-serif',
  large: '16px "Fira Sans", sans-serif',
  title: '18px "Fira Sans", sans-serif',
  data: '20px "Fira Sans", sans-serif',
};

export const G1000_THEMES: Record<G1000ThemeId, G1000Theme> = {
  day: {
    id: 'day',
    label: 'Day',
    palette: {
      background: '#0b1218',
      panel: '#111a21',
      border: '#1f2b36',
      textPrimary: '#e6edf3',
      textSecondary: '#9fb3c8',
      accent: '#4bb2e5',
      warning: '#f5d142',
      caution: '#f59f0b',
      sky: '#2f8ad8',
      ground: '#8b4c1f',
      horizon: '#f5f5f5',
      mapRing: '#355169',
      mapLabel: '#9fb3c8',
      mapAircraft: '#e6edf3',
      mapAircraftStroke: '#1f2933',
    },
    typography: DEFAULT_G1000_TYPOGRAPHY,
  },
  night: {
    id: 'night',
    label: 'Night',
    palette: {
      background: '#0a0606',
      panel: '#140808',
      border: '#331111',
      textPrimary: '#f5c2c2',
      textSecondary: '#b57171',
      accent: '#e05757',
      warning: '#ff8f4d',
      caution: '#ff4d4d',
      sky: '#3b1a1a',
      ground: '#1b0f0f',
      horizon: '#d49a9a',
      mapRing: '#4a2a2a',
      mapLabel: '#c48f8f',
      mapAircraft: '#f5c2c2',
      mapAircraftStroke: '#2b0f0f',
    },
    typography: DEFAULT_G1000_TYPOGRAPHY,
  },
  'high-contrast': {
    id: 'high-contrast',
    label: 'High Contrast',
    palette: {
      background: '#000000',
      panel: '#0b0b0b',
      border: '#ffffff',
      textPrimary: '#ffffff',
      textSecondary: '#e6e6e6',
      accent: '#00ffff',
      warning: '#ffff00',
      caution: '#ff00ff',
      sky: '#1e90ff',
      ground: '#8b4513',
      horizon: '#ffffff',
      mapRing: '#ffffff',
      mapLabel: '#ffffff',
      mapAircraft: '#00ffff',
      mapAircraftStroke: '#000000',
    },
    typography: DEFAULT_G1000_TYPOGRAPHY,
  },
};

export const DEFAULT_G1000_THEME = G1000_THEMES.day;

export const getG1000Theme = (id: G1000ThemeId): G1000Theme => {
  return G1000_THEMES[id] ?? DEFAULT_G1000_THEME;
};
