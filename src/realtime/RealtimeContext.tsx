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
  BatteryMessage,
  LocationMessage,
  MESSAGE_UPSERT_EVENT,
  parseEnvelope,
  RealtimeEnvelope,
  SensorsMessage,
  StatusMessage,
  TelemetryMessage,
} from '../types/messages';
import { startDemoSimulator } from './demoSimulator';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface AlertEntry extends AlertMessage {
  id: number;
  receivedAt: number;
}

export interface RealtimeState {
  location: LocationMessage | null;
  /** recent GPS fixes, oldest first (max 200) — used to draw the track */
  trail: LocationMessage[];
  telemetry: TelemetryMessage | null;
  battery: BatteryMessage | null;
  status: StatusMessage | null;
  sensors: SensorsMessage | null;
  alerts: AlertEntry[];
  /** epoch ms of the last message of any kind, null = nothing yet */
  lastUpdated: number | null;
  /** true when data is being simulated (demo/demo login) */
  isDemo: boolean;
}

const initialState: RealtimeState = {
  location: null,
  trail: [],
  telemetry: null,
  battery: null,
  status: null,
  sensors: null,
  alerts: [],
  lastUpdated: null,
  isDemo: false,
};

type Action =
  | { kind: 'envelope'; envelope: RealtimeEnvelope; at: number }
  | { kind: 'reset'; isDemo: boolean };

let alertSeq = 0;

function reducer(state: RealtimeState, action: Action): RealtimeState {
  if (action.kind === 'reset') {
    return { ...initialState, isDemo: action.isDemo };
  }

  const { envelope, at } = action;
  const next: RealtimeState = { ...state, lastUpdated: at };

  switch (envelope.Type) {
    case 'location': {
      next.location = envelope.Message;
      next.trail = [...state.trail.slice(-199), envelope.Message];
      return next;
    }
    case 'telemetry':
      next.telemetry = { ...state.telemetry, ...envelope.Message };
      return next;
    case 'battery':
      next.battery = { ...state.battery, ...envelope.Message };
      return next;
    case 'status':
      next.status = { ...state.status, ...envelope.Message };
      return next;
    case 'sensors':
      next.sensors = { ...state.sensors, ...envelope.Message };
      return next;
    case 'alert': {
      const entry: AlertEntry = {
        ...envelope.Message,
        id: ++alertSeq,
        receivedAt: at,
      };
      next.alerts = [entry, ...state.alerts].slice(0, 50); // newest first
      return next;
    }
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Context / provider                                                  */
/* ------------------------------------------------------------------ */

const RealtimeContext = createContext<RealtimeState | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const isDemo = isAuthenticated && user?.username === 'demo';
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    dispatch({ kind: 'reset', isDemo });
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
    return () => removeEventListener(MESSAGE_UPSERT_EVENT);
  }, [isAuthenticated, isDemo]);

  const value = useMemo(() => state, [state]);
  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeState {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside <RealtimeProvider>');
  return ctx;
}
