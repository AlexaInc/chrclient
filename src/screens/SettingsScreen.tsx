import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, ProgressBar, Page, CardRail } from '../components/ui';
import { colors } from '../theme';
import { applyFleetConfig } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import { useRealtime } from '../realtime/RealtimeContext';
import { useAuth } from '../auth/AuthContext';
import {
  fetchConfig,
  fetchWhatsAppStatus,
  linkWhatsApp,
  relinkWhatsApp,
  unlinkWhatsApp,
  setWhatsAppOwner,
  sendWhatsAppTest,
  WhatsAppStatusDto,
} from '../scripts/Api';
import { FleetConfig } from '../types/actions';

const DEFAULT_CONFIG: FleetConfig = {
  rowSpacingM: 1, scanSpacingM: 1, arrivalRadiusM: 2,
  irrigationThresholdPercent: 35, diseaseAlertThreshold: 0.6,
};

const FIELDS: { key: keyof FleetConfig; label: string; sub: string; min: number; max: number; step: number; unit: string; fmt?: (v: number) => string }[] = [
  { key: 'rowSpacingM', label: 'Row Spacing', sub: 'Distance between crop rows used to plan patrol waypoints.', min: 0.3, max: 5, step: 0.1, unit: 'm' },
  { key: 'scanSpacingM', label: 'Scan Spacing', sub: 'Distance between photo-capture points along each row.', min: 0.3, max: 5, step: 0.1, unit: 'm' },
  { key: 'arrivalRadiusM', label: 'Waypoint Arrival Radius', sub: 'How close the robot must get to a waypoint (by GPS) to count it as reached.', min: 0.5, max: 10, step: 0.5, unit: 'm' },
  { key: 'irrigationThresholdPercent', label: 'Irrigation Threshold', sub: 'Soil moisture % (from the pump sensor) below which auto-irrigation starts.', min: 5, max: 90, step: 1, unit: '%' },
  { key: 'diseaseAlertThreshold', label: 'Disease Alert Confidence', sub: 'Minimum AI model confidence to raise a disease alert for a photo.', min: 0.1, max: 0.99, step: 0.01, unit: '', fmt: (v) => `${(v * 100).toFixed(0)}%` },
];

