/**
 * The decision half of push notifications — no React, no native modules, so it
 * can be unit-tested (chrclient-verify-push.ts) and reasoned about on its own.
 *
 * Split of duties:
 *   pushPlan.ts     what to notify about, with which words, on which channel
 *   notify.ts       the thin adapter over expo-notifications / the browser
 *   PushContext.tsx permission, token, registration with chrserver, status
 *   NotificationsBridge.tsx  watches the live socket state and fires the above
 *
 * The rules encoded here are the operator's, not ours:
 *   • the bathroom-hum of the app — every reading, every sync message — must NOT
 *     reach the phone's lock screen; only alerts, and only at or above the level
 *     the operator picked (default: warnings and up, criticals always);
 *   • history must never be notified: on app start the alert list is hydrated
 *     from /api/state, and those old alerts are not news;
 *   • one alert = one notification: the same alert re-sent by the socket (or the
 *     same title repeating while the condition lasts) is shown once.
 */

export type PushSeverity = 'info' | 'warning' | 'critical';

export const SEVERITY_RANK: Record<PushSeverity, number> = { info: 0, warning: 1, critical: 2 };

export const PUSH_SEVERITIES: PushSeverity[] = ['critical', 'warning', 'info'];

/** Default: warnings + criticals. Informational entries stay in the app only. */
export const DEFAULT_PUSH_SEVERITY: PushSeverity = 'warning';

export function isPushSeverity(value: unknown): value is PushSeverity {
  return value === 'info' || value === 'warning' || value === 'critical';
}

export function severityAtLeast(severity: PushSeverity, min: PushSeverity): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[min];
}

export function severityLabel(severity: PushSeverity): string {
  return severity === 'critical' ? 'Critical only' : severity === 'warning' ? 'Warnings & critical' : 'Everything';
}

export function severityHint(severity: PushSeverity): string {
  if (severity === 'critical') return 'Only rain, petrol empty, emergency stop and failsafe — the alerts that need you NOW.';
  if (severity === 'warning') return 'Warnings and criticals (recommended): robot offline, GPS lost, field-map sync failures, low petrol.';
  return 'Everything the app records, including notes. Expect a busy phone.';
}

/* ------------------------------------------------------------------ */
/* Android channels                                                    */
/* ------------------------------------------------------------------ */

/**
 * Channel ids are shared with chrserver: a remote push names the channel it
 * wants (`safety` / `alerts`), so the app must create exactly these ids or the
 * phone quietly drops the notification into the default channel instead.
 */
export interface ChannelPlan {
  id: string;
  name: string;
  importance: 'max' | 'high' | 'default';
  description: string;
  sound: boolean;
  vibration: boolean;
}

export const ALERT_CHANNELS: ChannelPlan[] = [
  {
    id: 'safety',
    name: 'Safety alerts',
    importance: 'max',
    description: 'Rain, petrol empty, emergency stop, drive failsafe. These wake the phone.',
    sound: true,
    vibration: true,
  },
  {
    id: 'alerts',
    name: 'Robot alerts',
    importance: 'high',
    description: 'Robot offline, GPS lost, field-map sync, mission problems.',
    sound: true,
    vibration: true,
  },
];

/** Which channel an alert belongs on. Criticals share the loud channel. */
export function channelFor(severity: PushSeverity): 'safety' | 'alerts' {
  return severity === 'critical' ? 'safety' : 'alerts';
}

/* ------------------------------------------------------------------ */
/* Notification content                                                */
/* ------------------------------------------------------------------ */

export interface AlertLike {
  id: number;
  severity: PushSeverity;
  title: string;
  description?: string | null;
  timestamp?: number;
}

export interface NotificationContent {
  title: string;
  body: string;
  channelId: 'safety' | 'alerts';
  /** Android: 'max' lifts the notification above a quiet phone. */
  priority: 'max' | 'high' | 'default';
  severity: PushSeverity;
  /** handed to the app when the notification is tapped */
  data: { type: 'alert' | 'robot'; alertId: number | null; severity: PushSeverity; route: string };
}

const TITLE_PREFIX: Record<PushSeverity, string> = { critical: '🚨', warning: '⚠️', info: 'ℹ️' };

