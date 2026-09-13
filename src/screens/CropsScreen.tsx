import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, PillButton, ProgressBar, Page, CardRail } from '../components/ui';
import { colors } from '../theme';
import { exportReport, registerCropBatch, selectCropSource } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import FilterTabs from '../components/FilterTabs';

const KPIS = [
  {
    label: 'ACTIVE VARIETIES',
    value: '5 Cultivars',
    sub: 'Roma, Butterhead, Bell, Albion, Bush',
    note: 'Capacity: 92% • 14 Parcels',
    iconBg: 'bg-brand-100',
    icon: <MaterialCommunityIcons name="sprout-outline" size={20} color={colors.emerald600} />,
  },
  {
    label: 'AVG. CANOPY (NDVI)',
    value: '89.4%',
    sub: '+3.2% Cycle Benchmark',
    note: 'Optimal Band',
    iconBg: 'bg-brand-100',
    icon: <MaterialCommunityIcons name="leaf" size={20} color={colors.emerald600} />,
  },
  {
    label: 'SUBSTRATE MOISTURE',
    value: '64.5%',
    sub: 'Target: 60 - 70%',
    note: 'In Window',
    iconBg: 'bg-blue-100',
    icon: <MaterialCommunityIcons name="water-percent" size={22} color={colors.blue600} />,
  },
  {
    label: 'PEST / PATHOGENS',
    value: '0 Anomaly',
    sub: '100% Cleared by LiDAR',
    note: 'AI Scan Rate: Continuous',
    iconBg: 'bg-purple-100',
    icon: <MaterialCommunityIcons name="bug-outline" size={20} color={colors.purple600} />,
  },
  {
    label: 'HARVEST READINESS',
    value: '1,420 kg',
    sub: 'Batch Alpha next in 36h',
    note: 'Automated Harvester: Staged',
    iconBg: 'bg-orange-100',
    icon: <MaterialCommunityIcons name="basket-outline" size={20} color={colors.orange600} />,
  },
];

const CROPS = ['Vine Tomatoes (Block A2)', 'Hydroponic Romaine', 'Bell Peppers', 'Sweet Strawberries'];

const SENSORS = [
  { label: 'CANOPY VIGOR', value: 'NDVI 0.91 (Excellent)', icon: 'leaf' as const, color: colors.emerald600, bg: 'bg-brand-100' },
  { label: 'CANOPY TEMP', value: '23.4°C • RH 62%', icon: 'thermometer' as const, color: colors.orange600, bg: 'bg-orange-100' },
  { label: 'DRIP RATE', value: '120 ml/h Flow', icon: 'water-outline' as const, color: colors.blue600, bg: 'bg-blue-100' },
  { label: 'COLORIMETER INDEX', value: 'Est. Ripeness 88%', icon: 'palette-outline' as const, color: colors.purple600, bg: 'bg-purple-100' },
];

const STAGES = ['Germination', 'Vegetative', 'Flowering', 'Fruit Dev.', 'Harvest'];

const VITALS = [
  { label: 'Substrate EC', value: '2.1 mS/cm', note: '✓ Stable Osmosis' },
  { label: 'Root Zone pH', value: '6.2 pH', note: 'Ideal for Solanaceae' },
  { label: 'Solar PAR Radiation', value: '840 µmol', note: 'Peak Photosynthesis' },
  { label: 'CO₂ Enrichment', value: '920 ppm', note: 'Greenhouse Optimal' },
];

