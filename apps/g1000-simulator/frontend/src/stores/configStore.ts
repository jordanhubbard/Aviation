// configStore.ts
import create from 'zustand';

export interface SimulatorConfig {
  // Display settings
  brightness: number; // 0-100
  contrast: number; // 0-100
  theme: 'day' | 'night' | 'high-contrast';
  
  // Flight dynamics
  windSpeed: number; // knots
  windDirection: number; // degrees
  turbulenceLevel: number; // 0-100
  
  // Aircraft settings
  aircraftType: string; // e.g., 'C172', 'C182', 'SR22'
  weight: number; // lbs
  fuelQuantity: number; // gallons
  
  // Avionics settings
  baroSetting: number; // inHg
  magneticVariation: number; // degrees
  
  // Audio settings
  masterVolume: number; // 0-100
  enableAudio: boolean;
}

export interface ConfigProfile {
  id: string;
  name: string;
  config: SimulatorConfig;
  createdAt: Date;
  updatedAt: Date;
}

interface ConfigStore {
  currentConfig: SimulatorConfig;
  profiles: ConfigProfile[];
  activeProfileId: string | null;
  
  // Config management
  updateConfig: (partial: Partial<SimulatorConfig>) => void;
  resetToDefaults: () => void;
  
  // Profile management
  createProfile: (name: string) => void;
  loadProfile: (profileId: string) => void;
  deleteProfile: (profileId: string) => void;
  updateProfile: (profileId: string, name: string) => void;
  saveCurrentAsProfile: (name: string) => void;
}

const DEFAULT_CONFIG: SimulatorConfig = {
  brightness: 80,
  contrast: 50,
  theme: 'day',
  windSpeed: 0,
  windDirection: 0,
  turbulenceLevel: 0,
  aircraftType: 'C172',
  weight: 2450,
  fuelQuantity: 40,
  baroSetting: 29.92,
  magneticVariation: 0,
  masterVolume: 75,
  enableAudio: true,
};

export const useConfigStore = create<ConfigStore>((set, get) => ({
  currentConfig: DEFAULT_CONFIG,
  profiles: [],
  activeProfileId: null,

  updateConfig: (partial) =>
    set((state) => ({
      currentConfig: { ...state.currentConfig, ...partial },
    })),

  resetToDefaults: () =>
    set({
      currentConfig: DEFAULT_CONFIG,
      activeProfileId: null,
    }),

  createProfile: (name) =>
    set((state) => {
      const newProfile: ConfigProfile = {
        id: `profile-${Date.now()}-${Math.random()}`,
        name,
        config: { ...state.currentConfig },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return {
        profiles: [...state.profiles, newProfile],
      };
    }),

  loadProfile: (profileId) =>
    set((state) => {
      const profile = state.profiles.find((p) => p.id === profileId);
      if (profile) {
        return {
          currentConfig: { ...profile.config },
          activeProfileId: profileId,
        };
      }
      return state;
    }),

  deleteProfile: (profileId) =>
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== profileId),
      activeProfileId:
        state.activeProfileId === profileId ? null : state.activeProfileId,
    })),

  updateProfile: (profileId, name) =>
    set((state) => ({
      profiles: state.profiles.map((p) =>
        p.id === profileId
          ? { ...p, name, updatedAt: new Date() }
          : p
      ),
    })),

  saveCurrentAsProfile: (name) =>
    set((state) => {
      const existingProfile = state.profiles.find((p) => p.name === name);
      if (existingProfile) {
        return {
          profiles: state.profiles.map((p) =>
            p.id === existingProfile.id
              ? {
                  ...p,
                  config: { ...state.currentConfig },
                  updatedAt: new Date(),
                }
              : p
          ),
        };
      }
      const newProfile: ConfigProfile = {
        id: `profile-${Date.now()}-${Math.random()}`,
        name,
        config: { ...state.currentConfig },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return {
        profiles: [...state.profiles, newProfile],
        activeProfileId: newProfile.id,
      };
    }),
}));
