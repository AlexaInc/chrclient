/**
 * Realtime message contract.
 *
 * The server sends EVERY realtime update through a single Socket.IO event:
 *
 *     socket.emit('message.upsert', { Type: '<kind>', Message: { ...payload } })
 *
 * `Type` discriminates the payload shape. Example:
 *
 *     { "Type": "location",
 *       "Message": { "latitude": 6.9271, "longitude": 79.8612, "altitude": 15.4, "satellites": 7 } }
 *
 * Add new kinds by declaring the payload interface, adding a member to the
 * `RealtimeEnvelope` union, and handling it in the realtime reducer.
 */

/** The single socket event name every realtime update arrives on. */
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
  /** 0–100 percent */
  level: number;
  /** pack voltage */
  voltage?: number;
  charging?: boolean;
  /** solar input in watts */
  solarWatts?: number;
  /** estimated runtime remaining, in minutes */
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

/** Type: "status" — overall robot status. */
export interface StatusMessage {
  state: RobotState;
  /** e.g. "Autonomous Weeding" */
  mode?: string;
  currentRow?: number;
  totalRows?: number;
  firmware?: string;
  /** free-text status detail */
  message?: string;
}

/** Type: "sensors" — environment / crop sensor readings. */
export interface SensorsMessage {
  /** 0–100 percent */
  soilMoisture: number;
  /** °C */
  temperature: number;
  /** 0–100 percent relative humidity */
  humidity?: number;
  /** 0–100 crop health index */
  cropHealth?: number;
  /** count of active pest detections */
  pestAlerts?: number;
}

/** Type: "alert" — a notification the UI should surface. */
export interface AlertMessage {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description?: string;
  /** ISO string or epoch millis; defaults to arrival time */
  timestamp?: string | number;
}

/* ------------------------------------------------------------------ */
/* Envelope (discriminated union on `Type`)                            */
/* ------------------------------------------------------------------ */

export type RealtimeEnvelope =
  | { Type: 'location'; Message: LocationMessage }
  | { Type: 'telemetry'; Message: TelemetryMessage }
  | { Type: 'battery'; Message: BatteryMessage }
  | { Type: 'status'; Message: StatusMessage }
  | { Type: 'sensors'; Message: SensorsMessage }
  | { Type: 'alert'; Message: AlertMessage };

export type MessageType = RealtimeEnvelope['Type'];

const KNOWN_TYPES: MessageType[] = [
  'location',
  'telemetry',
  'battery',
  'status',
  'sensors',
  'alert',
];

/**
 * Validate raw socket data into a typed envelope.
 * Accepts an object or a JSON string; returns null for anything malformed
 * or with an unknown Type (logged so new server kinds are easy to spot).
 */
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
