import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import { addEventListener, removeEventListener } from '../scripts/Websocket';
import {
  AlertMessage,
  LocationMessage,
  MESSAGE_UPSERT_EVENT,
  parseEnvelope,
  RealtimeEnvelope,
  SensorsMessage,
  StatusMessage,
  IrrigationMessage,
  DeviceMessage,
  AIScanMessage,
  MissionMessage,
  MissionReportMessage,
} from '../types/messages';
import { startDemoSimulator } from './demoSimulator';
import { setCommandDemoMode } from '../scripts/Commands';
import { FieldBlock, FieldMapMessage, UltrasonicMessage, blockAt } from '../types/map';
import { fetchState, PatrolSummary, StateSnapshot } from '../scripts/Api';
import { FleetConfig } from '../types/actions';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface AlertEntry {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description?: string;
  timestamp?: string | number;
  receivedAt: number;
  acknowledgedAt?: number | null;
}

export interface RealtimeState {
  location: LocationMessage | null;
  /** recent GPS fixes, oldest first (max 200) — used to draw the track */
  trail: LocationMessage[];
  status: StatusMessage | null;
  sensors: SensorsMessage | null;
  alerts: AlertEntry[];
  fieldMap: FieldMapMessage | null;
  currentBlock: FieldBlock | null;
  ultrasonic: UltrasonicMessage | null;
  irrigation: IrrigationMessage | null;
  devices: Record<string, DeviceMessage>;
  robotOnline: boolean;
  pumpOnline: boolean;
  latestScan: AIScanMessage | null;
  mission: MissionMessage | null;
  latestReport: MissionReportMessage | null;
  fleetConfig: FleetConfig | null;
  recentPatrols: PatrolSummary[];
  /** epoch ms of the last message of any kind, null = nothing yet */
  lastUpdated: number | null;
  /** true once the initial /api/state snapshot has been applied (or, in demo
   *  mode, immediately) — screens can use this to distinguish "no data yet"
   *  from "still loading". */
  hydrated: boolean;
  /** true when data is being simulated (demo/demo login) */
  isDemo: boolean;
}

const initialState: RealtimeState = {
  location: null,
  trail: [],
  status: null,
  sensors: null,
  alerts: [],
  fieldMap: null,
  currentBlock: null,
  ultrasonic: null,
  irrigation: null,
  devices: {},
  robotOnline: false,
  pumpOnline: false,
  latestScan: null,
  mission: null,
  latestReport: null,
  fleetConfig: null,
  recentPatrols: [],
  lastUpdated: null,
  hydrated: false,
  isDemo: false,
};

type Action =
  | { kind: 'envelope'; envelope: RealtimeEnvelope; at: number }
  | { kind: 'hydrate'; snapshot: StateSnapshot }
  | { kind: 'reset'; isDemo: boolean }
  | { kind: 'ack'; ids?: number[]; at: number };

let alertSeq = 0;