export default function CropsScreen() {
  const [activeCrop, setActiveCrop] = useState(0);

  const exportCsv = useCommand(exportReport);
  const register = useCommand(registerCropBatch);
  const selectSource = useCommand(selectCropSource);

  const onSelectCrop = (i: number) => {
    setActiveCrop(i); // optimistic UI
    selectSource.run(CROPS[i]); // tell the rover which sensor source to stream
  };

  return (
    <View className="flex-1 bg-surface">
      <Header title="Crops" />
      <Page>
        <Row className="gap-2 flex-wrap">
          <Badge label="FIELD AGRICULTURE" className="bg-brand-50" textClassName="text-brand-700" />
          <Badge label="LIVE TELEMETRY" className="bg-blue-100" textClassName="text-blue-600" dotClassName="bg-blue-500" />
        </Row>
        <Text className="text-[22px] font-extrabold text-slate-900 mt-3">Crop Inventory & Health Intelligence</Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          Real-time vegetative vigor index, soil moisture dynamics, and cultivar yield forecasts.
        </Text>

        <Row className="mt-3.5 gap-2.5 lg:max-w-[560px]">
          <PillButton
            label={exportCsv.pending ? 'Exporting…' : 'Export Report (CSV)'}
            className={`flex-1 border-[1.5px] border-brand-700 ${exportCsv.pending ? 'opacity-60' : ''}`}
            textClassName="text-brand-700"
            onPress={() => exportCsv.run({ kind: 'crops_csv', format: 'csv' })}
          />
          <PillButton
            label={register.pending ? 'Registering…' : '+ Register Crop Batch'}
            className={`flex-1 bg-brand-600 ${register.pending ? 'opacity-60' : ''}`}
            textClassName="text-white"
            onPress={() =>
              register.run({
                crop: CROPS[activeCrop],
                plantedAt: new Date().toISOString().slice(0, 10),
              })
            }
          />
        </Row>
        <ActionFeedback result={exportCsv.result ?? register.result ?? selectSource.result} />

        {/* KPI cards */}
        <CardRail className="mt-4">
          {KPIS.map((k) => (
            <Card key={k.label} className="w-[190px] lg:w-auto lg:flex-1 lg:min-w-[190px]">
              <IconBox className={k.iconBg} size={36}>{k.icon}</IconBox>
              <Text className="text-[10px] font-extrabold text-slate-400 mt-2.5 tracking-wide">{k.label}</Text>
              <Text className="text-lg font-extrabold text-slate-900 mt-0.5">{k.value}</Text>
              <Text className="text-[11px] font-bold text-brand-700 mt-1">{k.sub}</Text>
              <Text className="text-[10px] text-slate-400 mt-0.5">{k.note}</Text>
            </Card>
          ))}
        </CardRail>

        {/* Sensor hub */}
        <Card className="mt-4">
          <SectionTitle>SENSOR ARRAY HUB</SectionTitle>
          <FilterTabs tabs={CROPS} active={activeCrop} onSelect={onSelectCrop} className="mt-3" />

          <Image
            source={require('../../assets/images/greenhouse.jpg')}
            className="w-full h-[190px] lg:h-[320px] rounded-xl mt-3.5"
            resizeMode="cover"
          />
          <Row className="justify-between mt-2.5">
            <Badge
              label="SPECTRAL OPTIC ACTIVE"
              className="bg-brand-50"
              textClassName="text-brand-700"
              dotClassName="bg-brand-500"
            />
            <Text className="text-[10px] font-extrabold text-slate-400">PARCEL ID: GH-A2-VINE</Text>
          </Row>

          <View className="flex-row flex-wrap gap-2.5 mt-3.5">
            {SENSORS.map((s) => (
              <View key={s.label} className="w-[47.5%] lg:w-[23%] grow bg-slate-50 rounded-xl border border-slate-100 p-3">
                <IconBox className={s.bg} size={32}>
                  <MaterialCommunityIcons name={s.icon} size={17} color={s.color} />
                </IconBox>
                <Text className="text-[9px] font-extrabold text-slate-400 mt-2 tracking-wide">{s.label}</Text>
                <Text className="text-xs font-extrabold text-slate-800 mt-0.5">{s.value}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Growth stage */}
        <Card className="mt-4">
          <SectionTitle>PHENOLOGICAL GROWTH STAGE</SectionTitle>
          <Row className="justify-between mt-3">
            <Text className="text-xs font-bold text-slate-600">76% Total Cycle Progress</Text>
            <Text className="text-xs font-extrabold text-brand-700">Fruit Dev.</Text>
          </Row>
          <View className="mt-2.5">
            <ProgressBar value={76} barClassName="bg-brand-500" />
          </View>
          <Row className="justify-between mt-2">
            {STAGES.map((s, i) => (
              <Text
                key={s}
                className={`text-[9px] font-bold ${i <= 3 ? 'text-brand-700' : 'text-slate-400'}`}
              >
                {s}
              </Text>
            ))}
          </Row>
        </Card>

        {/* Vitals */}
        <View className="flex-row flex-wrap gap-3 mt-4">
          {VITALS.map((v) => (
            <Card key={v.label} className="w-[47.5%] lg:w-[23%] grow">
              <Text className="text-[10px] font-extrabold text-slate-400">{v.label}</Text>
              <Text className="text-lg font-extrabold text-slate-900 mt-1">{v.value}</Text>
              <Text className="text-[10px] font-bold text-brand-600 mt-1">{v.note}</Text>
            </Card>
          ))}
        </View>
      </Page>
    </View>
  );
}
