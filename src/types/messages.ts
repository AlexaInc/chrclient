
export const MESSAGE_UPSERT_EVENT = 'message.upsert';

/* ------------------------------------------------------------------ */
/* Payloads                                                            */
/* ------------------------------------------------------------------ */

/** Type: "location" — GPS fix from the rover. */
export interface LocationMessage {
  latitude: number;
  longitude: number;
  /** metres above sea level */
  altitude: number;
  /** number of GNSS satellites in the fix */
  satellites: number;
}

/** Type: "telemetry" — motion / navigation telemetry. */
export interface TelemetryMessage {
  /** ground speed in m/s */
  speed: number;
  /** heading in degrees, 0–359 (0 = north) */
  heading: number;
  /** pitch in degrees (optional) */
  pitch?: number;
  /** roll in degrees (optional) */
  roll?: number;
  /** 0–100, percentage of today's route completed */
  routeProgress?: number;
  /** kilometres covered today */
  distanceKm?: number;
  /** rows scanned so far */
  rowsDone?: number;
  /** total rows in the mission */
  rowsTotal?: number;
}

/** Type: "battery" — power system state. */
export interface BatteryMessage {
  level: number;
  voltage?: number;
  charging?: boolean;
  solarWatts?: number;
  minutesRemaining?: number;
}

export type RobotState =
  | 'idle'
  | 'patrolling'
  | 'scanning'
  | 'returning'
  | 'charging'
  | 'fault'
  | 'offline';

export interface StatusMessage {
  state: RobotState;
  mode?: string;
  currentRow?: number;
  totalRows?: number;
  firmware?: string;
  message?: string;
}

export interface SensorsMessage {
  soilMoisture: number;
  temperature: number;
  humidity?: number;
  cropHealth?: number;
  pestAlerts?: number;
}

export interface AlertMessage {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description?: string;
  timestamp?: string | number;
}

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

export interface AIScanMessage {
  deviceId: string;
  plant: string;
  blockId: string | null;
  blockName: string | null;
  missionId?: string;
  scanPoint?: number;
  side?: 'left' | 'right' | 'manual';
  predictions: { className: string; confidence: number }[];
  capturedAt: number;
}

export interface MissionMessage {
  missionId: string;
  patrolId: number;
  state: 'deployed' | 'running' | 'paused' | 'completed' | 'fault';
  blocks: string[];
  currentWaypoint: number;
  totalWaypoints?: number;
  progress?: number;
  message?: string;
}

export interface MissionReportMessage {
  id: number;
  missionId: string;
  report: {
    imageCount: number;
    blocks: string[];
    averages: { className: string; averageConfidence: number; samples: number }[];
    completedAt: number;
  };
}

export type RealtimeEnvelope =
  | { Type: 'location'; Message: LocationMessage }
  | { Type: 'telemetry'; Message: TelemetryMessage }
  | { Type: 'battery'; Message: BatteryMessage }
  | { Type: 'status'; Message: StatusMessage }
  | { Type: 'sensors'; Message: SensorsMessage }
  | { Type: 'alert'; Message: AlertMessage }
  | { Type: 'map'; Message: import('./map').FieldMapMessage }
  | { Type: 'ultrasonic'; Message: import('./map').UltrasonicMessage }
  | { Type: 'irrigation'; Message: IrrigationMessage }
  | { Type: 'device'; Message: DeviceMessage }
  | { Type: 'ai_scan'; Message: AIScanMessage }
  | { Type: 'mission'; Message: MissionMessage }
  | { Type: 'mission_progress'; Message: MissionMessage }
  | { Type: 'mission_complete'; Message: MissionMessage }
  | { Type: 'report'; Message: MissionReportMessage };

export type MessageType = RealtimeEnvelope['Type'];

const KNOWN_TYPES: MessageType[] = [
  'location',
  'telemetry',
  'battery',
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
