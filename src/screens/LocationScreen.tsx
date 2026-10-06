import React from 'react';
import { View, Text } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, Page, CardRail, useIsDesktop } from '../components/ui';
import { colors } from '../theme';
import LiveMap, { DEFAULT_FIELD_LOCATION } from '../map/LiveMap';
import { useRealtime } from '../realtime/RealtimeContext';
import BlockMapBuilder from '../map/BlockMapBuilder';

function timeAgo(ts: number | null): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return 'Just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

export default function LocationScreen() {
  const isDesktop = useIsDesktop();
  const { location, trail, status, isDemo, currentBlock, fieldMap, robotOnline, mission, lastUpdated } = useRealtime();

  /**
   * No GPS fix (module missing/unplugged, no satellites, or a dead link) must
   * not leave the screen empty: the rover's field position is shown instead and
   * clearly labelled as the default, so the map still means something.
   */
  const defaultLocation = {
    latitude: DEFAULT_FIELD_LOCATION.latitude,
    longitude: DEFAULT_FIELD_LOCATION.longitude,
    altitude: 0,
    satellites: 0,
    deviceId: 'default-field-position',
  };
  const hasFix = !!location;
  const shownLocation = location ?? defaultLocation;

  const kpis = [
    {
      label: 'GNSS FIX',
      value: location ? `${location.satellites} satellites` : 'No fix',
      sub: location ? `Alt ${location.altitude.toFixed(1)}m MSL` : 'Waiting for GPS',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      icon: <Feather name="crosshair" size={18} color={colors.blue600} />,
    },
    {
      label: 'ROBOT',
      value: robotOnline ? 'ONLINE' : 'OFFLINE',
      sub: status?.state ? status.state.charAt(0).toUpperCase() + status.state.slice(1) : '—',
      iconBg: robotOnline ? 'bg-brand-100 dark:bg-brand-900/50' : 'bg-slate-100 dark:bg-slate-800',
      icon: <MaterialCommunityIcons name="robot-outline" size={20} color={robotOnline ? colors.emerald600 : colors.slate500} />,
    },
    {
      label: 'MAPPED BLOCKS',
      value: fieldMap ? String(fieldMap.blocks.length) : '0',
      sub: fieldMap?.name ?? 'No field map yet',
      iconBg: 'bg-purple-100 dark:bg-purple-900/40',
      icon: <Feather name="map" size={18} color={colors.purple600} />,
    },
    {
      label: 'ACTIVE MISSION',
      value: mission ? `${mission.currentWaypoint ?? 0}/${mission.totalWaypoints ?? mission.waypoints.length}` : 'None',
      sub: mission ? `${mission.progress ?? 0}% complete` : 'No mission deployed',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      icon: <Feather name="navigation" size={18} color={colors.amber600} />,
    },
  ];

  return (
    <View className="flex-1 bg-surface dark:bg-slate-950">
      <Header title="Location" />
      <Page>
        <Row className="gap-2 flex-wrap">
          <Badge label="GEOSPATIAL TELEMETRY" className="bg-brand-50 dark:bg-brand-900/40" textClassName="text-brand-700 dark:text-brand-300" />
          <Badge label={isDemo ? 'DEMO GPS' : 'LIVE GPS'} className="bg-blue-100 dark:bg-blue-900/40" textClassName="text-blue-600" dotClassName="bg-blue-500" />
        </Row>
        <Text className="text-[22px] font-extrabold text-slate-900 dark:text-slate-100 mt-3">
          Location & Field Map
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-[18px]">
          Real-time GPS position, the crop-block map the robot patrols against, and live mission progress.
        </Text>

        {/* KPIs */}
        <CardRail className="mt-4">
          {kpis.map((k) => (
            <Card key={k.label} className="w-[200px] lg:w-auto lg:flex-1 lg:min-w-[190px]">
              <IconBox className={k.iconBg} size={36}>{k.icon}</IconBox>
              <Text className="text-[10px] font-extrabold text-slate-400 mt-2.5 tracking-wide">{k.label}</Text>
              <Text className="text-[17px] font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">{k.value}</Text>
              <Text className="text-[10px] text-slate-400 mt-1">{k.sub}</Text>
            </Card>
          ))}
        </CardRail>

        {/* Live map */}
        <Card className="mt-4">
          <SectionTitle>LIVE ROBOT POSITION</SectionTitle>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            GPS track over the mapped field blocks
          </Text>

          <View className="mt-3">
            <LiveMap location={shownLocation} trail={trail} height={isDesktop ? 380 : 260} isDefault={!hasFix} />
            <View className="absolute top-2.5 left-2.5 bg-sidebar/90 rounded-md px-2 py-1" pointerEvents="none">
              <Text className="text-[9px] font-extrabold text-white">
                {hasFix ? (isDemo ? 'LIVE GPS • DEMO DATA' : 'LIVE GPS') : 'NO GPS FIX • DEFAULT POSITION'}
              </Text>
            </View>
          </View>
          <Text className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-2.5">
            {currentBlock ? `${currentBlock.name} — ${currentBlock.plant}` : 'Outside mapped blocks'}
          </Text>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {hasFix
              ? `Lat: ${shownLocation.latitude.toFixed(5)}° ${shownLocation.latitude >= 0 ? 'N' : 'S'} • Lon: ${shownLocation.longitude.toFixed(5)}° ${shownLocation.longitude >= 0 ? 'E' : 'W'} • Elevation: ${shownLocation.altitude.toFixed(1)}m MSL • ${shownLocation.satellites} satellites`
              : `No GPS fix — showing the default field position ${DEFAULT_FIELD_LOCATION.latitude.toFixed(6)}, ${DEFAULT_FIELD_LOCATION.longitude.toFixed(6)} (robot still reports offline/unfixed)`}
          </Text>
          {mission && (
            <Row className="mt-2">
              <Badge
                label={`Waypoint ${mission.currentWaypoint ?? 0}/${mission.totalWaypoints ?? mission.waypoints.length}`}
                className="bg-brand-50 dark:bg-brand-900/40"
                textClassName="text-brand-700 dark:text-brand-300"
              />
              <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-2">
                {mission.progress ?? 0}% of patrol completed
              </Text>
            </Row>
          )}
        </Card>

        {/* Block map builder: mark blocks, assign the plant grown in each, deploy patrols */}
        <BlockMapBuilder height={isDesktop ? 380 : 280} />

        {/* status strip */}
        <View className="mt-4 bg-sidebar rounded-2xl p-4">
          <Row className="justify-between">
            <Row>
              <Feather name="wifi" size={16} color={robotOnline ? colors.emerald400 : colors.slate500} />
              <Text className="text-xs font-extrabold text-white ml-2">{robotOnline ? 'ROBOT CONNECTED' : 'ROBOT OFFLINE'}</Text>
            </Row>
            <Text className="text-[11px] font-bold text-brand-300">Last update: {timeAgo(lastUpdated)}</Text>
          </Row>
        </View>
      </Page>
    </View>
  );
}
