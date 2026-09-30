import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, PillButton, ProgressBar, Page } from '../components/ui';
import { colors } from '../theme';
import { useRealtime } from '../realtime/RealtimeContext';
import {
  changeRoverMode,
  capturePhoto,
  emergencyStop,
  pausePatrol,
  returnToBase,
  setManualTeleop,
  startPatrol,
} from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return 'Just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

export default function RobotScreen() {
  const { status, location, sensors, ultrasonic, mission, isDemo, robotOnline, pumpOnline, devices } = useRealtime();

  const eStop = useCommand(emergencyStop);
  const rtb = useCommand(returnToBase);
  const pause = useCommand(pausePatrol);
  const resume = useCommand(startPatrol);
  const teleop = useCommand(setManualTeleop);
  const photo = useCommand(capturePhoto);
  const mode = useCommand(changeRoverMode);

  const isPaused = status?.state === 'idle';
  const fault = status?.state === 'fault';

  const CONTROLS: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; run: () => void; pending: boolean }[] = [
    { label: 'Return to Base', icon: 'home-import-outline', run: () => rtb.run(), pending: rtb.pending },
    {
      label: isPaused ? 'Resume Patrol' : 'Pause Patrol',
      icon: isPaused ? 'play-circle-outline' : 'pause-circle-outline',
      run: () => (isPaused ? resume.run() : pause.run()),
      pending: pause.pending || resume.pending,
    },
    { label: 'Manual Tele-Op', icon: 'gamepad-variant-outline', run: () => teleop.run(true), pending: teleop.pending },
    { label: 'Capture Photo', icon: 'camera-outline', run: () => photo.run(), pending: photo.pending },
  ];
  const controlsResult = rtb.result ?? pause.result ?? resume.result ?? teleop.result ?? photo.result ?? mode.result;

  const [d1, d2, d3] = ultrasonic?.distances_cm ?? [];

  const kpis = [
    {
      label: 'GPS FIX',
      value: location ? `${location.satellites} sats` : '—',
      sub: location ? `Alt ${location.altitude.toFixed(1)}m` : 'No fix yet',
      icon: <Feather name="crosshair" size={18} color={colors.blue600} />,
      iconBg: 'bg-blue-100',
    },
    {
      label: 'ENVIRONMENT',
      value: sensors ? `${sensors.temperature.toFixed(1)}°C` : '—',
      sub: sensors ? `${sensors.humidity != null ? `${Math.round(sensors.humidity)}% RH` : ''}${sensors.isRaining ? ' • Raining' : ''}` : 'No data yet',
      icon: <MaterialCommunityIcons name="thermometer" size={20} color={colors.orange600} />,
      iconBg: 'bg-orange-100',
    },
    {
      label: 'OBSTACLE SENSORS',
      value: d1 != null ? `${Math.round(d1)}cm` : '—',
      sub: d2 != null && d3 != null ? `L ${Math.round(d2)}cm • R ${Math.round(d3)}cm` : 'No reading yet',
      icon: <MaterialCommunityIcons name="radar" size={20} color={colors.purple600} />,
      iconBg: 'bg-purple-100',
    },
    {
      label: 'MISSION PROGRESS',
      value: mission ? `${mission.progress ?? 0}%` : 'None',
      sub: mission ? `Waypoint ${mission.currentWaypoint ?? 0}/${mission.totalWaypoints ?? mission.waypoints.length}` : 'No mission deployed',
      icon: <Feather name="trending-up" size={18} color={colors.emerald600} />,
      iconBg: 'bg-brand-100',
    },
  ];

  return (
    <View className="flex-1 bg-surface">
      <Header title="Robot Fleet" />
      <Page>
        <Text className="text-[10px] font-extrabold text-brand-700 tracking-wider">
          AUTONOMOUS CROP-MONITORING ROBOT
        </Text>
        <Text className="text-[22px] font-extrabold text-slate-900 mt-1.5">Robot Control 🤖</Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          Live status, real sensor readings, and mission control for the rover.
        </Text>

        <Row className="mt-3 gap-2.5 flex-wrap">
          <Badge label={robotOnline ? 'Robot Online' : 'Robot Offline'} className={robotOnline ? 'bg-brand-50' : 'bg-slate-100'} textClassName={robotOnline ? 'text-brand-700' : 'text-slate-600'} dotClassName={robotOnline ? 'bg-brand-500' : 'bg-slate-400'} />
          <Badge label={pumpOnline ? 'Pump Online' : 'Pump Offline'} className={pumpOnline ? 'bg-blue-50' : 'bg-slate-100'} textClassName={pumpOnline ? 'text-blue-700' : 'text-slate-600'} dotClassName={pumpOnline ? 'bg-blue-500' : 'bg-slate-400'} />
          {fault && <Badge label="FAULT" className="bg-rose-100" textClassName="text-rose-600" dotClassName="bg-rose-500" />}
          {isDemo && <Badge label="DEMO DATA" className="bg-amber-100" textClassName="text-amber-700" dotClassName="bg-amber-500" />}
        </Row>

        <Row className="mt-4 gap-2.5 lg:max-w-[420px]">
          <PillButton
            label={eStop.pending ? 'Stopping…' : 'Emergency Stop (E-Stop)'}
            className={`flex-1 bg-rose-600 ${eStop.pending ? 'opacity-60' : ''}`}
            textClassName="text-white"
            onPress={() => eStop.run()}
          />
        </Row>
        <ActionFeedback result={eStop.result} />

        {/* Active unit */}
        <Card className="mt-5">
          <Row className="justify-between">
            <SectionTitle>ROBOT STATUS</SectionTitle>
            <Badge
              label={robotOnline ? 'ONLINE' : fault ? 'FAULT' : 'OFFLINE'}
              className={robotOnline ? 'bg-brand-50' : fault ? 'bg-rose-100' : 'bg-slate-100'}
              textClassName={robotOnline ? 'text-brand-700' : fault ? 'text-rose-600' : 'text-slate-600'}
              dotClassName={robotOnline ? 'bg-brand-500' : fault ? 'bg-rose-500' : 'bg-slate-400'}
            />
          </Row>
          <Row className="mt-3">
            <Image source={require('../../assets/images/rover-alpha.jpg')} className="w-12 h-12 rounded-xl bg-slate-100" />
            <View className="ml-3">
              <Text className="text-[15px] font-extrabold text-slate-900">Rover-01</Text>
              <Text className="text-xs text-brand-700 font-semibold mt-0.5">
                {status?.message ?? (status?.state ? status.state.charAt(0).toUpperCase() + status.state.slice(1) : 'Waiting for connection…')}
              </Text>
            </View>
          </Row>
          <Image
            source={require('../../assets/images/rover-hero.jpg')}
            className="w-full h-[190px] lg:h-[320px] rounded-xl mt-3.5"
            resizeMode="cover"
          />
          <Text className="text-[11px] font-bold text-slate-400 mt-2">
            Last seen: {timeAgo(devices['robot-01']?.lastSeen)}
          </Text>
        </Card>

        {/* KPI cards */}
        <View className="flex-row flex-wrap gap-3 mt-4">
          {kpis.map((k) => (
            <Card key={k.label} className="w-[47.8%] lg:w-[23%] grow">
              <IconBox className={k.iconBg} size={36}>{k.icon}</IconBox>
              <Text className="text-[11px] font-bold text-slate-500 mt-2.5">{k.label}</Text>
              <Text className="text-xl font-extrabold text-slate-900 mt-0.5">{k.value}</Text>
              <Text className="text-[11px] font-bold text-brand-700 mt-0.5">{k.sub}</Text>
            </Card>
          ))}
        </View>

        {/* Live controls */}
        <Card className="mt-4">
          <SectionTitle>LIVE UNIT CONTROLS</SectionTitle>
          <View className="flex-row flex-wrap gap-2.5 mt-3">
            {CONTROLS.map((c) => (
              <TouchableOpacity
                key={c.label}
                onPress={c.run}
                disabled={c.pending}
                activeOpacity={0.75}
                className={`w-[47.5%] lg:w-[23%] grow bg-brand-50 border border-brand-100 rounded-xl py-4 items-center gap-1.5 ${c.pending ? 'opacity-50' : ''}`}
              >
                <MaterialCommunityIcons name={c.icon} size={22} color={colors.emerald700} />
                <Text className="text-[11px] font-extrabold text-brand-800 text-center">
                  {c.pending ? 'Sending…' : c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ActionFeedback result={controlsResult} />
          {/* Operator mode switch: the hardware only supports fully-autonomous
              patrol or paused-for-manual-drive — no other modes exist. */}
          <View className="flex-row flex-wrap gap-2 mt-3">
            {(['autonomous', 'manual'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => mode.run(m)}
                disabled={mode.pending}
                activeOpacity={0.8}
                className={`px-3 py-[7px] rounded-lg border ${
                  status?.mode === m ? 'bg-brand-600 border-brand-600' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <Text className={`text-[11px] font-bold capitalize ${status?.mode === m ? 'text-white' : 'text-slate-600'}`}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Mission progress */}
        <Card className="mt-4">
          <SectionTitle>MISSION PROGRESS</SectionTitle>
          {mission ? (
            <>
              <Row className="justify-between mt-3">
                <Text className="text-xs font-bold text-slate-600">Waypoint {mission.currentWaypoint ?? 0} of {mission.totalWaypoints ?? mission.waypoints.length}</Text>
                <Text className="text-xs font-extrabold text-brand-700">{mission.progress ?? 0}%</Text>
              </Row>
              <View className="mt-2">
                <ProgressBar value={mission.progress ?? 0} barClassName="bg-brand-500" />
              </View>
              {mission.message && <Text className="text-[11px] text-slate-500 mt-2">{mission.message}</Text>}
            </>
          ) : (
            <Text className="text-xs text-slate-500 mt-2">No mission deployed. Deploy one from the Location screen.</Text>
          )}
        </Card>

        {/* Real sensor feed — the only 4 real data sources this robot has:
            raindrop, temperature, camera (photos), GPS. */}
        <Card className="mt-4">
          <SectionTitle>LIVE SENSOR FEED</SectionTitle>
          <Text className="text-[11px] text-slate-500 mt-1">
            Direct readings from the rover — temperature, raindrop sensor, and ultrasonic obstacle sensors.
          </Text>
          <View className="mt-2">
            {[
              { label: 'Temperature', value: sensors ? `${sensors.temperature.toFixed(1)}°C` : '—' },
              { label: 'Humidity', value: sensors?.humidity != null ? `${Math.round(sensors.humidity)}%` : '—' },
              { label: 'Raindrop sensor', value: sensors?.rainDrop != null ? `${Math.round(sensors.rainDrop)}%${sensors.isRaining ? ' (raining)' : ''}` : '—' },
              { label: 'Ultrasonic — Front', value: d1 != null ? `${Math.round(d1)} cm` : '—' },
              { label: 'Ultrasonic — Left', value: d2 != null ? `${Math.round(d2)} cm` : '—' },
              { label: 'Ultrasonic — Right', value: d3 != null ? `${Math.round(d3)} cm` : '—' },
              { label: 'Current block', value: sensors?.blockId ? `${sensors.blockId} (${sensors.plant ?? '—'})` : 'Not in a mapped block' },
            ].map((row, i) => (
              <Row key={row.label} className={`justify-between py-2.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                <Text className="text-xs font-bold text-slate-600">{row.label}</Text>
                <Text className="text-[13px] font-extrabold text-slate-900">{row.value}</Text>
              </Row>
            ))}
          </View>
        </Card>
      </Page>
    </View>
  );
}
