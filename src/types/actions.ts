/**
 * Command contract: client → server (and onward to the robot).
 *
 * Every UI action is sent over the existing authenticated socket as the
 * single event `control_message`, with a Socket.IO ack callback:
 *
 *     socket.emit('control_message', { action, data, timestamp }, (res: CommandResponse) => ...)
 *
 * `action` discriminates the payload. Server should ack with
 * `{ success: true }` or `{ success: false, reason: '...' }`.
 */

/** The single socket event every UI command is emitted on. */
export const CONTROL_EVENT = 'control_message';

/** Ack payload the server must send back through the emit callback. */
export interface CommandResponse {
  success: boolean;
  /** human-readable confirmation, e.g. "patrol paused" */
  message?: string;
  /** failure reason when success === false */
  reason?: string;
  /** optional extra payload (e.g. export URL, report id) */
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
  /** optional ISO date range */
  from?: string;
  to?: string;
}

export interface ScheduleReportRequest {
  kind: ExportKind;
  /** cron-ish simple schedule */
  every: 'daily' | 'weekly' | 'monthly';
  format: ExportFormat;
}

export interface MissionRequest {
  name?: string;
  /** field/block ids the mission covers */
  blocks?: string[];
  /** waypoints as [lat, lng] pairs (optional — server may plan the route) */
  waypoints?: [number, number][];
}

export interface CropBatchRequest {
  crop: string;
  block?: string;
  plantedAt?: string; // ISO date
  notes?: string;
}

/** Settings screen — full fleet configuration snapshot sent on "Apply & Sync". */
export interface FleetConfig {
  /** m/s, 0.5–2.5 */
  maxSpeed: number;
  /** cm radial LiDAR clearance */
  obstacleClearanceCm: number;
  /** auto return-to-base on bad weather */
  weatherRTB: boolean;
  /** auto micro-spray on confirmed detections */
  microSpray: boolean;
  /** 50–99 (%) pathogen confidence cutoff */
  confidenceThreshold: number;
  /** active vision model id */
  visionModel?: string;
  /** capture FPS */
  captureFps?: number;
}

/* ------------------------------------------------------------------ */
/* Discriminated union of every action the UI can send                 */
/* ------------------------------------------------------------------ */

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
  | { action: 'deploy_waypoint_mission'; data?: MissionRequest };

export type ActionName = ControlAction['action'];

/** Wire format actually emitted: the action plus a client timestamp. */
export type ControlMessage = ControlAction & { timestamp: number };
