import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, Page, CardRail, Grid, GridItem, useIsDesktop } from '../components/ui';
import { Sparkline, LineChart, AutoWidth } from '../components/charts';
import { colors } from '../theme';

const STATS = [
  {
    label: 'Crop Health',
    value: '87%',
    status: 'Good',
    statusClass: 'text-brand-600',
    iconBg: 'bg-brand-100',
    icon: <MaterialCommunityIcons name="leaf" size={20} color={colors.emerald600} />,
    spark: [30, 45, 60, 80, 55],
    sparkColor: colors.green500,
  },
  {
    label: 'Soil Moisture',
    value: '62%',
    status: 'Moderate',
    statusClass: 'text-blue-600',
    iconBg: 'bg-blue-100',
    icon: <MaterialCommunityIcons name="water-outline" size={20} color={colors.blue600} />,
    spark: [20, 45, 75, 25],
    sparkColor: colors.blue500,
  },
  {
    label: 'Temperature',
    value: '28°C',
    status: 'Normal',
    statusClass: 'text-brand-600',
    iconBg: 'bg-orange-100',
    icon: <MaterialCommunityIcons name="thermometer" size={20} color={colors.orange600} />,
    spark: [40, 55, 35, 55],
    sparkColor: colors.green500,
  },
  {
    label: 'Pest Alerts',
    value: '2',
    status: 'Low Risk',
    statusClass: 'text-brand-600',
    iconBg: 'bg-purple-100',
    icon: <MaterialCommunityIcons name="bug-outline" size={20} color={colors.purple600} />,
    spark: [35, 30, 65, 40],
    sparkColor: colors.purple500,
  },
  {
    label: 'Location',
    value: 'Field A',
    status: 'Active',
    statusClass: 'text-brand-600',
    iconBg: 'bg-brand-100',
    icon: <Feather name="map-pin" size={18} color={colors.emerald600} />,
    spark: [25, 35, 70, 35],
    sparkColor: colors.green500,
  },
];

const ACTIVITY = [
  {
    title: 'Crop scan completed',
    sub: 'Tomato Field - Block A',
    time: '10:30 AM',
    iconBg: 'bg-brand-100',
    icon: <MaterialCommunityIcons name="leaf" size={16} color={colors.emerald600} />,
  },
  {
    title: 'Irrigation recommended',
    sub: 'Soil moisture is low in Block B',
    time: '09:15 AM',
    iconBg: 'bg-blue-100',
    icon: <MaterialCommunityIcons name="water-outline" size={16} color={colors.blue600} />,
  },
  {
    title: 'Pest detected',
    sub: 'Aphids detected in Block C',
    time: 'Yesterday',
    iconBg: 'bg-amber-100',
    icon: <Feather name="alert-triangle" size={15} color={colors.amber600} />,
  },
];

const SUMMARY = [
  { label: 'Fields Monitored', value: '3', iconBg: 'bg-brand-100', icon: <Feather name="grid" size={16} color={colors.emerald600} /> },
  { label: 'Crops Growing', value: '5', iconBg: 'bg-brand-100', icon: <MaterialCommunityIcons name="sprout" size={16} color={colors.emerald600} /> },
  { label: 'Robots Active', value: '1 / 1', iconBg: 'bg-slate-100', icon: <MaterialCommunityIcons name="robot-outline" size={16} color={colors.slate700} /> },
  { label: 'Data Accuracy', value: '98%', iconBg: 'bg-brand-100', icon: <Feather name="check-circle" size={15} color={colors.emerald600} /> },
  { label: 'Last Sync', value: '10:35 AM', iconBg: 'bg-sky-100', icon: <Feather name="refresh-cw" size={15} color={colors.sky600} /> },
];

