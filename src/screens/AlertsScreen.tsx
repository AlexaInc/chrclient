import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, PillButton, Page, CardRail } from '../components/ui';
import { BarChart, AutoWidth } from '../components/charts';
import { colors } from '../theme';

const KPIS = [
  {
    label: 'ACTIVE HAZARDS',
    value: '3 Crit / 5 Mod',
    sub: '2 Rovers Impacted',
    note: 'Field Live',
    iconBg: 'bg-rose-100',
    icon: <Feather name="alert-triangle" size={18} color={colors.rose600} />,
  },
  {
    label: 'MEAN TIME TO RESOLVE',
    value: '14.2 min',
    sub: '-18% vs avg',
    note: 'Auto-triage Active',
    iconBg: 'bg-brand-100',
    icon: <Feather name="clock" size={18} color={colors.emerald600} />,
  },
  {
    label: 'SENSOR INTEGRITY',
    value: '99.4% Online',
    sub: '1 LiDAR calibration needed',
    note: 'Fleet-wide diagnostics',
    iconBg: 'bg-blue-100',
    icon: <MaterialCommunityIcons name="radar" size={20} color={colors.blue600} />,
  },
  {
    label: 'PEST & PATHOGEN FLAGS',
    value: '2 Detected',
    sub: 'Early Blight + Spider Mite',
    note: 'Micro-spray staged',
    iconBg: 'bg-purple-100',
    icon: <MaterialCommunityIcons name="bug-outline" size={20} color={colors.purple600} />,
  },
  {
    label: 'PERIMETER & GEOFENCE',
    value: '100% Safe',
    sub: '0 Breaches recorded',
    note: 'Virtual fence armed',
    iconBg: 'bg-brand-100',
    icon: <Feather name="shield" size={18} color={colors.emerald600} />,
  },
];

const FILTERS = ['All Hazards (8)', 'Critical Pathogen (2)', 'Hardware & LiDAR (3)', 'Irrigation Faults (3)'];

const ALERTS = [
  {
    title: 'Early Blight Spore Concentration',
    zone: 'SECTOR 04 - BLOCK 2',
    severity: 'Stage 1 (Elevated)',
    status: 'Rover On Scene',
    time: '6 mins ago',
    sevClass: 'bg-rose-100',
    sevText: 'text-rose-600',
    iconBg: 'bg-rose-100',
    icon: <MaterialCommunityIcons name="mushroom-outline" size={20} color={colors.rose600} />,
  },
  {
    title: 'Spider Mite Cluster Detected',
    zone: 'GREENHOUSE ALPHA - POD 2',
    severity: 'Moderate',
    status: 'Scheduled Biocontrol',
    time: '24 mins ago',
    sevClass: 'bg-amber-100',
    sevText: 'text-amber-600',
    iconBg: 'bg-amber-100',
    icon: <MaterialCommunityIcons name="spider" size={20} color={colors.amber600} />,
  },
  {
    title: 'LiDAR Calibration Drift',
    zone: 'SCOUT D-1 UNIT',
    severity: 'Low',
    status: 'Auto-calibration queued',
    time: '1 hr ago',
    sevClass: 'bg-blue-100',
    sevText: 'text-blue-600',
    iconBg: 'bg-blue-100',
    icon: <MaterialCommunityIcons name="tune-vertical" size={20} color={colors.blue600} />,
  },
  {
    title: 'Drip Line Pressure Drop',
    zone: 'FIELD B - ROW 8',
    severity: 'Moderate',
    status: 'Valve inspection pending',
    time: '2 hrs ago',
    sevClass: 'bg-sky-100',
    sevText: 'text-sky-600',
    iconBg: 'bg-sky-100',
    icon: <MaterialCommunityIcons name="pipe-leak" size={20} color={colors.sky600} />,
  },
];

