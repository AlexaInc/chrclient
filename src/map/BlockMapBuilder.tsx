import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card, SectionTitle, Badge, Row } from '../components/ui';
import { colors } from '../theme';
import FieldMap from './FieldMap';
import { FieldBlock, FieldMapMessage } from '../types/map';
import { saveFieldMap, deployMission } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import { useRealtime } from '../realtime/RealtimeContext';

/* Plant -> AI model registry; the backend switches models by block plant. */
const PLANT_MODELS: { plant: string; model: string; color: string }[] = [
  { plant: 'tomato', model: 'tomato', color: '#22c55e' },
  { plant: 'potato', model: 'potato', color: '#a16207' },
  { plant: 'chilli', model: 'chilli', color: '#ef4444' },
  { plant: 'apple', model: 'apple', color: '#84cc16' },
  { plant: 'blueberry', model: 'blueberry', color: '#4f46e5' },
  { plant: 'cauliflower', model: 'cauliflower', color: '#0ea5e9' },
  { plant: 'lemon', model: 'lemon', color: '#eab308' },
  { plant: 'tea', model: 'tea', color: '#059669' },
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
  const [rowSpacing, setRowSpacing] = useState('1.0');
  const [scanSpacing, setScanSpacing] = useState('1.0');
  const [arrivalRadius, setArrivalRadius] = useState('2.0');
  const [selected, setSelected] = useState<FieldBlock | null>(null);
  const [queuedIds, setQueuedIds] = useState<string[]>([]);
  const [localMap, setLocalMap] = useState<FieldMapMessage | null>(null);
  const [newMapName, setNewMapName] = useState('');
  const save = useCommand(saveFieldMap);
  const mission = useCommand(deployMission);

  const map = localMap ?? fieldMap;

  const createMap = async () => {
    const name = newMapName.trim() || 'Field A';
    const empty: FieldMapMessage = { name, boundary: [], blocks: [] };
    setLocalMap(empty);
    await save.run(empty);
  };

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
      rowSpacingM: Math.max(0.25, Number(rowSpacing) || 1),
      scanSpacingM: Math.max(0.25, Number(scanSpacing) || 1),
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
    setQueuedIds((ids) => ids.filter((blockId) => blockId !== id));
    await save.run(nextMap);
  };

  const selectBlock = (block: FieldBlock | null) => {
    setSelected(block);
    if (block) {
      setRowSpacing(String(block.rowSpacingM ?? 1));
      setScanSpacing(String(block.scanSpacingM ?? 1));
    }
  };

  const toggleQueued = (id: string) => setQueuedIds((ids) =>
    ids.includes(id) ? ids.filter((blockId) => blockId !== id) : [...ids, id]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  if (!map) {
    // No map saved on the server yet — this is the very first setup, not a
    // dead end: let the operator create one right here so the robot has
    // something real to test against.
    return (
      <Card className="mt-4">
        <SectionTitle>FIELD BLOCK MAP</SectionTitle>
        <Text className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          No field map has been saved yet. Create one to start marking crop blocks for the robot to patrol.
        </Text>
        <TextInput
          value={newMapName}
          onChangeText={setNewMapName}
          placeholder="Field name (e.g. Field A)"
          placeholderTextColor={colors.slate400}
          className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100 mt-3 bg-white dark:bg-slate-900"
        />
        <TouchableOpacity
          onPress={createMap}
          disabled={save.pending}
          activeOpacity={0.85}
          className={`flex-row items-center justify-center bg-brand-600 rounded-xl py-2.5 mt-3 ${save.pending ? 'opacity-50' : ''}`}
        >
          <Feather name="plus" size={15} color={colors.white} />
          <Text className="text-xs font-extrabold text-white ml-1.5">{save.pending ? 'Creating…' : 'Create Field Map'}</Text>
        </TouchableOpacity>
        <ActionFeedback result={save.result} />
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <Row className="justify-between">
        <SectionTitle>FIELD BLOCK MAP — PLANT PER BLOCK</SectionTitle>
        <Badge
          label={drawing ? 'DRAW MODE' : `${map.blocks.length} BLOCKS`}
          className={drawing ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-brand-50 dark:bg-brand-900/40'}
          textClassName={drawing ? 'text-amber-700 dark:text-amber-300' : 'text-brand-700 dark:text-brand-300'}
        />
      </Row>
      <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
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
            onSelectBlock={selectBlock}
            draftPoints={drawing ? draft : []}
            onTapPoint={drawing ? (la, ln) => setDraft((d) => [...d, [la, ln]]) : undefined}
          />
        )}
      </View>

      {drawing ? (
        <View className="mt-3">
          <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
            Tap the map to add corners ({draft.length} points) — 3+ points needed.
          </Text>
          <TextInput
            value={blockName}
            onChangeText={setBlockName}
            placeholder="Block name (e.g. Block D)"
            placeholderTextColor={colors.slate400}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100 mt-2 bg-white dark:bg-slate-900"
          />
          <Row className="gap-2 mt-2">
            <TextInput value={rowSpacing} onChangeText={setRowSpacing} keyboardType="decimal-pad"
              placeholder="Row m" className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[12px] bg-white dark:bg-slate-900" />
            <TextInput value={scanSpacing} onChangeText={setScanSpacing} keyboardType="decimal-pad"
              placeholder="Photo m" className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[12px] bg-white dark:bg-slate-900" />
          </Row>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Row spacing (m) and distance between left/right photo stops (m).</Text>
          <Row className="gap-1.5 mt-2 flex-wrap">
            {PLANT_MODELS.map((p, i) => (
              <TouchableOpacity
                key={p.plant}
                onPress={() => setPlantIdx(i)}
                activeOpacity={0.8}
                className={`px-3 py-1.5 rounded-full border ${plantIdx === i ? 'border-transparent' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}
                style={plantIdx === i ? { backgroundColor: p.color } : undefined}
              >
                <Text className={`text-[11px] font-extrabold ${plantIdx === i ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
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
              className="flex-1 flex-row items-center justify-center border-[1.5px] border-slate-300 dark:border-slate-600 rounded-xl py-2.5"
            >
              <Feather name="x" size={15} color={colors.slate500} />
              <Text className="text-xs font-extrabold text-slate-600 dark:text-slate-300 ml-1.5">Cancel</Text>
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

      {/* Always-visible patrol deployment — previously this only appeared after
          tapping a block polygon on the map, so operators couldn't find it. */}
      {!drawing && map.blocks.length > 0 && (
        <View className="bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-700 rounded-xl p-3 mt-3">
          <SectionTitle>DEPLOY AUTONOMOUS PATROL</SectionTitle>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Pick the blocks to patrol (tap to queue) — or deploy all blocks. Tap a block
            polygon on the map above to edit its spacing or remove it.
          </Text>
          <Row className="gap-1.5 mt-2 flex-wrap">
            {map.blocks.map((b) => (
              <TouchableOpacity
                key={b.id}
                onPress={() => toggleQueued(b.id)}
                activeOpacity={0.8}
                className={`px-3 py-1.5 rounded-full border ${
                  queuedIds.includes(b.id) ? 'bg-brand-600 border-brand-600' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                }`}
              >
                <Text className={`text-[11px] font-extrabold ${queuedIds.includes(b.id) ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                  {b.name} ({b.plant})
                </Text>
              </TouchableOpacity>
            ))}
          </Row>
          {queuedIds.length > 0 && (
            <Text className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-2">
              Route: {queuedIds.map((id) => map.blocks.find((b) => b.id === id)?.name ?? id).join(' → ')}
            </Text>
          )}
          <TouchableOpacity
            onPress={() => mission.run({ blocks: queuedIds, rowSpacingM: Number(rowSpacing) || 1,
              scanSpacingM: Number(scanSpacing) || 1, arrivalRadiusM: Number(arrivalRadius) || 2 })}
            disabled={mission.pending}
            activeOpacity={0.85}
            className={`bg-brand-600 rounded-xl py-2.5 mt-2.5 ${mission.pending ? 'opacity-60' : ''}`}
          >
            <Text className="text-white text-center text-xs font-extrabold">
              {mission.pending
                ? 'DEPLOYING…'
                : queuedIds.length > 0
                  ? `DEPLOY PATROL — ${queuedIds.length} BLOCK${queuedIds.length > 1 ? 'S' : ''}`
                  : `DEPLOY PATROL — ALL ${map.blocks.length} BLOCK${map.blocks.length > 1 ? 'S' : ''}`}
            </Text>
          </TouchableOpacity>
          <ActionFeedback result={mission.result} />
        </View>
      )}

      {selected && !drawing && (
        <View className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 mt-3">
          <Row className="justify-between">
            <View>
              <Text className="text-[13px] font-extrabold text-slate-900 dark:text-slate-100">{selected.name}</Text>
              <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                Plant: {selected.plant} • AI model: {selected.aiModel ?? 'default'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeBlock(selected.id)} activeOpacity={0.8} className="p-2">
              <Feather name="trash-2" size={16} color={colors.rose500} />
            </TouchableOpacity>
          </Row>
          <Row className="gap-2 mt-3">
            <TextInput value={rowSpacing} onChangeText={setRowSpacing} keyboardType="decimal-pad"
              placeholder="Row m" className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-[11px] bg-white dark:bg-slate-900" />
            <TextInput value={scanSpacing} onChangeText={setScanSpacing} keyboardType="decimal-pad"
              placeholder="Photo m" className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-[11px] bg-white dark:bg-slate-900" />
            <TextInput value={arrivalRadius} onChangeText={setArrivalRadius} keyboardType="decimal-pad"
              placeholder="GPS m" className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-[11px] bg-white dark:bg-slate-900" />
          </Row>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Row spacing • photo-stop spacing • GPS arrival tolerance (metres)</Text>
          <TouchableOpacity onPress={() => toggleQueued(selected.id)}
            className={`border rounded-xl py-2 mt-2 ${queuedIds.includes(selected.id) ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-400' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
            <Text className={`text-center text-xs font-extrabold ${queuedIds.includes(selected.id) ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200'}`}>
              {queuedIds.includes(selected.id) ? 'REMOVE FROM PATROL QUEUE' : 'ADD TO PATROL QUEUE'}
            </Text>
          </TouchableOpacity>
          {queuedIds.length > 0 && <Text className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-2">
            Queue ({queuedIds.length}): {queuedIds.map((id) => map.blocks.find((b) => b.id === id)?.name ?? id).join(' → ')}
          </Text>}
          <TouchableOpacity
            onPress={() => mission.run({ blocks: queuedIds.length ? queuedIds : [selected.id], rowSpacingM: Number(rowSpacing) || 1,
              scanSpacingM: Number(scanSpacing) || 1, arrivalRadiusM: Number(arrivalRadius) || 2 })}
            disabled={mission.pending}
            className="bg-brand-600 rounded-xl py-2.5 mt-2">
            <Text className="text-white text-center text-xs font-extrabold">{mission.pending ? 'DEPLOYING…' : `DEPLOY ${queuedIds.length || 1}-BLOCK AUTONOMOUS PATROL`}</Text>
          </TouchableOpacity>
        </View>
      )}
      <ActionFeedback result={save.result} />
    </Card>
  );
}
