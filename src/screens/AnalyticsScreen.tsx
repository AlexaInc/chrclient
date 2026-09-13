import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, PillButton, Page, CardRail } from '../components/ui';
import KpiRail from '../components/KpiRail';
import { BarChart, LineChart, AutoWidth } from '../components/charts';
import { colors } from '../theme';
import { exportReport, runPredictiveModel } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import FilterTabs from '../components/FilterTabs';

const KPIS = [
  {
    label: 'PROJECTED YIELD',
    value: '184.6 Tons',
    sub: '+12.4% vs bench',
    note: 'On Target',
    iconBg: 'bg-brand-100',
    icon: <Feather name="trending-up" size={18} color={colors.emerald600} />,
  },
  {
    label: 'AVG BRIX INDEX',
    value: '12.8° Brix',
    sub: 'Grade A+ Premium',
    note: 'Sweetness: High',
    iconBg: 'bg-purple-100',
    icon: <MaterialCommunityIcons name="candy-outline" size={20} color={colors.purple600} />,
  },
  {
    label: 'HARVEST READINESS',
    value: '78.2%',
    sub: 'Optimal',
    note: '3 Parcels ready <48h',
    iconBg: 'bg-orange-100',
    icon: <MaterialCommunityIcons name="basket-outline" size={20} color={colors.orange600} />,
  },
  {
    label: 'FRUIT SIZING ACC.',
    value: '99.1%',
    sub: 'LiDAR',
    note: 'YOLOv9 Sizing Model',
    iconBg: 'bg-blue-100',
    icon: <Feather name="target" size={18} color={colors.blue600} />,
  },
  {
    label: 'RESOURCE EFFICIENCY',
    value: '94.8%',
    sub: 'Eco',
    note: '18.2 L/kg H₂O (-22% waste)',
    iconBg: 'bg-brand-100',
    icon: <MaterialCommunityIcons name="water-check-outline" size={20} color={colors.emerald600} />,
  },
];

const CROP_TABS = ['All Crops', 'Vine Tomatoes', 'Hydro Lettuce', 'Bell Peppers'];

export default function AnalyticsScreen() {
  const [tab, setTab] = useState(0);

  const exportCmd = useCommand(exportReport);
  const modelCmd = useCommand(runPredictiveModel);

  return (
    <View className="flex-1 bg-surface">
      <Header title="Analytics" />
      <Page>
        <Row className="gap-2 flex-wrap">
          <Badge label="AGRONOMY DATA PLATFORM" className="bg-brand-50" textClassName="text-brand-700" />
          <Badge label="YIELD FORECASTING" className="bg-purple-100" textClassName="text-purple-700" />
        </Row>
        <Text className="text-[22px] font-extrabold text-slate-900 mt-3">Analytics & Yield Intelligence</Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          Multi-season crop yield modeling, Brix sugar accumulation curves, automated harvest efficiency metrics,
          and microclimate correlation analysis.
        </Text>

        <Row className="mt-3.5 gap-2.5 lg:max-w-[560px]">
          <PillButton
            label={exportCmd.pending ? 'Exporting…' : 'Export Agronomy Report'}
            className={`flex-1 border-[1.5px] border-brand-700 ${exportCmd.pending ? 'opacity-60' : ''}`}
            textClassName="text-brand-700"
            onPress={() => exportCmd.run({ kind: 'agronomy_report', format: 'pdf' })}
          />
          <PillButton
            label={modelCmd.pending ? 'Running model…' : 'Run Predictive Model'}
            className={`flex-1 bg-brand-600 ${modelCmd.pending ? 'opacity-60' : ''}`}
            textClassName="text-white"
            onPress={() => modelCmd.run(CROP_TABS[tab])}
          />
        </Row>
        <ActionFeedback result={exportCmd.result ?? modelCmd.result} />

        {/* KPIs */}
        <KpiRail items={KPIS} />

        {/* Digital twin sim */}
        <Card className="mt-4">
          <SectionTitle>DIGITAL TWIN YIELD SIMULATION & SENSOR OVERLAY</SectionTitle>
          <Text className="text-[10px] text-slate-500 mt-1">
            Photonic sensor mapping, real-time biomass volume indexing, and greenhouse robotics feedback
          </Text>
          <FilterTabs tabs={CROP_TABS} active={tab} onSelect={setTab} />
          <View className="mt-3">
            <Image
              source={require('../../assets/images/analytics-3d.jpg')}
              className="w-full h-[200px] lg:h-[340px] rounded-xl"
              resizeMode="cover"
            />
            <View className="absolute top-2.5 left-2.5 flex-row items-center bg-sidebar/90 rounded-md px-2 py-1 gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              <Text className="text-[9px] font-extrabold text-white">LIVE BIOMETRIC FEED</Text>
            </View>
          </View>
          <Text className="text-[11px] font-bold text-slate-500 mt-2.5">Greenhouse Block A · Smart Pod 04</Text>
          <Row className="justify-between mt-2.5">
            <View>
              <Text className="text-[10px] font-bold text-slate-400">Predicted Yield</Text>
              <Text className="text-sm font-extrabold text-slate-900 mt-0.5">12,100 KG</Text>
            </View>
            <View>
              <Text className="text-[10px] font-bold text-slate-400">YoY Growth</Text>
              <Text className="text-sm font-extrabold text-brand-600 mt-0.5">+78% YoY</Text>
            </View>
            <View>
              <Text className="text-[10px] font-bold text-slate-400">Pick Rate</Text>
              <Text className="text-sm font-extrabold text-slate-900 mt-0.5">142 kg/hr</Text>
            </View>
          </Row>
        </Card>

        {/* Weekly harvest bar chart */}
        <Card className="mt-4">
          <SectionTitle>WEEKLY HARVEST PROJECTION VS ACTUAL (TONS)</SectionTitle>
          <Row className="mt-3 gap-4 flex-wrap">
            <Row>
              <View className="w-2.5 h-2.5 rounded-full bg-brand-500 mr-1.5" />
              <Text className="text-[11px] font-bold text-slate-600">Actual Picked (Tons)</Text>
            </Row>
            <Row>
              <View className="w-2.5 h-2.5 rounded-full bg-slate-300 mr-1.5" />
              <Text className="text-[11px] font-bold text-slate-600">Predictive Baseline</Text>
            </Row>
            <Row>
              <View className="w-2.5 h-2.5 rounded-full bg-purple-500 mr-1.5" />
              <Text className="text-[11px] font-bold text-slate-600">Brix Index (°Bx)</Text>
            </Row>
          </Row>
          <View className="mt-3">
            <AutoWidth minHeight={190}>
              {(w) => (
                <BarChart
                  width={w}
                  height={200}
                  bars={[14, 17, 16, 20, 22, 24, 27]}
                  labels={['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Wk 7']}
                  color={colors.emerald500}
                />
              )}
            </AutoWidth>
          </View>
        </Card>

        {/* Brix curve */}
        <Card className="mt-4">
          <SectionTitle>BRIX SUGAR ACCUMULATION CURVE</SectionTitle>
          <View className="mt-3">
            <AutoWidth minHeight={190}>
              {(w) => (
                <LineChart
                  width={w}
                  height={180}
                  series={[
                    { points: [42, 48, 55, 61, 68, 76, 84], color: colors.purple500 },
                    { points: [38, 44, 50, 57, 64, 70, 78], color: colors.slate300 },
                  ]}
                  yLabels={['16°', '12°', '8°', '4°', '0°']}
                />
              )}
            </AutoWidth>
          </View>
        </Card>
      </Page>
    </View>
  );
}
