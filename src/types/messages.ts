
export const MESSAGE_UPSERT_EVENT = 'message.upsert';

/* ------------------------------------------------------------------ */
/* Payloads — these mirror exactly what chrserver's WSServer emits.    */
/* There is no telemetry (speed/heading/pitch/roll) or battery message */
/* type: the rover has no IMU, wheel encoders, or battery gauge, so    */
/* the server never synthesizes or forwards anything like that.       */
/* ------------------------------------------------------------------ */

/** Type: "location" — GPS fix from the rover. */
export interface LocationMessage {
  latitude: number;
  longitude: number;
  /** metres above sea level */
  altitude: number;
  /** number of GNSS satellites in the fix */
  satellites: number;
  deviceId: string;
}

/** Real, observable robot states only. There is no charging/returning/scanning
 *  state on this hardware build (no battery gauge, no autonomous return-to-base
 *  path, no distinct "scanning" mode — photo capture happens inline during a
 *  patrol waypoint stop). */
export type RobotState = 'offline' | 'patrolling' | 'idle' | 'fault';

export interface StatusMessage {
  state: RobotState;
  mode: 'autonomous' | 'manual';
  missionId?: string;
  currentWaypoint?: number;
  totalWaypoints?: number;
  progress?: number;
  message?: string;
}

/** Type: "sensors" — sanitized rover sensor snapshot. The rover's onboard
 *  `soilMoisture` analog reading is dropped server-side (uncalibrated/not
 *  trustworthy) and is NEVER present here. The only legitimate soil-moisture
 *  reading in this whole system comes from the pump controller's
 *  `IrrigationMessage.soilMoisture`. */
export interface SensorsMessage {
  temperature: number;
  humidity?: number;
  /** raindrop sensor reading, 0-100% */
  rainDrop?: number;
  isRaining?: boolean;
  distForward?: number;
  distLeft?: number;
  distRight?: number;
  blockId?: string | null;
  plant?: string | null;
  deviceId: string;
}

export interface AlertMessage {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description?: string;
  timestamp?: string | number;
}

/** Type: "irrigation" — the pump controller's own state. This is the ONLY
 *  legitimate source of a soil-moisture reading anywhere in this app. */
export interface IrrigationMessage {
  deviceId: string;
  pumpOn: boolean;
  autoMode: boolean;
  soilMoisture?: number;
  threshold?: number;
  activeBlockId?: string | null;
  remainingSeconds?: number;
  lastSeen?: number;
}

export interface DeviceMessage {
  deviceId: string;
  role: 'esp_32' | 'esp_c3_pump' | string;
  online: boolean;
  lastSeen: number;
}

export interface ScanPrediction {
  className: string;
  confidence: number;
}

/** Type: "ai_scan" — one analyzed photo. This is a live progress ping only;
 *  the client must never present per-image "analyzing" UI from this — the
 *  finished patrol report (Type: "report") is the only user-facing result. */
export interface AIScanMessage {
  deviceId: string;
  plant: string;
  blockId: string | null;
  blockName: string | null;
  missionId?: string;
  patrolId?: number;
  scanPoint?: number;
  side?: 'left' | 'right' | 'manual';
  imagePath?: string;
  predictions: ScanPrediction[];
  capturedAt: number;
}

export interface MissionConfig {
  rowSpacingM: number;
  scanSpacingM: number;
  arrivalRadiusM: number;
  headingDeg?: number;
}

export interface MissionWaypoint {
  index: number;
  latitude: number;
  longitude: number;
  blockId: string;
  blockName: string;
  plant: string;
  scan: boolean;
  row: number;
}

/** Type: "mission" — full deployed mission (sent once, right after deploy),
 *  then progressively merged with live `mission_progress`/`mission_complete`
 *  updates (see RealtimeContext reducer) so a single object always reflects
 *  the latest known state of the active/last mission. */
export interface MissionMessage {
  missionId: string;
  patrolId: number;
  blocks: string[];
  config: MissionConfig;
  waypoints: MissionWaypoint[];
  createdAt?: number;
  state?: 'deployed' | 'running' | 'paused' | 'completed' | 'fault';
  currentWaypoint?: number;
  /** merged in from mission_progress/mission_complete — absent until the
   *  first progress ping arrives after deploy. */
  totalWaypoints?: number;
  progress?: number;
  message?: string;
}

/** Type: "mission_progress" / "mission_complete" — robot-reported progress. */
export interface MissionProgressMessage {
  missionId: string;
  patrolId: number;
  state: 'running' | 'paused' | 'completed' | 'fault';
  currentWaypoint: number;
  totalWaypoints: number;
  progress: number;
  message?: string;
}

export interface ReportAverage {
  className: string;
  averageConfidence: number;
  samples: number;
}

export interface ReportScan {
  id: number;
  patrol_id: number;
  mission_id: string;
  block_id: string;
  plant: string;
  scan_point: number;
  side: string;
  image_path: string;
  predictions: ScanPrediction[];
  created_at: number;
}

/** Type: "report" — the ONLY thing the AI-scan feature ever shows the user:
 *  a finished, server-built batch report produced automatically once a
 *  patrol/mission completes. There is no client-triggered "analyze" action. */
export interface MissionReportMessage {
  id: number;
  missionId: string;
  report: {
    missionId: string;
    patrolId: number;
    imageCount: number;
    blocks: string[];
    averages: ReportAverage[];
    scans: ReportScan[];
    completedAt: number;
  };
}

export type RealtimeEnvelope =
  | { Type: 'location'; Message: LocationMessage }
  | { Type: 'status'; Message: StatusMessage }
  | { Type: 'sensors'; Message: SensorsMessage }
  | { Type: 'alert'; Message: AlertMessage }
  | { Type: 'map'; Message: import('./map').FieldMapMessage }
  | { Type: 'ultrasonic'; Message: import('./map').UltrasonicMessage }
  | { Type: 'irrigation'; Message: IrrigationMessage }
  | { Type: 'device'; Message: DeviceMessage }
  | { Type: 'ai_scan'; Message: AIScanMessage }
  | { Type: 'mission'; Message: MissionMessage }
  | { Type: 'mission_progress'; Message: MissionProgressMessage }
  | { Type: 'mission_complete'; Message: MissionProgressMessage }
  | { Type: 'report'; Message: MissionReportMessage };

export type MessageType = RealtimeEnvelope['Type'];

const KNOWN_TYPES: MessageType[] = [
  'location',
  'status',
  'sensors',
  'alert',
  'map',
  'ultrasonic',
  'irrigation',
  'device',
  'ai_scan',
  'mission',
  'mission_progress',
  'mission_complete',
  'report',
];


export function parseEnvelope(raw: unknown): RealtimeEnvelope | null {
  let data: any = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  const type = data.Type ?? data.type;
  const message = data.Message ?? data.message;
  if (typeof type !== 'string' || !message || typeof message !== 'object') {
    console.warn('[realtime] dropped malformed envelope:', raw);
    return null;
  }
  if (!KNOWN_TYPES.includes(type as MessageType)) {
    console.warn(`[realtime] unknown message Type "${type}" — ignoring`);
    return null;
  }
  return { Type: type, Message: message } as RealtimeEnvelope;
}
