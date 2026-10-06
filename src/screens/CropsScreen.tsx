import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Platform, Linking } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, PillButton, Page } from '../components/ui';
import { colors } from '../theme';
import { registerCropBatch } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../realtime/RealtimeContext';
import { fetchCrops, cropsExportUrl, CropBatchDto } from '../scripts/Api';

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

export default function CropsScreen() {
  const { token } = useAuth();
  const { fieldMap, isDemo } = useRealtime();
  const [crops, setCrops] = useState<CropBatchDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [cropName, setCropName] = useState('');
  const [block, setBlock] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const register = useCommand(registerCropBatch);

  const reload = () => {
    if (isDemo || !token) return;
    setLoading(true);
    fetchCrops(token)
      .then((res) => setCrops(res.crops))
      .catch((e) => console.warn('[Crops] fetch failed:', e?.message ?? e))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [isDemo, token]);

  const blocks = fieldMap?.blocks ?? [];
  const cropTypeCounts = new Map<string, number>();
  for (const c of crops) cropTypeCounts.set(c.crop, (cropTypeCounts.get(c.crop) ?? 0) + 1);

  const submit = async () => {
    if (!cropName.trim()) return;
    const res = await register.run({
      crop: cropName.trim(),
      block,
      plantedAt: new Date().toISOString().slice(0, 10),
      notes: notes.trim() || undefined,
    });
    if (res.success) {
      setCropName('');
      setNotes('');
      reload();
    }
  };

  return (
    <View className="flex-1 bg-surface dark:bg-slate-950">
      <Header title="Crops" />
      <Page>
        <Row className="gap-2 flex-wrap">
          <Badge label="CROP BATCH REGISTRY" className="bg-brand-50 dark:bg-brand-900/40" textClassName="text-brand-700 dark:text-brand-300" />
          {isDemo && <Badge label="DEMO DATA" className="bg-amber-100 dark:bg-amber-900/40" textClassName="text-amber-700 dark:text-amber-300" dotClassName="bg-amber-500" />}
        </Row>
        <Text className="text-[22px] font-extrabold text-slate-900 dark:text-slate-100 mt-3">Crop Batches</Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-[18px]">
          Record which crop is planted where and when — used to tag AI photo analysis and irrigation blocks.
        </Text>

        {!isDemo && (
          <Row className="mt-3.5 gap-2.5 lg:max-w-[400px]">
            <PillButton
              label="Export Crops (CSV)"
              className="flex-1 border-[1.5px] border-brand-700"
              textClassName="text-brand-700 dark:text-brand-300"
              onPress={() => token && openUrl(cropsExportUrl(token))}
            />
          </Row>
        )}

        {/* Register new batch */}
        <Card className="mt-4">
          <SectionTitle>REGISTER CROP BATCH</SectionTitle>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Crop name</Text>
          <TextInput
            value={cropName}
            onChangeText={setCropName}
            placeholder="e.g. Tomato, Chili, Cabbage"
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm mt-1"
          />
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-3">Block (optional)</Text>
          <Row className="mt-1.5 gap-2 flex-wrap">
            <TouchableOpacity
              onPress={() => setBlock(undefined)}
              className={`px-3 py-1.5 rounded-full border ${block === undefined ? 'bg-brand-600 border-brand-600' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
            >
              <Text className={`text-[11px] font-extrabold ${block === undefined ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>None</Text>
            </TouchableOpacity>
            {blocks.map((b) => (
              <TouchableOpacity
                key={b.id}
                onPress={() => setBlock(b.id)}
                className={`px-3 py-1.5 rounded-full border ${block === b.id ? 'bg-brand-600 border-brand-600' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
              >
                <Text className={`text-[11px] font-extrabold ${block === b.id ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </Row>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-3">Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Variety, spacing, etc."
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm mt-1"
          />
          <TouchableOpacity
            onPress={submit}
            disabled={!cropName.trim() || register.pending}
            activeOpacity={0.85}
            className={`flex-row items-center justify-center bg-brand-600 rounded-xl py-2.5 mt-3.5 ${!cropName.trim() || register.pending ? 'opacity-50' : ''}`}
          >
            <Feather name="plus" size={15} color={colors.white} />
            <Text className="text-xs font-extrabold text-white ml-1.5">{register.pending ? 'Registering…' : 'Register Batch'}</Text>
          </TouchableOpacity>
          <ActionFeedback result={register.result} />
        </Card>

        {/* Summary */}
        {cropTypeCounts.size > 0 && (
          <Card className="mt-4">
            <SectionTitle>CROP TYPES</SectionTitle>
            <Row className="mt-2 gap-2 flex-wrap">
              {Array.from(cropTypeCounts.entries()).map(([crop, count]) => (
                <View key={crop} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 flex-row items-center gap-2">
                  <MaterialCommunityIcons name="sprout" size={15} color={colors.emerald600} />
                  <Text className="text-xs font-extrabold text-slate-700 dark:text-slate-200">{crop}</Text>
                  <Text className="text-[11px] font-bold text-slate-400">×{count}</Text>
                </View>
              ))}
            </Row>
          </Card>
        )}

        {/* Batch list */}
        <Card className="mt-4">
          <Row className="justify-between">
            <SectionTitle>REGISTERED BATCHES</SectionTitle>
            {loading && <Text className="text-[11px] text-slate-400">Loading…</Text>}
          </Row>
          <View className="mt-2">
            {isDemo ? (
              <Text className="text-xs text-slate-400 py-8 text-center">Crop batches require a real server connection — not simulated in demo mode.</Text>
            ) : crops.length === 0 ? (
              <Text className="text-xs text-slate-400 py-8 text-center">No crop batches registered yet.</Text>
            ) : (
              crops.map((c, i) => (
                <View key={c.id} className={`flex-row items-center py-3 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}>
                  <IconBox className="bg-brand-100 dark:bg-brand-900/50" size={36}>
                    <MaterialCommunityIcons name="sprout-outline" size={18} color={colors.emerald600} />
                  </IconBox>
                  <View className="flex-1 ml-3">
                    <Text className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{c.crop}</Text>
                    <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {c.block ? `Block: ${c.block}` : 'No block assigned'}{c.notes ? ` • ${c.notes}` : ''}
                    </Text>
                  </View>
                  <Text className="text-[10px] font-bold text-slate-400">{c.planted_at ?? '—'}</Text>
                </View>
              ))
            )}
          </View>
        </Card>
      </Page>
    </View>
  );
}
