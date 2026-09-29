import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import { Badge, Card, Page, Row, SectionTitle } from '../components/ui';
import { useRealtime } from '../realtime/RealtimeContext';
import { useCommand } from '../hooks/useCommand';
import { pumpOn, pumpOff, setPumpAuto, setIrrigationThreshold, irrigateBlock } from '../scripts/Commands';
import ActionFeedback from '../components/ActionFeedback';

export default function IrrigationScreen() {
  const { irrigation, fieldMap, devices } = useRealtime();
  const pump = devices['pump-01'];
  const [threshold, setThreshold] = useState(irrigation?.threshold ?? 35);
  const command = useCommand(pumpOn);
  const off = useCommand(pumpOff);
  const auto = useCommand(setPumpAuto);
  const thresholdCmd = useCommand(setIrrigationThreshold);
  const blockCmd = useCommand(irrigateBlock);
  const result = command.result ?? off.result ?? auto.result ?? thresholdCmd.result ?? blockCmd.result;

  return (
    <View className="flex-1 bg-surface">
      <Header title="Irrigation" />
      <Page>
        <Row className="justify-between">
          <View>
            <Text className="text-[22px] font-extrabold text-slate-900">Water Pump Controller</Text>
            <Text className="text-xs text-slate-500 mt-1">ESP32-C3 pump node and block irrigation</Text>
          </View>
          <Badge label={pump?.online ? 'ONLINE' : 'OFFLINE'} className={pump?.online ? 'bg-brand-50' : 'bg-rose-100'} textClassName={pump?.online ? 'text-brand-700' : 'text-rose-700'} />
        </Row>

        <Card className="mt-4">
          <SectionTitle>LIVE PUMP STATE</SectionTitle>
          <Row className="justify-between mt-3"><Text className="text-slate-600">Pump</Text><Text className="font-extrabold">{irrigation?.pumpOn ? 'ON' : 'OFF'}</Text></Row>
          <Row className="justify-between mt-2"><Text className="text-slate-600">Mode</Text><Text className="font-extrabold">{irrigation?.autoMode ? 'AUTO' : 'MANUAL'}</Text></Row>
          <Row className="justify-between mt-2"><Text className="text-slate-600">Soil moisture</Text><Text className="font-extrabold">{irrigation?.soilMoisture?.toFixed(1) ?? '--'}%</Text></Row>
          <Row className="gap-2 mt-4">
            <TouchableOpacity onPress={() => command.run(60)} className="flex-1 bg-brand-600 rounded-xl py-3"><Text className="text-white text-center font-extrabold">PUMP ON 60s</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => off.run()} className="flex-1 bg-rose-600 rounded-xl py-3"><Text className="text-white text-center font-extrabold">STOP</Text></TouchableOpacity>
          </Row>
          <TouchableOpacity onPress={() => auto.run(!(irrigation?.autoMode ?? false))} className="border border-brand-300 rounded-xl py-3 mt-2">
            <Text className="text-brand-700 text-center font-extrabold">{irrigation?.autoMode ? 'DISABLE AUTO' : 'ENABLE AUTO'}</Text>
          </TouchableOpacity>
        </Card>

        <Card className="mt-4">
          <SectionTitle>AUTO MOISTURE THRESHOLD</SectionTitle>
          <Row className="gap-2 mt-3">
            {[25, 35, 45, 55].map((value) => <TouchableOpacity key={value} onPress={() => setThreshold(value)} className={`flex-1 rounded-lg py-2 ${threshold === value ? 'bg-brand-600' : 'bg-slate-100'}`}><Text className={`text-center font-extrabold ${threshold === value ? 'text-white' : 'text-slate-600'}`}>{value}%</Text></TouchableOpacity>)}
          </Row>
          <TouchableOpacity onPress={() => thresholdCmd.run(threshold)} className="bg-brand-600 rounded-xl py-3 mt-3"><Text className="text-white text-center font-extrabold">APPLY THRESHOLD</Text></TouchableOpacity>
        </Card>

        <Card className="mt-4">
          <SectionTitle>IRRIGATE A MAPPED BLOCK</SectionTitle>
          {fieldMap?.blocks.map((block) => (
            <TouchableOpacity key={block.id} onPress={() => blockCmd.run(block.id, 120)} className="border border-slate-200 rounded-xl p-3 mt-2">
              <Row className="justify-between"><Text className="font-extrabold text-slate-800">{block.name}</Text><Text className="text-brand-700 font-bold">{block.plant} • 120s</Text></Row>
            </TouchableOpacity>
          )) ?? <Text className="text-slate-500 mt-2">Create field blocks first.</Text>}
        </Card>
        <ActionFeedback result={result} />
      </Page>
    </View>
  );
}
