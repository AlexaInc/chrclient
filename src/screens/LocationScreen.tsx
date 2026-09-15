import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, PillButton, Page, CardRail, useIsDesktop } from '../components/ui';
import { colors } from '../theme';
import LiveMap from '../map/LiveMap';
import { useRealtime } from '../realtime/RealtimeContext';
import { addFieldBoundary, deployWaypointMission } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import FilterTabs from '../components/FilterTabs';
import BlockMapBuilder from '../map/BlockMapBuilder';

const KPIS = [
  {
    label: 'TOTAL FIELD AREA',
    value: '142.5 Ha',
    sub: '8 Managed Zones • 100% Mapped',
    iconBg: 'bg-brand-100',
    icon: <Feather name="map" size={18} color={colors.emerald600} />,
  },
  {
    label: 'ACTIVE ROVERS ON MAP',
    value: '3 Units ONLINE',
    sub: 'Rover Alpha-01, Harvester-02, Scout D-1',
    iconBg: 'bg-blue-100',
    icon: <MaterialCommunityIcons name="robot-outline" size={20} color={colors.blue600} />,
  },
  {
    label: 'RTK LOCK & PRECISION',
    value: '±1.2 cm',
    sub: 'Quad-Constellation Active',
    iconBg: 'bg-purple-100',
    icon: <Feather name="crosshair" size={18} color={colors.purple600} />,
  },
  {
    label: 'GEOFENCE INTEGRITY',
    value: '100% Safe',
    sub: '0 Perimeter Breaches • Virtual Fence',
    iconBg: 'bg-brand-100',
    icon: <Feather name="shield" size={18} color={colors.emerald600} />,
  },
  {
    label: 'FIELD MICROCLIMATE',
    value: '24.2°C • 62% RH',
    sub: 'Wind: 4.8 km/h NW • Solar: 840 W/m²',
    iconBg: 'bg-sky-100',
    icon: <Feather name="cloud" size={18} color={colors.sky600} />,
  },
];

const LAYERS = ['All Layers', 'Satellite', 'Topography', 'NDVI Heatmap', 'Rover Trajectories'];

