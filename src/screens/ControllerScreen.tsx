import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, Row, Page, useIsDesktop } from '../components/ui';
import { colors } from '../theme';
import { useRealtime } from '../realtime/RealtimeContext';
import { changeRoverMode, drive, emergencyStop } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import { DriveDirection } from '../types/actions';

const REPEAT_MS = 250; // resend rate while a direction is held

const DIRS: { dir: DriveDirection; icon: keyof typeof Feather.glyphMap; key: string }[] = [
  { dir: 'forward', icon: 'arrow-up', key: 'w' },
  { dir: 'left', icon: 'arrow-left', key: 'a' },
  { dir: 'backward', icon: 'arrow-down', key: 's' },
  { dir: 'right', icon: 'arrow-right', key: 'd' },
];

export default function ControllerScreen() {
  const isDesktop = useIsDesktop();
  const { status, battery, ultrasonic, currentBlock, isDemo } = useRealtime();
  const [speed, setSpeed] = useState(50);
  const [active, setActive] = useState<DriveDirection | null>(null);
  const [teleop, setTeleop] = useState(false);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mode = useCommand(changeRoverMode);
  const eStop = useCommand(emergencyStop);

  const stopDrive = useCallback(() => {
    if (repeatRef.current) clearInterval(repeatRef.current);
    repeatRef.current = null;
    setActive(null);
    drive('stop', 0);
  }, []);

  const startDrive = useCallback((dir: DriveDirection, spd: number) => {
    if (repeatRef.current) clearInterval(repeatRef.current);
    setActive(dir);
    drive(dir, spd);
    repeatRef.current = setInterval(() => drive(dir, spd), REPEAT_MS);
  }, []);

  const enableTeleop = async () => {
    const res = await mode.run('manual');
    if (res.success) setTeleop(true);
  };
  const disableTeleop = async () => {
    stopDrive();
    const res = await mode.run('autonomous');
    if (res.success) setTeleop(false);
  };

  // PC: WASD / arrow keys via web keydown/keyup
  useEffect(() => {
    if (Platform.OS !== 'web' || !teleop) return;
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      const map: Record<string, DriveDirection> = {
        w: 'forward', arrowup: 'forward',
        s: 'backward', arrowdown: 'backward',
        a: 'left', arrowleft: 'left',
        d: 'right', arrowright: 'right',
      };
      if (map[k]) { e.preventDefault(); startDrive(map[k], speed); }
      if (k === ' ') { e.preventDefault(); stopDrive(); }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) stopDrive();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [teleop, speed, startDrive, stopDrive]);

  useEffect(() => () => stopDrive(), [stopDrive]);

  const online = status?.state != null && status.state !== 'offline' && status.state !== 'fault';
  const minDist = ultrasonic ? Math.min(...ultrasonic.distances_cm) : null;
  const obstacle = minDist != null && minDist < 30;

  const padBtn = (d: (typeof DIRS)[number]) => (
    <TouchableOpacity
      key={d.dir}
      disabled={!teleop}
      onPressIn={() => startDrive(d.dir, speed)}
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
          {Platform.OS === 'web' ? 'Hold on-screen buttons or use WASD / arrow keys. Space = stop.' : 'Press and hold the direction buttons to drive.'}
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

            {/* Speed selector */}
            <Row className="justify-between mt-5">
              <Text className="text-xs font-extrabold text-slate-700">THROTTLE</Text>
              <Text className="text-xs font-extrabold text-brand-700">{speed}%</Text>
            </Row>
            <Row className="gap-2 mt-2">
              {[25, 50, 75, 100].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSpeed(s)}
                  activeOpacity={0.8}
                  className={`flex-1 py-2 rounded-lg border items-center ${
                    speed === s ? 'bg-brand-600 border-brand-600' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Text className={`text-[11px] font-extrabold ${speed === s ? 'text-white' : 'text-slate-600'}`}>{s}%</Text>
                </TouchableOpacity>
              ))}
            </Row>

            {/* Mode toggle */}
            <TouchableOpacity
              onPress={teleop ? disableTeleop : enableTeleop}
              disabled={mode.pending}
              activeOpacity={0.85}
              className={`flex-row items-center justify-center rounded-xl py-3 mt-4 ${
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

          {/* Live status panel */}
          <Card className={isDesktop ? 'w-[320px]' : 'mt-4'}>
            <SectionTitle>LIVE PROXIMITY & STATUS</SectionTitle>

            <Row className="justify-between mt-3">
              <Text className="text-xs font-semibold text-slate-500">Robot</Text>
              <Text className={`text-xs font-extrabold ${online ? 'text-brand-700' : 'text-rose-600'}`}>
                {online ? (status?.state ?? '').toUpperCase() : 'OFFLINE'}
              </Text>
            </Row>
            <Row className="justify-between mt-2.5">
              <Text className="text-xs font-semibold text-slate-500">Battery</Text>
              <Text className="text-xs font-extrabold text-slate-900">{battery ? `${battery.level}%` : '—'}</Text>
            </Row>
            <Row className="justify-between mt-2.5">
              <Text className="text-xs font-semibold text-slate-500">Current Block</Text>
              <Text className="text-xs font-extrabold text-slate-900">
                {currentBlock ? `${currentBlock.name} (${currentBlock.plant})` : '—'}
              </Text>
            </Row>

            {/* Ultrasonic bars: index = sensor position on the rover */}
            <Text className="text-[10px] font-extrabold text-slate-400 mt-4 tracking-wide">ULTRASONIC SENSORS (cm)</Text>
            <View className="mt-2 gap-1.5">
              {(ultrasonic?.distances_cm ?? [null, null, null, null, null]).map((d, i) => {
                const danger = d != null && d < 30;
                const pct = d != null ? Math.min(100, (d / 300) * 100) : 0;
                return (
                  <Row key={i} className="items-center">
                    <Text className="text-[10px] font-bold text-slate-500 w-8">S{i + 1}</Text>
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
      </Page>
    </View>
  );
}