function reducer(state: RealtimeState, action: Action): RealtimeState {
  if (action.kind === 'reset') {
    return { ...initialState, isDemo: action.isDemo };
  }

  // The `acknowledge_alerts` command is DB-only server-side and doesn't
  // broadcast anything back — mark it locally so screens (Dashboard's alert
  // count, Alerts screen) update immediately instead of waiting on the next
  // hydrate/live event.
  if (action.kind === 'ack') {
    const ids = action.ids;
    return {
      ...state,
      alerts: state.alerts.map((a) =>
        (!ids || ids.includes(a.id)) && !a.acknowledgedAt ? { ...a, acknowledgedAt: action.at } : a,
      ),
    };
  }

  if (action.kind === 'hydrate') {
    const s = action.snapshot;
    const location: LocationMessage | null = s.location
      ? {
          latitude: s.location.latitude,
          longitude: s.location.longitude,
          altitude: s.location.altitude ?? 0,
          satellites: s.location.satellites ?? 0,
          deviceId: 'robot-01',
        }
      : state.location;
    const sensors: SensorsMessage | null = s.sensors
      ? {
          temperature: s.sensors.temperature ?? 0,
          humidity: s.sensors.humidity ?? undefined,
          rainDrop: s.sensors.rain_percent ?? undefined,
          isRaining: s.sensors.is_raining ? Boolean(s.sensors.is_raining) : false,
          distForward: s.sensors.dist_forward_cm ?? undefined,
          distLeft: s.sensors.dist_left_cm ?? undefined,
          distRight: s.sensors.dist_right_cm ?? undefined,
          blockId: s.sensors.block_id,
          plant: s.sensors.plant,
          deviceId: 'robot-01',
        }
      : state.sensors;
    const irrigation: IrrigationMessage | null = s.irrigation
      ? {
          deviceId: s.irrigation.device_id,
          pumpOn: Boolean(s.irrigation.pump_on),
          autoMode: Boolean(s.irrigation.auto_mode),
          soilMoisture: s.irrigation.soil_moisture ?? undefined,
          threshold: s.irrigation.threshold ?? undefined,
          activeBlockId: s.irrigation.active_block_id,
          lastSeen: s.irrigation.received_at,
        }
      : state.irrigation;
    const fieldMap = s.fieldMap ?? state.fieldMap;
    const currentBlock = location ? blockAt(fieldMap, location.latitude, location.longitude) : state.currentBlock;
    const mission: MissionMessage | null = s.activeMission
      ? {
          missionId: s.activeMission.missionId,
          patrolId: s.activeMission.patrolId,
          blocks: s.activeMission.blocks,
          config: { rowSpacingM: s.activeMission.config.rowSpacingM, scanSpacingM: s.activeMission.config.scanSpacingM, arrivalRadiusM: s.activeMission.config.arrivalRadiusM },
          waypoints: s.activeMission.waypoints,
          state: 'deployed',
          currentWaypoint: s.status.currentWaypoint ?? 0,
        }
      : state.mission;
    const alerts: AlertEntry[] = s.alerts.recent.map((a) => ({
      id: a.id,
      severity: a.severity,
      title: a.title,
      description: a.description,
      timestamp: a.created_at,
      receivedAt: a.created_at,
      acknowledgedAt: a.acknowledged_at,
    }));
    return {
      ...state,
      location,
      sensors,
      irrigation,
      fieldMap,
      currentBlock,
      mission,
      status: s.status,
      fleetConfig: s.fleetConfig,
      robotOnline: s.devices.robotOnline,
      pumpOnline: s.devices.pumpOnline,
      alerts,
      recentPatrols: s.recentPatrols,
      hydrated: true,
    };
  }

  const { envelope, at } = action;
  const next: RealtimeState = { ...state, lastUpdated: at };

  switch (envelope.Type) {
    case 'location': {
      next.location = envelope.Message;
      next.trail = [...state.trail.slice(-199), envelope.Message];
      next.currentBlock = blockAt(state.fieldMap, envelope.Message.latitude, envelope.Message.longitude);
      return next;
    }
    case 'status':
      next.status = envelope.Message;
      return next;
    case 'sensors':
      next.sensors = envelope.Message;
      return next;
    case 'alert': {
      const entry: AlertEntry = {
        id: envelope.Message.id ?? ++alertSeq,
        severity: envelope.Message.severity,
        title: envelope.Message.title,
        description: envelope.Message.description,
        timestamp: envelope.Message.timestamp,
        receivedAt: at,
        acknowledgedAt: null,
      };
      // de-dupe in case the same alert id arrives twice (e.g. hydrate race)
      next.alerts = [entry, ...state.alerts.filter((a) => a.id !== entry.id)].slice(0, 100);
      return next;
    }
    case 'map': {
      next.fieldMap = envelope.Message;
      if (state.location)
        next.currentBlock = blockAt(envelope.Message, state.location.latitude, state.location.longitude);
      return next;
    }
    case 'ultrasonic':
      next.ultrasonic = envelope.Message;
      return next;
    case 'irrigation':
      next.irrigation = envelope.Message;
      return next;
    case 'device':
      next.devices = { ...state.devices, [envelope.Message.deviceId]: envelope.Message };
      if (envelope.Message.role === 'esp_32') next.robotOnline = envelope.Message.online;
      if (envelope.Message.role === 'esp_c3_pump') next.pumpOnline = envelope.Message.online;
      return next;
    case 'ai_scan':
      next.latestScan = envelope.Message;
      return next;
    case 'mission':
      next.mission = envelope.Message;
      return next;
    case 'mission_progress':
    case 'mission_complete': {
      const m = envelope.Message;
      next.mission = state.mission && state.mission.missionId === m.missionId
        ? { ...state.mission, state: m.state === 'running' ? 'deployed' : (m.state as any), currentWaypoint: m.currentWaypoint, totalWaypoints: m.totalWaypoints, progress: m.progress, message: m.message }
        : state.mission;
      return next;
    }
    case 'report':
      next.latestReport = envelope.Message;
      return next;
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Context / provider                                                  */
/* ------------------------------------------------------------------ */

export interface RealtimeContextValue extends RealtimeState {
  /** Call after a successful `acknowledgeAlerts` command so the UI updates
   *  immediately (the server doesn't broadcast anything for this action). */
  acknowledgeLocally: (ids?: number[]) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, token } = useAuth();
  const isDemo = isAuthenticated && user?.username === 'demo';
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    dispatch({ kind: 'reset', isDemo });
    setCommandDemoMode(isDemo); // demo login: commands are acked locally
    if (!isAuthenticated) return;

    const handle = (raw: unknown) => {
      const envelope = parseEnvelope(raw);
      if (envelope) dispatch({ kind: 'envelope', envelope, at: Date.now() });
    };

    if (isDemo) {
      // demo/demo login: no server — feed fabricated envelopes instead.
      const stop = startDemoSimulator((envelope) =>
        handle(envelope as unknown),
      );
      return stop;
    }

    // Real login: the socket was connected by AuthContext before
    // isAuthenticated flipped true, so the listener attaches safely here.
    addEventListener(MESSAGE_UPSERT_EVENT, handle);

    // Hydrate once from the REST snapshot so screens show real data
    // immediately (device online flags, alert history, field map,
    // fleet config, ...) instead of waiting for the next live event.
    let cancelled = false;
    if (token) {
      fetchState(token)
        .then((snapshot) => {
          if (!cancelled) dispatch({ kind: 'hydrate', snapshot });
        })
        .catch((e) => console.warn('[realtime] failed to load initial state:', e?.message ?? e));
    }

    return () => {
      cancelled = true;
      removeEventListener(MESSAGE_UPSERT_EVENT);
    };
  }, [isAuthenticated, isDemo, token]);

  const acknowledgeLocally = React.useCallback((ids?: number[]) => {
    dispatch({ kind: 'ack', ids, at: Date.now() });
  }, []);

  const value = useMemo(() => ({ ...state, acknowledgeLocally }), [state, acknowledgeLocally]);
  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside <RealtimeProvider>');
  return ctx;
}
