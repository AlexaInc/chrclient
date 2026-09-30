import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, ProgressBar, Page, CardRail } from '../components/ui';
import { colors } from '../theme';
import { applyFleetConfig } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import { useRealtime } from '../realtime/RealtimeContext';
import { useAuth } from '../auth/AuthContext';
import { fetchConfig } from '../scripts/Api';
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
      </Page>
    </View>
  );
}
