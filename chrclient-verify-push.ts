/**
 * chrclient — phone notification (push) checks.
 *
 * Two kinds of assertion, deliberately:
 *
 *   A. behaviour  — the pure planning module (src/notifications/pushPlan.ts) is
 *      exercised directly. It is the part that decides what buzzes a phone, so
 *      it is the part that must be right: hydrated history is never notified,
 *      the severity floor holds, criticals go to the loud channel, a phone that
 *      said "no" is not asked again, demo mode sends nothing…
 *   B. wiring     — source greps that the plumbing really is connected: the
 *      bridge is inside the realtime provider, the provider registers with
 *      chrserver, Settings shows the card, Android channels are created, and the
 *      notification package/plugin/permission are declared.
 *
 * Run:  npx tsx chrclient-verify-push.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import {
  ALERT_CHANNELS,
  BACKGROUND_PUSH_SETUP,
  DEFAULT_PUSH_SEVERITY,
  PUSH_SEVERITIES,
  bannerText,
  channelFor,
  clip,
  isPushSeverity,
  markAllSeen,
  newAlertsToNotify,
  notificationForAlert,
  notificationForRobot,
  pushStatusText,
  registrationPlan,
  severityAtLeast,
  severityHint,
  severityLabel,
} from './src/notifications/pushPlan';

let passed = 0;
const failures: string[] = [];
const ok = (m: string) => { passed++; console.log(`✅ ${m}`); };
const fail = (m: string) => { failures.push(m); console.log(`❌ ${m}`); };
const check = (cond: boolean, m: string) => (cond ? ok(m) : fail(m));

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const App = read('App.tsx');
const bridge = read('src/notifications/NotificationsBridge.tsx');
const pushContext = read('src/notifications/PushContext.tsx');
const notify = read('src/notifications/notify.ts');
const settings = read('src/screens/SettingsScreen.tsx');
const api = read('src/scripts/Api.ts');
const prefs = read('src/state/Preferences.tsx');
const appJson = read('app.json');
const pkg = read('package.json');
const workflow = read('.github/workflows/release.yml');

/* ------------------------------------------------------------------ */
/* A1 · severity floor                                                 */
/* ------------------------------------------------------------------ */
check(severityAtLeast('critical', 'critical') && severityAtLeast('critical', 'warning') && severityAtLeast('warning', 'warning'),
  'the severity floor lets through everything at or above the chosen level');
check(!severityAtLeast('warning', 'critical') && !severityAtLeast('info', 'warning'),
  '…and keeps the quiet stuff out (a warning is not a critical, an info is not a warning)');
check(isPushSeverity('info') && isPushSeverity('warning') && isPushSeverity('critical') && !isPushSeverity('loud') && !isPushSeverity(''),
  'only the three real severities are accepted from the wire');
check(DEFAULT_PUSH_SEVERITY === 'warning', 'the default floor is “warnings & critical” — the loudest sensible default');
check(PUSH_SEVERITIES.length === 3 && PUSH_SEVERITIES[0] === 'critical',
  'Settings offers the three levels, critical first');
check(severityLabel('critical') === 'Critical only' && severityLabel('warning') === 'Warnings & critical' && severityLabel('info') === 'Everything',
  'each level has an operator-readable label');
check(severityHint('critical').toLowerCase().includes('rain') && severityHint('info').toLowerCase().includes('everything'),
  'each level explains itself in the operator\u2019s language');

/* ------------------------------------------------------------------ */
/* A2 · channels (Android drops a notification whose channel is missing) */
/* ------------------------------------------------------------------ */
check(ALERT_CHANNELS.map((c) => c.id).join(',') === 'safety,alerts',
  'the two Android channels are the ids chrserver sends (safety, alerts)');
const safety = ALERT_CHANNELS.find((c) => c.id === 'safety')!;
check(safety.importance === 'max' && safety.sound && safety.vibration,
  'the safety channel is importance MAX with sound and vibration — a rain alert wakes the phone');
check(channelFor('critical') === 'safety' && channelFor('warning') === 'alerts' && channelFor('info') === 'alerts',
  'criticals go to the loud channel, everything else to the normal one');