export default function AlertsScreen() {
  const [filter, setFilter] = useState(0);

  return (
    <View className="flex-1 bg-surface">
      <Header title="Alerts" />
      <Page>
        <Row className="gap-2 flex-wrap">
          <Badge label="FIELD SAFETY & DIAGNOSTICS" className="bg-rose-100" textClassName="text-rose-600" />
          <Badge
            label="REAL-TIME HAZARD STREAM"
            className="bg-amber-100"
            textClassName="text-amber-600"
            dotClassName="bg-amber-600"
          />
        </Row>
        <Text className="text-[22px] font-extrabold text-slate-900 mt-3">Alerts & Hazard Intelligence</Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          Real-time autonomous rover anomaly detection, crop disease alerts, geofence breaches, and sensor
          diagnostic streams.
        </Text>

        <Row className="mt-3.5 gap-2.5 lg:max-w-[560px]">
          <PillButton
            label="Export Incident Log"
            className="flex-1 border-[1.5px] border-slate-700"
            textClassName="text-slate-700"
          />
          <PillButton label="Acknowledge All" className="flex-1 bg-brand-600" textClassName="text-white" />
        </Row>

        {/* KPIs */}
        <CardRail className="mt-4">
          {KPIS.map((k) => (
            <Card key={k.label} className="w-[190px] lg:w-auto lg:flex-1 lg:min-w-[190px]">
              <IconBox className={k.iconBg} size={36}>{k.icon}</IconBox>
              <Text className="text-[10px] font-extrabold text-slate-400 mt-2.5 tracking-wide">{k.label}</Text>
              <Text className="text-[17px] font-extrabold text-slate-900 mt-0.5">{k.value}</Text>
              <Text className="text-[11px] font-bold text-brand-700 mt-1">{k.sub}</Text>
              <Text className="text-[10px] text-slate-400 mt-0.5">{k.note}</Text>
            </Card>
          ))}
        </CardRail>

        {/* Featured incident */}
        <Card className="mt-4">
          <SectionTitle>LIVE ANOMALY INSPECTION & INCIDENT DIGITAL TWIN</SectionTitle>
          <Text className="text-[10px] text-slate-500 mt-1">
            Photonic diagnostics, real-time pathogen triangulation, and robotic rover telemetry
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2.5" contentContainerStyle={{ gap: 8 }}>
            {FILTERS.map((f, i) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(i)}
                activeOpacity={0.8}
                className={`px-3 py-[7px] rounded-lg border ${
                  i === filter ? 'bg-rose-600 border-rose-600' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <Text className={`text-[11px] font-bold ${i === filter ? 'text-white' : 'text-slate-600'}`}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View className="mt-3">
            <Image
              source={require('../../assets/images/alerts-3d.jpg')}
              className="w-full h-[200px] lg:h-[340px] rounded-xl"
              resizeMode="cover"
            />
            <View className="absolute top-2.5 left-2.5 bg-rose-600/90 rounded-md px-2 py-1">
              <Text className="text-[9px] font-extrabold text-white">ACTIVE ALERT: SECTOR 04 - BLOCK 2</Text>
            </View>
          </View>
          <Text className="text-[15px] font-extrabold text-slate-900 mt-2.5">
            Early Blight Spore Concentration
          </Text>
          <Row className="justify-between mt-2.5">
            <View>
              <Text className="text-[10px] font-bold text-slate-400">Severity Level</Text>
              <Text className="text-[13px] font-extrabold text-rose-600 mt-0.5">Stage 1 (Elevated)</Text>
            </View>
            <View>
              <Text className="text-[10px] font-bold text-slate-400">Autonomous Status</Text>
              <Text className="text-[13px] font-extrabold text-brand-700 mt-0.5">Rover On Scene</Text>
            </View>
          </Row>
          <Text className="text-[10px] text-slate-400 mt-2.5">
            Rover Alpha-01 Diagnostic: Triggered 6 mins ago
          </Text>
        </Card>

        {/* Alert list */}
        <Card className="mt-4">
          <SectionTitle>INCIDENT QUEUE</SectionTitle>
          <View className="mt-2">
            {ALERTS.map((a, i) => (
              <View
                key={a.title}
                className={`flex-row items-start py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}
              >
                <IconBox className={a.iconBg} size={38}>{a.icon}</IconBox>
                <View className="flex-1 ml-3">
                  <Text className="text-xs font-extrabold text-slate-800">{a.title}</Text>
                  <Text className="text-[10px] font-bold text-slate-400 mt-0.5">{a.zone}</Text>
                  <Row className="mt-1.5 gap-2 flex-wrap">
                    <Badge label={a.severity} className={a.sevClass} textClassName={a.sevText} />
                    <Badge label={a.status} className="bg-brand-50" textClassName="text-brand-700" />
                  </Row>
                </View>
                <Text className="text-[10px] font-bold text-slate-400">{a.time}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Hazard frequency chart */}
        <Card className="mt-4">
          <SectionTitle>HAZARD FREQUENCY VS AUTO-RESOLUTION (LAST 24 HOURS)</SectionTitle>
          <Row className="mt-3 gap-4 flex-wrap">
            <Row>
              <View className="w-2.5 h-2.5 rounded-full bg-brand-500 mr-1.5" />
              <Text className="text-[11px] font-bold text-slate-600">Auto-Resolved</Text>
            </Row>
            <Row>
              <View className="w-2.5 h-2.5 rounded-full bg-amber-600 mr-1.5" />
              <Text className="text-[11px] font-bold text-slate-600">Pending / Triage</Text>
            </Row>
            <Row>
              <View className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5" />
              <Text className="text-[11px] font-bold text-slate-600">Critical</Text>
            </Row>
          </Row>
          <View className="mt-3">
            <AutoWidth minHeight={190}>
              {(w) => (
                <BarChart
                  width={w}
                  height={190}
                  bars={[6, 9, 4, 11, 7, 13, 8, 5]}
                  labels={['00', '03', '06', '09', '12', '15', '18', '21']}
                  color={colors.emerald500}
                />
              )}
            </AutoWidth>
          </View>
        </Card>
      </Page>
    </View>
  );
}
