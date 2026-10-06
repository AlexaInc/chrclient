import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, Row, Page, useIsDesktop } from '../components/ui';
import { colors } from '../theme';
import { useRealtime } from '../realtime/RealtimeContext';
import { captureBurst, capturePhoto, changeRoverMode, drive, emergencyStop } from '../scripts/Commands';
import { useAuth } from '../auth/AuthContext';
import { endManualPatrol, fetchManualPatrol, startManualPatrol } from '../scripts/Api';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import { DriveDirection } from '../types/actions';
import { describeAvoidState, isAvoiding, isStuck } from '../scripts/robotMotion';

const REPEAT_MS = 250; // resend rate while a direction is held

const DIRS: { dir: DriveDirection; icon: keyof typeof Feather.glyphMap; key: string }[] = [
  { dir: 'forward', icon: 'arrow-up', key: 'w' },
  { dir: 'left', icon: 'arrow-left', key: 'a' },
  { dir: 'backward', icon: 'arrow-down', key: 's' },
  { dir: 'right', icon: 'arrow-right', key: 'd' },
];

/** Sensor position labels — the rover has exactly 3 ultrasonic sensors
 *  (centre + the two bracket-mounted side ones), matching the server's
 *  `ultrasonic.distances_cm` array order. The side sensors are splayed
 *  outwards so the three beams overlap into one fan with no blind spot between
 *  the centre beam and the corners. There is no 4th/5th sensor on this build. */
const SENSOR_LABELS = ['Front', 'Left ±', 'Right ±'];

