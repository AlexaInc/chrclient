
export const CONTROL_EVENT = 'control_message';

export interface CommandResponse {
  success: boolean;
  message?: string;
  reason?: string;
  data?: unknown;
}

/* ------------------------------------------------------------------ */
/* Domain value types — every one of these maps to something the       */
/* server/robot can actually do. See chrserver's ROVER_ACTIONS /        */
/* PUMP_ACTIONS / UNSUPPORTED_ACTIONS allow-lists for ground truth.     */
/* ------------------------------------------------------------------ */

/** The rover only has two real operating modes: fully autonomous patrol,
 *  or paused-for-manual-drive. There is no "charging" mode (no battery
 *  gauge) and no separate persisted "paused" mode distinct from manual. */
export type RoverMode = 'autonomous' | 'manual';

export type DriveDirection = 'forward' | 'backward' | 'left' | 'right' | 'stop';

export interface DriveCommand {
  direction: DriveDirection;
}

export interface MissionRequest {
  blocks?: string[];
  rowSpacingM?: number;
  scanSpacingM?: number;
  arrivalRadiusM?: number;
  headingDeg?: number;
}

export interface CropBatchRequest {
  crop: string;
  block?: string;
  plantedAt?: string; // ISO date
  notes?: string;
}

/** Mirrors chrserver's FleetConfig exactly — every field is a real,
 *  persisted setting the server (and, for irrigation threshold, the pump)
 *  actually consumes. */
export interface FleetConfig {
  rowSpacingM: number;
  scanSpacingM: number;
  arrivalRadiusM: number;
  irrigationThresholdPercent: number;
  diseaseAlertThreshold: number;
}

export type ControlAction =
  /* --- robot motion / mission --- */
  | { action: 'stop' }               // E-Stop
  | { action: 'start_patrol' }
  | { action: 'pause_patrol' }
  | { action: 'return_to_base' }
  | { action: 'manual_teleop'; data: { enabled: boolean } }
  | { action: 'change_mode'; data: { mode: RoverMode } }
  | { action: 'deploy_mission'; data: MissionRequest }
  /* --- camera / AI scan (manual/ad-hoc capture — the real patrol capture
   *  flow is fully automatic and needs no client action at all) --- */
  | { action: 'cap_photo' }
  | { action: 'camera_capture_burst' }
  /* --- alerts --- */
  | { action: 'acknowledge_alerts'; data?: { ids?: number[] } }
  /* --- crops --- */
  | { action: 'register_crop_batch'; data: CropBatchRequest }
  /* --- settings --- */
  | { action: 'apply_config'; data: FleetConfig }
  /* --- map / location --- */
  | { action: 'drive'; data: DriveCommand }
  | { action: 'save_field_map'; data: import('./map').FieldMapMessage }
  | { action: 'get_field_map' }
  /* --- ESP32-C3 irrigation controller --- */
  | { action: 'pump_on'; data?: { durationSeconds?: number; blockId?: string } }
  | { action: 'pump_off' }
  | { action: 'pump_auto'; data: { enabled: boolean } }
  | { action: 'set_irrigation_threshold'; data: { moisturePercent: number } }
  | { action: 'irrigate_block'; data: { blockId: string; durationSeconds?: number } }
  | { action: 'stop_irrigation' };

export type ActionName = ControlAction['action'];

/** Wire format actually emitted: the action plus a client timestamp. */
export type ControlMessage = ControlAction & { timestamp: number };
