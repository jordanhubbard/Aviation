/**
 * Hardware Integration Types
 * Defines interfaces for HOTAS, rudder pedals, multi-monitor, touch controls, and button panels
 */

/**
 * HOTAS (Hands On Throttle And Stick) Input
 * Represents yoke/stick and throttle control inputs
 */
export interface HOTASInput {
  // Yoke/Stick inputs
  pitch: number; // -1.0 (full back) to 1.0 (full forward)
  roll: number; // -1.0 (full left) to 1.0 (full right)
  yawTrim: number; // -1.0 to 1.0
  
  // Throttle inputs
  throttle1: number; // 0.0 (idle) to 1.0 (full)
  throttle2?: number; // For multi-engine aircraft
  throttle3?: number;
  
  // Propeller controls
  propeller1?: number; // 0.0 to 1.0
  propeller2?: number;
  
  // Mixture controls
  mixture1?: number; // 0.0 (lean) to 1.0 (rich)
  mixture2?: number;
  
  // Buttons on yoke
  pushToTalk?: boolean;
  autopilotEngage?: boolean;
  autopilotDisconnect?: boolean;
  trimUp?: boolean;
  trimDown?: boolean;
  trimLeft?: boolean;
  trimRight?: boolean;
}

/**
 * Rudder Pedals Input
 * Represents foot pedal controls
 */
export interface RudderPedalsInput {
  yaw: number; // -1.0 (full left) to 1.0 (full right)
  leftBrake: number; // 0.0 to 1.0
  rightBrake: number; // 0.0 to 1.0
  parkingBrake?: boolean;
}

/**
 * Multi-Monitor Display Configuration
 * Defines separate screens for PFD, MFD, and other displays
 */
export interface MonitorConfig {
  id: string;
  displayType: 'PFD' | 'MFD' | 'ENGINE' | 'SYSTEM' | 'CUSTOM';
  resolution: {
    width: number;
    height: number;
  };
  position: {
    x: number;
    y: number;
  };
  enabled: boolean;
}

/**
 * Touch Screen Bezel Controls
 * Represents physical buttons around touch screen edges
 */
export interface BezelControl {
  id: string;
  position: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
  index: number; // Position in the row/column
  label?: string;
  pressed: boolean;
}

/**
 * Physical Softkey/Button Panel
 * Represents dedicated button panels for quick access
 */
export interface SoftkeyPanel {
  id: string;
  name: string;
  buttonCount: number;
  buttons: SoftkeyButton[];
}

export interface SoftkeyButton {
  id: string;
  panelId: string;
  index: number;
  label: string;
  pressed: boolean;
  color?: 'WHITE' | 'GREEN' | 'YELLOW' | 'RED' | 'AMBER';
  illuminated?: boolean;
}

/**
 * Complete Hardware State
 * Aggregates all hardware inputs
 */
export interface HardwareState {
  hotas?: HOTASInput;
  rudderPedals?: RudderPedalsInput;
  monitors: MonitorConfig[];
  bezelControls: BezelControl[];
  softkeyPanels: SoftkeyPanel[];
  timestamp: number;
}

/**
 * Hardware Device Status
 */
export interface HardwareDeviceStatus {
  deviceId: string;
  deviceType: 'HOTAS' | 'RUDDER_PEDALS' | 'MONITOR' | 'BEZEL' | 'SOFTKEY_PANEL';
  connected: boolean;
  lastUpdate: number;
  error?: string;
}

/**
 * Hardware Configuration
 * Persistent settings for hardware setup
 */
export interface HardwareConfig {
  hotasEnabled: boolean;
  hotasDeviceId?: string;
  rudderPedalsEnabled: boolean;
  rudderPedalsDeviceId?: string;
  multiMonitorEnabled: boolean;
  monitors: MonitorConfig[];
  bezelControlsEnabled: boolean;
  softkeyPanelsEnabled: boolean;
  softkeyPanels: SoftkeyPanel[];
  calibration?: HardwareCalibration;
}

/**
 * Hardware Calibration Data
 */
export interface HardwareCalibration {
  hotasCalibration?: {
    pitchCenter: number;
    rollCenter: number;
    yawTrimCenter: number;
  };
  rudderPedalsCalibration?: {
    yawCenter: number;
    leftBrakeCenter: number;
    rightBrakeCenter: number;
  };
}