/**
 * Permission, token and server registration for phone notifications.
 *
 * The app is the only part of the system that can ask the phone for permission
 * and obtain a push token; chrserver cannot do either. So on every start this
 * provider walks the same small path:
 *
 *   1. install the foreground handler and create the Android channels
 *   2. ask for permission (first run only — the OS only lets us ask once)
 *   3. reuse the token stored on this device, or fetch a new one from Expo
 *   4. POST it to chrserver's /api/push/register so alerts have somewhere to go
 *
 * If any step cannot be done — a build without Firebase, a phone that said no,
 * a server that is off — the provider records *why* and Settings shows it. The
 * app keeps working; alerts are then at least visible inside the app.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { usePreferences } from '../state/Preferences';
import { readPref, writePref } from '../state/deviceStorage';
import {
  PermissionState,
  PushSeverity,
  PushStatusInput,
  PushStatusText,
  pushStatusText,
  registrationPlan,
} from './pushPlan';
import {
  ensureAndroidChannels,
  fetchPushToken,
  getPermissionState,
  installForegroundHandler,
  notificationsSupported,
  onNotificationResponse,
  presentNotification,
  requestPermission,
} from './notify';
import {
  fetchPushStatus,
  registerPushDevice,
  sendPushTest,
  unregisterPushDevice,
  PushStatusDto,
} from '../scripts/Api';

const KEY_TOKEN = 'chrclient.push.token';
const KEY_LAST_TOKEN = 'chrclient.push.lastRegistered';

export interface PushContextValue {
  supported: boolean;
  permission: PermissionState;
  token: string | null;
  tokenError: string | null;
  registering: boolean;
  deviceCount: number | null;
  server: PushStatusDto | null;
  status: PushStatusText;
  /** ask again + register this phone (the Settings button) */
  enable: () => Promise<void>;
  /** re-read the server status without changing anything */
  refresh: () => Promise<void>;
  /** send one arrival test; falls back to a local notification */
  test: () => Promise<{ ok: boolean; message: string }>;
  /** stop notifying this phone and forget it on the server */
  forget: () => Promise<void>;
  /** last notification the operator tapped (data payload) */
  lastTapped: any;
}

const PushContext = createContext<PushContextValue | undefined>(undefined);

