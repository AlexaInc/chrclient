import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card, SectionTitle, Badge, Row } from '../components/ui';
import { colors } from '../theme';
import FieldMap from './FieldMap';
import { FieldBlock, FieldMapMessage } from '../types/map';
import { saveFieldMap } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import { useRealtime } from '../realtime/RealtimeContext';

/* Plant -> AI model registry; the backend switches models by block plant. */
const PLANT_MODELS: { plant: string; model: string; color: string }[] = [
  { plant: 'tomato', model: 'tomato-disease-v1', color: '#22c55e' },
  { plant: 'chili', model: 'chili-disease-v1', color: '#f59e0b' },
  { plant: 'brinjal', model: 'brinjal-disease-v1', color: '#8b5cf6' },
  { plant: 'cabbage', model: 'cabbage-disease-v1', color: '#0ea5e9' },
  { plant: 'bean', model: 'bean-disease-v1', color: '#ef4444' },
];

interface Props {
  height?: number;
}

export default function BlockMapBuilder({ height = 300 }: Props) {
  const { fieldMap, location, trail, currentBlock } = useRealtime();
  const [width, setWidth] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [blockName, setBlockName] = useState('');
  const [plantIdx, setPlantIdx] = useState(0);
  const [selected, setSelected] = useState<FieldBlock | null>(null);
  const [localMap, setLocalMap] = useState<FieldMapMessage | null>(null);
  const save = useCommand(saveFieldMap);

  const map = localMap ?? fieldMap;

  const finishBlock = async () => {
    if (!map || draft.length < 3 || !blockName.trim()) return;
    const p = PLANT_MODELS[plantIdx];
    const block: FieldBlock = {
      id: `block-${Date.now()}`,
      name: blockName.trim(),
      plant: p.plant,
      aiModel: p.model,
      color: p.color,
      polygon: draft,
    };
    const nextMap: FieldMapMessage = { ...map, blocks: [...map.blocks, block] };
    setLocalMap(nextMap);
    setDraft([]);
    setBlockName('');
    setDrawing(false);
    await save.run(nextMap);
  };

  const removeBlock = async (id: string) => {
    if (!map) return;
    const nextMap: FieldMapMessage = { ...map, blocks: map.blocks.filter((b) => b.id !== id) };
    setLocalMap(nextMap);
    setSelected(null);
    await save.run(nextMap);
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  if (!map) {
    return (
      <Card className="mt-4">
        <SectionTitle>FIELD BLOCK MAP</SectionTitle>
        <Text className="text-xs text-slate-500 mt-2">Waiting for field map from server…</Text>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <Row className="justify-between">
        <SectionTitle>FIELD BLOCK MAP — PLANT PER BLOCK</SectionTitle>
        <Badge
          label={drawing ? 'DRAW MODE' : `${map.blocks.length} BLOCKS`}
          className={drawing ? 'bg-amber-100' : 'bg-brand-50'}
          textClassName={drawing ? 'text-amber-700' : 'text-brand-700'}
        />
      </Row>
      <Text className="text-[10px] text-slate-500 mt-1">
        Each block is mapped to its plant — the AI analysis model is switched automatically per block.
      </Text>

      <View className="mt-3" onLayout={onLayout}>
        {width > 0 && (
          <FieldMap
            map={map}
            width={width}
            height={height}
            location={location}
            trail={trail}
            currentBlock={currentBlock}
            selectedBlockId={selected?.id ?? null}
            onSelectBlock={setSelected}
            draftPoints={drawing ? draft : []}
            onTapPoint={drawing ? (la, ln) => setDraft((d) => [...d, [la, ln]]) : undefined}
          />
        )}
      </View>

      {drawing ? (
        <View className="mt-3">
          <Text className="text-[11px] font-bold text-slate-600">
            Tap the map to add corners ({draft.length} points) — 3+ points needed.
          </Text>
          <TextInput
            value={blockName}
            onChangeText={setBlockName}
            placeholder="Block name (e.g. Block D)"
            placeholderTextColor={colors.slate400}
            className="border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 mt-2 bg-white"
          />
          <Row className="gap-1.5 mt-2 flex-wrap">
            {PLANT_MODELS.map((p, i) => (
              <TouchableOpacity
                key={p.plant}
                onPress={() => setPlantIdx(i)}
                activeOpacity={0.8}
                className={`px-3 py-1.5 rounded-full border ${plantIdx === i ? 'border-transparent' : 'border-slate-200 bg-white'}`}
                style={plantIdx === i ? { backgroundColor: p.color } : undefined}
              >
                <Text className={`text-[11px] font-extrabold ${plantIdx === i ? 'text-white' : 'text-slate-600'}`}>
                  {p.plant}
                </Text>
              </TouchableOpacity>
            ))}
          </Row>
          <Row className="gap-2 mt-3">
            <TouchableOpacity
              onPress={finishBlock}
              disabled={draft.length < 3 || !blockName.trim() || save.pending}
              activeOpacity={0.85}
              className={`flex-1 flex-row items-center justify-center bg-brand-600 rounded-xl py-2.5 ${
                draft.length < 3 || !blockName.trim() || save.pending ? 'opacity-50' : ''
              }`}
            >
              <Feather name="check" size={15} color={colors.white} />
              <Text className="text-xs font-extrabold text-white ml-1.5">{save.pending ? 'Saving…' : 'Save Block'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setDraft([]); setDrawing(false); }}
              activeOpacity={0.85}
              className="flex-1 flex-row items-center justify-center border-[1.5px] border-slate-300 rounded-xl py-2.5"
            >
              <Feather name="x" size={15} color={colors.slate500} />
              <Text className="text-xs font-extrabold text-slate-600 ml-1.5">Cancel</Text>
            </TouchableOpacity>
          </Row>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => { setDrawing(true); setSelected(null); }}
          activeOpacity={0.85}
          className="flex-row items-center justify-center bg-brand-600 rounded-xl py-2.5 mt-3"
        >
          <Feather name="plus" size={15} color={colors.white} />
          <Text className="text-xs font-extrabold text-white ml-1.5">Mark New Block</Text>
        </TouchableOpacity>
      )}

      {selected && !drawing && (
        <View className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-3">
          <Row className="justify-between">
            <View>
              <Text className="text-[13px] font-extrabold text-slate-900">{selected.name}</Text>
              <Text className="text-[11px] font-bold text-slate-500 mt-0.5">
                Plant: {selected.plant} • AI model: {selected.aiModel ?? 'default'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeBlock(selected.id)} activeOpacity={0.8} className="p-2">
              <Feather name="trash-2" size={16} color={colors.rose500} />
            </TouchableOpacity>
          </Row>
        </View>
      )}
      <ActionFeedback result={save.result} />
    </Card>
  );
}
