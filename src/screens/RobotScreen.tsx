import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, PillButton, ProgressBar, Page, CardRail } from '../components/ui';
import { LineChart, AutoWidth } from '../components/charts';
import { colors } from '../theme';
import { emitMessage } from '../scripts/Websocket';

const KPIS = [
  {
    label: 'Battery & Solar',
    value: '82%',
    sub: '+94W Solar',
    note: 'Est. 4h 15m remaining',
    icon: <MaterialCommunityIcons name="battery-charging-80" size={20} color={colors.emerald600} />,
    iconBg: 'bg-brand-100',
  },
  {
    label: 'Speed & Precision',
    value: '1.4 m/s',
    sub: 'RTK Fix (±1.2 cm)',
    note: 'Centimeter navigation',
    icon: <Feather name="navigation" size={18} color={colors.blue600} />,
    iconBg: 'bg-blue-100',
  },
  {
    label: 'Sensors & AI',
    value: '100%',
    sub: 'Ultrasonic & GPS',
    note: 'Operational',
    icon: <MaterialCommunityIcons name="radar" size={20} color={colors.purple600} />,
    iconBg: 'bg-purple-100',
  },
  {
    label: "Today's Progress",
    value: '6.8 km',
    sub: '14 of 18 Rows Scanned',
    note: '78% route complete',
    icon: <Feather name="trending-up" size={18} color={colors.orange600} />,
    iconBg: 'bg-orange-100',
  },
];

const CONTROLS: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { label: 'Return to Base', icon: 'home-import-outline' },
  { label: 'Pause Patrol', icon: 'pause-circle-outline' },
  { label: 'Manual Tele-Op', icon: 'gamepad-variant-outline' },
  { label: 'Calibrate Gimbal', icon: 'crosshairs-gps' },
];

const DIAGNOSTICS = [
  { label: 'Motor Hub Temp', value: '34°C', note: 'Normal', noteClass: 'text-brand-600' },
  { label: 'Cell Balance', value: '3.82 V', note: 'Balanced', noteClass: 'text-brand-600' },
  { label: 'Lens Clarity', value: '98%', note: 'Clean', noteClass: 'text-brand-600' },
  { label: 'LiDAR Latency', value: '12 ms', note: 'Optimal', noteClass: 'text-blue-600' },
];

