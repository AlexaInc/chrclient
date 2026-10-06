import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, ProgressBar, Page, CardRail } from '../components/ui';
import { colors } from '../theme';
import { applyFleetConfig } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import { usePreferences } from '../state/Preferences';
import { useUpdate } from '../state/Update';
import ActionFeedback from '../components/ActionFeedback';
import { useRealtime } from '../realtime/RealtimeContext';
import { useAuth } from '../auth/AuthContext';
import {
  fetchConfig,
  fetchWhatsAppStatus,
  linkWhatsApp,
  relinkWhatsApp,
  unlinkWhatsApp,
  setWhatsAppEnabled,
  setWhatsAppOwner,
  addWhatsAppOwner,
  removeWhatsAppOwner,
  ownerNumbersFrom,
  MAX_OWNER_NUMBERS,
  sendWhatsAppTest,
  WhatsAppSessionHealth,
  WhatsAppStatusDto,
} from '../scripts/Api';
import { FleetConfig } from '../types/actions';
import { describeAvoidState } from '../scripts/robotMotion';

const DEFAULT_CONFIG: FleetConfig = {
  rowSpacingM: 1, scanSpacingM: 1, arrivalRadiusM: 2,
  irrigationThresholdPercent: 35, diseaseAlertThreshold: 0.6,
  // Fresh installs start deliberately slow: this rover drives between closely
  // planted crops, so the operator raises the limit only if they need to.
  driveSpeedPercent: 70, turnSpeedPercent: 65,
  // Printed front mounts: the side sensors are splayed outwards so the three
  // beams overlap into one fan with no blind spot at the corners. The brackets
  // are bolted at 35°, so a fresh install defaults to 35° on both sides.
  sensorAngleLeftDeg: 35, sensorAngleRightDeg: 35, avoidAssist: true,
};

/** Everything in FleetConfig except the on/off switch, so the steppers below
 *  can treat every value as a number. */
type NumericConfigKey = Exclude<keyof FleetConfig, 'avoidAssist'>;

const FIELDS: { key: NumericConfigKey; label: string; sub: string; min: number; max: number; step: number; unit: string; fmt?: (v: number) => string }[] = [
  { key: 'driveSpeedPercent', label: 'Robot Drive Speed', sub: 'Percentage of the safe cruise speed built into the firmware. 100 % is the fastest this rover may travel — it works between closely planted crops, so keep it low.', min: 20, max: 100, step: 5, unit: '%' },
  { key: 'turnSpeedPercent', label: 'Robot Turn Speed', sub: 'In-place turning speed on the same scale. Lower values make the rover pivot more gently around plants.', min: 20, max: 100, step: 5, unit: '%' },
  { key: 'sensorAngleLeftDeg', label: 'Left Sensor Angle', sub: 'How far OUTWARDS the left ultrasonic bracket points its sensor, measured from straight ahead. The rover turns every reading on that beam into "how wide is the gap on the left", so set this to the angle the bracket is really bolted at — a wrong angle makes it steer toward a plant. Default 35°.', min: 25, max: 80, step: 5, unit: '°' },
  { key: 'sensorAngleRightDeg', label: 'Right Sensor Angle', sub: 'Same for the right bracket, default 35°. With the two side beams splayed outwards the front arc covers the corners too, which is what removes the blind spots.', min: 25, max: 80, step: 5, unit: '°' },
  { key: 'rowSpacingM', label: 'Row Spacing', sub: 'Distance between crop rows used to plan patrol waypoints.', min: 0.3, max: 5, step: 0.1, unit: 'm' },
  { key: 'scanSpacingM', label: 'Scan Spacing', sub: 'Distance between photo-capture points along each row.', min: 0.3, max: 5, step: 0.1, unit: 'm' },
  { key: 'arrivalRadiusM', label: 'Waypoint Arrival Radius', sub: 'How close the robot must get to a waypoint (by GPS) to count it as reached.', min: 0.5, max: 10, step: 0.5, unit: 'm' },
  { key: 'irrigationThresholdPercent', label: 'Irrigation Threshold (default)', sub: 'Fleet-wide fallback for AUTO MOISTURE THRESHOLD. The rover has NO soil-moisture sensor — the reading comes from the water pump, so each well sets its own threshold on the Irrigation screen and that value wins over this one.', min: 5, max: 90, step: 1, unit: '%' },
  { key: 'diseaseAlertThreshold', label: 'Disease Alert Confidence', sub: 'Minimum AI model confidence to raise a disease alert for a photo.', min: 0.1, max: 0.99, step: 0.01, unit: '', fmt: (v) => `${(v * 100).toFixed(0)}%` },
];