export function PushProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, token: sessionToken } = useAuth();
  const { pushEnabled, setPushEnabled, pushSeverity } = usePreferences();
  const isDemo = isAuthenticated && user?.username === 'demo';

  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [token, setToken] = useState<string | null>(() => readPref(KEY_TOKEN));
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [server, setServer] = useState<PushStatusDto | null>(null);
  const [lastTapped, setLastTapped] = useState<any>(null);
  const inFlight = useRef(false);

  const supported = useMemo(() => notificationsSupported(), []);

  /** One pass of the four steps above. Safe to call repeatedly. */
  const register = useCallback(
    async (opts: { ask?: boolean } = {}) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setRegistering(true);
      try {
        installForegroundHandler();
        await ensureAndroidChannels();

        let state = await getPermissionState();
        setPermission(state);
        const stored = readPref(KEY_TOKEN);
        const plan = registrationPlan({
          platform: Platform.OS,
          isDemo: !!isDemo,
          supported,
          permission: state,
          hasStoredToken: !!stored,
        });

        if (plan.requestPermission || (opts.ask && state !== 'denied')) {
          state = await requestPermission();
          setPermission(state);
        }
        if (state !== 'granted' || !plan.registerOnServer) {
          setRegistering(false);
          return;
        }

        let pushToken = stored;
        if (!pushToken || plan.fetchToken) {
          const fetched = await fetchPushToken();
          setTokenError(fetched.error);
          if (fetched.token) {
            pushToken = fetched.token;
            writePref(KEY_TOKEN, fetched.token);
            setToken(fetched.token);
          }
        } else {
          setTokenError(null);
        }

        if (!pushToken || !sessionToken) {
          setRegistering(false);
          return;
        }

        try {
          const out = await registerPushDevice(
            {
              token: pushToken,
              platform: Platform.OS,
              label: Platform.OS === 'android' ? 'Android phone' : Platform.OS === 'ios' ? 'iPhone' : 'Browser',
            },
            sessionToken,
          );
          setServer((prev) => (prev ? { ...prev, deviceCount: out.devices, activeDevices: out.devices } : prev));
          writePref(KEY_LAST_TOKEN, pushToken);
        } catch (e: any) {
          // The phone is registered locally; the server just could not be told
          // right now (offline, restarted). The next refresh fixes it.
          setTokenError(`could not reach the server: ${e?.message ?? e}`);
        }

        try {
          setServer(await fetchPushStatus(sessionToken));
        } catch {
          /* status is a nicety; registration above is what matters */
        }
      } finally {
        inFlight.current = false;
        setRegistering(false);
      }
    },
    [isDemo, sessionToken, supported],
  );

  // Ask + register on start whenever the operator has notifications switched on.
  useEffect(() => {
    if (!isAuthenticated || isDemo) return;
    void (async () => {
      setPermission(await getPermissionState());
      if (!pushEnabled) return;
      await register();
    })();
  }, [isAuthenticated, isDemo, pushEnabled, register]);

  // Refresh the server-side picture (how many phones, last send, last error).
  const refresh = useCallback(async () => {
    if (!sessionToken) return;
    try {
      setServer(await fetchPushStatus(sessionToken));
    } catch (e: any) {
      setTokenError(`could not read the push status: ${e?.message ?? e}`);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken || isDemo) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    return () => clearInterval(timer);
  }, [sessionToken, isDemo, refresh]);

  // Tapping a notification is the operator's way back into the app.
  useEffect(() => onNotificationResponse((data) => setLastTapped(data)), []);

  const enable = useCallback(async () => {
    setPushEnabled(true);
    await register({ ask: true });
  }, [register, setPushEnabled]);

  const test = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    // Always show something on this phone first: if the server route is not set
    // up yet, the operator still sees where the notifications will appear.
    const local = await presentNotification({
      title: 'AI Crop Robot',
      body: 'Test notification — rain, petrol and offline alerts will look like this.',
      channelId: 'alerts',
      priority: 'high',
      severity: 'warning',
      data: { type: 'alert', alertId: null, severity: 'warning', route: 'Alerts' },
    });
    if (!sessionToken) {
      return { ok: local, message: local ? 'Shown on this phone (not registered with a server).' : 'The phone refused to show it — check the notification permission.' };
    }
    try {
      const out = await sendPushTest(sessionToken, 'Test notification from Settings — if you can see this, rain and safety alerts will reach this phone.');
      await refresh();
      if (out.ok) return { ok: true, message: `Sent to ${out.sent} registered phone${out.sent === 1 ? '' : 's'}.` };
      if (out.reason === 'no-devices') {
        return { ok: local, message: 'This phone is not registered with the server yet — press “Register this phone”. The test you just saw came from the app itself.' };
      }
      if (out.reason === 'disabled') return { ok: local, message: 'Push is switched off on the server (PUSH_ENABLED=false).' };
      return { ok: local, message: `The server could not send it: ${out.reason ?? 'unknown reason'}. ${local ? 'A local test was shown instead.' : ''}` };
    } catch (e: any) {
      return { ok: local, message: `Could not reach the server: ${e?.message ?? e}. ${local ? 'A local test was shown instead.' : ''}` };
    }
  }, [refresh, sessionToken]);

  const forget = useCallback(async () => {
    const current = readPref(KEY_TOKEN);
    if (current && sessionToken) {
      try {
        await unregisterPushDevice(current, sessionToken);
      } catch {
        /* the server will drop the token by itself once Expo reports it dead */
      }
    }
    setPushEnabled(false);
    await refresh();
  }, [refresh, sessionToken, setPushEnabled]);

  const status = useMemo(
    () =>
      pushStatusText({
        supported,
        permission,
        prefsOn: pushEnabled,
        isDemo: !!isDemo,
        token,
        tokenError,
        deviceCount: server?.deviceCount ?? null,
        serverEnabled: server?.enabled ?? null,
        lastSentAt: server?.lastSentAt ?? null,
        lastError: server?.lastError ?? null,
        registering,
      }),
    [supported, permission, pushEnabled, isDemo, token, tokenError, server, registering],
  );

  const value = useMemo<PushContextValue>(
    () => ({ supported, permission, token, tokenError, registering, deviceCount: server?.deviceCount ?? null, server, status, enable, refresh, test, forget, lastTapped }),
    [supported, permission, token, tokenError, registering, server, status, enable, refresh, test, forget, lastTapped],
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePush(): PushContextValue {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error('usePush must be used inside <PushProvider>');
  return ctx;
}

/** For components that may render outside the provider (a preview, a test). */
export function usePushOptional(): PushContextValue | null {
  return useContext(PushContext) ?? null;
}

export type { PushSeverity };
