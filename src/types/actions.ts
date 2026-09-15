
export const CONTROL_EVENT = 'control_message';

export interface CommandResponse {
  success: boolean;
  message?: string;
  reason?: string;
  data?: unknown;
}

/* ------------------------------------------------------------------ */
/* Domain value types                                                  */
/* ------------------------------------------------------------------ */

export type RoverMode = 'autonomous' | 'manual' | 'paused' | 'charging';

export type CameraChannel = 'rgb' | 'nir' | 'ndvi' | 'thermal';
export type CameraZoom = '1x' | '2x' | '4x' | 'macro';

export type ExportKind = 'incident_log' | 'agronomy_report' | 'crops_csv' | 'telemetry';
export type ExportFormat = 'csv' | 'pdf' | 'json';

export interface ExportRequest {
  kind: ExportKind;
  format: ExportFormat;
  from?: string;
  to?: string;
}

export interface ScheduleReportRequest {
  kind: ExportKind;
  every: 'daily' | 'weekly' | 'monthly';
  format: ExportFormat;
}

export type DriveDirection = 'forward' | 'backward' | 'left' | 'right' | 'stop';

export interface DriveCommand {
  direction: DriveDirection;
  speed: number; // 0-100 percent throttle
}

export interface MissionRequest {
  name?: string;
  blocks?: string[];
  waypoints?: [number, number][];
}

export interface CropBatchRequest {
  crop: string;
  block?: string;
  plantedAt?: string; // ISO date
  notes?: string;
}

export interface FleetConfig {
  maxSpeed: number;
  obstacleClearanceCm: number;
  weatherRTB: boolean;
  microSpray: boolean;
  confidenceThreshold: number;
  visionModel?: string;
  /** capture FPS */
  captureFps?: number;
}


export type ControlAction =
  /* --- robot motion / mission --- */
  | { action: 'stop'; data?: { speed?: number } }               // E-Stop
  | { action: 'start_patrol' }
  | { action: 'pause_patrol' }
  | { action: 'return_to_base' }
  | { action: 'manual_teleop'; data: { enabled: boolean } }
  | { action: 'calibrate_gimbal' }
  | { action: 'change_mode'; data: { mode: RoverMode } }
  | { action: 'set_speed'; data: { speed: number } }
  | { action: 'deploy_mission'; data: MissionRequest }
  /* --- camera / AI scan --- */
  | { action: 'camera_set_channel'; data: { channel: CameraChannel } }
  | { action: 'camera_set_zoom'; data: { zoom: CameraZoom } }
  | { action: 'camera_record'; data: { recording: boolean } }
  | { action: 'camera_capture_burst'; data?: { frames?: number } }
  /* --- alerts --- */
  | { action: 'acknowledge_alerts'; data?: { ids?: number[] } }
  /* --- reports / analytics / crops --- */
  | { action: 'export_report'; data: ExportRequest }
  | { action: 'schedule_report'; data: ScheduleReportRequest }
  | { action: 'run_predictive_model'; data?: { crop?: string } }
  | { action: 'register_crop_batch'; data: CropBatchRequest }
  | { action: 'select_crop_source'; data: { crop: string } }
  /* --- settings --- */
  | { action: 'apply_config'; data: FleetConfig }
  /* --- map / location --- */
  | { action: 'add_field_boundary' }
  | { action: 'deploy_waypoint_mission'; data?: MissionRequest }
  | { action: 'drive'; data: DriveCommand }
  | { action: 'save_field_map'; data: import('./map').FieldMapMessage }
  | { action: 'get_field_map' };

export type ActionName = ControlAction['action'];

/** Wire format actually emitted: the action plus a client timestamp. */
export type ControlMessage = ControlAction & { timestamp: number };