export default function RobotScreen() {
  const handleStartRobot = () => {
    emitMessage('control_message', {
      action: 'stop',
      speed: 10,
      timestamp: new Date()
    });
  };


  return (
    <View className="flex-1 bg-surface">
      <Header title="Robot Fleet" />
      <Page>
        <Text className="text-[10px] font-extrabold text-brand-700 tracking-wider">
          AUTONOMOUS AGRICULTURAL FLEET • MISSION #AM-2026-08
        </Text>
        <Text className="text-[22px] font-extrabold text-slate-900 mt-1.5">Robot Fleet Management 🤖</Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          Real-time Telemetry, Sensor Diagnostics & Autonomous Navigation Control
        </Text>

        <Row className="mt-3 gap-2.5">
          <Badge label="1 Online" className="bg-brand-50" textClassName="text-brand-700" dotClassName="bg-brand-500" />
          <Badge label="0 Idle" className="bg-slate-100" textClassName="text-slate-600" dotClassName="bg-slate-400" />
          <Badge label="0 Fault" className="bg-rose-100" textClassName="text-rose-600" dotClassName="bg-rose-500" />
        </Row>

        <Row className="mt-4 gap-2.5 lg:max-w-[560px]">
          <PillButton label="Emergency Stop (E-Stop)" className="flex-1 bg-rose-600" textClassName="text-white" onPress={handleStartRobot} />
          <PillButton label="Deploy New Mission" className="flex-1 bg-brand-600" textClassName="text-white" />
        </Row>

        {/* Active unit */}
        <Card className="mt-5">
          <Row className="justify-between">
            <SectionTitle>ACTIVE UNIT</SectionTitle>
            <Badge label="ONLINE" className="bg-brand-50" textClassName="text-brand-700" dotClassName="bg-brand-500" />
          </Row>
          <Row className="mt-3">
            <Image source={require('../../assets/images/rover-alpha.jpg')} className="w-12 h-12 rounded-xl bg-slate-100" />
            <View className="ml-3">
              <Text className="text-[15px] font-extrabold text-slate-900">Rover Alpha-01</Text>
              <Text className="text-xs text-brand-700 font-semibold mt-0.5">Patrolling • Row #14</Text>
            </View>
          </Row>
          <Image
            source={require('../../assets/images/rover-hero.jpg')}
            className="w-full h-[190px] lg:h-[320px] rounded-xl mt-3.5"
            resizeMode="cover"
          />
          <Text className="text-[11px] font-bold text-slate-500 mt-2">
            Firmware OS v4.8.2-AgOS • Hardware SN: ROV-2026-X9
          </Text>
          <Text className="text-[11px] font-bold text-slate-400 mt-1">HDG 042° NE • Pitch +1.4°</Text>
        </Card>

        {/* KPI cards */}
        <View className="flex-row flex-wrap gap-3 mt-4">
          {KPIS.map((k) => (
            <Card key={k.label} className="w-[47.8%] lg:w-[23%] grow">
              <IconBox className={k.iconBg} size={36}>{k.icon}</IconBox>
              <Text className="text-[11px] font-bold text-slate-500 mt-2.5">{k.label}</Text>
              <Text className="text-xl font-extrabold text-slate-900 mt-0.5">{k.value}</Text>
              <Text className="text-[11px] font-bold text-brand-700 mt-0.5">{k.sub}</Text>
              <Text className="text-[10px] text-slate-400 mt-0.5">{k.note}</Text>
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
                activeOpacity={0.75}
                className="w-[47.5%] lg:w-[23%] grow bg-brand-50 border border-brand-100 rounded-xl py-4 items-center gap-1.5"
              >
                <MaterialCommunityIcons name={c.icon} size={22} color={colors.emerald700} />
                <Text className="text-[11px] font-extrabold text-brand-800 text-center">{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Diagnostics */}
        <Card className="mt-4">
          <SectionTitle>UNIT DIAGNOSTICS</SectionTitle>
          <View className="mt-2">
            {DIAGNOSTICS.map((d, i) => (
              <Row key={d.label} className={`justify-between py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                <Text className="text-xs font-bold text-slate-600">{d.label}</Text>
                <Row>
                  <Text className="text-[13px] font-extrabold text-slate-900">{d.value} </Text>
                  <Text className={`text-[11px] font-bold ${d.noteClass}`}>{d.note}</Text>
                </Row>
              </Row>
            ))}
          </View>
        </Card>

        {/* Mission progress */}
        <Card className="mt-4">
          <SectionTitle>TODAY'S MISSION PROGRESS</SectionTitle>
          <Row className="justify-between mt-3">
            <Text className="text-xs font-bold text-slate-600">14 of 18 Rows Scanned</Text>
            <Text className="text-xs font-extrabold text-brand-700">78%</Text>
          </Row>
          <View className="mt-2">
            <ProgressBar value={78} barClassName="bg-brand-500" />
          </View>
        </Card>

        {/* Sensor stream */}
        <Card className="mt-4">
          <SectionTitle>REAL-TIME SENSOR STREAMS</SectionTitle>
          <Text className="text-[11px] text-slate-500 mt-1">
            Live 100Hz agricultural telemetry stream from Field A
          </Text>
          <Row className="mt-3 gap-5">
            <Row>
              <View className="w-2.5 h-2.5 rounded-full bg-brand-500 mr-1.5" />
              <Text className="text-[11px] font-bold text-slate-600">NDVI Index (x100)</Text>
            </Row>
            <Row>
              <View className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5" />
              <Text className="text-[11px] font-bold text-slate-600">Soil Moisture (%)</Text>
            </Row>
          </Row>
          <View className="mt-2">
            <AutoWidth minHeight={190}>
              {(w) => (
                <LineChart
                  width={w}
                  height={190}
                  series={[
                    { points: [82, 86, 84, 88, 87, 90, 88], color: colors.emerald500 },
                    { points: [58, 62, 60, 66, 63, 64, 62], color: colors.blue500 },
                  ]}
                />
              )}
            </AutoWidth>
          </View>
          <Badge
            label="NDVI SCAN  0.88 Healthy"
            className="bg-brand-50 mt-3"
            textClassName="text-brand-700"
            dotClassName="bg-brand-500"
          />
        </Card>
      </Page>
    </View>
  );
}
