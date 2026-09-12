import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, ProgressBar, Page, CardRail } from '../components/ui';
import { colors } from '../theme';

const STATUS = [
  {
    label: 'FLEET OS FIRMWARE',
    value: 'v4.8.2-AgOS',
    note: 'All 3 Units Up to Date',
    iconBg: 'bg-brand-100',
    icon: <Feather name="cpu" size={18} color={colors.emerald600} />,
  },
  {
    label: 'RTK BASE STATION',
    value: 'Alpha-Base 01',
    note: 'Quad-Band GNSS ±1.2cm',
    iconBg: 'bg-blue-100',
    icon: <Feather name="radio" size={18} color={colors.blue600} />,
  },
  {
    label: 'EDGE AI INFERENCE',
    value: '18.4 ms',
    note: 'YOLOv9 TensorRT • Optimal FPS',
    iconBg: 'bg-purple-100',
    icon: <Feather name="zap" size={18} color={colors.purple600} />,
  },
  {
    label: 'CLOUD SYNC',
    value: '500 ms',
    note: '4G / LoRa Hybrid • Online',
    iconBg: 'bg-sky-100',
    icon: <Feather name="cloud" size={18} color={colors.sky600} />,
  },
  {
    label: 'SAFETY PROTOCOL',
    value: 'ISOBUS Cl. 3',
    note: 'E-Stop Armed • 100% Redundant',
    iconBg: 'bg-rose-100',
    icon: <Feather name="shield" size={18} color={colors.rose600} />,
  },
];

const SECTIONS = ['Autonomous Navigation', 'Vision & Edge AI', 'RTK Base & Geofencing', 'API Keys & Hooks', 'Audit Trail'];

