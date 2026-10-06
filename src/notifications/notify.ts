/**
 * The thin adapter between the planning logic (pushPlan.ts) and the phone.
 *
 * Everything here is defensive on purpose. This module is imported by a provider
 * that renders on web, Android and iOS, sometimes in an Expo Go / dev client
 * that was built without the native module. A missing module must never crash
 * the app — it only means "notifications are not available here", which the
 * Settings card shows.
 *
 *   Android / iOS : expo-notifications (local notifications + Expo push token)
 *   web           : the browser Notification API, best effort
 */

import { Platform } from 'react-native';
import { ALERT_CHANNELS, NotificationContent, PermissionState } from './pushPlan';

type AnyNotifications = any;

let cached: AnyNotifications | null = null;
let tried = false;

/** The expo-notifications module, or null when this build does not have it. */
export function notificationsModule(): AnyNotifications | null {
  if (tried) return cached;
  tried = true;
  if (Platform.OS === 'web') return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-notifications');
    cached = mod && typeof mod.scheduleNotificationAsync === 'function' ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function notificationsSupported(): boolean {
  if (Platform.OS === 'web') return typeof (globalThis as any)?.Notification === 'function';
  return notificationsModule() != null;
}

/** Android 8+ drops a notification whose channel does not exist. */
export async function ensureAndroidChannels(): Promise<boolean> {
  const N = notificationsModule();
  if (!N || Platform.OS !== 'android') return false;
  try {
    const importance = {
      max: N.AndroidImportance?.MAX ?? 5,
      high: N.AndroidImportance?.HIGH ?? 4,
      default: N.AndroidImportance?.DEFAULT ?? 3,
    };
    for (const channel of ALERT_CHANNELS) {
      await N.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: importance[channel.importance],
        sound: channel.sound ? 'default' : null,
        vibrationPattern: channel.vibration ? [0, 250, 250, 250] : undefined,
        lockscreenVisibility: N.AndroidNotificationVisibility?.PUBLIC ?? 1,
        bypassDnd: false,
        showBadge: true,
      });
    }
    return true;
  } catch (e: any) {
    console.warn('[push] could not create the Android channels:', e?.message ?? e);
    return false;
  }
}

/**
 * A notification that arrives while the app is on screen must still be shown:
 * the whole point is that the phone behaves the same whether the app is open or
 * not, otherwise a rain alert is missed by whoever is staring at the map.
 */
export function installForegroundHandler(): void {
  const N = notificationsModule();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        // kept for older SDKs
        shouldShowAlert: true,
      }),
    });
  } catch (e: any) {
    console.warn('[push] could not install the foreground handler:', e?.message ?? e);
  }
}

/* ------------------------------------------------------------------ */
/* Permission                                                          */
/* ------------------------------------------------------------------ */

export async function getPermissionState(): Promise<PermissionState> {
  if (Platform.OS === 'web') {
    const api = (globalThis as any)?.Notification;
    if (typeof api !== 'function') return 'unsupported';
    const p = String(api.permission ?? 'default');
    return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'undetermined';
  }
  const N = notificationsModule();
  if (!N) return 'unsupported';
  try {
    const current = await N.getPermissionsAsync();
    if (current?.granted) return 'granted';
    const status = String(current?.status ?? current?.ios?.status ?? '');
    return status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'unsupported';
  }
}

/** Ask once. A denial is final on both platforms — only Settings can undo it. */
export async function requestPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') {
    const api = (globalThis as any)?.Notification;
    if (typeof api !== 'function') return 'unsupported';
    try {
      const result = await api.requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  const N = notificationsModule();
  if (!N) return 'unsupported';
  try {
    const asked = await N.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    if (asked?.granted) return 'granted';
    return String(asked?.status ?? '') === 'denied' ? 'denied' : 'undetermined';
  } catch (e: any) {
    console.warn('[push] permission request failed:', e?.message ?? e);
    return 'denied';
  }
}

/* ------------------------------------------------------------------ */
/* Token                                                               */
/* ------------------------------------------------------------------ */

export interface TokenResult {
  token: string | null;
  error: string | null;
  projectId: string | null;
}

/**
 * The Expo push token for this install. On Android this needs a Firebase
 * project wired into the build (google-services.json + the FCM V1 key on Expo's
 * side) — without it the call throws, and the thrown message is exactly what the
 * operator needs to read, so it is passed through instead of being swallowed.
 */
export async function fetchPushToken(): Promise<TokenResult> {
  const N = notificationsModule();
  if (!N || Platform.OS === 'web') {
    return { token: null, error: 'remote push is not available in this build', projectId: null };
  }
  let projectId: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants')?.default ?? require('expo-constants');
    projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      null;
  } catch {
    projectId = null;
  }
  try {
    const result = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = String(result?.data ?? '');
    if (!token) return { token: null, error: 'the phone returned an empty push token', projectId };
    return { token, error: null, projectId };
  } catch (e: any) {
    return { token: null, error: String(e?.message ?? e ?? 'unknown error'), projectId };
  }
}

/* ------------------------------------------------------------------ */
/* Showing a notification                                              */
/* ------------------------------------------------------------------ */

/**
 * Present one notification now (trigger null = immediately). Returns false when
 * nothing could be shown, so the caller can fall back to an in-app banner
 * instead of silently losing the alert.
 */
export async function presentNotification(content: NotificationContent): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      const api = (globalThis as any)?.Notification;
      if (typeof api !== 'function' || String(api.permission) !== 'granted') return false;
      // eslint-disable-next-line no-new
      new api(content.title, { body: content.body, tag: `chr-${content.data.alertId ?? content.data.type}` });
      return true;
    } catch {
      return false;
    }
  }
  const N = notificationsModule();
  if (!N) return false;
  try {
    await N.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        data: content.data,
        sound: content.severity === 'info' ? null : 'default',
        // A safety alert must out-rank chat apps on the lock screen.
        priority: content.priority === 'max' ? 'max' : content.priority === 'high' ? 'high' : 'default',
        ...(content.data.alertId != null ? { identifier: `alert-${content.data.alertId}` } : {}),
      },
      trigger: null,
    });
    return true;
  } catch (e: any) {
    console.warn('[push] could not show a notification:', e?.message ?? e);
    return false;
  }
}

/** Tapping an alert notification: hand the payload to whoever navigates. */
export function onNotificationResponse(handler: (data: any) => void): () => void {
  const N = notificationsModule();
  if (!N?.addNotificationResponseReceivedListener) return () => {};
  try {
    const sub = N.addNotificationResponseReceivedListener((response: any) => {
      handler(response?.notification?.request?.content?.data ?? null);
    });
    return () => {
      try {
        sub?.remove?.();
      } catch {
        /* already gone */
      }
    };
  } catch {
    return () => {};
  }
}
