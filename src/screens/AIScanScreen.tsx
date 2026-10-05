import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, Row, Page } from '../components/ui';
import { colors } from '../theme';
import { capturePhoto, captureBurst } from '../scripts/Commands';
import { useRealtime } from '../realtime/RealtimeContext';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import { useAuth } from '../auth/AuthContext';
import {
  analyzePhotoCollection, deletePhoto, deletePhotoCollection, endManualPatrol,
  fetchManualPatrol, fetchPhotoCollections, PhotoCollectionDto, scanImageUrl, startManualPatrol,
} from '../scripts/Api';

const when = (ts?: number | null) => ts ? new Date(ts).toLocaleString() : '—';

// React Native Web's Alert.alert does not reliably support custom action
// buttons. On web that meant the confirmation appeared (or was swallowed),
// but the destructive callback never ran, so no DELETE request reached the
// network tab. Use the browser's synchronous confirm there and native Alert
// on Android/iOS.
function confirmDelete(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export default function AIScanScreen() {
  const { token } = useAuth();
  const { fieldMap, robotOnline, status, latestScan, latestReport } = useRealtime();
  const photo = useCommand(capturePhoto);
  const burst = useCommand(captureBurst);
  const [collections, setCollections] = useState<PhotoCollectionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<number | 'manual' | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [manualPatrol, setManualPatrol] = useState<{ patrolId: number; blockName: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try { setCollections((await fetchPhotoCollections(token)).collections); }
    catch (e: any) { console.warn('[AI Scan] collections:', e?.message ?? e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh, latestScan, latestReport]);
  useEffect(() => {
    if (!token) return;
    fetchManualPatrol(token).then((r) => setManualPatrol(r.patrol
      ? { patrolId: r.patrol.patrolId, blockName: r.patrol.blockName } : null)).catch(() => undefined);
  }, [token]);
  useEffect(() => {
    if (!selectedBlock && fieldMap?.blocks[0]) setSelectedBlock(fieldMap.blocks[0].id);
  }, [fieldMap, selectedBlock]);

  const startManual = async () => {
    if (!token || !selectedBlock) return;
    setWorking('manual');
    try {
      const r = await startManualPatrol(token, selectedBlock);
      setManualPatrol({ patrolId: r.patrol.patrolId, blockName: r.patrol.blockName });
      await refresh();
    } catch (e: any) { Alert.alert('Could not start patrol', e?.message ?? String(e)); }
    finally { setWorking(null); }
  };
  const finishManual = async () => {
    if (!token) return;
    setWorking('manual');
    try { await endManualPatrol(token); setManualPatrol(null); await refresh(); }
    catch (e: any) { Alert.alert('Could not end patrol', e?.message ?? String(e)); }
    finally { setWorking(null); }
  };
  const analyze = async (id: number) => {
    if (!token) return; setWorking(id);
    try { await analyzePhotoCollection(token, id); await refresh(); }
    catch (e: any) { Alert.alert('Analysis failed', e?.message ?? String(e)); }
    finally { setWorking(null); }
  };
  const removeCollection = async (id: number) => {
    if (!token || !(await confirmDelete('Delete collection?', 'All photo files and analysis results will be permanently deleted.'))) return;
    setWorking(id);
    try {
      await deletePhotoCollection(token, id);
      if (expanded === id) setExpanded(null);
      await refresh();
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message ?? String(e));
    } finally {
      setWorking(null);
    }
  };
  const removePhoto = async (id: number) => {
    if (!token || !(await confirmDelete('Delete photo?', 'The image file and its predictions will be permanently deleted.'))) return;
    try {
      await deletePhoto(token, id);
      await refresh();
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message ?? String(e));
    }
  };

  return <View className="flex-1 bg-surface">
    <Header title="AI Analyze" />
    <Page>
      <Text className="text-[22px] font-extrabold text-slate-900">Patrol Photo Collections</Text>
      <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
        Every autonomous and manual patrol stores its photos as one collection. Completed patrols are analyzed automatically; Analyze Again runs the full collection manually.
      </Text>
      <Row className="mt-3 gap-2"><Badge label={status?.state === 'patrolling' ? 'AUTO PATROL RUNNING' : 'ROBOT IDLE'} /><Badge label={robotOnline ? 'ONLINE' : 'OFFLINE'} /></Row>

      <Card className="mt-4">
        <SectionTitle>MANUAL PATROL COLLECTION</SectionTitle>
        {!manualPatrol ? <>
          <Text className="text-[11px] text-slate-500 mt-1">Choose the block first. Photos cannot be collected in manual mode until a manual patrol is started.</Text>
          <Row className="gap-2 mt-3 flex-wrap">
            {fieldMap?.blocks.map((b) => <TouchableOpacity key={b.id} onPress={() => setSelectedBlock(b.id)}
              className={`px-3 py-2 rounded-full border ${selectedBlock === b.id ? 'bg-brand-600 border-brand-600' : 'bg-white border-slate-300'}`}>
              <Text className={`text-xs font-bold ${selectedBlock === b.id ? 'text-white' : 'text-slate-700'}`}>{b.name} • {b.plant}</Text>
            </TouchableOpacity>)}
          </Row>
          <TouchableOpacity onPress={startManual} disabled={!robotOnline || !selectedBlock || working === 'manual'} className="bg-brand-600 rounded-xl py-3 mt-3 disabled:opacity-50">
            <Text className="text-white text-center text-xs font-extrabold">START MANUAL PATROL</Text>
          </TouchableOpacity>
        </> : <>
          <Text className="text-sm font-extrabold text-brand-700 mt-2">Collection #{manualPatrol.patrolId} • {manualPatrol.blockName}</Text>
          <Row className="gap-2 mt-3">
            <TouchableOpacity onPress={() => photo.run()} disabled={photo.pending} className="flex-1 bg-brand-600 rounded-xl py-3"><Text className="text-white text-center text-xs font-extrabold">CAPTURE PHOTO</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => burst.run()} disabled={burst.pending} className="flex-1 bg-slate-800 rounded-xl py-3"><Text className="text-white text-center text-xs font-extrabold">CAPTURE BOTH SIDES</Text></TouchableOpacity>
          </Row>
          <TouchableOpacity onPress={finishManual} disabled={working === 'manual'} className="border border-rose-500 rounded-xl py-3 mt-3"><Text className="text-rose-600 text-center text-xs font-extrabold">END PATROL & AUTO ANALYZE</Text></TouchableOpacity>
          <ActionFeedback result={photo.result ?? burst.result} />
        </>}
      </Card>

      <Row className="justify-between mt-5"><SectionTitle>ALL COLLECTIONS</SectionTitle>{loading && <ActivityIndicator color={colors.emerald600} />}</Row>
      {!loading && collections.length === 0 && <Card className="mt-2"><Text className="text-xs text-slate-500">No photos yet. Start a manual patrol or deploy an autonomous patrol.</Text></Card>}
      {collections.map((c) => <Card key={c.id} className="mt-3">
        <Row className="justify-between items-start">
          <TouchableOpacity className="flex-1" onPress={() => setExpanded(expanded === c.id ? null : c.id)}>
            <Text className="text-sm font-extrabold text-slate-900">Patrol #{c.id} • {(c.mode ?? 'auto').toUpperCase()}</Text>
            <Text className="text-[10px] text-slate-500 mt-1">{c.notes || c.block_ids.join(', ') || 'Photo collection'} • {when(c.started_at)}</Text>
            <Text className="text-xs font-bold text-brand-700 mt-2">{c.photo_count} photo(s) • {c.status}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeCollection(c.id)} className="p-2"><Feather name="trash-2" size={17} color={colors.rose500} /></TouchableOpacity>
        </Row>
        <Row className="gap-2 mt-3">
          <TouchableOpacity onPress={() => analyze(c.id)} disabled={working === c.id} className="flex-1 bg-brand-600 rounded-xl py-2.5"><Text className="text-white text-center text-xs font-extrabold">{working === c.id ? 'ANALYZING…' : 'ANALYZE AGAIN'}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setExpanded(expanded === c.id ? null : c.id)} className="px-4 border border-slate-300 rounded-xl py-2.5"><Text className="text-xs font-bold text-slate-700">{expanded === c.id ? 'HIDE' : 'OPEN'}</Text></TouchableOpacity>
        </Row>
        {expanded === c.id && <View className="mt-3">
          <Row className="gap-2 flex-wrap">{c.scans.map((scan) => <View key={scan.id} className="w-[112px] border border-slate-200 rounded-xl p-1.5">
            {token && <Image source={{ uri: scanImageUrl(scan.id, token) }} className="w-full h-[76px] rounded-lg bg-slate-100" resizeMode="cover" />}
            <Text className="text-[9px] font-extrabold text-slate-700 mt-1" numberOfLines={1}>{scan.predictions?.[0]?.className?.replace(/_+/g, ' ') || 'Not analyzed'}</Text>
            <Text className="text-[9px] text-slate-400">{scan.side} • {scan.plant}</Text>
            <TouchableOpacity onPress={() => removePhoto(scan.id)} className="mt-1 py-1"><Text className="text-[9px] font-bold text-rose-600 text-center">DELETE PHOTO</Text></TouchableOpacity>
          </View>)}</Row>
        </View>}
      </Card>)}
    </Page>
  </View>;
}