export default function LocationScreen() {
  const [layer, setLayer] = useState(0);
  const isDesktop = useIsDesktop();
  const { location, trail, telemetry, battery, status, isDemo, currentBlock } = useRealtime();

  const boundary = useCommand(addFieldBoundary);
  const waypoint = useCommand(deployWaypointMission);

  const kpis = KPIS.map((k) => {
    if (k.label === 'RTK LOCK & PRECISION' && location) {
      return { ...k, value: `${location.satellites} Satellites`, sub: `GNSS Fix • Alt ${location.altitude.toFixed(1)}m MSL` };
    }
    if (k.label === 'ACTIVE ROVERS ON MAP' && status) {
      const online = status.state !== 'offline' && status.state !== 'fault';
      return { ...k, value: online ? '1 Unit ONLINE' : '0 Units ONLINE', sub: 'Rover Alpha-01' };
    }
    return k;
  });

  return (
    <View className="flex-1 bg-surface">
      <Header title="Location" />
      <Page>
        <Row className="gap-2 flex-wrap">
          <Badge label="GEOSPATIAL TELEMETRY" className="bg-brand-50" textClassName="text-brand-700" />
          <Badge label="LIVE RTK-GNSS" className="bg-blue-100" textClassName="text-blue-600" dotClassName="bg-blue-500" />
        </Row>
        <Text className="text-[22px] font-extrabold text-slate-900 mt-3">
          Location & Field Geospatial Intelligence
        </Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          Real-time GPS parcel geofencing, multi-rover fleet positioning, RTK-guided waypoint navigation, and
          micro-climate field topography.
        </Text>

        <Row className="mt-3.5 gap-2.5 lg:max-w-[560px]">
          <PillButton
            label={boundary.pending ? 'Requesting…' : 'Add Field Boundary'}
            className={`flex-1 bg-brand-600 ${boundary.pending ? 'opacity-60' : ''}`}
            textClassName="text-white"
            onPress={() => boundary.run()}
          />
          <PillButton
            label={waypoint.pending ? 'Deploying…' : 'Deploy Waypoint Mission'}
            className={`flex-1 border-[1.5px] border-brand-700 ${waypoint.pending ? 'opacity-60' : ''}`}
            textClassName="text-brand-700"
            onPress={() =>
              waypoint.run(
                location
                  ? { waypoints: [[location.latitude, location.longitude]] }
                  : undefined,
              )
            }
          />
        </Row>
        <ActionFeedback result={boundary.result ?? waypoint.result} />

        {/* KPIs */}
        <CardRail className="mt-4">
          {kpis.map((k) => (
            <Card key={k.label} className="w-[200px] lg:w-auto lg:flex-1 lg:min-w-[190px]">
              <IconBox className={k.iconBg} size={36}>{k.icon}</IconBox>
              <Text className="text-[10px] font-extrabold text-slate-400 mt-2.5 tracking-wide">{k.label}</Text>
              <Text className="text-[17px] font-extrabold text-slate-900 mt-0.5">{k.value}</Text>
              <Text className="text-[10px] text-slate-400 mt-1">{k.sub}</Text>
            </Card>
          ))}
        </CardRail>

        {/* Digital twin map */}
        <Card className="mt-4">
          <SectionTitle>INTERACTIVE PARCEL DIGITAL TWIN & LIVE FLEET GPS</SectionTitle>
          <Text className="text-[10px] text-slate-500 mt-1">
            Real-time centimeter-grade RTK positioning & autonomous waypoint tracks
          </Text>

          <FilterTabs tabs={LAYERS} active={layer} onSelect={setLayer} />

          <View className="mt-3">
            <LiveMap location={location} trail={trail} height={isDesktop ? 380 : 260} />
            <View className="absolute top-2.5 left-2.5 bg-sidebar/90 rounded-md px-2 py-1" pointerEvents="none">
              <Text className="text-[9px] font-extrabold text-white">
                {location ? (isDemo ? 'LIVE GPS • DEMO DATA' : 'LIVE GPS TELEMETRY') : 'WAITING FOR GPS…'}
              </Text>
            </View>
          </View>
          <Text className="text-xs font-extrabold text-slate-800 mt-2.5">
            {currentBlock ? `${currentBlock.name} — ${currentBlock.plant}` : 'Outside mapped blocks'}
          </Text>
          <Text className="text-[10px] text-slate-500 mt-0.5">
            {location
              ? `Lat: ${location.latitude.toFixed(5)}° ${location.latitude >= 0 ? 'N' : 'S'} • Lon: ${location.longitude.toFixed(5)}° ${location.longitude >= 0 ? 'E' : 'W'} • Elevation: ${location.altitude.toFixed(1)}m MSL • ${location.satellites} satellites`
              : 'No GPS fix yet — waiting for location data'}
          </Text>
          <Row className="mt-2">
            <Badge
              label={
                telemetry?.rowsDone != null && telemetry?.rowsTotal != null
                  ? `Mission Leg ${telemetry.rowsDone}/${telemetry.rowsTotal}`
                  : 'Mission Leg 14/18'
              }
              className="bg-brand-50"
              textClassName="text-brand-700"
            />
            <Text className="text-[10px] font-bold text-slate-500 ml-2">
              {telemetry?.routeProgress != null ? `${telemetry.routeProgress}% Row Path Completed` : '78% Row Path Completed'}
            </Text>
          </Row>
        </Card>

        {/* Active rover card */}
        <Card className="mt-4">
          <Row className="justify-between">
            <Row>
              <Image source={require('../../assets/images/rover-alpha.jpg')} className="w-10 h-10 rounded-xl bg-slate-100" />
              <View className="ml-2.5">
                <Text className="text-[13px] font-extrabold text-slate-900">Rover Alpha-01</Text>
                <Text className="text-[10px] font-bold text-brand-700">{status?.mode ?? 'Autonomous Weeding'}</Text>
              </View>
            </Row>
            <Badge label="ONLINE" className="bg-brand-50" textClassName="text-brand-700" dotClassName="bg-brand-500" />
          </Row>
          <View className="mt-3 gap-2.5">
            <Row className="justify-between">
              <Text className="text-xs font-semibold text-slate-500">Ground Speed & Heading</Text>
              <Text className="text-xs font-extrabold text-slate-900">
                {telemetry ? `${telemetry.speed.toFixed(1)} m/s | ${String(telemetry.heading).padStart(3, '0')}°` : '— m/s | —°'}
              </Text>
            </Row>
            <Row className="justify-between">
              <Text className="text-xs font-semibold text-slate-500">Power Remaining</Text>
              <Text className="text-xs font-extrabold text-brand-700">{battery ? `${battery.level}%` : '—'}</Text>
            </Row>
            <Row className="justify-between">
              <Text className="text-xs font-semibold text-slate-500">Next Pivot Waypoint</Text>
              <Text className="text-xs font-extrabold text-slate-900">#15-A (ETA 2m 40s)</Text>
            </Row>
          </View>
        </Card>

        {/* Block map builder: mark blocks and assign the plant grown in each */}
        <BlockMapBuilder height={isDesktop ? 380 : 280} />

        {/* RTK status strip */}
        <View className="mt-4 bg-sidebar rounded-2xl p-4">
          <Row className="justify-between">
            <Row>
              <Feather name="wifi" size={16} color={colors.emerald400} />
              <Text className="text-xs font-extrabold text-white ml-2">RTK-FIX 38ms</Text>
            </Row>
            <Text className="text-[11px] font-bold text-brand-300">Accuracy: ±1.2cm</Text>
          </Row>
        </View>
      </Page>
    </View>
  );
}
