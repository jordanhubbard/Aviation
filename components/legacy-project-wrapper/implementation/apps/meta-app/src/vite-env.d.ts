/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_META_APP_MODE?: 'tabs' | 'launcher';
  readonly VITE_ACCIDENT_TRACKER_URL?: string;
  readonly VITE_MISSIONS_URL?: string;
  readonly VITE_FLIGHT_PLANNER_URL?: string;
  readonly VITE_FLIGHT_SCHOOL_URL?: string;
  readonly VITE_FOREFLIGHT_URL?: string;
  readonly VITE_FLIGHT_TRACKER_URL?: string;
  readonly VITE_WEATHER_BRIEFING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
