import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, Page, CardRail, Grid, GridItem, useIsDesktop } from '../components/ui';
import { Sparkline, LineChart, AutoWidth } from '../components/charts';
import { colors } from '../theme';
import FieldMapCard from '../components/FieldMapcard';
import { useRealtime } from '../realtime/RealtimeContext';
import { useAuth } from '../auth/AuthContext';
import { fetchSensorHistory, fetchIrrigationHistory } from '../scripts/Api';

function timeAgo(ts: number | null): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return 'Just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default function DashboardScreen() {
  const isDesktop = useIsDesktop();
  const {
    sensors, status, location, irrigation, alerts, lastUpdated, isDemo,
    robotOnline, pumpOnline, fieldMap, currentBlock, mission, hydrated,
  } = useRealtime();
  const { token } = useAuth();
  const navigation = useNavigation<any>();

  const [tempHistory, setTempHistory] = useState<number[]>([]);
  const [moistureHistory, setMoistureHistory] = useState<number[]>([]);

  useEffect(() => {
    if (isDemo || !token) return;
    fetchSensorHistory(token, 24)
      .then((res) => setTempHistory(res.readings.map((r) => r.temperature).filter((v): v is number => v != null).reverse()))
      .catch((e) => console.warn('[Dashboard] sensor history failed:', e?.message ?? e));
    fetchIrrigationHistory(token, 24)
      .then((res) => setMoistureHistory(res.readings.map((r) => r.soil_moisture).filter((v): v is number => v != null).reverse()))
      .catch((e) => console.warn('[Dashboard] irrigation history failed:', e?.message ?? e));
  }, [isDemo, token]);

  const unacknowledged = alerts.filter((a) => !a.acknowledgedAt).length;
  const critical = alerts.filter((a) => !a.acknowledgedAt && a.severity === 'critical').length;
  const cropTypes = fieldMap ? new Set(fieldMap.blocks.map((b) => b.plant)).size : 0;

  const KPIS = [
    {
      label: 'Robot',
      value: robotOnline ? (status?.state ?? 'online').toUpperCase() : 'OFFLINE',
      status: status?.mode ? `Mode: ${status.mode}` : '—',
      statusClass: robotOnline ? 'text-brand-600' : 'text-rose-600',
      iconBg: robotOnline ? 'bg-brand-100' : 'bg-slate-100',
      icon: <MaterialCommunityIcons name="robot-outline" size={20} color={robotOnline ? colors.emerald600 : colors.slate400} />,
    },
    {
      label: 'GPS Fix',
      value: location ? `${location.satellites} sats` : 'No fix',
      status: location ? `Alt ${location.altitude.toFixed(0)}m` : 'Waiting for GPS',
      statusClass: location ? 'text-blue-600' : 'text-slate-400',
      iconBg: 'bg-blue-100',
      icon: <Feather name="crosshair" size={18} color={colors.blue600} />,
    },
    {
      label: 'Temperature',
      value: sensors?.temperature != null ? `${sensors.temperature.toFixed(1)}°C` : '—',
      status: sensors?.isRaining ? 'Raining' : 'Dry',
      statusClass: sensors?.isRaining ? 'text-blue-600' : 'text-brand-600',
      iconBg: 'bg-orange-100',
      icon: <MaterialCommunityIcons name="thermometer" size={20} color={colors.orange600} />,
    },
    {
      label: 'Soil Moisture',
      value: irrigation?.soilMoisture != null ? `${irrigation.soilMoisture}%` : '—',
      status: irrigation ? `Pump sensor • ${irrigation.pumpOn ? 'Pump ON' : 'Pump off'}` : 'No pump data',
      statusClass: irrigation?.pumpOn ? 'text-blue-600' : 'text-slate-500',
      iconBg: 'bg-blue-100',
      icon: <MaterialCommunityIcons name="water-outline" size={20} color={colors.blue600} />,
    },
    {
      label: 'Active Alerts',
      value: String(unacknowledged),
      status: critical > 0 ? `${critical} critical` : unacknowledged > 0 ? 'Needs review' : 'All clear',
      statusClass: critical > 0 ? 'text-rose-600' : unacknowledged > 0 ? 'text-amber-600' : 'text-brand-600',
      iconBg: critical > 0 ? 'bg-rose-100' : 'bg-purple-100',
      icon: <Feather name="alert-triangle" size={18} color={critical > 0 ? colors.rose600 : colors.purple600} />,
    },
  ];

  const activity = alerts.slice(0, 4).map((a) => ({
    title: a.title,
    sub: a.description ?? '',
    time: timeAgo(typeof a.receivedAt === 'number' ? a.receivedAt : Date.now()),
    iconBg: a.severity === 'critical' ? 'bg-rose-100' : a.severity === 'warning' ? 'bg-amber-100' : 'bg-brand-100',
    icon:
      a.severity === 'info' ? (
        <MaterialCommunityIcons name="information-outline" size={16} color={colors.emerald600} />
      ) : (
        <Feather name="alert-triangle" size={15} color={a.severity === 'critical' ? colors.rose600 : colors.amber600} />
      ),
  }));

  const SUMMARY = [
    { label: 'Mapped Blocks', value: fieldMap ? String(fieldMap.blocks.length) : '0', iconBg: 'bg-brand-100', icon: <Feather name="grid" size={16} color={colors.emerald600} /> },
    { label: 'Crop Types', value: String(cropTypes), iconBg: 'bg-brand-100', icon: <MaterialCommunityIcons name="sprout" size={16} color={colors.emerald600} /> },
    { label: 'Devices Online', value: `${(robotOnline ? 1 : 0) + (pumpOnline ? 1 : 0)} / 2`, iconBg: 'bg-slate-100', icon: <MaterialCommunityIcons name="robot-outline" size={16} color={colors.slate700} /> },
    { label: 'Active Mission', value: mission?.state && mission.state !== 'completed' ? `${mission.currentWaypoint ?? 0}/${mission.waypoints.length}` : 'None', iconBg: 'bg-sky-100', icon: <Feather name="navigation" size={15} color={colors.sky600} /> },
    { label: 'Last Sync', value: timeAgo(lastUpdated), iconBg: 'bg-sky-100', icon: <Feather name="refresh-cw" size={15} color={colors.sky600} /> },
  ];

  return (
    <View className="flex-1 bg-surface">
      <Header />
      <Page>
        {/* Welcome + date: side by side on desktop */}
        <View className={isDesktop ? 'flex-row items-center justify-between' : ''}>
          <View>
            <Text className="text-2xl font-extrabold text-slate-900">Welcome back! 👋</Text>
            <Text className="text-[13px] font-bold text-brand-700 mt-1">
              AI Smart Crop Monitoring System{isDemo ? '  •  DEMO MODE (simulated data)' : ''}
            </Text>
          </View>
          <Row className={`self-start bg-white border border-slate-200 rounded-lg px-3 py-1.5 ${isDesktop ? '' : 'mt-2'}`}>
            <Text className="text-xs text-slate-400">Date: </Text>
            <Feather name="calendar" size={13} color={colors.emerald600} />
            <Text className="text-xs font-extrabold text-slate-700 ml-1.5">{new Date().toDateString()}</Text>
          </Row>
        </View>

        {!hydrated && !isDemo && (
          <Text className="text-xs text-slate-400 mt-2">Loading live data…</Text>
        )}

        {/* KPI cards: rail on mobile, 5-across grid on desktop */}
        <CardRail className="mt-4">
          {KPIS.map((s) => (
            <Card key={s.label} className="w-[175px] lg:w-auto lg:flex-1 lg:min-w-[180px]">
              <Row>
                <IconBox className={s.iconBg}>{s.icon}</IconBox>
                <View className="ml-3 flex-1">
                  <Text className="text-[11px] font-bold text-slate-500">{s.label}</Text>
                  <Text className="text-xl font-extrabold text-slate-900 mt-0.5">{s.value}</Text>
                  <Text className={`text-[11px] font-semibold mt-0.5 ${s.statusClass}`}>{s.status}</Text>
                </View>
              </Row>
            </Card>
          ))}
        </CardRail>

        {/* Middle row: Robot Status / Field Map / Alerts — 3 columns on desktop */}
        <Grid className="mt-4">
          <GridItem span={5} cols={12}>
            <Card className="flex-1">
              <Row className="justify-between">
                <SectionTitle>ROBOT STATUS</SectionTitle>
                <Badge
                  label={robotOnline ? 'ONLINE' : status ? 'OFFLINE' : 'WAITING'}
                  className={robotOnline ? 'bg-brand-50' : 'bg-slate-100'}
                  textClassName={robotOnline ? 'text-brand-700' : 'text-slate-600'}
                  dotClassName={robotOnline ? 'bg-brand-500' : 'bg-slate-400'}
                />
              </Row>
              <Image
                source={require('../../assets/images/rover.jpg')}
                className="w-full self-center rounded-xl mt-3"
                resizeMode="cover"
              />
              <Row className="justify-between mt-3">
                <View>
                  <Text className="text-[10px] font-extrabold text-slate-400">MODE</Text>
                  <Text className="text-xs font-extrabold text-slate-800 mt-1">{status?.mode ?? '—'}</Text>
                </View>
                <View>
                  <Text className="text-[10px] font-extrabold text-slate-400">CURRENT BLOCK</Text>
                  <Row className="mt-1">
                    <Text className="text-xs font-extrabold text-slate-800">{currentBlock ? currentBlock.name : '—'} </Text>
                    <Feather name="map-pin" size={13} color={colors.blue600} />
                  </Row>
                </View>
                <View>
                  <Text className="text-[10px] font-extrabold text-slate-400">STATUS</Text>
                  <Text className="text-xs font-extrabold text-brand-600 mt-1">
                    {status?.state ? status.state.charAt(0).toUpperCase() + status.state.slice(1) : '—'}
                  </Text>
                </View>
              </Row>
            </Card>
          </GridItem>

          <FieldMapCard />

          <GridItem span={3} cols={12}>
            <Card className="flex-1">
              <SectionTitle className="text-purple-900">ALERTS</SectionTitle>
              <Row className="mt-4 justify-center gap-4">
                <IconBox className={critical > 0 ? 'bg-rose-50' : 'bg-purple-50'} size={56}>
                  <Feather name="alert-triangle" size={26} color={critical > 0 ? colors.rose600 : colors.purple700} />
                </IconBox>
                <View>
                  <Text className="text-3xl font-extrabold text-slate-900">{unacknowledged}</Text>
                  <Text className="text-[11px] font-bold text-slate-500">{critical > 0 ? `${critical} Critical` : 'Unacknowledged'}</Text>
                </View>
              </Row>
              <TouchableOpacity
                onPress={() => navigation.navigate('Alerts')}
                activeOpacity={0.8}
                className="flex-row items-center justify-center border-[1.5px] border-purple-600 rounded-lg py-2.5 mt-4"
              >
                <Text className="text-xs font-extrabold text-purple-700">View Alerts</Text>
                <Feather name="arrow-right" size={15} color={colors.purple700} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </Card>
          </GridItem>
        </Grid>

        {/* Lower row: Environment trend chart + Recent Activity — 2 columns on desktop */}
        <Grid className="mt-4">
          <GridItem span={7} cols={12}>
            <Card className="flex-1">
              <Row className="justify-between">
                <SectionTitle>ENVIRONMENT TRENDS</SectionTitle>
                <Text className="text-[11px] font-extrabold text-slate-500">Last 24h</Text>
              </Row>
              <Row className="mt-3 gap-5">
                <Row>
                  <View className="w-2.5 h-2.5 rounded-full bg-brand-500 mr-1.5" />
                  <Text className="text-[11px] font-bold text-slate-600">Temperature (°C)</Text>
                </Row>
                <Row>
                  <View className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5" />
                  <Text className="text-[11px] font-bold text-slate-600">Soil Moisture — pump sensor (%)</Text>
                </Row>
              </Row>
              <View className="mt-2">
                {isDemo ? (
                  <Text className="text-xs text-slate-400 py-8 text-center">History charts are not simulated in demo mode.</Text>
                ) : tempHistory.length < 2 && moistureHistory.length < 2 ? (
                  <Text className="text-xs text-slate-400 py-8 text-center">Not enough history yet — check back after the robot has been running a while.</Text>
                ) : (
                  <AutoWidth minHeight={210}>
                    {(w) => (
                      <LineChart
                        width={w}
                        height={210}
                        series={[
                          ...(tempHistory.length >= 2 ? [{ points: tempHistory, color: colors.green500 }] : []),
                          ...(moistureHistory.length >= 2 ? [{ points: moistureHistory, color: colors.blue500 }] : []),
                        ]}
                        xLabels={[]}
                      />
                    )}
                  </AutoWidth>
                )}
              </View>
            </Card>
          </GridItem>

          <GridItem span={5} cols={12}>
            <Card className="flex-1">
              <SectionTitle>RECENT ACTIVITY</SectionTitle>
              <View className="mt-2">
                {activity.length === 0 ? (
                  <Text className="text-xs text-slate-400 py-6 text-center">No alerts raised yet.</Text>
                ) : (
                  activity.map((a, i) => (
                    <Row key={`${a.title}-${i}`} className={`py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                      <IconBox className={a.iconBg} size={36}>{a.icon}</IconBox>
                      <View className="flex-1 ml-3">
                        <Text className="text-xs font-extrabold text-slate-800">{a.title}</Text>
                        <Text className="text-[11px] text-slate-500 mt-0.5">{a.sub}</Text>
                      </View>
                      <Text className="text-[11px] font-bold text-slate-400">{a.time}</Text>
                    </Row>
                  ))
                )}
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('Alerts')}
                activeOpacity={0.7}
                className="flex-row self-end items-center mt-1"
              >
                <Text className="text-xs font-extrabold text-brand-700">View All Activity</Text>
                <Feather name="arrow-right" size={15} color={colors.emerald700} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </Card>
          </GridItem>
        </Grid>

        {/* Quick summary: vertical list on mobile, 5-across row on desktop */}
        <Card className="mt-4">
          <SectionTitle>QUICK SUMMARY</SectionTitle>
          <View className={isDesktop ? 'mt-3 flex-row flex-wrap gap-6' : 'mt-3 gap-3.5'}>
            {SUMMARY.map((s) => (
              <Row key={s.label} className={isDesktop ? 'flex-1 min-w-[150px]' : ''}>
                <IconBox className={s.iconBg} size={36}>{s.icon}</IconBox>
                <View className="ml-3">
                  <Text className="text-[11px] text-slate-500 font-semibold">{s.label}</Text>
                  <Text className="text-base font-extrabold text-slate-900">{s.value}</Text>
                </View>
              </Row>
            ))}
          </View>
        </Card>

        {/* Footer */}
        <View className={`mt-6 bg-sidebar rounded-xl p-3.5 ${isDesktop ? 'flex-row justify-between px-6' : 'items-center gap-1'}`}>
          <Text className="text-[11px] font-semibold text-white">© 2026 Group 01 SLIIT Kurunegala IT | All Rights Reserved</Text>
          <Text className="text-[11px] font-semibold text-brand-300">Version 1.0.0</Text>
        </View>
      </Page>
    </View>
  );
}