export default function DashboardScreen() {
  const isDesktop = useIsDesktop();

  return (
    <View className="flex-1 bg-surface">
      <Header />
      <Page>
        {/* Welcome + date: side by side on desktop */}
        <View className={isDesktop ? 'flex-row items-center justify-between' : ''}>
          <View>
            <Text className="text-2xl font-extrabold text-slate-900">Welcome back! 👋</Text>
            <Text className="text-[13px] font-bold text-brand-700 mt-1">AI Smart Crop Monitoring System</Text>
          </View>
          <Row className={`self-start bg-white border border-slate-200 rounded-lg px-3 py-1.5 ${isDesktop ? '' : 'mt-2'}`}>
            <Text className="text-xs text-slate-400">Date: </Text>
            <Feather name="calendar" size={13} color={colors.emerald600} />
            <Text className="text-xs font-extrabold text-slate-700 ml-1.5">18 May 2026</Text>
          </Row>
        </View>

        {/* KPI cards: rail on mobile, 5-across grid on desktop */}
        <CardRail className="mt-4">
          {STATS.map((s) => (
            <Card key={s.label} className="w-[175px] lg:w-auto lg:flex-1 lg:min-w-[180px]">
              <Row>
                <IconBox className={s.iconBg}>{s.icon}</IconBox>
                <View className="ml-3 flex-1">
                  <Text className="text-[11px] font-bold text-slate-500">{s.label}</Text>
                  <Text className="text-xl font-extrabold text-slate-900 mt-0.5">{s.value}</Text>
                  <Text className={`text-[11px] font-semibold mt-0.5 ${s.statusClass}`}>{s.status}</Text>
                </View>
              </Row>
              <View className="mt-3 items-center">
                <Sparkline points={s.spark} color={s.sparkColor} />
              </View>
            </Card>
          ))}
        </CardRail>

        {/* Middle row: Robot Status / Current Location / Pest Alerts — 3 columns on desktop */}
        <Grid className="mt-4">
          <GridItem span={5} cols={12}>
            <Card className="flex-1">
              <Row className="justify-between">
                <SectionTitle>ROBOT STATUS</SectionTitle>
                <Badge label="ONLINE" className="bg-brand-50" textClassName="text-brand-700" dotClassName="bg-brand-500" />
              </Row>
              <Image
                source={require('../../assets/images/rover.jpg')}
                className="w-full h-[170px] rounded-xl mt-3"
                resizeMode="cover"
              />
              <Row className="justify-between mt-3">
                <View>
                  <Text className="text-[10px] font-extrabold text-slate-400">BATTERY</Text>
                  <Row className="mt-1">
                    <MaterialCommunityIcons name="battery-80" size={18} color={colors.emerald500} />
                    <Text className="text-xs font-extrabold text-slate-800"> 82%</Text>
                  </Row>
                </View>
                <View>
                  <Text className="text-[10px] font-extrabold text-slate-400">LOCATION</Text>
                  <Row className="mt-1">
                    <Text className="text-xs font-extrabold text-slate-800">Field A </Text>
                    <Feather name="map-pin" size={13} color={colors.blue600} />
                  </Row>
                </View>
                <View>
                  <Text className="text-[10px] font-extrabold text-slate-400">STATUS</Text>
                  <Text className="text-xs font-extrabold text-brand-600 mt-1">Patrolling</Text>
                </View>
              </Row>
            </Card>
          </GridItem>

          <GridItem span={4} cols={12}>
            <Card className="flex-1">
              <SectionTitle>CURRENT LOCATION</SectionTitle>
              <Image
                source={require('../../assets/images/field-map.jpg')}
                className="w-full h-[180px] rounded-lg mt-3 border border-slate-200"
                resizeMode="cover"
              />
              <Row className="mt-2.5">
                <Text className="text-xs font-extrabold text-slate-800">Field A</Text>
                <Text className="text-slate-400 mx-2">•</Text>
                <Text className="text-xs font-extrabold text-slate-700">Block 2</Text>
              </Row>
            </Card>
          </GridItem>

          <GridItem span={3} cols={12}>
            <Card className="flex-1">
              <SectionTitle className="text-purple-900">PEST ALERTS</SectionTitle>
              <Row className="mt-4 justify-center gap-4">
                <IconBox className="bg-purple-50" size={56}>
                  <MaterialCommunityIcons name="bug-outline" size={30} color={colors.purple700} />
                </IconBox>
                <View>
                  <Text className="text-3xl font-extrabold text-slate-900">2</Text>
                  <Text className="text-[11px] font-bold text-slate-500">Low Risk</Text>
                </View>
              </Row>
              <TouchableOpacity
                activeOpacity={0.8}
                className="flex-row items-center justify-center border-[1.5px] border-purple-600 rounded-lg py-2.5 mt-4"
              >
                <Text className="text-xs font-extrabold text-purple-700">View Alerts</Text>
                <Feather name="arrow-right" size={15} color={colors.purple700} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </Card>
          </GridItem>
        </Grid>

        {/* Lower row: Analytics chart + Recent Activity — 2 columns on desktop */}
        <Grid className="mt-4">
          <GridItem span={7} cols={12}>
            <Card className="flex-1">
              <Row className="justify-between">
                <SectionTitle>CROP HEALTH ANALYTICS</SectionTitle>
                <Row className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5">
                  <Text className="text-[11px] font-extrabold text-slate-700">Last 7 Days</Text>
                  <Feather name="chevron-down" size={13} color={colors.slate400} style={{ marginLeft: 4 }} />
                </Row>
              </Row>
              <Row className="mt-3 gap-5">
                <Row>
                  <View className="w-2.5 h-2.5 rounded-full bg-brand-500 mr-1.5" />
                  <Text className="text-[11px] font-bold text-slate-600">Crop Health (%)</Text>
                </Row>
                <Row>
                  <View className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5" />
                  <Text className="text-[11px] font-bold text-slate-600">Soil Moisture (%)</Text>
                </Row>
              </Row>
              <View className="mt-2">
                <AutoWidth minHeight={210}>
                  {(w) => (
                    <LineChart
                      width={w}
                      height={210}
                      series={[
                        { points: [70, 74, 70, 73, 71, 70, 78], color: colors.green500 },
                        { points: [43, 49, 42, 41, 39, 48, 45], color: colors.blue500 },
                      ]}
                      xLabels={['12', '13', '14', '15', '16', '17', '18 May']}
                    />
                  )}
                </AutoWidth>
              </View>
            </Card>
          </GridItem>

          <GridItem span={5} cols={12}>
            <Card className="flex-1">
              <SectionTitle>RECENT ACTIVITY</SectionTitle>
              <View className="mt-2">
                {ACTIVITY.map((a, i) => (
                  <Row key={a.title} className={`py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                    <IconBox className={a.iconBg} size={36}>{a.icon}</IconBox>
                    <View className="flex-1 ml-3">
                      <Text className="text-xs font-extrabold text-slate-800">{a.title}</Text>
                      <Text className="text-[11px] text-slate-500 mt-0.5">{a.sub}</Text>
                    </View>
                    <Text className="text-[11px] font-bold text-slate-400">{a.time}</Text>
                  </Row>
                ))}
              </View>
              <TouchableOpacity activeOpacity={0.7} className="flex-row self-end items-center mt-1">
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
          <Text className="text-[11px] font-semibold text-white">© 2026 AI Crop Robot | All Rights Reserved</Text>
          <Text className="text-[11px] font-semibold text-brand-300">Version 1.0.0</Text>
        </View>
      </Page>
    </View>
  );
}
