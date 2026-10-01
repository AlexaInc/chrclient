import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, Page, Row, SectionTitle, Badge } from '../components/ui';
import { useRealtime } from '../realtime/RealtimeContext';
import { drive, emergencyStop, saveFieldMap, setManualTeleop } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import { FieldMapMessage } from '../types/map';

const plants = ['tomato', 'potato', 'chilli', 'apple', 'blueberry', 'cauliflower', 'lemon', 'tea'];

export default function MappingScreen() {
  const { fieldMap, location, robotOnline } = useRealtime();
  const save = useCommand(saveFieldMap);
  const [active, setActive] = useState(false);
  const [map, setMap] = useState<FieldMapMessage>({ name: 'Field A', boundary: [], blocks: [] });
  const [blockPoints, setBlockPoints] = useState<[number, number][]>([]);
  const [blockName, setBlockName] = useState('');
  const [plant, setPlant] = useState('tomato');

  useEffect(() => { if (fieldMap) setMap(JSON.parse(JSON.stringify(fieldMap))); }, [fieldMap]);
  const point = (): [number, number] | null => location ? [location.latitude, location.longitude] : null;
  const requireFix = () => { const p = point(); if (!p) Alert.alert('GPS fix required', 'Wait for a valid live GPS location.'); return p; };
  const markBase = () => { const p = requireFix(); if (p) setMap((m) => ({ ...m, base: { latitude: p[0], longitude: p[1], name: 'Robot Base' } })); };
  const addBoundary = () => { const p = requireFix(); if (p) setMap((m) => ({ ...m, boundary: [...m.boundary, p] })); };
  const addBlockPoint = () => { const p = requireFix(); if (p) setBlockPoints((x) => [...x, p]); };
  const finishBlock = () => {
    if (blockPoints.length < 3 || !blockName.trim()) return;
    setMap((m) => ({ ...m, blocks: [...m.blocks, { id: `block-${Date.now()}`, name: blockName.trim(), plant, aiModel: plant,
      color: '#22c55e', polygon: blockPoints, rowSpacingM: 1, scanSpacingM: 1 }] }));
    setBlockPoints([]); setBlockName('');
  };
  const begin = async () => { await setManualTeleop(true); setActive(true); };
  const finish = async () => { await emergencyStop(); await save.run(map); setActive(false); };

  const MoveButton = ({ dir, label }: { dir: 'forward'|'backward'|'left'|'right', label: string }) =>
    <TouchableOpacity onPressIn={() => drive(dir)} onPressOut={() => drive('stop')} className="w-20 h-14 bg-slate-800 rounded-xl items-center justify-center"><Text className="text-white text-xs font-extrabold">{label}</Text></TouchableOpacity>;

  return <View className="flex-1 bg-surface"><Header title="GPS Mapping Mode" /><Page>
    <Text className="text-[22px] font-extrabold text-slate-900">Drive & Capture Field Map</Text>
    <Text className="text-xs text-slate-500 mt-1">Manually drive the robot to each real corner and capture its live GPS point. Mark the base separately; autonomous patrols return there after the queued blocks.</Text>
    <Row className="gap-2 mt-3"><Badge label={active ? 'MAPPING ACTIVE' : 'MAPPING STOPPED'} /><Badge label={location ? 'GPS FIX' : 'NO GPS'} /><Badge label={robotOnline ? 'ROBOT ONLINE' : 'OFFLINE'} /></Row>

    <Card className="mt-4"><SectionTitle>MAPPING SESSION</SectionTitle>
      {!active ? <TouchableOpacity onPress={begin} disabled={!robotOnline} className="bg-brand-600 rounded-xl py-3 mt-3"><Text className="text-white text-center text-xs font-extrabold">START MAPPING MODE</Text></TouchableOpacity>
      : <TouchableOpacity onPress={finish} className="bg-brand-600 rounded-xl py-3 mt-3"><Text className="text-white text-center text-xs font-extrabold">FINISH & SAVE MAP</Text></TouchableOpacity>}
      <Text className="text-[10px] text-slate-500 mt-2">Live: {location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'waiting for GPS…'}</Text>
    </Card>

    {active && <Card className="mt-4"><SectionTitle>MANUAL DRIVE</SectionTitle>
      <View className="items-center mt-3"><MoveButton dir="forward" label="FORWARD" /><Row className="gap-3 mt-2"><MoveButton dir="left" label="LEFT" /><TouchableOpacity onPress={() => emergencyStop()} className="w-20 h-14 bg-rose-600 rounded-xl items-center justify-center"><Text className="text-white text-xs font-extrabold">STOP</Text></TouchableOpacity><MoveButton dir="right" label="RIGHT" /></Row><View className="mt-2"><MoveButton dir="backward" label="BACK" /></View></View>
    </Card>}

    <Card className="mt-4"><SectionTitle>BASE POINT</SectionTitle>
      <Text className="text-xs text-slate-500 mt-1">Drive to the parking/charging base and capture this dedicated return point.</Text>
      <TouchableOpacity onPress={markBase} disabled={!active || !location} className="border border-brand-600 rounded-xl py-2.5 mt-3"><Text className="text-brand-700 text-center text-xs font-extrabold"><Feather name="home" /> MARK CURRENT GPS AS BASE</Text></TouchableOpacity>
      {map.base && <Text className="text-[10px] font-bold text-brand-700 mt-2">Base: {map.base.latitude.toFixed(6)}, {map.base.longitude.toFixed(6)}</Text>}
    </Card>

    <Card className="mt-4"><SectionTitle>FIELD OUTER BOUNDARY</SectionTitle>
      <TouchableOpacity onPress={addBoundary} disabled={!active || !location} className="border border-slate-400 rounded-xl py-2.5 mt-3"><Text className="text-slate-700 text-center text-xs font-extrabold">CAPTURE BOUNDARY CORNER ({map.boundary.length})</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => setMap((m) => ({ ...m, boundary: m.boundary.slice(0, -1) }))} className="py-2"><Text className="text-center text-[10px] text-rose-600">Undo last boundary point</Text></TouchableOpacity>
    </Card>

    <Card className="mt-4"><SectionTitle>CAPTURE A CROP BLOCK</SectionTitle>
      <TextInput value={blockName} onChangeText={setBlockName} placeholder="Block name" className="border border-slate-300 rounded-xl p-3 mt-2" />
      <Row className="gap-1.5 mt-2 flex-wrap">{plants.map((x) => <TouchableOpacity key={x} onPress={() => setPlant(x)} className={`px-3 py-1.5 rounded-full border ${plant === x ? 'bg-brand-600 border-brand-600' : 'border-slate-300'}`}><Text className={`text-[10px] font-bold ${plant === x ? 'text-white' : 'text-slate-700'}`}>{x}</Text></TouchableOpacity>)}</Row>
      <TouchableOpacity onPress={addBlockPoint} disabled={!active || !location} className="border border-slate-400 rounded-xl py-2.5 mt-3"><Text className="text-slate-700 text-center text-xs font-extrabold">CAPTURE BLOCK CORNER ({blockPoints.length})</Text></TouchableOpacity>
      <Row className="gap-2 mt-2"><TouchableOpacity onPress={() => setBlockPoints((p) => p.slice(0,-1))} className="flex-1 py-2"><Text className="text-center text-[10px] text-rose-600">Undo</Text></TouchableOpacity><TouchableOpacity onPress={finishBlock} disabled={blockPoints.length < 3 || !blockName.trim()} className="flex-1 bg-brand-600 rounded-xl py-2"><Text className="text-white text-center text-[10px] font-extrabold">SAVE BLOCK</Text></TouchableOpacity></Row>
      <Text className="text-[10px] text-slate-500 mt-2">Saved blocks: {map.blocks.map((b) => b.name).join(' → ') || 'none'}</Text>
    </Card>
  </Page></View>;
}