/* ------------------------------------------------------------------ */
/* A3 · notification text                                              */
/* ------------------------------------------------------------------ */
const rain = notificationForAlert({
  id: 12, severity: 'critical',
  title: 'Rain detected — pump off, robot returning to base',
  description: 'Rain 82% on the roof sensor. Pump switched off and the rover is on its way back.',
});
check(rain.title.startsWith('🚨') && rain.title.includes('Rain detected'), 'a critical alert carries a red-flag title');
check(rain.body.includes('82%') && rain.body.length <= 180, 'the description becomes the second line');
check(rain.channelId === 'safety' && rain.priority === 'max', '…and is delivered on the loud channel with max priority');
check(rain.data.type === 'alert' && rain.data.alertId === 12 && rain.data.severity === 'critical',
  'the payload identifies the alert, so tapping the notification can open it');
const offline = notificationForAlert({ id: 13, severity: 'warning', title: 'Robot offline', description: null });
check(offline.title.startsWith('⚠️') && offline.body === 'Robot offline' && offline.priority === 'high',
  'an alert without a description still produces a readable notification');
const noisy = notificationForAlert({ id: 14, severity: 'info', title: 'Notes', description: 'x'.repeat(600) });
check(noisy.priority === 'default' && noisy.body.endsWith('…') && noisy.body.length <= 180,
  'an informational alert is quiet and long text is clipped');
check(clip('  a\n\nb   c  ') === 'a b c', 'whitespace and newlines are collapsed into one line');

/* ------------------------------------------------------------------ */
/* A4 · what counts as new                                             */
/* ------------------------------------------------------------------ */
const seen = new Set<number>();
markAllSeen([{ id: 1, severity: 'critical', title: 'old rain' }, { id: 2, severity: 'warning', title: 'old offline' }], seen);
check(newAlertsToNotify(
  [{ id: 2, severity: 'warning', title: 'old offline' }, { id: 1, severity: 'critical', title: 'old rain' }],
  seen, { enabled: true, minSeverity: 'warning' },
).length === 0,
  'the hydrated history never buzzes the phone — an alert from last night stays quiet');

const fresh = newAlertsToNotify(
  [{ id: 7, severity: 'critical', title: 'new rain' }, { id: 6, severity: 'warning', title: 'new offline' }],
  seen, { enabled: true, minSeverity: 'warning' },
);
check(fresh.length === 2 && fresh[0].id === 6 && fresh[1].id === 7,
  'new alerts are notified, oldest first (the phone lists them in the order they happened)');
check(newAlertsToNotify(
  [{ id: 7, severity: 'critical', title: 'new rain' }, { id: 6, severity: 'warning', title: 'new offline' }],
  seen, { enabled: true, minSeverity: 'warning' },
).length === 0,
  'the same alert arriving twice (a socket re-send) is only notified once');
check(newAlertsToNotify([{ id: 9, severity: 'info', title: 'fyi' }], new Set<number>() as any, { enabled: true, minSeverity: 'warning' }).length === 0,
  'an informational alert below the floor is not notified');
check(newAlertsToNotify([{ id: 10, severity: 'warning', title: 'offline' }], new Set<number>() as any, { enabled: false, minSeverity: 'info' }).length === 0,
  'with the master switch off nothing is notified at all');
const afterOff = new Set<number>();
newAlertsToNotify([{ id: 11, severity: 'critical', title: 'rain' }], afterOff, { enabled: false, minSeverity: 'info' });
check(newAlertsToNotify([{ id: 11, severity: 'critical', title: 'rain' }], afterOff, { enabled: true, minSeverity: 'info' }).length === 0,
  'an alert that happened while notifications were off is not replayed later');

/* ------------------------------------------------------------------ */
/* A5 · robot online / offline                                         */
/* ------------------------------------------------------------------ */
const wentOffline = notificationForRobot(false);
const backOnline = notificationForRobot(true);
check(wentOffline.severity === 'warning' && wentOffline.priority === 'high' && wentOffline.title.includes('offline'),
  'the robot going offline is a high-priority warning — the operator must not deploy a mission blindly');
check(backOnline.severity === 'info' && backOnline.priority === 'default',
  'the robot coming back is informational (below the default floor, in the app only)');

