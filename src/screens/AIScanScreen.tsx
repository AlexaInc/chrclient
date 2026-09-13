import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, Page, CardRail } from '../components/ui';
import KpiRail from '../components/KpiRail';
import { colors } from '../theme';
import {
  captureRawBurst,
  setCameraChannel,
  setCameraZoom,
  setRecording,
} from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import { CameraChannel, CameraZoom } from '../types/actions';
import FilterTabs from '../components/FilterTabs';

const KPIS = [
  {
    label: 'INFERENCE LATENCY',
    value: '18.4 ms',
    sub: 'YOLOv9 Edge TensorRT',
    note: 'Framerate: 60 FPS Stream',
    iconBg: 'bg-amber-100',
    icon: <Feather name="zap" size={18} color={colors.amber600} />,
  },
  {
    label: 'PATHOGEN STATUS',
    value: '1 Flagged',
    sub: 'Early Blight (Leaf 045)',
    note: 'Priority: Action Req',
    iconBg: 'bg-rose-100',
    icon: <Feather name="alert-octagon" size={18} color={colors.rose600} />,
  },
  {
    label: 'FRUIT CENSUS',
    value: '48 Ripe / 112 Grn',
    sub: '82% Maturity Index',
    note: 'Yield Trend: +14% vs yesterday',
    iconBg: 'bg-brand-100',
    icon: <MaterialCommunityIcons name="fruit-cherries" size={20} color={colors.emerald600} />,
  },
  {
    label: 'NDVI VIGOR',
    value: '0.88 Avg',
    sub: 'Optimal Photosynthesis',
    note: 'Health Bracket: High Vigor (Tier 1)',
    iconBg: 'bg-brand-100',
    icon: <MaterialCommunityIcons name="leaf-circle-outline" size={20} color={colors.emerald600} />,
  },
  {
    label: 'OPTICS CHANNEL',
    value: '4K RGB + NIR',
    sub: 'Dual Stereo Mast Cam',
    note: 'Optics Cleanliness: 99% Pristine',
    iconBg: 'bg-blue-100',
    icon: <Feather name="video" size={18} color={colors.blue600} />,
  },
];

const CHANNELS = ['RGB Color', 'NIR Band', 'NDVI Heatmap', 'Thermal/H₂O'];
const CHANNEL_IDS: CameraChannel[] = ['rgb', 'nir', 'ndvi', 'thermal'];
const ZOOMS = ['1x', '2x', '4x', 'MACRO'];
const ZOOM_IDS: CameraZoom[] = ['1x', '2x', '4x', 'macro'];

const DETECTIONS = [
  {
    tag: 'TOMATO_CLUSTER_A [Ripe: 99.2%]',
    sub: 'Yield Est: 420g • BRIX ~5.4',
    textClass: 'text-brand-600',
    boxClass: 'bg-brand-50 border-brand-600',
  },
  {
    tag: 'ID: LEAF_045 [EARLY BLIGHT 94.1%]',
    sub: 'Stage 1 Fungal Lesion • Micro-Spray Rec.',
    textClass: 'text-rose-600',
    boxClass: 'bg-rose-100 border-rose-600',
  },
];