export function clip(text: string, max = 180): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * What the operator reads on the lock screen. The alert title comes from the
 * server and is already written for humans ("Rain detected — pump off, robot
 * returning to base"); the description is the second line, clipped so a long
 * report does not turn into a wall of text on a small screen.
 */
export function notificationForAlert(alert: AlertLike): NotificationContent {
  const severity = isPushSeverity(alert.severity) ? alert.severity : 'warning';
  const channelId = channelFor(severity);
  return {
    title: `${TITLE_PREFIX[severity]} ${clip(alert.title, 90)}`,
    body: clip(alert.description || alert.title),
    channelId,
    priority: severity === 'critical' ? 'max' : severity === 'warning' ? 'high' : 'default',
    severity,
    data: { type: 'alert', alertId: alert.id ?? null, severity, route: 'Alerts' },
  };
}

/** Robot connected / disconnected — the one state change worth a buzz. */
export function notificationForRobot(online: boolean): NotificationContent {
  return online
    ? {
        title: '✅ Robot back online',
        body: 'The rover is reporting again. Missions can be deployed.',
        channelId: 'alerts',
        priority: 'default',
        severity: 'info',
        data: { type: 'robot', alertId: null, severity: 'info', route: 'Dashboard' },
      }
    : {
        title: '⚠️ Robot offline',
        body: 'No telemetry from the rover. Check the ESP32 power, Wi-Fi and range before deploying a mission.',
        channelId: 'alerts',
        priority: 'high',
        severity: 'warning',
        data: { type: 'robot', alertId: null, severity: 'warning', route: 'Dashboard' },
      };
}

/* ------------------------------------------------------------------ */
/* Which alerts are "new"                                              */
/* ------------------------------------------------------------------ */

export interface NotifyPrefs {
  enabled: boolean;
  minSeverity: PushSeverity;
}

/**
 * The alerts that arrived since the last look — newest first, one entry per id,
 * and never the hydrated history.
 *
 * `seen` is the caller's memory of ids already handled (the bridge keeps it in a
 * ref). `baseline` is set when the app has just hydrated: whatever was already
 * in the list is history, and history must not buzz a phone that has been in a
 * pocket all night.
 */
export function newAlertsToNotify(
  alerts: AlertLike[],
  seen: { has: (id: number) => boolean; add: (id: number) => void },
  prefs: NotifyPrefs,
): AlertLike[] {
  const fresh: AlertLike[] = [];
  for (const alert of alerts) {
    const id = Number(alert?.id);
    if (!Number.isFinite(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!prefs.enabled) continue;
    if (!severityAtLeast(isPushSeverity(alert.severity) ? alert.severity : 'warning', prefs.minSeverity)) continue;
    fresh.push(alert);
  }
  // Oldest first: the phone shows them in the order they happened.
  return fresh.reverse();
}

/**
 * Fill the memory with everything currently in the list, without notifying.
 * Called on the first hydrated state (and after a reconnect, where the server
 * re-sends recent alerts as part of the snapshot).
 */
export function markAllSeen(alerts: AlertLike[], seen: { add: (id: number) => void }): void {
  for (const alert of alerts) {
    const id = Number(alert?.id);
    if (Number.isFinite(id)) seen.add(id);
  }
}

/* ------------------------------------------------------------------ */
/* Registration plan                                                   */
/* ------------------------------------------------------------------ */

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface RegistrationInput {
  platform: string;
  isDemo: boolean;
  supported: boolean;
  permission: PermissionState;
  hasStoredToken: boolean;
}

export interface RegistrationPlan {
  requestPermission: boolean;
  attachNative: boolean;
  fetchToken: boolean;
  registerOnServer: boolean;
  reason: string;
}

/**
 * What the app should do at start-up. Kept as data so the verification suite can
 * assert every branch without a phone in hand — each of these five cases really
 * happens in the field.
 */
export function registrationPlan(input: RegistrationInput): RegistrationPlan {
  if (input.isDemo) {
    return { requestPermission: false, attachNative: false, fetchToken: false, registerOnServer: false, reason: 'demo login — no server, no notifications' };
  }
  if (!input.supported) {
    return { requestPermission: false, attachNative: false, fetchToken: false, registerOnServer: false, reason: 'this platform has no notification module (web tab keeps in-app alerts only)' };
  }
  if (input.permission === 'denied') {
    // Once denied, the OS refuses to ask again: the app can only point the
    // operator at the system settings screen (Settings card + banner).
    return { requestPermission: false, attachNative: false, fetchToken: false, registerOnServer: false, reason: 'permission denied — enable it in the phone settings' };
  }
  const needsAsk = input.permission === 'undetermined';
  return {
    requestPermission: needsAsk,
    attachNative: true,
    // A stored token is re-sent to the server on every start (so the server's
    // lastSeenAt stays fresh and a restored database still knows this phone);
    // a fresh token is only fetched when there is none, or after the OS
    // replaced it.
    fetchToken: !input.hasStoredToken,
    registerOnServer: true,
    reason: needsAsk ? 'asking for permission, then registering this phone' : 'registering this phone for alerts',
  };
}

/* ------------------------------------------------------------------ */
/* Status wording (Settings card + banner)                             */
/* ------------------------------------------------------------------ */

export interface PushStatusInput {
  supported: boolean;
  permission: PermissionState;
  prefsOn: boolean;
  isDemo: boolean;
  token: string | null;
  tokenError: string | null;
  deviceCount: number | null;
  serverEnabled: boolean | null;
  lastSentAt: number | null;
  lastError: string | null;
  registering: boolean;
}

export interface PushStatusText {
  state: 'on' | 'blocked' | 'off' | 'unsupported' | 'demo' | 'working' | 'local-only';
  label: string;
  detail: string;
  tone: 'ok' | 'warn' | 'bad' | 'muted';
}

export function pushStatusText(input: PushStatusInput): PushStatusText {
  if (input.isDemo) {
    return { state: 'demo', label: 'DEMO', detail: 'Demo login: notifications are not sent anywhere.', tone: 'muted' };
  }
  if (!input.supported) {
    return {
      state: 'unsupported',
      label: 'IN-APP ONLY',
      detail: 'This build has no notification module. Alerts still appear in the app — install the Android/iOS build for phone notifications.',
      tone: 'muted',
    };
  }
  if (!input.prefsOn) {
    return { state: 'off', label: 'OFF', detail: 'Notifications are switched off on this phone. Turn the switch on to get alerts again.', tone: 'muted' };
  }
  if (input.permission === 'denied') {
    return {
      state: 'blocked',
      label: 'BLOCKED BY THE PHONE',
      detail: 'The phone is refusing notifications for this app. Open the phone settings → Apps → AI Crop Robot → Notifications and allow them, then press Register again.',
      tone: 'bad',
    };
  }
  if (input.registering) {
    return { state: 'working', label: 'REGISTERING…', detail: 'Asking the phone for permission and registering this device.', tone: 'warn' };
  }
  if (!input.token) {
    return {
      state: 'local-only',
      label: 'ON (APP RUNNING)',
      detail: input.tokenError
        ? `Live alerts are shown while the app is running. Background push needs one more setup step on the server side: ${clip(input.tokenError, 120)}`
        : 'Live alerts are shown while the app is running. Register this phone to also get them when the app is closed.',
      tone: 'warn',
    };
  }
  const devices = input.deviceCount == null ? '?' : String(input.deviceCount);
  const sent = input.lastSentAt ? new Date(input.lastSentAt).toLocaleString() : 'not yet';
  return {
    state: 'on',
    label: 'ON — REGISTERED',
    detail: `This phone is registered with the server (${devices} phone${devices === '1' ? '' : 's'} registered${input.serverEnabled === false ? ', push switched off on the server' : ''}). Last push sent: ${sent}.${input.lastError ? ` Last push problem: ${clip(input.lastError, 80)}` : ''}`,
    tone: input.lastError ? 'warn' : 'ok',
  };
}

/** The one-line explanation the blocking banner shows. */
export function bannerText(input: PushStatusInput): string | null {
  const status = pushStatusText(input);
  if (status.state === 'blocked') return 'Notifications are blocked — tap to allow them, or alerts will only be visible inside the app.';
  if (status.state === 'off') return 'Alert notifications are switched off on this phone.';
  return null;
}

/**
 * The steps that make phone notifications work when the app is CLOSED. The app
 * side is done by this code; the server side needs a Firebase project, which is
 * an account-level step, so it is written out for the operator instead of being
 * hidden in a log.
 */
export const BACKGROUND_PUSH_SETUP = [
  'Create a Firebase project (console.firebase.google.com) and add an Android app with the package name com.hansaka01.aicroprobot.',
  'Download google-services.json and add it to the repository as a GitHub secret named GOOGLE_SERVICES_JSON_BASE64 (base64 of that file). The build workflow writes it into the project for you.',
  'In Firebase → Project settings → Service accounts, generate a new private key and upload it to Expo (expo.dev → your project → Credentials → Android → FCM V1 service account key).',
  'Push the repository once so a new APK is built, install it, open Settings → NOTIFICATIONS and press “Register this phone”.',
  'Press “Send test notification”: the notification must arrive even with the app closed. If it does, rain and petrol alerts will reach you the same way.',
].join('\n');