/* ------------------------------------------------------------------ */
/* A6 · registration plan                                              */
/* ------------------------------------------------------------------ */
const base = { platform: 'android', isDemo: false, supported: true, permission: 'granted' as const, hasStoredToken: false };
const firstRun = registrationPlan({ ...base, permission: 'undetermined' });
check(firstRun.requestPermission && firstRun.attachNative && firstRun.fetchToken && firstRun.registerOnServer,
  'first run on a real phone: ask, attach, fetch a token, register');
const laterRun = registrationPlan({ ...base, hasStoredToken: true });
check(!laterRun.requestPermission && !laterRun.fetchToken && laterRun.registerOnServer,
  'later runs reuse the stored token but refresh it on the server');
const denied = registrationPlan({ ...base, permission: 'denied' });
check(!denied.requestPermission && !denied.fetchToken && !denied.registerOnServer && denied.reason.includes('settings'),
  'a phone that said no is not asked again — the app points at the system settings instead');
const demo = registrationPlan({ ...base, isDemo: true });
check(!demo.requestPermission && !demo.registerOnServer && demo.reason.includes('demo'),
  'a demo login registers nothing (there is no server to notify)');
const noModule = registrationPlan({ ...base, supported: false });
check(!noModule.fetchToken && !noModule.registerOnServer && noModule.reason.includes('web'),
  'a build without the notification module degrades to in-app alerts only');

/* ------------------------------------------------------------------ */
/* A7 · what Settings shows                                            */
/* ------------------------------------------------------------------ */
const statusOn = pushStatusText({
  supported: true, permission: 'granted', prefsOn: true, isDemo: false, token: 'ExponentPushToken[abc]',
  tokenError: null, deviceCount: 2, serverEnabled: true, lastSentAt: Date.now(), lastError: null, registering: false,
});
check(statusOn.state === 'on' && statusOn.label.includes('REGISTERED') && statusOn.tone === 'ok',
  'a registered phone reads “ON — REGISTERED” with a count of the phones');
const statusDenied = pushStatusText({
  supported: true, permission: 'denied', prefsOn: true, isDemo: false, token: null,
  tokenError: null, deviceCount: 1, serverEnabled: true, lastSentAt: null, lastError: null, registering: false,
});
check(statusDenied.state === 'blocked' && statusDenied.tone === 'bad' && statusDenied.detail.includes('Apps'),
  'a blocked phone says exactly where to unblock it');
check(bannerText({ supported: true, permission: 'denied', prefsOn: true, isDemo: false, token: null, tokenError: null, deviceCount: 0, serverEnabled: true, lastSentAt: null, lastError: null, registering: false })?.includes('blocked') === true,
  '…and the in-app banner repeats it, because the notification itself cannot be shown');
const statusLocal = pushStatusText({
  supported: true, permission: 'granted', prefsOn: true, isDemo: false, token: null,
  tokenError: 'Default FirebaseApp is not initialized', deviceCount: 0, serverEnabled: true, lastSentAt: null, lastError: null, registering: false,
});
check(statusLocal.state === 'local-only' && statusLocal.detail.includes('FirebaseApp') && statusLocal.tone === 'warn',
  'no push token (no Firebase in the build) is reported honestly, with the reason from the phone');
const statusOff = pushStatusText({
  supported: true, permission: 'granted', prefsOn: false, isDemo: false, token: null, tokenError: null,
  deviceCount: 0, serverEnabled: true, lastSentAt: null, lastError: null, registering: false,
});
check(statusOff.state === 'off' && statusOff.tone === 'muted', 'the master switch off is shown as OFF, not as a failure');
const statusWorking = pushStatusText({
  supported: true, permission: 'undetermined', prefsOn: true, isDemo: false, token: null, tokenError: null,
  deviceCount: null, serverEnabled: null, lastSentAt: null, lastError: null, registering: true,
});
check(statusWorking.state === 'working', 'while registering, Settings says so');
check(pushStatusText({
  supported: true, permission: 'granted', prefsOn: true, isDemo: false, token: 'ExponentPushToken[abc]',
  tokenError: null, deviceCount: 1, serverEnabled: true, lastSentAt: Date.now(), lastError: 'DeviceNotRegistered', registering: false,
}).tone === 'warn', 'a delivery problem on the server side is surfaced, not hidden');