export default function ControllerScreen() {
  const isDesktop = useIsDesktop();
  const { status, ultrasonic, currentBlock, fieldMap, isDemo, robotOnline } = useRealtime();
  // Speed limits the rover is really applying (from the firmware's own report).
  const motion = status?.motion;
  const { token } = useAuth();
  const [active, setActive] = useState<DriveDirection | null>(null);
  // Single source of truth: the server-broadcast status.mode (itself derived
  // from what the rover is really doing). A local useState here previously
  // disagreed with the Dashboard/Robot screens and reset on re-login.
  const teleop = status?.mode === 'manual';
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mode = useCommand(changeRoverMode);
  const eStop = useCommand(emergencyStop);
  const photoCmd = useCommand(capturePhoto);
  const burstCmd = useCommand(captureBurst);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [manualPatrol, setManualPatrol] = useState<{ patrolId: number; blockName: string } | null>(null);
  const [patrolBusy, setPatrolBusy] = useState(false);

  useEffect(() => {
    if (!selectedBlockId && fieldMap?.blocks[0]) setSelectedBlockId(fieldMap.blocks[0].id);
  }, [fieldMap, selectedBlockId]);
  useEffect(() => {
    if (!token) return;
    fetchManualPatrol(token).then((r) => setManualPatrol(r.patrol
      ? { patrolId: r.patrol.patrolId, blockName: r.patrol.blockName } : null)).catch(() => undefined);
  }, [token]);

  const beginManualPatrol = async () => {
    if (!token || !selectedBlockId) return;
    setPatrolBusy(true);
    try {
      const r = await startManualPatrol(token, selectedBlockId);
      setManualPatrol({ patrolId: r.patrol.patrolId, blockName: r.patrol.blockName });
      await mode.run('manual');
    } finally { setPatrolBusy(false); }
  };
  const finishManualPatrol = async () => {
    if (!token) return;
    stopDrive(); setPatrolBusy(true);
    try { await endManualPatrol(token); setManualPatrol(null); }
    finally { setPatrolBusy(false); }
  };

  const stopDrive = useCallback(() => {
    if (repeatRef.current) clearInterval(repeatRef.current);
    repeatRef.current = null;
    setActive(null);
    drive('stop');
  }, []);

  const startDrive = useCallback((dir: DriveDirection) => {
    if (repeatRef.current) clearInterval(repeatRef.current);
    setActive(dir);
    drive(dir);
    repeatRef.current = setInterval(() => drive(dir), REPEAT_MS);
  }, []);

  // The server ack triggers a status broadcast, which flips `teleop` above —
  // every screen updates together from the same truth.
  const enableTeleop = async () => {
    await mode.run('manual');
  };
  const disableTeleop = async () => {
    stopDrive();
    await mode.run('autonomous');
  };

  // PC: WASD / arrow keys via web keydown/keyup
  useEffect(() => {
    if (Platform.OS !== 'web' || !teleop) return;
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      const map: Record<string, DriveDirection> = {
        w: 'forward', arrowup: 'forward',
        s: 'backward', arrowdown: 'backward',
        a: 'left', arrowleft: 'left',
        d: 'right', arrowright: 'right',
      };
      if (map[k]) { e.preventDefault(); startDrive(map[k]); }
      if (k === ' ' || k === 'escape') { e.preventDefault(); stopDrive(); }
      if (k === 'c' && manualPatrol) { e.preventDefault(); photoCmd.run(); }
      if (k === 'b' && manualPatrol) { e.preventDefault(); burstCmd.run(); }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) stopDrive();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [teleop, startDrive, stopDrive, manualPatrol, photoCmd.run, burstCmd.run]);

  useEffect(() => () => stopDrive(), [stopDrive]);

  const minDist = ultrasonic ? Math.min(...ultrasonic.distances_cm) : null;
  const obstacle = minDist != null && minDist < 30;
  // The front-arc planner reports what it is doing; the rover is only supposed
  // to STOP when no side gap is wide enough to drive around the plant.
  const avoidLine = describeAvoidState(motion);
  const avoiding = isAvoiding(motion);
  const stuck = isStuck(motion);
  const failsafe = motion?.blockedBy === 'failsafe';
  const brakeOnlyStop = motion?.blockedBy === 'obstacle' && !avoidLine && !failsafe;

  const padBtn = (d: (typeof DIRS)[number]) => (
    <TouchableOpacity
      key={d.dir}
      disabled={!teleop}
      onPressIn={() => startDrive(d.dir)}
      onPressOut={stopDrive}
      activeOpacity={0.7}
      className={`w-20 h-20 lg:w-24 lg:h-24 rounded-2xl items-center justify-center border-2 ${
        active === d.dir ? 'bg-brand-600 border-brand-600' : teleop ? 'bg-white border-brand-200' : 'bg-slate-100 border-slate-200'
      }`}
    >
      <Feather name={d.icon} size={30} color={active === d.dir ? colors.white : teleop ? colors.emerald700 : colors.slate400} />
      {isDesktop && <Text className={`text-[9px] font-extrabold mt-0.5 ${active === d.dir ? 'text-white' : 'text-slate-400'}`}>{d.key.toUpperCase()}</Text>}
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-surface">
      <Header title="Controller" />
      <Page>
        <Row className="gap-2 flex-wrap">
          <Badge label="MANUAL TELE-OPERATION" className="bg-brand-50" textClassName="text-brand-700" />
          {isDemo && <Badge label="DEMO DATA" className="bg-amber-100" textClassName="text-amber-700" dotClassName="bg-amber-500" />}
        </Row>
        <Text className="text-[22px] font-extrabold text-slate-900 mt-3">Manual Rover Controller</Text>
        <Text className="text-xs text-slate-500 mt-1.5">
          {Platform.OS === 'web' ? 'WASD/arrows = drive • Space/Esc = stop • C = photo • B = both sides.' : 'Press and hold the direction buttons to drive.'}
        </Text>

        <View className={isDesktop ? 'flex-row gap-4 mt-4 items-start' : 'mt-4'}>
          {/* Drive pad */}
          <Card className={isDesktop ? 'flex-1' : ''}>
            <Row className="justify-between">
              <SectionTitle>DRIVE PAD</SectionTitle>
              <Badge
                label={teleop ? 'MANUAL' : 'AUTONOMOUS'}
                className={teleop ? 'bg-amber-100' : 'bg-brand-50'}
                textClassName={teleop ? 'text-amber-700' : 'text-brand-700'}
                dotClassName={teleop ? 'bg-amber-500' : 'bg-brand-500'}
              />
            </Row>

            <View className="items-center mt-4 gap-2.5">
              {padBtn(DIRS[0])}
              <Row className="gap-2.5">
                {padBtn(DIRS[1])}
                <TouchableOpacity
                  disabled={!teleop}
                  onPress={stopDrive}
                  activeOpacity={0.7}
                  className={`w-20 h-20 lg:w-24 lg:h-24 rounded-2xl items-center justify-center ${teleop ? 'bg-rose-600' : 'bg-slate-200'}`}
                >
                  <MaterialCommunityIcons name="octagon-outline" size={30} color={colors.white} />
                  <Text className="text-[10px] font-extrabold text-white">STOP</Text>
                </TouchableOpacity>
                {padBtn(DIRS[3])}
              </Row>
              {padBtn(DIRS[2])}
            </View>

            {/* Mode toggle */}
            <TouchableOpacity
              onPress={teleop ? disableTeleop : enableTeleop}
              disabled={mode.pending}
              activeOpacity={0.85}
              className={`flex-row items-center justify-center rounded-xl py-3 mt-5 ${
                teleop ? 'bg-slate-700' : 'bg-brand-600'
              } ${mode.pending ? 'opacity-60' : ''}`}
            >
              <MaterialCommunityIcons name={teleop ? 'robot-outline' : 'gamepad-variant-outline'} size={18} color={colors.white} />
              <Text className="text-[13px] font-extrabold text-white ml-2">
                {mode.pending ? 'Switching…' : teleop ? 'Return to Autonomous Mode' : 'Take Manual Control'}
              </Text>
            </TouchableOpacity>
            <ActionFeedback result={mode.result ?? eStop.result} />
          </Card>

          <View className={isDesktop ? 'w-[360px]' : 'mt-4'}>
            <Card>
              <Row className="justify-between"><SectionTitle>DRIVE + CAMERA</SectionTitle><Badge label={manualPatrol ? `PATROL #${manualPatrol.patrolId}` : 'NO COLLECTION'} /></Row>
              {!manualPatrol ? <>
                <Text className="text-[11px] text-slate-500 mt-2">Select a block and start a manual patrol before driving/capturing. Every photo will appear in that collection.</Text>
                <Row className="gap-1.5 mt-2 flex-wrap">{fieldMap?.blocks.map((b) => <TouchableOpacity key={b.id} onPress={() => setSelectedBlockId(b.id)} className={`px-3 py-1.5 rounded-full border ${selectedBlockId === b.id ? 'bg-brand-600 border-brand-600' : 'bg-white border-slate-300'}`}><Text className={`text-[10px] font-bold ${selectedBlockId === b.id ? 'text-white' : 'text-slate-700'}`}>{b.name}</Text></TouchableOpacity>)}</Row>
                <TouchableOpacity onPress={beginManualPatrol} disabled={!robotOnline || !selectedBlockId || patrolBusy} className="bg-brand-600 rounded-xl py-3 mt-3"><Text className="text-white text-center text-xs font-extrabold">START MANUAL PATROL</Text></TouchableOpacity>
              </> : <>
                <Text className="text-xs font-extrabold text-brand-700 mt-2">{manualPatrol.blockName}</Text>
                <Row className="gap-2 mt-3"><TouchableOpacity onPress={() => photoCmd.run()} disabled={photoCmd.pending} className="flex-1 bg-brand-600 rounded-xl py-3"><Text className="text-white text-center text-xs font-extrabold">PHOTO (C)</Text></TouchableOpacity><TouchableOpacity onPress={() => burstCmd.run()} disabled={burstCmd.pending} className="flex-1 bg-slate-800 rounded-xl py-3"><Text className="text-white text-center text-xs font-extrabold">BOTH SIDES (B)</Text></TouchableOpacity></Row>
                <TouchableOpacity onPress={finishManualPatrol} disabled={patrolBusy} className="border border-rose-500 rounded-xl py-2.5 mt-3"><Text className="text-rose-600 text-center text-xs font-extrabold">END PATROL & ANALYZE</Text></TouchableOpacity>
              </>}
              <Text className="text-[10px] text-slate-400 mt-2">PC shortcuts work while this page is open. Camera automatically returns to centre after the full right/left sweep.</Text>
              <ActionFeedback result={photoCmd.result ?? burstCmd.result} />
            </Card>

            {/* Live status panel */}
            <Card className="mt-4">
            <SectionTitle>LIVE PROXIMITY & STATUS</SectionTitle>

            <Row className="justify-between mt-3">
              <Text className="text-xs font-semibold text-slate-500">Robot</Text>
              <Text className={`text-xs font-extrabold ${robotOnline ? 'text-brand-700' : 'text-rose-600'}`}>
                {robotOnline ? (status?.state ?? '').toUpperCase() : 'OFFLINE'}
              </Text>
            </Row>
            <Row className="justify-between mt-2.5">
              <Text className="text-xs font-semibold text-slate-500">Current Block</Text>
              <Text className="text-xs font-extrabold text-slate-900">
                {currentBlock ? `${currentBlock.name} (${currentBlock.plant})` : '—'}
              </Text>
            </Row>
            <Row className="justify-between mt-2.5">
              <Text className="text-xs font-semibold text-slate-500">Speed limit</Text>
              <Text className="text-xs font-extrabold text-slate-900">
                {motion
                  ? `${motion.driveSpeedPercent}% drive${motion.drivePwm != null ? ` (${motion.drivePwm} PWM)` : ''}${motion.appliedPwm != null ? ` · now ${motion.appliedPwm} PWM` : ''}`
                  : '—'}
              </Text>
            </Row>
            <Row className="justify-between mt-2.5">
              <Text className="text-xs font-semibold text-slate-500">Front arc</Text>
              <Text className="text-xs font-extrabold text-slate-900">
                {motion?.sensorAngleLeftDeg != null
                  ? `±${motion.sensorAngleLeftDeg}° / ±${motion.sensorAngleRightDeg}°${motion.avoidAssist === false ? ' · assist off' : ''}`
                  : '—'}
              </Text>
            </Row>

            {/* Ultrasonic bars: 3 fixed sensors — front, left, right */}
            <Text className="text-[10px] font-extrabold text-slate-400 mt-4 tracking-wide">ULTRASONIC SENSORS (cm)</Text>
            <View className="mt-2 gap-1.5">
              {SENSOR_LABELS.map((label, i) => {
                const d = ultrasonic?.distances_cm?.[i] ?? null;
                const danger = d != null && d < 30;
                const pct = d != null ? Math.min(100, (d / 300) * 100) : 0;
                return (
                  <Row key={label} className="items-center">
                    <Text className="text-[10px] font-bold text-slate-500 w-12">{label}</Text>
                    <View className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <View
                        className={`h-full rounded-full ${danger ? 'bg-rose-500' : 'bg-brand-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </View>
                    <Text className={`text-[10px] font-extrabold w-14 text-right ${danger ? 'text-rose-600' : 'text-slate-700'}`}>
                      {d != null ? `${d.toFixed(0)} cm` : '—'}
                    </Text>
                  </Row>
                );
              })}
            </View>
            {obstacle && (
              <View className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-3">
                <Text className="text-[11px] font-extrabold text-rose-600">⚠ Obstacle under 30 cm — drive carefully</Text>
              </View>
            )}
            {avoidLine && !failsafe && (
              <View className={`border rounded-lg px-3 py-2 mt-3 ${stuck ? 'bg-rose-50 border-rose-200' : 'bg-brand-50 border-brand-200'}`}>
                <Text className={`text-[11px] font-extrabold ${stuck ? 'text-rose-600' : 'text-brand-700'}`}>
                  {avoidLine}
                </Text>
                <Text className={`text-[10px] mt-0.5 ${stuck ? 'text-rose-600' : 'text-brand-700'}`}>
                  {stuck
                    ? 'Neither side gap is wider than the rover, so it stopped instead of pushing through the crop row. Clear the row or drive it back manually.'
                    : avoiding
                      ? 'The rover steers around the plant and picks the mission up again — no action needed.'
                      : 'The rover is still working out a way past.'}
                </Text>
              </View>
            )}
            {failsafe && (
              <View className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                <Text className="text-[11px] font-extrabold text-amber-700">
                  Robot cut its motors — no fresh drive command arrived (failsafe)
                </Text>
                <Text className="text-[10px] text-amber-700 mt-0.5">
                  The rover only moves again when a new drive command or a mission arrives.
                </Text>
              </View>
            )}
            {brakeOnlyStop && (
              <View className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                <Text className="text-[11px] font-extrabold text-amber-700">
                  Robot stopped itself: obstacle inside the safety distance ({motion?.obstacleStopCm ?? 30} cm)
                </Text>
                <Text className="text-[10px] text-amber-700 mt-0.5">
                  Auto-avoid steering is off for manual driving — switch it on in Settings and the rover will steer
                  around plants instead of stopping at them.
                </Text>
              </View>
            )}

            {/* E-Stop always available */}
            <TouchableOpacity
              onPress={() => { stopDrive(); eStop.run(); }}
              disabled={eStop.pending}
              activeOpacity={0.85}
              className={`flex-row items-center justify-center bg-rose-600 rounded-xl py-3 mt-4 ${eStop.pending ? 'opacity-60' : ''}`}
            >
              <Feather name="alert-octagon" size={16} color={colors.white} />
              <Text className="text-[13px] font-extrabold text-white ml-2">
                {eStop.pending ? 'Stopping…' : 'EMERGENCY STOP'}
              </Text>
            </TouchableOpacity>
            </Card>
          </View>
        </View>
      </Page>
    </View>
  );
}