export default function AIScanScreen() {
  const [channel, setChannel] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [recording, setRecordingState] = useState(false);

  const channelCmd = useCommand(setCameraChannel);
  const zoomCmd = useCommand(setCameraZoom);
  const recordCmd = useCommand(setRecording);
  const burstCmd = useCommand(captureRawBurst);

  const selectChannel = (i: number) => {
    setChannel(i); // optimistic UI
    channelCmd.run(CHANNEL_IDS[i]);
  };
  const selectZoom = (i: number) => {
    setZoom(i);
    zoomCmd.run(ZOOM_IDS[i]);
  };
  const toggleRecording = async () => {
    const next = !recording;
    const res = await recordCmd.run(next);
    if (res.success) setRecordingState(next);
  };

  return (
    <View className="flex-1 bg-surface">
      <Header title="AI Scan" />
      <Page>
        <Text className="text-[22px] font-extrabold text-slate-900">
          Edge AI Inference & Classification Stream
        </Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          Continuous automated object bounding & botanical defect recognition
        </Text>

        {/* KPIs */}
        <KpiRail items={KPIS} />

        {/* Live camera feed */}
        <Card className="mt-4 p-0 overflow-hidden">
          <View className="p-4 pb-3">
            <SectionTitle>FRONT GIMBAL 4K OPTICAL MAST</SectionTitle>
            <Text className="text-[10px] text-slate-500 mt-1">
              Rover Alpha-01 • 3840×2160 @ 60 FPS • Sony Starvis II CMOS
            </Text>
            <FilterTabs
              tabs={CHANNELS}
              active={channel}
              onSelect={selectChannel}
              activeClassName="bg-slate-900 border-slate-900"
            />
          </View>

          <View>
            <Image source={require('../../assets/images/scan-feed.jpg')} className="w-full h-[230px] lg:h-[420px] bg-slate-950" resizeMode="cover" />
            <View className="absolute top-2.5 left-3">
              <Text className="text-[10px] font-extrabold text-green-400">LIVE CAM-A01 [ZONE 03 - PARCEL B]</Text>
              <Text className="text-[9px] font-semibold text-brand-100">
                LAT: 38.4912° N | LON: 122.3129° W | ALT: 48.2m
              </Text>
            </View>
            <View className="absolute top-2.5 right-3 bg-slate-950/70 px-2 py-1 rounded-md">
              <Text className="text-[10px] font-extrabold text-green-400">NDVI 0.91</Text>
            </View>
            <View className="absolute bottom-2.5 left-3 bg-slate-950/70 px-2 py-1 rounded-md">
              <Text className="text-[9px] font-semibold text-brand-100">
                LiDAR DIST: 0.42 m • CANOPY TEMP: 23.8°C
              </Text>
            </View>
            <View className="absolute bottom-3.5 right-3.5 w-2.5 h-2.5 rounded-full bg-rose-500" />
          </View>

          <View className="p-4">
            <Row className="justify-between">
              <Text className="text-[10px] font-extrabold text-slate-500">OPTICAL ZOOM:</Text>
              <Row className="gap-1.5">
                {ZOOMS.map((z, i) => (
                  <TouchableOpacity
                    key={z}
                    onPress={() => selectZoom(i)}
                    activeOpacity={0.8}
                    className={`px-2.5 py-1.5 rounded-md border ${
                      i === zoom ? 'bg-brand-600 border-brand-600' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Text className={`text-[10px] font-extrabold ${i === zoom ? 'text-white' : 'text-slate-600'}`}>
                      {z}
                    </Text>
                  </TouchableOpacity>
                ))}
              </Row>
            </Row>
            <Row className="mt-3 gap-2.5">
              <TouchableOpacity
                onPress={toggleRecording}
                disabled={recordCmd.pending}
                activeOpacity={0.8}
                className={`flex-1 flex-row items-center justify-center rounded-lg py-2.5 gap-2 ${
                  recording ? 'bg-slate-800' : 'bg-rose-600'
                } ${recordCmd.pending ? 'opacity-60' : ''}`}
              >
                <View className={`w-2 h-2 rounded-full ${recording ? 'bg-rose-500' : 'bg-white'}`} />
                <Text className="text-[11px] font-extrabold text-white">
                  {recordCmd.pending ? 'Sending…' : recording ? 'Stop Recording' : 'Record Live Stream'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => burstCmd.run(5)}
                disabled={burstCmd.pending}
                activeOpacity={0.8}
                className={`flex-1 flex-row items-center justify-center bg-slate-100 rounded-lg py-2.5 ${
                  burstCmd.pending ? 'opacity-60' : ''
                }`}
              >
                <Feather name="camera" size={14} color={colors.slate700} />
                <Text className="text-[11px] font-extrabold text-slate-700 ml-1.5">
                  {burstCmd.pending ? 'Capturing…' : 'RAW Burst'}
                </Text>
              </TouchableOpacity>
            </Row>
            <ActionFeedback
              result={recordCmd.result ?? burstCmd.result ?? channelCmd.result ?? zoomCmd.result}
            />
            <Text className="text-[10px] text-slate-400 mt-2.5">
              Spectral Exposure: Auto-Adjusted 1/240s | Edge GPU @ 48% Core Load
            </Text>
          </View>
        </Card>

        {/* Detections */}
        <Card className="mt-4">
          <SectionTitle>DETECTION & CLASSIFICATION STREAM</SectionTitle>
          <View className="mt-2.5 gap-2.5">
            {DETECTIONS.map((d) => (
              <View key={d.tag} className={`rounded-xl border-l-4 p-3 ${d.boxClass}`}>
                <Text className={`text-[11px] font-extrabold ${d.textClass}`}>{d.tag}</Text>
                <Text className="text-[10px] text-slate-600 mt-1">{d.sub}</Text>
              </View>
            ))}
          </View>
          <Row className="mt-3.5 justify-between">
            <Badge label="All (14)" className="bg-brand-600" textClassName="text-white" />
            <Image source={require('../../assets/images/scan-thumb.jpg')} className="w-[72px] h-11 rounded-lg" />
          </Row>
        </Card>
      </Page>
    </View>
  );
}
