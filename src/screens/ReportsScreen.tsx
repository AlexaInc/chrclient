import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, PillButton, Page, CardRail } from '../components/ui';
import KpiRail from '../components/KpiRail';
import { LineChart, AutoWidth } from '../components/charts';
import { colors } from '../theme';
import { scheduleReport } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import FilterTabs from '../components/FilterTabs';

const KPIS = [
  {
    label: 'GENERATED REPORTS',
    value: '48 This Month',
    sub: '+12 vs prior month',
    note: '100% Verified',
    iconBg: 'bg-brand-100',
    icon: <Feather name="file-text" size={18} color={colors.emerald600} />,
  },
  {
    label: 'AUDIT COMPLIANCE',
    value: '99.8% Score',
    sub: 'ISOBUS / GlobalGAP',
    note: 'Tier-1 Certified',
    iconBg: 'bg-blue-100',
    icon: <Feather name="award" size={18} color={colors.blue600} />,
  },
  {
    label: 'CARBON OFFSET AUDIT',
    value: '-34.2 tCO₂e',
    sub: 'Electric Rovers',
    note: 'Zero Chemical Runoff',
    iconBg: 'bg-brand-100',
    icon: <MaterialCommunityIcons name="molecule-co2" size={22} color={colors.emerald600} />,
  },
  {
    label: 'PENDING AUDIT REVIEWS',
    value: '1 Review',
    sub: 'Soil Bio-Nitrogen Dossier',
    note: 'Queued',
    iconBg: 'bg-amber-100',
    icon: <Feather name="clock" size={18} color={colors.amber600} />,
  },
  {
    label: 'EXPORT INTEGRITY',
    value: '100% Valid',
    sub: 'Tamper-Proof Ledger',
    note: 'SHA-256 Signed',
    iconBg: 'bg-purple-100',
    icon: <Feather name="lock" size={18} color={colors.purple600} />,
  },
];

const FILTERS = ['All Reports (48)', 'Agronomy Audits (18)', 'Yield & Harvest (14)', 'Robotic Telemetry (16)'];

const REPORTS = [
  {
    title: 'Q4 Yield & Soil Bio-Health Audit',
    tag: 'ISO 11783 VALIDATED DOSSIER',
    meta: 'Compliance 99.8% (Grade A+) • 3 Rovers + 12 Beds',
    icon: <Feather name="shield" size={18} color={colors.emerald600} />,
    bg: 'bg-brand-100',
  },
  {
    title: 'Weekly NDVI Vegetation Survey',
    tag: 'MULTISPECTRAL EXPORT',
    meta: 'Blocks A–C • 42 pages • PDF/CSV',
    icon: <MaterialCommunityIcons name="leaf" size={18} color={colors.emerald600} />,
    bg: 'bg-brand-100',
  },
  {
    title: 'Rover Fleet Telemetry Digest',
    tag: 'ROBOTIC TELEMETRY',
    meta: '3 Units • 128k data points • Signed',
    icon: <MaterialCommunityIcons name="robot-outline" size={18} color={colors.blue600} />,
    bg: 'bg-blue-100',
  },
  {
    title: 'Harvest Efficiency Certification',
    tag: 'YIELD & HARVEST',
    meta: 'Batch Alpha • 1,420 kg • GlobalGAP',
    icon: <MaterialCommunityIcons name="basket-outline" size={18} color={colors.orange600} />,
    bg: 'bg-orange-100',
  },
];

