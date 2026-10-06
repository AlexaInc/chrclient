import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, Row, Page } from '../components/ui';
import KpiRail from '../components/KpiRail';
import { BarChart, LineChart, AutoWidth, GraphDotsToggle } from '../components/charts';
import { colors } from '../theme';
import FilterTabs from '../components/FilterTabs';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../realtime/RealtimeContext';
import { fetchSensorHistory, fetchIrrigationHistory, SensorHistoryRow, IrrigationHistoryRow } from '../scripts/Api';

const RANGES = ['6h', '24h', '3d', '7d'];
const RANGE_HOURS = [6, 24, 72, 168];

function avg(nums: (number | null)[]): number | null {
  const v = nums.filter((n): n is number => n != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export default function AnalyticsScreen() {
  const [range, setRange] = useState(1);
  const [sensorRows, setSensorRows] = useState<SensorHistoryRow[]>([]);
  const [irrigationRows, setIrrigationRows] = useState<IrrigationHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const { isDemo } = useRealtime();

  useEffect(() => {
    if (isDemo || !token) return;
    setLoading(true);
    Promise.all([
      fetchSensorHistory(token, RANGE_HOURS[range]),
      fetchIrrigationHistory(token, RANGE_HOURS[range]),
    ])
      .then(([s, i]) => {
        setSensorRows(s.readings);
        setIrrigationRows(i.readings);
      })
      .catch((e) => console.warn('[Analytics] history fetch failed:', e?.message ?? e))
      .finally(() => setLoading(false));
  }, [range, isDemo, token]);

  const chronological = useMemo(() => [...sensorRows].reverse(), [sensorRows]);
  const irrigationChrono = useMemo(() => [...irrigationRows].reverse(), [irrigationRows]);

  const avgTemp = avg(sensorRows.map((r) => r.temperature));
  const avgHumidity = avg(sensorRows.map((r) => r.humidity));
  const rainSamples = sensorRows.filter((r) => r.is_raining != null);
  const rainPct = rainSamples.length ? (rainSamples.filter((r) => r.is_raining).length / rainSamples.length) * 100 : null;
  const avgMoisture = avg(irrigationRows.map((r) => r.soil_moisture));

  const KPIS = [
    {
      label: 'AVG TEMPERATURE',
      value: avgTemp != null ? `${avgTemp.toFixed(1)}°C` : '—',
      sub: `${sensorRows.length} readings`,
      note: `Window: ${RANGES[range]}`,
      iconBg: 'bg-orange-100',
      icon: <MaterialCommunityIcons name="thermometer" size={20} color={colors.orange600} />,
    },
    {
      label: 'AVG HUMIDITY',
      value: avgHumidity != null ? `${avgHumidity.toFixed(0)}%` : '—',
      sub: 'From onboard sensor',
      note: `Window: ${RANGES[range]}`,
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      icon: <Feather name="droplet" size={18} color={colors.blue600} />,
    },
    {
      label: 'TIME RAINING',
      value: rainPct != null ? `${rainPct.toFixed(0)}%` : '—',
      sub: 'Raindrop sensor',
      note: `Window: ${RANGES[range]}`,
      iconBg: 'bg-sky-100',
      icon: <MaterialCommunityIcons name="weather-pouring" size={20} color={colors.sky600} />,
    },
    {
      label: 'AVG SOIL MOISTURE',
      value: avgMoisture != null ? `${avgMoisture.toFixed(0)}%` : '—',
      sub: 'From irrigation pump sensor (not the robot)',
      note: `Window: ${RANGES[range]}`,
      iconBg: 'bg-brand-100 dark:bg-brand-900/50',
      icon: <MaterialCommunityIcons name="water-outline" size={20} color={colors.emerald600} />,
    },
  ];

  // Reading distribution per mapped block — how much of the robot's
  // patrol time (by sensor-reading count) was spent in each block.
  const blockCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of sensorRows) {
      const key = r.block_id ?? 'Unmapped';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [sensorRows]);

  return (
    <View className="flex-1 bg-surface dark:bg-slate-950">
      <Header title="Analytics" />
      <Page>
        <Row className="gap-2 flex-wrap">
          <Badge label="SENSOR HISTORY" className="bg-brand-50 dark:bg-brand-900/40" textClassName="text-brand-700 dark:text-brand-300" />
          {isDemo && <Badge label="DEMO DATA" className="bg-amber-100 dark:bg-amber-900/40" textClassName="text-amber-700 dark:text-amber-300" dotClassName="bg-amber-500" />}
        </Row>
        <Text className="text-[22px] font-extrabold text-slate-900 dark:text-slate-100 mt-3">Analytics</Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-[18px]">
          Historical trends from the robot's real sensors (temperature, raindrop) and the irrigation pump's soil
          moisture sensor.
        </Text>

        <View className="mt-3">
          <FilterTabs tabs={RANGES} active={range} onSelect={setRange} />
        </View>

        {isDemo ? (
          <Card className="mt-4">
            <Text className="text-xs text-slate-400 py-8 text-center">Historical analytics require a real server connection — not simulated in demo mode.</Text>
          </Card>
        ) : (
          <>
            <KpiRail items={KPIS} />
            {loading && <Text className="text-xs text-slate-400 mt-2">Loading history…</Text>}

            <Card className="mt-4">
              <Row className="justify-between">
                <SectionTitle>TEMPERATURE & HUMIDITY</SectionTitle>
                <GraphDotsToggle />
              </Row>
              <Row className="mt-3 gap-4 flex-wrap">
                <Row><View className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-1.5" /><Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Temperature (°C)</Text></Row>
                <Row><View className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5" /><Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Humidity (%)</Text></Row>
              </Row>
              <View className="mt-2">
                {chronological.length < 2 ? (
                  <Text className="text-xs text-slate-400 py-8 text-center">Not enough data yet.</Text>
                ) : (
                  <AutoWidth minHeight={200}>
                    {(w) => (
                      <LineChart
                        width={w}
                        height={200}
                        series={[
                          { points: chronological.map((r) => r.temperature ?? 0), color: colors.orange600 },
                          { points: chronological.map((r) => r.humidity ?? 0), color: colors.blue500 },
                        ]}
                        xLabels={[]}
                      />
                    )}
                  </AutoWidth>
                )}
              </View>
            </Card>

            <Card className="mt-4">
              <Row className="justify-between">
                <SectionTitle>SOIL MOISTURE (IRRIGATION PUMP SENSOR)</SectionTitle>
                <GraphDotsToggle />
              </Row>
              <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                This reading comes from the water pump's own soil-moisture sensor — the rover has no such sensor.
              </Text>
              <View className="mt-2">
                {irrigationChrono.length < 2 ? (
                  <Text className="text-xs text-slate-400 py-8 text-center">Not enough data yet.</Text>
                ) : (
                  <AutoWidth minHeight={190}>
                    {(w) => (
                      <LineChart
                        width={w}
                        height={190}
                        series={[{ points: irrigationChrono.map((r) => r.soil_moisture ?? 0), color: colors.emerald500 }]}
                        xLabels={[]}
                      />
                    )}
                  </AutoWidth>
                )}
              </View>
            </Card>

            <Card className="mt-4">
              <SectionTitle>PATROL TIME BY BLOCK (READING COUNT)</SectionTitle>
              <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Number of sensor readings recorded while the robot was in each mapped block — a proxy for time spent per block.
              </Text>
              <View className="mt-3">
                {blockCounts.length === 0 ? (
                  <Text className="text-xs text-slate-400 py-8 text-center">No block-tagged readings yet.</Text>
                ) : (
                  <AutoWidth minHeight={180}>
                    {(w) => (
                      <BarChart
                        width={w}
                        height={180}
                        bars={blockCounts.map(([, c]) => c)}
                        labels={blockCounts.map(([id]) => id)}
                        color={colors.emerald500}
                      />
                    )}
                  </AutoWidth>
                )}
              </View>
            </Card>
          </>
        )}
      </Page>
    </View>
  );
}