/* ------------------------------------------------------------------ */
/* A8 · the closed-app setup is written down, not hidden                */
/* ------------------------------------------------------------------ */
check(BACKGROUND_PUSH_SETUP.split('\n').length === 5 && BACKGROUND_PUSH_SETUP.includes('com.hansaka01.aicroprobot'),
  'the five Firebase steps (needed only for notifications while the app is closed) are spelled out');
check(BACKGROUND_PUSH_SETUP.includes('GOOGLE_SERVICES_JSON_BASE64') && BACKGROUND_PUSH_SETUP.includes('FCM V1'),
  '…including the exact secret name and the FCM V1 key upload');

/* ------------------------------------------------------------------ */
/* B · wiring                                                          */
/* ------------------------------------------------------------------ */
check(pkg.includes('"expo-notifications"'), 'expo-notifications is a dependency of the app');
check(appJson.includes('"expo-notifications"') && appJson.includes('POST_NOTIFICATIONS'),
  'app.json declares the expo-notifications plugin and the Android POST_NOTIFICATIONS permission');
check(appJson.includes('android-icon-monochrome.png') && appJson.includes('"defaultChannel": "alerts"'),
  'the Android notification icon and default channel are configured');
check(App.includes('PushProvider') && App.includes('NotificationsBridge') && App.indexOf('PushProvider') < App.indexOf('NotificationsBridge'),
  'the push provider wraps the realtime provider, and the bridge runs inside it');
check(App.indexOf('<RealtimeProvider>') < App.indexOf('<NotificationsBridge />') && App.indexOf('<UpdateProvider>') > App.indexOf('<NotificationsBridge />'),
  'the bridge sits inside <RealtimeProvider> (so it sees live alerts) and above the rest of the tree');
check(bridge.includes('newAlertsToNotify') && bridge.includes('markAllSeen') && bridge.includes('presentNotification'),
  'the bridge feeds live alerts through the decision module and shows the result');
check(bridge.includes('baselined') && bridge.includes('robotOnline'),
  '…marking the hydrated history first and watching the robot online flag');
check(pushContext.includes('registerPushDevice') && pushContext.includes('fetchPushStatus') && pushContext.includes('unregisterPushDevice'),
  'the provider registers / reads / removes this phone through the REST client');
check(pushContext.includes('installForegroundHandler') && pushContext.includes('ensureAndroidChannels') && pushContext.includes('getPermissionState'),
  '…and sets up the foreground handler and the Android channels before asking');
check(pushContext.includes("readPref(KEY_TOKEN)") && pushContext.includes('writePref(KEY_TOKEN'),
  'the token is remembered on this device, so it is only fetched again when it changes');
check(notify.includes("require('expo-notifications')") && notify.includes('AndroidImportance'),
  'the native adapter loads the module defensively and uses the Android importance levels');
check(notify.includes('globalThis') && notify.includes('Notification'),
  'the web build falls back to the browser notification API');
check(api.includes('/api/push/register') && api.includes('/api/push/unregister') && api.includes('/api/push/test') && api.includes("authedGet<{ ok: boolean; push: PushStatusDto }>('/api/push'"),
  'the client talks to all four chrserver push endpoints');
check(prefs.includes("chrclient.prefs.pushEnabled") && prefs.includes("chrclient.prefs.pushSeverity") && prefs.includes('pushSeverity'),
  'both notification choices are device preferences (they survive a restart)');
check(settings.includes('NOTIFICATIONS') && settings.includes('Send test notification') && settings.includes('Register this phone'),
  'Settings has the NOTIFICATIONS card with the test and register buttons');
check(settings.includes('usePush()') && settings.includes('BACKGROUND_PUSH_SETUP'),
  '…showing live status, the token error, and the closed-app setup steps');
check(settings.includes('Linking.openSettings'), 'a blocked phone gets a button that opens the system settings screen');
check(workflow.includes('GOOGLE_SERVICES_JSON_BASE64') && workflow.includes('google-services.json'),
  'the release workflow can write google-services.json from a secret, so Firebase is wired in when available');
check(workflow.includes('building without Firebase') || workflow.includes('No GOOGLE_SERVICES_JSON_BASE64'),
  '…and the build still succeeds without that secret (notifications simply stay in-app)');

console.log('');
if (failures.length) {
  console.log(`❌ ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.log(`   - ${f}`));
  process.exit(1);
}
console.log(`🎉 all ${passed} push notification checks passed`);