export default function SettingsScreen() {
  const [section, setSection] = useState(0);
  const [weatherRTB, setWeatherRTB] = useState(true);
  const [microSpray, setMicroSpray] = useState(true);

  return (
    <View className="flex-1 bg-surface">
      <Header title="Settings" />
      <Page>
        <Text className="text-[22px] font-extrabold text-slate-900">System Configuration</Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          Fleet firmware, autonomy parameters, AI model tuning, and safety protocols.
        </Text>

        {/* Status cards */}
        <CardRail className="mt-4">
          {STATUS.map((s) => (
            <Card key={s.label} className="w-[185px] lg:w-auto lg:flex-1 lg:min-w-[190px]">
              <IconBox className={s.iconBg} size={36}>{s.icon}</IconBox>
              <Text className="text-[10px] font-extrabold text-slate-400 mt-2.5 tracking-wide">{s.label}</Text>
              <Text className="text-base font-extrabold text-slate-900 mt-0.5">{s.value}</Text>
              <Text className="text-[10px] text-slate-400 mt-1">{s.note}</Text>
            </Card>
          ))}
        </CardRail>

        {/* Section tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4" contentContainerStyle={{ gap: 8 }}>
          {SECTIONS.map((s, i) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSection(i)}
              activeOpacity={0.8}
              className={`px-3.5 py-[9px] rounded-lg border ${
                i === section ? 'bg-brand-600 border-brand-600' : 'bg-white border-slate-200'
              }`}
            >
              <Text className={`text-[11px] font-bold ${i === section ? 'text-white' : 'text-slate-600'}`}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Autonomous navigation */}
        <Card className="mt-4">
          <Row className="justify-between">
            <SectionTitle>AUTONOMOUS NAVIGATION & ROVER VELOCITY</SectionTitle>
            <Badge label="LOOP: LOCKED" className="bg-brand-50" textClassName="text-brand-700" dotClassName="bg-brand-500" />
          </Row>
          <Text className="text-[10px] text-slate-500 mt-1">
            Kinematic limits, LiDAR clearance buffers, and geofence breach protocols
          </Text>

          <View className="mt-4">
            <Row className="justify-between">
              <Text className="text-[13px] font-extrabold text-slate-800">Maximum Rover Patrol Velocity</Text>
              <Text className="text-xs font-extrabold text-brand-700">1.4 m/s (5.04 km/h)</Text>
            </Row>
            <Text className="text-[11px] text-slate-500 mt-1 leading-4">
              Limits traverse velocity down crop furrows. Throttled automatically when canopy vegetation index
              exceeds 0.74 NDVI.
            </Text>
            <View className="mt-2.5">
              <ProgressBar value={45} barClassName="bg-brand-500" />
            </View>
            <Row className="justify-between mt-1.5">
              <Text className="text-[10px] font-bold text-slate-400">0.5 m/s</Text>
              <Text className="text-[10px] font-bold text-slate-400">2.5 m/s</Text>
            </Row>
          </View>

          <View className="h-px bg-slate-100 my-4" />

          <Row className="justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[13px] font-extrabold text-slate-800">Obstacle Avoidance Clearance</Text>
              <Text className="text-[11px] text-slate-500 mt-1">LiDAR 3D point-cloud bounding envelope.</Text>
            </View>
            <Badge label="12 cm radial • LiDAR 16-Beam" className="bg-blue-100" textClassName="text-blue-600" />
          </Row>

          <View className="h-px bg-slate-100 my-4" />

          <View>
            <Text className="text-[13px] font-extrabold text-slate-800">Boundary Deceleration Mode</Text>
            <Text className="text-[11px] text-slate-500 mt-1">
              Action triggered upon approaching virtual plot perimeter.
            </Text>
            <View className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 mt-2.5">
              <Text className="text-xs font-bold text-slate-800">Immediate Dynamic Deceleration & Safe Stop</Text>
              <Feather name="chevron-down" size={16} color={colors.slate400} />
            </View>
          </View>

          <View className="h-px bg-slate-100 my-4" />

          <Row className="justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[13px] font-extrabold text-slate-800">Automatic Weather RTB Return Protocol</Text>
              <Text className="text-[11px] text-slate-500 mt-1 leading-4">
                Autonomous recall when wind shear exceeds 25 km/h or rain sensor detects precipitation &gt; 5.0 mm/h.
              </Text>
            </View>
            <Switch
              value={weatherRTB}
              onValueChange={setWeatherRTB}
              trackColor={{ false: colors.slate200, true: colors.emerald500 }}
              thumbColor={colors.white}
            />
          </Row>
        </Card>

        {/* Vision & Edge AI */}
        <Card className="mt-4">
          <Row className="justify-between">
            <SectionTitle>EDGE AI & VISION SENSOR PARAMETERS</SectionTitle>
            <Badge label="JETSON ORIN: 60 FPS" className="bg-purple-100" textClassName="text-purple-700" />
          </Row>
          <Text className="text-[10px] text-slate-500 mt-1">
            Inferencing models, confidence cutoffs, and micro-spray actuation triggers
          </Text>

          <View className="mt-4">
            <Text className="text-[13px] font-extrabold text-slate-800">Active Vision Model Selector</Text>
            <Text className="text-[11px] text-slate-500 mt-1">
              Calibrated for multispectral foliar anomaly detection.
            </Text>
            <View className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 mt-2.5">
              <Text className="text-xs font-bold text-slate-800">YOLOv9-Ag-CropHealth (v2.4.1 Production)</Text>
              <Feather name="chevron-down" size={16} color={colors.slate400} />
            </View>
          </View>

          <View className="h-px bg-slate-100 my-4" />

          <View>
            <Text className="text-[13px] font-extrabold text-slate-800">Sensor Capture Frame Rate</Text>
            <Text className="text-[11px] text-slate-500 mt-1">Balance inference latency vs edge GPU power draw.</Text>
            <View className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 mt-2.5">
              <Text className="text-xs font-bold text-slate-800">30 FPS Balanced (Field recommended)</Text>
              <Feather name="chevron-down" size={16} color={colors.slate400} />
            </View>
          </View>

          <View className="h-px bg-slate-100 my-4" />

          <View>
            <Row className="justify-between">
              <Text className="text-[13px] font-extrabold text-slate-800">
                Pathogen Detection Confidence Threshold
              </Text>
              <Text className="text-xs font-extrabold text-brand-700">85%</Text>
            </Row>
            <Text className="text-[11px] text-slate-500 mt-1 leading-4">
              Detections under this cutoff will be flagged for review rather than triggering automatic spot
              treatment.
            </Text>
            <View className="mt-2.5">
              <ProgressBar value={85} barClassName="bg-purple-500" />
            </View>
            <Row className="justify-between mt-1.5">
              <Text className="text-[10px] font-bold text-slate-400">50%</Text>
              <Text className="text-[10px] font-bold text-slate-400">99%</Text>
            </Row>
          </View>

          <View className="h-px bg-slate-100 my-4" />

          <Row className="justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[13px] font-extrabold text-slate-800">
                Auto-Dispatch Biocontrol Micro-Spray Actuator
              </Text>
              <Text className="text-[11px] text-slate-500 mt-1">
                Automatic targeted treatment on confirmed detections.
              </Text>
            </View>
            <Switch
              value={microSpray}
              onValueChange={setMicroSpray}
              trackColor={{ false: colors.slate200, true: colors.emerald500 }}
              thumbColor={colors.white}
            />
          </Row>
        </Card>

        {/* Save */}
        <TouchableOpacity
          activeOpacity={0.85}
          className="flex-row items-center justify-center bg-brand-600 rounded-xl py-3.5 mt-5"
        >
          <MaterialCommunityIcons name="content-save-check-outline" size={18} color={colors.white} />
          <Text className="text-[13px] font-extrabold text-white ml-2">
            Apply & Sync Configuration to Fleet
          </Text>
        </TouchableOpacity>
      </Page>
    </View>
  );
}