export default function SettingsScreen() {
  const { fleetConfig, robotOnline, pumpOnline, isDemo } = useRealtime();
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

  const step = (key: keyof FleetConfig, dir: 1 | -1) => {
    const f = FIELDS.find((f) => f.key === key)!;
    setConfig((c) => ({ ...c, [key]: Math.min(f.max, Math.max(f.min, +(c[key] + dir * f.step).toFixed(2))) }));
  };

  const STATUS = [
    {
      label: 'ROBOT (ESP32-S3)',
      value: robotOnline ? 'ONLINE' : 'OFFLINE',
      note: robotOnline ? 'Reporting sensors normally' : 'No recent messages',
      iconBg: robotOnline ? 'bg-brand-100' : 'bg-slate-100',
      icon: <MaterialCommunityIcons name="robot-outline" size={18} color={robotOnline ? colors.emerald600 : colors.slate400} />,
    },
    {
      label: 'IRRIGATION PUMP (ESP32-C3)',
      value: pumpOnline ? 'ONLINE' : 'OFFLINE',
      note: pumpOnline ? 'Reporting soil moisture normally' : 'No recent messages',
      iconBg: pumpOnline ? 'bg-blue-100' : 'bg-slate-100',
      icon: <Feather name="cpu" size={18} color={pumpOnline ? colors.blue600 : colors.slate400} />,
    },
  ];

  return (
    <View className="flex-1 bg-surface">
      <Header title="Settings" />
      <Page>
        <Text className="text-[22px] font-extrabold text-slate-900">Fleet Configuration</Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          Patrol geometry, waypoint arrival tolerance, irrigation threshold, and AI disease alert sensitivity.
          These values are pushed to the robot/pump on save.
        </Text>

        {/* Device status */}
        <CardRail className="mt-4">
          {STATUS.map((s) => (
            <Card key={s.label} className="w-[220px] lg:w-auto lg:flex-1 lg:min-w-[220px]">
              <IconBox className={s.iconBg} size={36}>{s.icon}</IconBox>
              <Text className="text-[10px] font-extrabold text-slate-400 mt-2.5 tracking-wide">{s.label}</Text>
              <Text className="text-base font-extrabold text-slate-900 mt-0.5">{s.value}</Text>
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
            <SectionTitle>PATROL & MISSION PARAMETERS</SectionTitle>
            <Badge label="Pushed to robot on save" className="bg-brand-50" textClassName="text-brand-700" />
          </Row>

          {FIELDS.map((f, i) => {
            const value = config[f.key];
            const pct = ((value - f.min) / (f.max - f.min)) * 100;
            return (
              <View key={f.key}>
                {i > 0 && <View className="h-px bg-slate-100 my-4" />}
                <Row className="justify-between">
                  <Text className="text-[13px] font-extrabold text-slate-800">{f.label}</Text>
                  <Text className="text-xs font-extrabold text-brand-700">{f.fmt ? f.fmt(value) : `${value}${f.unit}`}</Text>
                </Row>
                <Text className="text-[11px] text-slate-500 mt-1 leading-4">{f.sub}</Text>
                <Row className="mt-2.5 items-center gap-2.5">
                  <TouchableOpacity
                    onPress={() => step(f.key, -1)}
                    activeOpacity={0.7}
                    className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 items-center justify-center"
                  >
                    <Text className="text-base font-extrabold text-slate-700">−</Text>
                  </TouchableOpacity>
                  <View className="flex-1">
                    <ProgressBar value={pct} barClassName="bg-brand-500" />
                  </View>
                  <TouchableOpacity
                    onPress={() => step(f.key, 1)}
                    activeOpacity={0.7}
                    className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 items-center justify-center"
                  >
                    <Text className="text-base font-extrabold text-slate-700">+</Text>
                  </TouchableOpacity>
                </Row>
                <Row className="justify-between mt-1.5">
                  <Text className="text-[10px] font-bold text-slate-400">{f.fmt ? f.fmt(f.min) : `${f.min}${f.unit}`}</Text>
                  <Text className="text-[10px] font-bold text-slate-400">{f.fmt ? f.fmt(f.max) : `${f.max}${f.unit}`}</Text>
                </Row>
              </View>
            );
          })}
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

        {/* WhatsApp service — link / unlink / relink + owner number */}
        <WhatsAppServiceCard token={token} isDemo={isDemo} />
      </Page>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* WhatsApp Service card                                               */
/* ------------------------------------------------------------------ */

type WaAction = 'owner' | 'link' | 'relink' | 'unlink' | 'test';

const WA_STATE_BADGE: Record<string, { label: string; className: string; textClassName: string }> = {
  connected: { label: 'LINKED', className: 'bg-brand-50', textClassName: 'text-brand-700' },
  pairing: { label: 'PAIRING…', className: 'bg-amber-100', textClassName: 'text-amber-700' },
  idle: { label: 'NOT LINKED', className: 'bg-slate-100', textClassName: 'text-slate-500' },
  disabled: { label: 'DISABLED', className: 'bg-slate-100', textClassName: 'text-slate-500' },
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
      if (!ownerTouched.current) setOwnerInput(snapshot.ownerNumber ?? '');
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
      if (!ownerTouched.current) setOwnerInput(snapshot.ownerNumber ?? '');
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

  const saveOwner = () => {
    if (!token) return;
    const problem = validate(ownerInput, 'owner');
    if (problem) return setFeedback({ ok: false, text: problem });
    ownerTouched.current = true;
    void run('owner', () => setWhatsAppOwner(token, digitsOnly(ownerInput)),
      (s) => `Owner number saved: ${s.ownerNumber}. Only this number can command the robot.`);
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
  const busyAny = busy !== null;
  const connected = status?.state === 'connected';

  return (
    <Card className="mt-4">
      <Row className="justify-between">
        <SectionTitle>WHATSAPP SERVICE</SectionTitle>
        {loaded && !isDemo
          ? <Badge label={badge.label} className={badge.className} textClassName={badge.textClassName} />
          : <Badge label="…" className="bg-slate-100" textClassName="text-slate-400" />}
      </Row>

      <Text className="text-[11px] text-slate-500 mt-2 leading-[17px]">
        Pair the farm's WhatsApp account to the server and control everything from chat. Command replies use
        interactive buttons, and only the owner number below is allowed to send commands.
      </Text>

      {isDemo ? (
        <Text className="text-xs text-slate-400 py-3 mt-2 text-center">
          WhatsApp linking is unavailable in demo mode — log in with the real server first.
        </Text>
      ) : (
        <>
          {/* Session state */}
          <View className="bg-slate-50 rounded-xl p-3 mt-3">
            <Row className="justify-between">
              <Text className="text-[11px] font-bold text-slate-500">Linked account</Text>
              <Text className="text-[12px] font-extrabold text-slate-800">{status?.linkedNumber ?? '—'}</Text>
            </Row>
            <Row className="justify-between mt-1.5">
              <Text className="text-[11px] font-bold text-slate-500">Session on server</Text>
              <Text className="text-[12px] font-extrabold text-slate-800">{status?.sessionExists ? 'present' : 'none'}</Text>
            </Row>
            <Row className="justify-between mt-1.5">
              <Text className="text-[11px] font-bold text-slate-500">Linked since</Text>
              <Text className="text-[12px] font-extrabold text-slate-800">{formatWhen(status?.linkedAt ?? null)}</Text>
            </Row>
            {status?.lastError ? (
              <Text className="text-[11px] text-rose-600 mt-2">Last error: {status.lastError}</Text>
            ) : null}

            {status?.state === 'pairing' && (
              <View className="bg-amber-100 rounded-lg p-3 mt-3 items-center">
                <Text className="text-[10px] font-extrabold text-amber-700 tracking-wide">PAIRING CODE</Text>
                <Text className="text-[22px] font-extrabold text-amber-900 tracking-widest mt-1">
                  {status?.pairingCode ?? 'waiting…'}
                </Text>
                <Text className="text-[10px] text-amber-800 text-center mt-1.5 leading-4">
                  WhatsApp on the linked phone → Settings → Linked devices → Link a device →{' '}
                  “Link with phone number instead” → enter this code.
                </Text>
              </View>
            )}
          </View>

          {/* Owner number */}
          <Text className="text-[11px] font-extrabold text-slate-700 mt-4">OWNER NUMBER</Text>
          <Text className="text-[10px] text-slate-500 mt-1 leading-4">
            Only this number can issue commands. Include the country code — Sri Lanka 94, e.g. 94766045156.
          </Text>
          <Row className="gap-2 mt-2">
            <TextInput
              value={ownerInput}
              onChangeText={(v) => { ownerTouched.current = true; setOwnerInput(v); }}
              placeholder="94766045156"
              keyboardType="phone-pad"
              className="flex-1 border border-slate-300 rounded-xl px-3 py-2.5 text-[13px]"
            />
            <TouchableOpacity
              onPress={saveOwner}
              disabled={busyAny}
              activeOpacity={0.85}
              className={`px-4 rounded-xl items-center justify-center bg-brand-600 ${busyAny ? 'opacity-60' : ''}`}
            >
              <Text className="text-[12px] font-extrabold text-white">{busy === 'owner' ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </Row>

          {/* Link / relink */}
          <Text className="text-[11px] font-extrabold text-slate-700 mt-4">
            {connected ? 'LINK ANOTHER ACCOUNT' : 'LINK A WHATSAPP ACCOUNT'}
          </Text>
          <Text className="text-[10px] text-slate-500 mt-1 leading-4">
            Enter the number of the WhatsApp account that will act as the bot (country code required), then read the
            pairing code out of this screen into that phone.
          </Text>
          <TextInput
            value={linkInput}
            onChangeText={setLinkInput}
            placeholder="94766045156"
            keyboardType="phone-pad"
            className="border border-slate-300 rounded-xl px-3 py-2.5 text-[13px] mt-2"
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
              connected ? 'border-brand-300 bg-white' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <Text className={`text-[12px] font-extrabold ${connected ? 'text-brand-700' : 'text-slate-400'}`}>
              {busy === 'test' ? 'Sending…' : 'Send test message'}
            </Text>
          </TouchableOpacity>

          {feedback && (
            <Row className={`mt-3 rounded-lg px-3 py-2 ${feedback.ok ? 'bg-brand-50' : 'bg-rose-100'}`}>
              <Feather name={feedback.ok ? 'check-circle' : 'alert-circle'} size={14} color={feedback.ok ? colors.emerald600 : colors.rose600} />
              <Text className={`text-[11px] ml-2 flex-1 leading-4 ${feedback.ok ? 'text-brand-700' : 'text-rose-700'}`}>{feedback.text}</Text>
            </Row>
          )}

          {busyAny && (
            <Row className="mt-2 justify-center">
              <ActivityIndicator size="small" color={colors.emerald600} />
            </Row>
          )}

          {/* Command cheat-sheet */}
          <View className="border border-slate-100 rounded-xl p-3 mt-3">
            <Text className="text-[10px] font-extrabold text-slate-400 tracking-wide">CHAT COMMANDS (OWNER ONLY)</Text>
            <Text className="text-[11px] text-slate-600 mt-1.5 leading-[18px]">
              .menu · .status · .telemetry{'\n'}
              .mission deploy [block|all] · .mission_status · .mission_pause · .mission_resume · .stop{'\n'}
              .pump_on 60 · .pump_off · .pump_auto on|off · .pump_status{'\n'}
              .alerts · .reports · .blocks · .owner set 94XXXXXXXXX
            </Text>
            <Text className="text-[10px] text-slate-400 mt-2">
              Every reply carries the footer “Powered by hazu@AlexaInc.github.io”.
            </Text>
          </View>
        </>
      )}
    </Card>
  );
}