export default function ReportsScreen() {
  const [filter, setFilter] = useState(0);
  const [showFilters, setShowFilters] = useState(true);

  const schedule = useCommand(scheduleReport);

  return (
    <View className="flex-1 bg-surface">
      <Header title="Reports" />
      <Page>
        <Row className="gap-2 flex-wrap">
          <Badge label="FIELD AGROLOGY & AUDIT" className="bg-brand-50" textClassName="text-brand-700" />
          <Badge label="COMPLIANCE INTELLIGENCE" className="bg-blue-100" textClassName="text-blue-600" />
        </Row>
        <Text className="text-[22px] font-extrabold text-slate-900 mt-3">Agronomy & Telemetry Reports</Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          Automated multi-spectral crop health certifications, carbon offset tracking, harvest yield audits, and
          regulatory export dossiers.
        </Text>

        <Row className="mt-3.5 gap-2.5 lg:max-w-[560px]">
          <PillButton
            label={showFilters ? 'Hide Filters' : 'Filter: Date & Type'}
            className="flex-1 border-[1.5px] border-slate-700"
            textClassName="text-slate-700"
            onPress={() => setShowFilters((v) => !v)}
          />
          <PillButton
            label={schedule.pending ? 'Scheduling…' : '+ Schedule New Report'}
            className={`flex-1 bg-brand-600 ${schedule.pending ? 'opacity-60' : ''}`}
            textClassName="text-white"
            onPress={() => schedule.run({ kind: 'agronomy_report', every: 'weekly', format: 'pdf' })}
          />
        </Row>
        <ActionFeedback result={schedule.result} />

        {/* KPIs */}
        <KpiRail items={KPIS} />

        {/* Featured dossier */}
        <Card className="mt-4">
          <SectionTitle>LIVE DIGITAL TWIN COMPLIANCE DOSSIER: Q4 HARVEST CERTIFICATION</SectionTitle>
          <Text className="text-[10px] text-slate-500 mt-1">
            Automated agronomic multi-spectral telemetry, crop health certifications, and sensor validation
          </Text>
          {showFilters && <FilterTabs tabs={FILTERS} active={filter} onSelect={setFilter} />}
          <View className="mt-3">
            <Image
              source={require('../../assets/images/reports-3d.jpg')}
              className="w-full h-[200px] lg:h-[340px] rounded-xl"
              resizeMode="cover"
            />
            <View className="absolute top-2.5 left-2.5 bg-sidebar/90 rounded-md px-2 py-1">
              <Text className="text-[9px] font-extrabold text-white">ISO 11783 VALIDATED DOSSIER</Text>
            </View>
          </View>
          <Text className="text-[15px] font-extrabold text-slate-900 mt-2.5">
            Q4 Yield & Soil Bio-Health Audit
          </Text>
          <Row className="justify-between mt-2.5">
            <View>
              <Text className="text-[10px] font-bold text-slate-400">Compliance Rating</Text>
              <Text className="text-[13px] font-extrabold text-brand-700 mt-0.5">99.8% (Grade A+)</Text>
            </View>
            <View>
              <Text className="text-[10px] font-bold text-slate-400">Audited Assets</Text>
              <Text className="text-[13px] font-extrabold text-slate-900 mt-0.5">3 Rovers + 12 Beds</Text>
            </View>
          </Row>
          <Badge
            label="Ledger Status: Cryptographically Signed"
            className="bg-brand-50 mt-3"
            textClassName="text-brand-700"
            dotClassName="bg-brand-500"
          />
        </Card>

        {/* Report list */}
        <Card className="mt-4">
          <SectionTitle>RECENT DOSSIERS</SectionTitle>
          <View className="mt-2">
            {REPORTS.map((r, i) => (
              <Row key={r.title} className={`py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                <IconBox className={r.bg} size={38}>{r.icon}</IconBox>
                <View className="flex-1 ml-3">
                  <Text className="text-[10px] font-extrabold text-slate-400">{r.tag}</Text>
                  <Text className="text-xs font-extrabold text-slate-800 mt-0.5">{r.title}</Text>
                  <Text className="text-[10px] text-slate-500 mt-0.5">{r.meta}</Text>
                </View>
                <Feather name="download" size={17} color={colors.emerald600} />
              </Row>
            ))}
          </View>
        </Card>

        {/* Compliance trend */}
        <Card className="mt-4">
          <SectionTitle>REPORT GENERATION & COMPLIANCE SCORE TREND (LAST 30 DAYS)</SectionTitle>
          <Row className="mt-3 gap-4 flex-wrap">
            <Row>
              <View className="w-2.5 h-2.5 rounded-full bg-brand-500 mr-1.5" />
              <Text className="text-[11px] font-bold text-slate-600">Daily Generated Reports</Text>
            </Row>
            <Row>
              <View className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5" />
              <Text className="text-[11px] font-bold text-slate-600">Compliance Index (Avg 99.4%)</Text>
            </Row>
          </Row>
          <View className="mt-3">
            <AutoWidth minHeight={190}>
              {(w) => (
                <LineChart
                  width={w}
                  height={190}
                  series={[
                    { points: [40, 55, 48, 62, 58, 72, 66], color: colors.emerald500 },
                    { points: [96, 98, 97, 99, 98, 99, 99], color: colors.blue500 },
                  ]}
                  yLabels={['100%', '75%', '50%', '25%', '0%']}
                  xLabels={['D1', 'D5', 'D10', 'D15', 'D20', 'D25', 'D30']}
                />
              )}
            </AutoWidth>
          </View>
        </Card>
      </Page>
    </View>
  );
}