export default function SettingsScreen() {
  const { fleetConfig, robotOnline, pumpOnline, isDemo, status } = useRealtime();
  const { token } = useAuth();
  const [config, setConfig] = useState<FleetConfig>(fleetConfig ?? DEFAULT_CONFIG);
  const apply = useCommand(applyFleetConfig);

  useEffect(() => {
    if (fleetConfig) setConfig(fleetConfig);
  }, [fleetConfig]);

  useEffect(() => {
    if (isDemo || !token || fleetConfig) return;
    fetchConfig(token).then((res) => setConfig(res.config)).catch((e) => console.warn('[Settings] config fetch failed:', e?.message ?? e));
  }, [isDemo, token, fleetConfig]);

  const step = (key: NumericConfigKey, dir: 1 | -1) => {
    const f = FIELDS.find((f) => f.key === key)!;
    setConfig((c) => ({ ...c, [key]: Math.min(f.max, Math.max(f.min, +(c[key] + dir * f.step).toFixed(2))) }));
  };

  const STATUS = [
    {
      label: 'ROBOT (ESP32-S3)',
      value: robotOnline ? 'ONLINE' : 'OFFLINE',
      note: robotOnline ? 'Reporting sensors normally' : 'No recent messages',
      iconBg: robotOnline ? 'bg-brand-100 dark:bg-brand-900/50' : 'bg-slate-100 dark:bg-slate-800',
      icon: <MaterialCommunityIcons name="robot-outline" size={18} color={robotOnline ? colors.emerald600 : colors.slate400} />,
    },
    {
      label: 'FIELD MAP (SD CACHE)',
      value: status?.fieldMap?.serverRev
        ? (status.fieldMap.inSync ? 'IN SYNC' : 'NOT SYNCED')
        : 'NO MAP',
      note: status?.fieldMap?.serverRev
        ? `Server ${status.fieldMap.serverRev} · rover ${status.fieldMap.robotRev ?? 'unknown'}${status.fieldMap.sd ? ' · SD' : status.fieldMap.robotRev ? '' : ' · no SD'}`
        : 'Save a field map to send it to the rover once',
      iconBg: status?.fieldMap?.inSync ? 'bg-brand-100 dark:bg-brand-900/50' : 'bg-amber-100 dark:bg-amber-900/40',
      icon: <Feather name="hard-drive" size={18} color={status?.fieldMap?.inSync ? colors.emerald600 : '#b45309'} />,
    },
    {
      label: 'IRRIGATION PUMP (ESP32-C3)',
      value: pumpOnline ? 'ONLINE' : 'OFFLINE',
      note: pumpOnline ? 'Reporting soil moisture normally' : 'No recent messages',
      iconBg: pumpOnline ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-slate-100 dark:bg-slate-800',
      icon: <Feather name="cpu" size={18} color={pumpOnline ? colors.blue600 : colors.slate400} />,
    },
  ];

  return (
    <View className="flex-1 bg-surface dark:bg-slate-950">
      <Header title="Settings" />
      <Page>
        <Text className="text-[22px] font-extrabold text-slate-900 dark:text-slate-100">Fleet Configuration</Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-[18px]">
          Robot speed limits (the rover can never be driven faster than the firmware's own ceiling),
          the front-arc sensor angles of the brackets, patrol geometry, waypoint arrival tolerance,
          irrigation threshold, and AI disease alert sensitivity.
          These values are pushed to the robot/pump on save.
        </Text>

        {/* Device status */}
        <CardRail className="mt-4">
          {STATUS.map((s) => (
            <Card key={s.label} className="w-[220px] lg:w-auto lg:flex-1 lg:min-w-[220px]">
              <IconBox className={s.iconBg} size={36}>{s.icon}</IconBox>
              <Text className="text-[10px] font-extrabold text-slate-400 mt-2.5 tracking-wide">{s.label}</Text>
              <Text className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">{s.value}</Text>
              <Text className="text-[10px] text-slate-400 mt-1">{s.note}</Text>
            </Card>
          ))}
        </CardRail>

        {isDemo && (
          <Card className="mt-4">
            <Text className="text-xs text-slate-400 py-2 text-center">Configuration cannot be saved in demo mode — not connected to a real server.</Text>
          </Card>
        )}

        <Card className="mt-4">
          <Row className="justify-between">
            <SectionTitle>SPEED LIMITS, PATROL & MISSION PARAMETERS</SectionTitle>
            <Badge label="Pushed to robot on save" className="bg-brand-50 dark:bg-brand-900/40" textClassName="text-brand-700 dark:text-brand-300" />
          </Row>

          {status?.motion?.drivePwm != null && (
            <View className="mb-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-3 py-2">
              <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Rover reports: {status.motion.drivePwm} PWM drive · {status.motion.turnPwm} PWM turn
                {status.motion.hardMaxPwm ? ` · hard ceiling ${status.motion.hardMaxPwm} PWM` : ''}
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {status.motion.appliedPwm != null ? `Motors now at ${status.motion.appliedPwm} PWM` : 'Motors idle'}
                {status.motion.blockedBy ? ` · ${status.motion.blockedBy}` : ''}
                {status.motion.obstacleStopCm ? ` · safety distance ${status.motion.obstacleStopCm} cm` : ''}
                {status.motion.sensorAngleLeftDeg != null
                  ? ` · arc ±${status.motion.sensorAngleLeftDeg}/±${status.motion.sensorAngleRightDeg}°`
                  : ''}
              </Text>
              {describeAvoidState(status.motion) && (
                <Text className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                  {describeAvoidState(status.motion)}
                </Text>
              )}
            </View>
          )}

          {FIELDS.map((f, i) => {
            const value = config[f.key];
            const pct = ((value - f.min) / (f.max - f.min)) * 100;
            return (
              <View key={f.key}>
                {i > 0 && <View className="h-px bg-slate-100 dark:bg-slate-800 my-4" />}
                <Row className="justify-between">
                  <Text className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">{f.label}</Text>
                  <Text className="text-xs font-extrabold text-brand-700 dark:text-brand-300">{f.fmt ? f.fmt(value) : `${value}${f.unit}`}</Text>
                </Row>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-4">{f.sub}</Text>
                <Row className="mt-2.5 items-center gap-2.5">
                  <TouchableOpacity
                    onPress={() => step(f.key, -1)}
                    activeOpacity={0.7}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 items-center justify-center"
                  >
                    <Text className="text-base font-extrabold text-slate-700 dark:text-slate-200">−</Text>
                  </TouchableOpacity>
                  <View className="flex-1">
                    <ProgressBar value={pct} barClassName="bg-brand-500" />
                  </View>
                  <TouchableOpacity
                    onPress={() => step(f.key, 1)}
                    activeOpacity={0.7}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 items-center justify-center"
                  >
                    <Text className="text-base font-extrabold text-slate-700 dark:text-slate-200">+</Text>
                  </TouchableOpacity>
                </Row>
                <Row className="justify-between mt-1.5">
                  <Text className="text-[10px] font-bold text-slate-400">{f.fmt ? f.fmt(f.min) : `${f.min}${f.unit}`}</Text>
                  <Text className="text-[10px] font-bold text-slate-400">{f.fmt ? f.fmt(f.max) : `${f.max}${f.unit}`}</Text>
                </Row>
              </View>
            );
          })}

          <View className="h-px bg-slate-100 dark:bg-slate-800 my-4" />
          <Row className="justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">Auto-avoid steering (manual driving)</Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-4">
                ON: when you hold a drive button and a plant is in the way, the rover steers around it and creeps past
                instead of stopping at the safety distance. OFF: it brakes at the safety distance and you decide where
                it goes. In autonomous mode the rover always goes around - it only stops when no side gap is wide enough.
              </Text>
            </View>
            <Switch
              value={config.avoidAssist}
              onValueChange={(v) => setConfig((c) => ({ ...c, avoidAssist: v }))}
              disabled={isDemo}
            />
          </Row>
        </Card>

        {/* Save */}
        <TouchableOpacity
          onPress={() => apply.run(config)}
          disabled={apply.pending || isDemo}
          activeOpacity={0.85}
          className={`flex-row items-center justify-center bg-brand-600 rounded-xl py-3.5 mt-5 ${
            apply.pending || isDemo ? 'opacity-60' : ''
          }`}
        >
          <MaterialCommunityIcons name="content-save-check-outline" size={18} color={colors.white} />
          <Text className="text-[13px] font-extrabold text-white ml-2">
            {apply.pending ? 'Syncing Configuration…' : 'Apply & Sync Configuration'}
          </Text>
        </TouchableOpacity>
        <ActionFeedback result={apply.result} className="self-center" />

        {/* Display, theme and app updates */}
        <DisplayAndAppCard />

        {/* WhatsApp service — link / unlink / relink + owner numbers */}
        <WhatsAppServiceCard token={token} isDemo={isDemo} />
      </Page>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* WhatsApp Service card                                               */
/* ------------------------------------------------------------------ */

type WaAction = 'owner' | 'link' | 'relink' | 'unlink' | 'test' | 'toggle';

const WA_STATE_BADGE: Record<string, { label: string; className: string; textClassName: string }> = {
  connected: { label: 'LINKED', className: 'bg-brand-50 dark:bg-brand-900/40', textClassName: 'text-brand-700 dark:text-brand-300' },
  pairing: { label: 'PAIRING…', className: 'bg-amber-100 dark:bg-amber-900/40', textClassName: 'text-amber-700 dark:text-amber-300' },
  idle: { label: 'NOT LINKED', className: 'bg-slate-100 dark:bg-slate-800', textClassName: 'text-slate-500 dark:text-slate-400' },
  disabled: { label: 'OFF', className: 'bg-slate-100 dark:bg-slate-800', textClassName: 'text-slate-500 dark:text-slate-400' },
};

/** Session verdict → how it is presented (badge + colour). */
const WA_HEALTH: Record<WhatsAppSessionHealth, { label: string; className: string; textClassName: string; note: string }> = {
  active: {
    label: 'ACTIVE', className: 'bg-brand-100 dark:bg-brand-900/50', textClassName: 'text-brand-700 dark:text-brand-300',
    note: 'Session valid and connected right now.',
  },
  inactive: {
    label: 'INACTIVE', className: 'bg-slate-100 dark:bg-slate-800', textClassName: 'text-slate-600 dark:text-slate-300',
    note: 'Session is saved on the server but the bot is switched off.',
  },
  invalid: {
    label: 'SESSION INVALID', className: 'bg-rose-100 dark:bg-rose-900/40', textClassName: 'text-rose-700',
    note: 'This account was logged out (or the session was deleted) — link it again to use the bot.',
  },
  not_linked: {
    label: 'NOT LINKED', className: 'bg-slate-100 dark:bg-slate-800', textClassName: 'text-slate-500 dark:text-slate-400',
    note: 'No WhatsApp account paired yet.',
  },
};

const digitsOnly = (value: string): string => value.replace(/[^\d]/g, '');

const formatWhen = (ts: number | null): string =>
  ts ? new Date(ts).toLocaleString() : 'never';

/**
 * The WhatsApp bot controls the robot and the water pump from a chat, so the
 * pairing/owner controls live here instead of in the server logs. The number
 * must always carry its country code (Sri Lanka = 94, e.g. 94766045156) —
 * local formats like 0766045156 are rejected by the server.
 */
function WhatsAppServiceCard({ token, isDemo }: { token: string | null; isDemo: boolean }) {
  const [status, setStatus] = useState<WhatsAppStatusDto | null>(null);
  const [ownerList, setOwnerList] = useState<string[]>([]);
  const [addingOwner, setAddingOwner] = useState(false);
  const [ownerInput, setOwnerInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [busy, setBusy] = useState<WaAction | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const ownerTouched = useRef(false);

  const refresh = useCallback(async (showError = false) => {
    if (!token || isDemo) return;
    try {
      const snapshot = await fetchWhatsAppStatus(token);
      setStatus(snapshot);
      if (!ownerTouched.current) setOwnerList(ownerNumbersFrom(snapshot));
    } catch (e: any) {
      if (showError) setFeedback({ ok: false, text: e?.message ?? 'Could not load the WhatsApp status' });
    } finally {
      setLoaded(true);
    }
  }, [token, isDemo]);

  useEffect(() => { void refresh(); }, [refresh]);

  // While a pairing code is on screen, keep polling so the card flips to
  // LINKED by itself the moment the code is entered on the phone.
  useEffect(() => {
    if (isDemo || status?.state !== 'pairing') return;
    const timer = setInterval(() => { void refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [isDemo, status?.state, refresh]);

  const run = async (action: WaAction, call: () => Promise<WhatsAppStatusDto>, okText: (s: WhatsAppStatusDto) => string) => {
    setBusy(action);
    setFeedback(null);
    try {
      const snapshot = await call();
      setStatus(snapshot);
      if (!ownerTouched.current) setOwnerList(ownerNumbersFrom(snapshot));
      setFeedback({ ok: true, text: okText(snapshot) });
    } catch (e: any) {
      setFeedback({ ok: false, text: e?.message ?? 'Action failed' });
      void refresh();
    } finally {
      setBusy(null);
    }
  };

  const validate = (value: string, what: 'owner' | 'link'): string | null => {
    const digits = digitsOnly(value);
    if (!digits) return `Enter the ${what === 'owner' ? 'owner' : 'WhatsApp'} number.`;
    if (digits.startsWith('0')) return 'Include the country code (local numbers starting with 0 are rejected). Sri Lanka: 94 — e.g. 94766045156';
    if (digits.length < 7 || digits.length > 15) return 'That number does not look like a full international number.';
    return null;
  };

  /**
   * Add one more owner number. The list lives in chrserver's database and the
   * WhatsApp bot accepts commands from every entry in it, so a second phone can
   * stop the pump or send the robot home when the first one is not around.
   */
  const addOwner = () => {
    if (!token) return;
    if (ownerList.length >= MAX_OWNER_NUMBERS) {
      return setFeedback({ ok: false, text: `That is already ${MAX_OWNER_NUMBERS} numbers — the maximum. Remove one first.` });
    }
    const problem = validate(ownerInput, 'owner');
    if (problem) return setFeedback({ ok: false, text: problem });
    const digits = digitsOnly(ownerInput);
    if (ownerList.includes(digits)) {
      return setFeedback({ ok: false, text: `${digits} is already in the list.` });
    }
    ownerTouched.current = true;
    setBusy('owner');
    setFeedback(null);
    const optimistic = [...ownerList, digits];
    (async () => {
      try {
        const snapshot = await addWhatsAppOwner(token, digits);
        setStatus(snapshot);
        const list = ownerNumbersFrom(snapshot);
        setOwnerList(list.length ? list : optimistic);
        setNewOwnerStateDone(digits, (list.length || optimistic.length));
      } catch (e: any) {
        // Server without the multi-number routes yet: keep the single slot working
        // rather than leaving the operator with a dead button.
        try {
          const snapshot = await setWhatsAppOwner(token, digits);
          setStatus(snapshot);
          setOwnerList(ownerNumbersFrom(snapshot).length ? ownerNumbersFrom(snapshot) : [digits]);
          setNewOwnerStateDone(digits, 1);
          setFeedback({
            ok: true,
            text: `Saved ${digits}. This chrserver build only stores one owner number — ` +
              `update the server to keep up to ${MAX_OWNER_NUMBERS} and alert all of them.`,
          });
        } catch (e2: any) {
          setFeedback({ ok: false, text: e2?.message ?? e?.message ?? 'Could not save the number' });
        }
      } finally {
        setBusy(null);
      }
    })();
  };

  const setNewOwnerStateDone = (digits: string, count: number) => {
    setOwnerInput('');
    setAddingOwner(false);
    setFeedback({
      ok: true,
      text: `Added ${digits}. The bot now accepts commands from ${count} owner number${count === 1 ? '' : 's'} and sends alerts to all of them.`,
    });
  };

  const removeOwner = (digits: string) => {
    if (!token) return;
    if (ownerList.length <= 1) {
      return setFeedback({ ok: false, text: 'At least one owner number must stay in the list.' });
    }
    const doIt = () => {
      ownerTouched.current = true;
      setBusy('owner');
      setFeedback(null);
      (async () => {
        try {
          const snapshot = await removeWhatsAppOwner(token, digits);
          setStatus(snapshot);
          const list = ownerNumbersFrom(snapshot);
          setOwnerList(list.length ? list : ownerList.filter((n) => n !== digits));
          setFeedback({ ok: true, text: `Removed ${digits} — the bot no longer accepts commands or sends alerts to it.` });
        } catch (e: any) {
          setFeedback({ ok: false, text: e?.message ?? 'Could not remove the number' });
        } finally {
          setBusy(null);
        }
      })();
    };
    Alert.alert(
      'Remove owner number?',
      `${digits} will no longer be able to command the robot and will stop receiving rain/petrol alerts.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: doIt }],
    );
  };

  const startLink = (mode: 'link' | 'relink') => {
    if (!token) return;
    const problem = validate(linkInput, 'link');
    if (problem) return setFeedback({ ok: false, text: problem });
    const digits = digitsOnly(linkInput);
    const doIt = () => void run(mode, () => (mode === 'relink' ? relinkWhatsApp(token, digits) : linkWhatsApp(token, digits)),
      (s) => s.pairingCode
        ? `Pairing code ${s.pairingCode} — open WhatsApp on ${digits} → Linked devices → Link a device → “Link with phone number instead”, then enter it within a few minutes.`
        : 'Pairing started — watch for the pairing code.');
    if (mode === 'relink') {
      Alert.alert(
        'Relink WhatsApp?',
        'The current session is deleted and a new pairing code is generated for the number you entered.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Relink', style: 'destructive', onPress: doIt }],
      );
    } else {
      doIt();
    }
  };

  const confirmUnlink = () => {
    if (!token) return;
    Alert.alert(
      'Delete WhatsApp session?',
      'The linked account is signed out and its session files are deleted from the server. The owner number is kept, so you can link again at any time.',
      [{ text: 'Cancel', style: 'cancel' },
       { text: 'Delete session', style: 'destructive',
         onPress: () => void run('unlink', () => unlinkWhatsApp(token), () => 'Session deleted — the WhatsApp service is now offline.') }],
    );
  };

  const badge = WA_STATE_BADGE[status?.state ?? 'idle'] ?? WA_STATE_BADGE.idle;
  const health = WA_HEALTH[status?.sessionHealth ?? 'not_linked'] ?? WA_HEALTH.not_linked;
  const busyAny = busy !== null;
  const connected = status?.state === 'connected';
  const botOn = Boolean(status?.enabled);
  const hasSession = Boolean(status?.sessionExists || status?.linkedNumber);

  const toggleBot = (next: boolean) => {
    if (!token) return;
    const doIt = () => void run('toggle', () => setWhatsAppEnabled(token, next),
      () => next
        ? 'Bot switched ON — it reconnects with the saved session.'
        : 'Bot switched OFF — the session stays saved, switch it back on any time.');
    if (!next) {
      // Switching off stops the chat control channel, so ask first.
      Alert.alert(
        'Switch the WhatsApp bot OFF?',
        'The bot stops answering and stops forwarding commands. The linked session stays saved on the server — you can switch it back on here, or with `.bot on` from chat.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Switch OFF', style: 'destructive', onPress: doIt }],
      );
      return;
    }
    doIt();
  };

  return (
    <Card className="mt-4">
      <Row className="justify-between">
        <SectionTitle>WHATSAPP SERVICE</SectionTitle>
        {loaded && !isDemo
          ? <Badge label={badge.label} className={badge.className} textClassName={badge.textClassName} />
          : <Badge label="…" className="bg-slate-100 dark:bg-slate-800" textClassName="text-slate-400" />}
      </Row>

      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-[17px]">
        Pair the farm's WhatsApp account to the server and control everything from chat. Command replies use
        interactive buttons, and only the owner number below is allowed to send commands.
      </Text>

      {isDemo ? (
        <Text className="text-xs text-slate-400 py-3 mt-2 text-center">
          WhatsApp linking is unavailable in demo mode — log in with the real server first.
        </Text>
      ) : (
        <>
          {/* Bot ON/OFF switch + session health */}
          <View className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 mt-3">
            <Row className="justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">WhatsApp bot</Text>
                <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-4">
                  {hasSession
                    ? 'ON keeps the bot listening in chat; OFF closes the session socket (the link stays saved, so it can be switched back on without pairing again).'
                    : 'Link an account below first — then this switch starts and stops the bot.'}
                </Text>
              </View>
              <Switch
                value={botOn}
                onValueChange={toggleBot}
                disabled={busyAny || (!hasSession && !botOn)}
                trackColor={{ false: colors.slate300, true: colors.emerald500 }}
                thumbColor={colors.white}
              />
            </Row>
            <Row className="justify-between mt-2.5">
              <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Power</Text>
              <Text className={`text-[12px] font-extrabold ${botOn ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`}>
                {busy === 'toggle' ? 'switching…' : botOn ? 'ON' : 'OFF'}
              </Text>
            </Row>
            <Row className="justify-between mt-1.5">
              <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Session</Text>
              <Badge label={health.label} className={health.className} textClassName={health.textClassName} />
            </Row>
            <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-4">{health.note}</Text>
          </View>

          {/* Session state */}
          <View className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 mt-3">
            <Row className="justify-between">
              <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Linked account</Text>
              <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">{status?.linkedNumber ?? '—'}</Text>
            </Row>
            <Row className="justify-between mt-1.5">
              <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Session on server</Text>
              <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">{status?.sessionExists ? 'present' : 'none'}</Text>
            </Row>
            <Row className="justify-between mt-1.5">
              <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Linked since</Text>
              <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">{formatWhen(status?.linkedAt ?? null)}</Text>
            </Row>
            {status?.lastError ? (
              <Text className="text-[11px] text-rose-600 dark:text-rose-400 mt-2">Last error: {status.lastError}</Text>
            ) : null}

            {status?.state === 'pairing' && (
              <View className="bg-amber-100 dark:bg-amber-900/40 rounded-lg p-3 mt-3 items-center">
                <Text className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 tracking-wide">PAIRING CODE</Text>
                <Text className="text-[22px] font-extrabold text-amber-900 dark:text-amber-200 tracking-widest mt-1">
                  {status?.pairingCode ?? 'waiting…'}
                </Text>
                <Text className="text-[10px] text-amber-800 dark:text-amber-200 text-center mt-1.5 leading-4">
                  WhatsApp on the linked phone → Settings → Linked devices → Link a device →{' '}
                  “Link with phone number instead” → enter this code.
                </Text>
              </View>
            )}
          </View>

          {/* Owner numbers — a list of up to MAX_OWNER_NUMBERS */}
          <Row className="justify-between mt-4">
            <Text className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
              OWNER NUMBERS
            </Text>
            <Text className="text-[10px] font-extrabold text-slate-400">
              {ownerList.length}/{MAX_OWNER_NUMBERS}
            </Text>
          </Row>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-4">
            Every number on this list can command the robot and the pump, and every one of them receives the alerts
            (rain detected, petrol empty, faults). Include the country code — Sri Lanka 94, e.g. 94766045156.
          </Text>

          {ownerList.length === 0 ? (
            <Text className="text-[11px] text-slate-400 mt-2">No owner number saved yet — add the first one below.</Text>
          ) : (
            ownerList.map((number, index) => (
              <Row
                key={number}
                className="justify-between border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 mt-2"
              >
                <Row className="flex-1">
                  <Feather
                    name={index === 0 ? 'shield' : 'user-check'}
                    size={14}
                    color={index === 0 ? colors.emerald600 : colors.slate400}
                  />
                  <View className="ml-2 flex-1">
                    <Text className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">{number}</Text>
                    <Text className="text-[10px] text-slate-400">
                      {index === 0 ? 'Primary owner · WhatsApp service number' : `Owner number ${index + 1}`}
                    </Text>
                  </View>
                </Row>
                <TouchableOpacity
                  onPress={() => removeOwner(number)}
                  disabled={busyAny || ownerList.length <= 1}
                  className={busyAny || ownerList.length <= 1 ? 'opacity-40 p-1.5' : 'p-1.5'}
                >
                  <Feather name="trash-2" size={15} color={colors.rose600} />
                </TouchableOpacity>
              </Row>
            ))
          )}

          {addingOwner ? (
            <View className="border border-brand-300 dark:border-brand-600 rounded-xl p-3 mt-2.5">
              <Text className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wide">
                NEW OWNER NUMBER
              </Text>
              <Row className="gap-2 mt-2">
                <TextInput
                  value={ownerInput}
                  onChangeText={(v) => { ownerTouched.current = true; setOwnerInput(v); }}
                  placeholder="94766045156"
                  keyboardType="phone-pad"
                  autoFocus
                  className="flex-1 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-[13px]"
                />
              </Row>
              <Row className="gap-2 mt-2">
                <TouchableOpacity
                  onPress={addOwner}
                  disabled={busyAny}
                  activeOpacity={0.85}
                  className={`flex-1 rounded-xl py-3 items-center justify-center bg-brand-600 ${busyAny ? 'opacity-60' : ''}`}
                >
                  <Text className="text-[12px] font-extrabold text-white">
                    {busy === 'owner' ? 'Saving…' : 'Save this number'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setAddingOwner(false); setOwnerInput(''); ownerTouched.current = false; }}
                  disabled={busyAny}
                  activeOpacity={0.85}
                  className="px-4 rounded-xl py-3 items-center justify-center border border-slate-200 dark:border-slate-700"
                >
                  <Text className="text-[12px] font-extrabold text-slate-500 dark:text-slate-400">Cancel</Text>
                </TouchableOpacity>
              </Row>
            </View>
          ) : ownerList.length >= MAX_OWNER_NUMBERS ? (
            <Text className="text-[10px] text-amber-700 dark:text-amber-300 mt-2.5 leading-4">
              The maximum of {MAX_OWNER_NUMBERS} owner numbers is reached. Remove one to add another.
            </Text>
          ) : (
            <TouchableOpacity
              onPress={() => setAddingOwner(true)}
              disabled={busyAny}
              activeOpacity={0.85}
              className={`flex-row items-center justify-center border border-brand-300 dark:border-brand-600 bg-brand-50 dark:bg-brand-900/40 rounded-xl py-3 mt-2.5 ${
                busyAny ? 'opacity-60' : ''
              }`}
            >
              <Feather name="plus-circle" size={15} color={colors.emerald700} />
              <Text className="text-[12px] font-extrabold text-brand-700 dark:text-brand-300 ml-2">
                Add another number
              </Text>
            </TouchableOpacity>
          )}

          {/* Link / relink */}
          <Text className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 mt-4">
            {connected ? 'LINK ANOTHER ACCOUNT' : 'LINK A WHATSAPP ACCOUNT'}
          </Text>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-4">
            Enter the number of the WhatsApp account that will act as the bot (country code required), then read the
            pairing code out of this screen into that phone.
          </Text>
          <TextInput
            value={linkInput}
            onChangeText={setLinkInput}
            placeholder="94766045156"
            keyboardType="phone-pad"
            className="border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-[13px] mt-2"
          />
          <Row className="gap-2 mt-2">
            <TouchableOpacity
              onPress={() => startLink(connected ? 'relink' : 'link')}
              disabled={busyAny}
              activeOpacity={0.85}
              className={`flex-1 rounded-xl py-3 items-center justify-center bg-brand-600 ${busyAny ? 'opacity-60' : ''}`}
            >
              <Text className="text-[12px] font-extrabold text-white">
                {busy === 'link' || busy === 'relink' ? 'Pairing…' : connected ? 'Relink with another account' : 'Link account'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmUnlink}
              disabled={busyAny || (!status?.sessionExists && !status?.linkedNumber)}
              activeOpacity={0.85}
              className={`px-4 rounded-xl py-3 items-center justify-center bg-rose-600 ${
                busyAny || (!status?.sessionExists && !status?.linkedNumber) ? 'opacity-50' : ''
              }`}
            >
              <Text className="text-[12px] font-extrabold text-white">{busy === 'unlink' ? 'Deleting…' : 'Delete session'}</Text>
            </TouchableOpacity>
          </Row>

          <TouchableOpacity
            onPress={() => token && void run('test', () => sendWhatsAppTest(token), () => 'Test message sent to the owner number.')}
            disabled={busyAny || !connected}
            activeOpacity={0.85}
            className={`border rounded-xl py-3 mt-2 items-center justify-center ${
              connected ? 'border-brand-300 dark:border-brand-600 bg-white dark:bg-slate-900' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
            }`}
          >
            <Text className={`text-[12px] font-extrabold ${connected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400'}`}>
              {busy === 'test' ? 'Sending…' : 'Send test message'}
            </Text>
          </TouchableOpacity>

          {feedback && (
            <Row className={`mt-3 rounded-lg px-3 py-2 ${feedback.ok ? 'bg-brand-50 dark:bg-brand-900/40' : 'bg-rose-100 dark:bg-rose-900/40'}`}>
              <Feather name={feedback.ok ? 'check-circle' : 'alert-circle'} size={14} color={feedback.ok ? colors.emerald600 : colors.rose600} />
              <Text className={`text-[11px] ml-2 flex-1 leading-4 ${feedback.ok ? 'text-brand-700 dark:text-brand-300' : 'text-rose-700'}`}>{feedback.text}</Text>
            </Row>
          )}

          {busyAny && (
            <Row className="mt-2 justify-center">
              <ActivityIndicator size="small" color={colors.emerald600} />
            </Row>
          )}

          {/* Command cheat-sheet */}
          <View className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 mt-3">
            <Text className="text-[10px] font-extrabold text-slate-400 tracking-wide">CHAT COMMANDS (OWNER ONLY)</Text>
            <Text className="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 leading-[18px]">
              .menu · .status · .telemetry{'\n'}
              .mission deploy [block|all] · .mission_status · .mission_pause · .mission_resume · .stop{'\n'}
              .pump_on 60 · .pump_off · .pump_auto on|off · .pump_status{'\n'}
              .alerts · .reports · .blocks · .owner (list/add/remove) · .bot on|off
            </Text>
            <Text className="text-[10px] text-slate-400 mt-2">
              Reply buttons follow the live state (Pump ON only while it is off, resume/stop only when a mission is loaded).
              Every reply carries the footer “Powered by hazu@AlexaInc.github.io”.
            </Text>
          </View>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Display, theme and app updates                                      */
/* ------------------------------------------------------------------ */

const UPDATE_STATE_TEXT: Record<string, { label: string; className: string; textClassName: string }> = {
  idle: { label: 'NOT CHECKED YET', className: 'bg-slate-100 dark:bg-slate-800', textClassName: 'text-slate-500 dark:text-slate-400' },
  checking: { label: 'CHECKING…', className: 'bg-amber-100 dark:bg-amber-900/40', textClassName: 'text-amber-700 dark:text-amber-300' },
  'up-to-date': { label: 'UP TO DATE', className: 'bg-brand-100 dark:bg-brand-900/50', textClassName: 'text-brand-700 dark:text-brand-300' },
  available: { label: 'UPDATE AVAILABLE', className: 'bg-amber-100 dark:bg-amber-900/40', textClassName: 'text-amber-700 dark:text-amber-300' },
  installing: { label: 'INSTALLING…', className: 'bg-blue-100 dark:bg-blue-900/40', textClassName: 'text-blue-700' },
  blocked: { label: 'NEEDS A PERMISSION', className: 'bg-rose-100 dark:bg-rose-900/40', textClassName: 'text-rose-700 dark:text-rose-400' },
  error: { label: 'CHECK FAILED', className: 'bg-rose-100 dark:bg-rose-900/40', textClassName: 'text-rose-700 dark:text-rose-400' },
};

/**
 * Device-level switches (dark mode, graph dots) plus the self-update panel.
 *
 * The self-update panel exists so the operator can see *why* a phone did or did
 * not update itself: every platform that cannot install a new release on its own
 * says so here and offers the release page instead.
 */
function DisplayAndAppCard() {
  const { darkMode, setDarkMode, graphDots, setGraphDots } = usePreferences();
  const { currentVersion, status, latest, checkedAt, error, notice, autoUpdate, setAutoUpdate, checkNow, install } = useUpdate();
  const [busy, setBusy] = useState(false);

  const badge = UPDATE_STATE_TEXT[status] ?? UPDATE_STATE_TEXT.idle;
  const newer = !!latest && latest.version !== currentVersion;

  return (
    <Card className="mt-4">
      <SectionTitle>DISPLAY & APP</SectionTitle>
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-[17px]">
        These switches are stored on this device only — they change how the app looks, not how the robot behaves.
      </Text>

      <Row className="justify-between mt-3">
        <View className="flex-1 pr-3">
          <Text className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">Dark mode</Text>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-4">
            Dark theme for night work and for phones mounted on the rover — easier on the eyes and on the battery.
          </Text>
        </View>
        <Switch
          value={darkMode}
          onValueChange={setDarkMode}
          trackColor={{ false: colors.slate300, true: colors.emerald500 }}
          thumbColor={colors.white}
        />
      </Row>

      <Row className="justify-between mt-3">
        <View className="flex-1 pr-3">
          <Text className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">Show dots on graphs</Text>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-4">
            OFF (default): the graphs draw a smooth line through the readings. ON: every single sample is marked, which
            makes it easy to see how many readings a curve is really made of.
          </Text>
        </View>
        <Switch
          value={graphDots}
          onValueChange={setGraphDots}
          trackColor={{ false: colors.slate300, true: colors.emerald500 }}
          thumbColor={colors.white}
        />
      </Row>

      {/* Self-update */}
      <View className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 mt-4">
        <Row className="justify-between">
          <Text className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">SOFTWARE UPDATE</Text>
          <Badge label={badge.label} className={badge.className} textClassName={badge.textClassName} />
        </Row>
        <Row className="justify-between mt-2">
          <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Installed version</Text>
          <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">v{currentVersion}</Text>
        </Row>
        <Row className="justify-between mt-1.5">
          <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Newest release</Text>
          <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">
            {latest ? `${latest.tag}${newer ? '' : ' (current)'}` : '—'}
          </Text>
        </Row>
        <Row className="justify-between mt-1.5">
          <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Last checked</Text>
          <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">{formatWhen(checkedAt)}</Text>
        </Row>

        {error ? (
          <Text className="text-[10px] text-rose-600 dark:text-rose-400 mt-1.5">Check failed: {error}</Text>
        ) : null}
        {notice ? (
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-4">{notice}</Text>
        ) : null}

        <Row className="justify-between mt-3">
          <View className="flex-1 pr-3">
            <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">Update automatically</Text>
            <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-4">
              When a new build is published as a GitHub release, an Android phone downloads the new APK by itself and
              asks you to confirm the install. On iPhone and in a desktop browser no silent install is possible, so the
              app raises a "new version available" notice instead.
            </Text>
          </View>
          <Switch
            value={autoUpdate}
            onValueChange={setAutoUpdate}
            trackColor={{ false: colors.slate300, true: colors.emerald500 }}
            thumbColor={colors.white}
          />
        </Row>

        <Row className="gap-2 mt-3">
          <TouchableOpacity
            onPress={() => { setBusy(true); void checkNow().finally(() => setBusy(false)); }}
            disabled={busy || status === 'checking'}
            activeOpacity={0.85}
            className={`flex-1 border border-brand-300 dark:border-brand-600 bg-white dark:bg-slate-900 rounded-xl py-3 items-center justify-center ${
              busy ? 'opacity-60' : ''
            }`}
          >
            <Text className="text-[12px] font-extrabold text-brand-700 dark:text-brand-300">
              {status === 'checking' ? 'Checking…' : 'Check for updates'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void install()}
            disabled={!latest || !newer}
            activeOpacity={0.85}
            className={`flex-1 bg-brand-600 rounded-xl py-3 items-center justify-center ${
              !latest || !newer ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-[12px] font-extrabold text-white">
              {status === 'installing' ? 'Installing…' : 'Update now'}
            </Text>
          </TouchableOpacity>
        </Row>
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Display, theme and app updates                                      */
/* ------------------------------------------------------------------ */

const UPDATE_STATE_TEXT: Record<string, { label: string; className: string; textClassName: string }> = {
  idle: { label: 'NOT CHECKED YET', className: 'bg-slate-100 dark:bg-slate-800', textClassName: 'text-slate-500 dark:text-slate-400' },
  checking: { label: 'CHECKING…', className: 'bg-amber-100 dark:bg-amber-900/40', textClassName: 'text-amber-700 dark:text-amber-300' },
  'up-to-date': { label: 'UP TO DATE', className: 'bg-brand-100 dark:bg-brand-900/50', textClassName: 'text-brand-700 dark:text-brand-300' },
  available: { label: 'UPDATE AVAILABLE', className: 'bg-amber-100 dark:bg-amber-900/40', textClassName: 'text-amber-700 dark:text-amber-300' },
  installing: { label: 'INSTALLING…', className: 'bg-blue-100 dark:bg-blue-900/40', textClassName: 'text-blue-700' },
  blocked: { label: 'NEEDS A PERMISSION', className: 'bg-rose-100 dark:bg-rose-900/40', textClassName: 'text-rose-700 dark:text-rose-400' },
  error: { label: 'CHECK FAILED', className: 'bg-rose-100 dark:bg-rose-900/40', textClassName: 'text-rose-700 dark:text-rose-400' },
};

/**
 * Device-level switches (dark mode, graph dots) plus the self-update panel.
 *
 * The self-update panel exists so the operator can see *why* a phone did or did
 * not update itself: every platform that cannot install a new release on its own
 * says so here and offers the release page instead.
 */
function DisplayAndAppCard() {
  const { darkMode, setDarkMode, graphDots, setGraphDots } = usePreferences();
  const { currentVersion, status, latest, checkedAt, error, notice, autoUpdate, setAutoUpdate, checkNow, install } = useUpdate();
  const [busy, setBusy] = useState(false);

  const badge = UPDATE_STATE_TEXT[status] ?? UPDATE_STATE_TEXT.idle;
  const newer = !!latest && latest.version !== currentVersion;

  return (
    <Card className="mt-4">
      <SectionTitle>DISPLAY & APP</SectionTitle>
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-[17px]">
        These switches are stored on this device only — they change how the app looks, not how the robot behaves.
      </Text>

      <Row className="justify-between mt-3">
        <View className="flex-1 pr-3">
          <Text className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">Dark mode</Text>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-4">
            Dark theme for night work and for phones mounted on the rover — easier on the eyes and on the battery.
          </Text>
        </View>
        <Switch
          value={darkMode}
          onValueChange={setDarkMode}
          trackColor={{ false: colors.slate300, true: colors.emerald500 }}
          thumbColor={colors.white}
        />
      </Row>

      <Row className="justify-between mt-3">
        <View className="flex-1 pr-3">
          <Text className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">Show dots on graphs</Text>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-4">
            OFF (default): the graphs draw a smooth line through the readings. ON: every single sample is marked, which
            makes it easy to see how many readings a curve is really made of.
          </Text>
        </View>
        <Switch
          value={graphDots}
          onValueChange={setGraphDots}
          trackColor={{ false: colors.slate300, true: colors.emerald500 }}
          thumbColor={colors.white}
        />
      </Row>

      {/* Self-update */}
      <View className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 mt-4">
        <Row className="justify-between">
          <Text className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">SOFTWARE UPDATE</Text>
          <Badge label={badge.label} className={badge.className} textClassName={badge.textClassName} />
        </Row>
        <Row className="justify-between mt-2">
          <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Installed version</Text>
          <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">v{currentVersion}</Text>
        </Row>
        <Row className="justify-between mt-1.5">
          <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Newest release</Text>
          <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">
            {latest ? `${latest.tag}${newer ? '' : ' (current)'}` : '—'}
          </Text>
        </Row>
        <Row className="justify-between mt-1.5">
          <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Last checked</Text>
          <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">{formatWhen(checkedAt)}</Text>
        </Row>

        {error ? (
          <Text className="text-[10px] text-rose-600 dark:text-rose-400 mt-1.5">Check failed: {error}</Text>
        ) : null}
        {notice ? (
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-4">{notice}</Text>
        ) : null}

        <Row className="justify-between mt-3">
          <View className="flex-1 pr-3">
            <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">Update automatically</Text>
            <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-4">
              When a new build is published as a GitHub release, an Android phone downloads the new APK by itself and
              asks you to confirm the install. On iPhone and in a desktop browser no silent install is possible, so the
              app raises a "new version available" notice instead.
            </Text>
          </View>
          <Switch
            value={autoUpdate}
            onValueChange={setAutoUpdate}
            trackColor={{ false: colors.slate300, true: colors.emerald500 }}
            thumbColor={colors.white}
          />
        </Row>

        <Row className="gap-2 mt-3">
          <TouchableOpacity
            onPress={() => { setBusy(true); void checkNow().finally(() => setBusy(false)); }}
            disabled={busy || status === 'checking'}
            activeOpacity={0.85}
            className={`flex-1 border border-brand-300 dark:border-brand-600 bg-white dark:bg-slate-900 rounded-xl py-3 items-center justify-center ${
              busy ? 'opacity-60' : ''
            }`}
          >
            <Text className="text-[12px] font-extrabold text-brand-700 dark:text-brand-300">
              {status === 'checking' ? 'Checking…' : 'Check for updates'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void install()}
            disabled={!latest || !newer}
            activeOpacity={0.85}
            className={`flex-1 bg-brand-600 rounded-xl py-3 items-center justify-center ${
              !latest || !newer ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-[12px] font-extrabold text-white">
              {status === 'installing' ? 'Installing…' : 'Update now'}
            </Text>
          </TouchableOpacity>
        </Row>
      </View>
    </Card>
  );
}
