import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, Page, Row, SectionTitle, Badge } from '../components/ui';
import { colors } from '../theme';
import { useRealtime } from '../realtime/RealtimeContext';
import { drive, emergencyStop, saveFieldMap, setManualTeleop } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import { FieldBlock, FieldMapMessage, StopPoint } from '../types/map';
import LiveMap, { MapPhoneFix } from '../map/LiveMap';
import { LeafletPointIn } from '../map/leafletHtml';
import { PhonePermission, PhoneFix, requestPhoneLocationPermission, stopPhoneLocation, watchPhoneLocation } from '../scripts/PhoneLocation';
import { readPref, writePref } from '../state/deviceStorage';
import { usePreferences } from '../state/Preferences';

/**
 * GPS mapping, three ways to put a point on the map:
 *
 *  1. ROBOT GPS   — drive the rover to the corner and capture (as before).
 *  2. PHONE WALK  — allow location, walk the block with the phone and mark the
 *                   corners from the phone; the robot stays parked.
 *  3. MAP TAP     — with no GPS at all, tap the point straight on the map.
 *
 * Stop points (places the robot must really come to a halt) are captured the
 * same three ways and are stored INSIDE the block, plus mirrored on this device,
 * so re-mapping a block keeps the stops it already had.
 */

const plants = ['tomato', 'potato', 'chilli', 'apple', 'blueberry', 'cauliflower', 'lemon', 'tea'];
const STOP_POINT_KEY = 'chrclient.mapping.stopPoints';
const AUTO_CAPTURE_METRES = 10;
/**
 * A corner marked from a fix this rough is worth a re-do: 25 m is about the
 * width of two crop rows. Rough fixes are skipped by the automatic capture and
 * refused by the manual button instead of quietly poisoning the field map
 * (the map's phone marker turns amber >15 m and red >30 m).
 */
const MAX_CAPTURE_ACCURACY_M = 25;
/** The walked path is drawn on the map; drop samples closer than this. */
const TRACE_MIN_METRES = 3;

type CaptureSource = 'robot' | 'phone' | 'tap';
type CaptureTarget = 'block' | 'boundary' | 'base' | 'stop';

/** metres between two fixes (haversine, good enough for a few hundred metres) */
function distanceM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function readStopLibrary(): Record<string, StopPoint[]> {
  const raw = readPref(STOP_POINT_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStopLibrary(library: Record<string, StopPoint[]>) {
  writePref(STOP_POINT_KEY, JSON.stringify(library));
}

const newStopPoint = (latitude: number, longitude: number, index: number): StopPoint => ({
  id: `stop-${Date.now()}-${index}`,
  label: `Stop ${index}`,
  latitude,
  longitude,
  order: index,
});

export default function MappingScreen() {
  const { fieldMap, location, robotOnline } = useRealtime();
  const save = useCommand(saveFieldMap);

  const [active, setActive] = useState(false);
  const [map, setMap] = useState<FieldMapMessage>({ name: 'Field A', boundary: [], blocks: [] });
  const [blockPoints, setBlockPoints] = useState<[number, number][]>([]);
  const [blockName, setBlockName] = useState('');
  const { mapProvider, setMapProvider } = usePreferences();
  const [plant, setPlant] = useState('tomato');
  const [stopPoints, setStopPoints] = useState<StopPoint[]>([]);
  const [stopLibrary, setStopLibrary] = useState<Record<string, StopPoint[]>>(() => readStopLibrary());

  const [source, setSource] = useState<CaptureSource>('robot');
  const [target, setTarget] = useState<CaptureTarget>('block');
  const [phoneFix, setPhoneFix] = useState<PhoneFix | null>(null);
  const [phonePermission, setPhonePermission] = useState<PhonePermission | 'idle'>('idle');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [walking, setWalking] = useState(false);
  const [autoCapture, setAutoCapture] = useState(false);
  /** the path already walked with the phone — drawn as a dashed line on the map */
  const [walkTrace, setWalkTrace] = useState<[number, number][]>([]);
  /** bumped by "my location" so the map re-centres even without a value change */
  const [focusToken, setFocusToken] = useState(0);
  /**
   * The mapping map lives inside the page scroller, and on a phone the scroller
   * can swallow a drag that was meant for the map. Full screen puts the same map
   * (same props, same state) in a Modal, where every gesture reaches it.
   */
  const [mapFullScreen, setMapFullScreen] = useState(false);
  const lastAutoRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (fieldMap) setMap(JSON.parse(JSON.stringify(fieldMap)));
  }, [fieldMap]);

  useEffect(() => () => stopPhoneLocation(), []);

  /** the live fix of whichever source the operator picked */
  const liveFix = useMemo(() => {
    if (source === 'phone') return phoneFix;
    if (source === 'robot' && location)
      return { latitude: location.latitude, longitude: location.longitude, accuracy: null, at: Date.now() };
    return null;
  }, [source, phoneFix, location]);

  /** true when the fix in hand is too rough to mark a corner with */
  const liveAccuracy = source === 'phone' ? phoneFix?.accuracy ?? null : null;
  const liveTooRough = liveAccuracy != null && liveAccuracy > MAX_CAPTURE_ACCURACY_M;

  const mapPoints: LeafletPointIn[] = useMemo(() => {
    const out: LeafletPointIn[] = [];
    map.boundary.forEach((p, i) => out.push({ id: `bnd-${i}`, latitude: p[0], longitude: p[1], kind: 'boundary', label: `B${i + 1}` }));
    if (map.base) out.push({ id: 'base', latitude: map.base.latitude, longitude: map.base.longitude, kind: 'base', label: 'BASE' });
    blockPoints.forEach((p, i) => out.push({ id: `blk-${i}`, latitude: p[0], longitude: p[1], kind: 'block', label: `C${i + 1}` }));
    stopPoints.forEach((s, i) =>
      out.push({ id: s.id, latitude: s.latitude, longitude: s.longitude, kind: 'stop', label: s.label || `S${i + 1}` }),
    );
    return out;
  }, [map.boundary, map.base, blockPoints, stopPoints]);

  /**
   * Put a captured point where it belongs. Everything funnels through here:
   * robot GPS, the phone's fix while walking, or a tap on the map.
   */
  const acceptPoint = useCallback(
    (latitude: number, longitude: number, why: string) => {
      if (target === 'base') {
        setMap((m) => ({ ...m, base: { latitude, longitude, name: 'Robot Base' } }));
      } else if (target === 'boundary') {
        setMap((m) => ({ ...m, boundary: [...m.boundary, [latitude, longitude] as [number, number]] }));
      } else if (target === 'stop') {
        setStopPoints((list) => [...list, newStopPoint(latitude, longitude, list.length + 1)]);
      } else {
        setBlockPoints((list) => [...list, [latitude, longitude] as [number, number]]);
      }
      lastAutoRef.current = { latitude, longitude };
      if (why) console.log('[mapping] point captured:', why, latitude, longitude);
    },
    [target],
  );

  const captureFromLive = () => {
    if (!liveFix) {
      Alert.alert(
        source === 'robot' ? 'No robot GPS fix' : 'No phone location yet',
        source === 'robot'
          ? 'Wait for a valid live GPS location from the rover, or switch to phone walking / map tapping.'
          : 'Allow location access and wait for the first fix.',
      );
      return;
    }
    if (liveTooRough) {
      Alert.alert(
        'Location is not accurate enough yet',
        `This fix is ±${Math.round(liveAccuracy ?? 0)} m — a corner marked with it can be one or two crop rows out.\n\n` +
          'Step into the open, wait for the ± figure to drop below ' +
          `${MAX_CAPTURE_ACCURACY_M} m, then capture. (The map marker turns green when the fix is good.)`,
      );
      return;
    }
    acceptPoint(liveFix.latitude, liveFix.longitude, source);
  };

  const startPhoneWalk = async () => {
    const permission = await requestPhoneLocationPermission();
    setPhonePermission(permission);
    if (permission !== 'granted') {
      setSource('tap');
      setPhoneError(
        permission === 'denied'
          ? 'Location permission denied — mark the corners by tapping the map instead.'
          : 'This device has no location service — mark the corners by tapping the map instead.',
      );
      return;
    }
    setPhoneError(null);
    setWalkTrace([]);
    setWalking(true);
    setSource('phone');
    watchPhoneLocation(
      (fix) => {
        setPhoneFix(fix);
        // Trace the walk so the operator can see on the map where they have
        // been (and that the map is following them).
        setWalkTrace((line) => {
          const lastPt = line[line.length - 1];
          if (lastPt && distanceM({ latitude: lastPt[0], longitude: lastPt[1] }, fix) < TRACE_MIN_METRES) return line;
          return [...line.slice(-400), [fix.latitude, fix.longitude] as [number, number]];
        });
        if (!autoCapture || target === 'base' || target === 'stop') return;
        // A rough fix must not plant a corner 20 m into the next row.
        if (fix.accuracy != null && fix.accuracy > MAX_CAPTURE_ACCURACY_M) return;
        const last = lastAutoRef.current;
        if (!last || distanceM(last, fix) >= AUTO_CAPTURE_METRES) {
          lastAutoRef.current = { latitude: fix.latitude, longitude: fix.longitude };
          // no toast spam: silently add the next boundary/block corner
          if (target === 'boundary') {
            setMap((m) => ({ ...m, boundary: [...m.boundary, [fix.latitude, fix.longitude] as [number, number]] }));
          } else {
            setBlockPoints((list) => [...list, [fix.latitude, fix.longitude] as [number, number]]);
          }
        }
      },
      (message) => setPhoneError(message),
    );
  };

  const stopPhoneWalk = () => {
    stopPhoneLocation();
    setWalking(false);
    if (source === 'phone') setSource('robot');
  };

  const finishBlock = () => {
    if (blockPoints.length < 3 || !blockName.trim()) return;
    const name = blockName.trim();
    const block: FieldBlock = {
      id: `block-${Date.now()}`,
      name,
      plant,
      aiModel: plant,
      color: '#22c55e',
      polygon: blockPoints,
      rowSpacingM: 1,
      scanSpacingM: 1,
      stopPoints,
    };
    setMap((m) => ({ ...m, blocks: [...m.blocks, block] }));
    // Keep the stop points for this block name: re-mapping the same block later
    // must not lose the places the robot has to stop at.
    const library = { ...stopLibrary, [name]: stopPoints };
    setStopLibrary(library);
    writeStopLibrary(library);
    setBlockPoints([]);
    setBlockName('');
    setStopPoints([]);
  };

  /** Restore the stop points a block already had (or this device remembers). */
  const reuseStopPoints = (block: FieldBlock) => {
    const saved = block.stopPoints?.length ? block.stopPoints : stopLibrary[block.name] ?? [];
    if (!saved.length) {
      Alert.alert('No saved stop points', `“${block.name}” has no stop points stored yet — mark them and save the block.`);
      return;
    }
    setStopPoints(saved.map((s, i) => ({ ...s, order: i + 1 })));
    setBlockName(block.name);
    setPlant(block.plant || plant);
    setTarget('stop');
    Alert.alert(
      'Stop points kept',
      `${saved.length} stop point${saved.length === 1 ? '' : 's'} from “${block.name}” are loaded into this mapping session. Finish & save to push them to the robot again.`,
    );
  };

  const renameStop = (id: string, label: string) =>
    setStopPoints((list) => list.map((s) => (s.id === id ? { ...s, label } : s)));

  const removeStop = (id: string) =>
    setStopPoints((list) => list.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })));

  const begin = async () => {
    await setManualTeleop(true);
    setActive(true);
  };
  const finish = async () => {
    await emergencyStop();
    // A block that was captured but not saved yet is saved here, otherwise the
    // operator's corners would be thrown away on "finish".
    const merged: FieldMapMessage = { ...map };
    if (blockPoints.length >= 3 && blockName.trim()) {
      const name = blockName.trim();
      merged.blocks = [
        ...map.blocks,
        { id: `block-${Date.now()}`, name, plant, aiModel: plant, color: '#22c55e', polygon: blockPoints, stopPoints },
      ];
      writeStopLibrary({ ...stopLibrary, [name]: stopPoints });
    }
    setMap(merged);
    await save.run(merged);
    setActive(false);
  };

  const MoveButton = ({ dir, label }: { dir: 'forward' | 'backward' | 'left' | 'right'; label: string }) => (
    <TouchableOpacity
      onPressIn={() => drive(dir)}
      onPressOut={() => drive('stop')}
      className="w-20 h-14 bg-slate-800 rounded-xl items-center justify-center"
    >
      <Text className="text-white text-xs font-extrabold">{label}</Text>
    </TouchableOpacity>
  );

  const SOURCES: { key: CaptureSource; label: string; icon: keyof typeof Feather.glyphMap; note: string }[] = [
    { key: 'robot', label: 'ROBOT GPS', icon: 'cpu', note: 'Drive the rover to the corner and capture its live fix.' },
    { key: 'phone', label: 'PHONE WALK', icon: 'smartphone', note: 'Walk the block with this phone — no driving needed.' },
    { key: 'tap', label: 'MAP TAP', icon: 'crosshair', note: 'Tap the map where the corner is (works with no GPS).' },
  ];

  const TARGETS: { key: CaptureTarget; label: string }[] = [
    { key: 'block', label: 'Block corner' },
    { key: 'boundary', label: 'Field boundary' },
    { key: 'base', label: 'Base point' },
    { key: 'stop', label: 'Stop point' },
  ];

  const phoneMarker: MapPhoneFix | null = phoneFix ? { ...phoneFix, active: walking } : null;

  /**
   * One map, used in the card and (full screen) in the modal below. Same props
   * both times, so tapping a corner in full screen marks exactly the same point.
   */
  const mapNode = (
    <LiveMap
      location={location}
      trail={[]}
      height={300}
      points={mapPoints}
      interactive
      onTap={(latitude, longitude) => acceptPoint(latitude, longitude, 'map tap')}
      phone={phoneMarker}
      phoneTrail={walkTrace}
      provider={mapProvider}
      onProviderChange={setMapProvider}
      /* Walking the block? The map follows the phone, so the operator never has
         to drag it back to where they are standing. */
      focus={walking ? 'phone' : 'rover'}
      focusToken={focusToken}
    />
  );

  return (
    <View className="flex-1 bg-surface dark:bg-slate-950">
      <Header title="GPS Mapping Mode" />
      <Page>
        <Text className="text-[22px] font-extrabold text-slate-900 dark:text-slate-100">Drive & Capture Field Map</Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-[18px]">
          Mark the corners of a block and the places the robot must stop at. You can capture from the robot's GPS, from
          this phone while you walk the crop, or by tapping the map directly. Stop points are saved with the block and
          are kept when the block is mapped again.
        </Text>
        <Row className="gap-2 mt-3 flex-wrap">
          <Badge label={active ? 'MAPPING ACTIVE' : 'MAPPING STOPPED'} />
          <Badge label={location ? 'ROBOT GPS FIX' : 'NO ROBOT GPS'} />
          <Badge label={walking ? 'PHONE WALKING' : 'PHONE IDLE'} />
          <Badge label={robotOnline ? 'ROBOT ONLINE' : 'OFFLINE'} />
        </Row>

        {/* Live map — always interactive so any point can be tapped in */}
        <Card className="mt-4">
          <Row className="justify-between">
            <SectionTitle>MAPPING MAP</SectionTitle>
            <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              tap the map to mark a {TARGETS.find((t) => t.key === target)?.label.toLowerCase()}
            </Text>
          </Row>
          <View className="mt-3">{mapNode}</View>
          <Row className="justify-between items-center mt-2.5">
            <Row className="gap-2">
              <TouchableOpacity
                onPress={() => setFocusToken((n) => n + 1)}
                activeOpacity={0.85}
                className="flex-row items-center bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 rounded-lg px-2.5 py-1.5"
              >
                <Feather name="crosshair" size={13} color={colors.emerald600} />
                <Text className="text-[10px] font-extrabold text-brand-700 dark:text-brand-300 ml-1.5">
                  CENTRE ON {walking ? 'ME' : 'ROBOT'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMapFullScreen(true)}
                activeOpacity={0.85}
                className="flex-row items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
              >
                <Feather name="maximize-2" size={13} color={colors.slate600} />
                <Text className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 ml-1.5">
                  FULL SCREEN
                </Text>
              </TouchableOpacity>
            </Row>
            <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {mapPoints.length} point{mapPoints.length === 1 ? '' : 's'} captured • {stopPoints.length} stop point
              {stopPoints.length === 1 ? '' : 's'} in this block
            </Text>
            <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {liveFix ? `${liveFix.latitude.toFixed(6)}, ${liveFix.longitude.toFixed(6)}` : 'no live fix'}
            </Text>
          </Row>
        </Card>

        {/* Full screen map — pinch, drag and zoom without the page scroller
            fighting the map (phones). Same map as the card above. */}
        <Modal visible={mapFullScreen} animationType="slide" onRequestClose={() => setMapFullScreen(false)}>
          <View className="flex-1 bg-surface dark:bg-slate-950">
            <Row className="justify-between items-center px-4 pt-4 pb-2">
              <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                MAPPING MAP — {TARGETS.find((t) => t.key === target)?.label.toUpperCase()}
              </Text>
              <TouchableOpacity
                onPress={() => setMapFullScreen(false)}
                activeOpacity={0.85}
                className="flex-row items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2"
              >
                <Feather name="minimize-2" size={14} color={colors.slate600} />
                <Text className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 ml-1.5">CLOSE</Text>
              </TouchableOpacity>
            </Row>
            <Text className="text-[10px] text-slate-500 dark:text-slate-400 px-4 pb-2">
              Pinch or use + / − to zoom, drag to move, ◎ for your position, ⤢ to frame everything. Tap to mark a{' '}
              {TARGETS.find((t) => t.key === target)?.label.toLowerCase()}.
            </Text>
            <View style={{ flex: 1 }}>{mapNode}</View>
          </View>
        </Modal>

        {/* Capture controls */}
        <Card className="mt-4">
          <SectionTitle>HOW TO CAPTURE</SectionTitle>
          <Row className="gap-2 mt-3 flex-wrap">
            {SOURCES.map((s) => (
              <TouchableOpacity
                key={s.key}
                onPress={() => {
                  if (s.key === 'phone' && !walking) void startPhoneWalk();
                  else setSource(s.key);
                }}
                className={`px-3 py-2 rounded-xl border ${
                  source === s.key ? 'bg-brand-600 border-brand-600' : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                <Row>
                  <Feather name={s.icon} size={13} color={source === s.key ? colors.white : colors.slate500} />
                  <Text className={`text-[11px] font-extrabold ml-1.5 ${source === s.key ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                    {s.label}
                  </Text>
                </Row>
              </TouchableOpacity>
            ))}
          </Row>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
            {SOURCES.find((s) => s.key === source)?.note}
            {source === 'tap' ? ' Tap anywhere on the map above.' : ''}
          </Text>

          <Text className="text-[10px] font-extrabold text-slate-400 mt-3 tracking-wide">WHAT THE NEXT POINT IS</Text>
          <Row className="gap-2 mt-2 flex-wrap">
            {TARGETS.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTarget(t.key)}
                className={`px-3 py-1.5 rounded-full border ${
                  target === t.key ? 'bg-slate-800 border-slate-800' : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                <Text className={`text-[10px] font-bold ${target === t.key ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Row>

          <Row className="gap-2 mt-3">
            <TouchableOpacity
              onPress={captureFromLive}
              disabled={source === 'tap'}
              className={`flex-1 bg-brand-600 rounded-xl py-3 items-center justify-center ${source === 'tap' ? 'opacity-50' : ''}`}
            >
              <Text className="text-white text-center text-xs font-extrabold">
                {source === 'phone' ? 'CAPTURE FROM PHONE' : 'CAPTURE FROM ROBOT GPS'}
              </Text>
            </TouchableOpacity>
            {walking ? (
              <TouchableOpacity onPress={stopPhoneWalk} className="px-4 bg-slate-700 rounded-xl py-3 items-center justify-center">
                <Text className="text-white text-[11px] font-extrabold">STOP WALK</Text>
              </TouchableOpacity>
            ) : null}
          </Row>

          {walking ? (
            <View className="border border-blue-100 dark:border-blue-900/40 bg-blue-100/40 dark:bg-blue-900/20 rounded-xl p-3 mt-3">
              <Row className="justify-between">
                <Text className="text-[11px] font-extrabold text-blue-700 dark:text-blue-300">WALKING WITH THE PHONE</Text>
                <Text className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                  {phoneFix
                    ? phoneFix.accuracy == null
                      ? 'accuracy unknown'
                      : liveTooRough
                        ? `±${phoneFix.accuracy.toFixed(0)} m — too rough, wait`
                        : `±${phoneFix.accuracy.toFixed(0)} m`
                    : 'waiting for a fix…'}
                </Text>
              </Row>
              <Text className="text-[10px] text-blue-700 dark:text-blue-300 mt-1 leading-4">
                Walk to a corner and press CAPTURE FROM PHONE (or turn on auto-capture and just walk — a corner is added
                automatically every {AUTO_CAPTURE_METRES} m).
              </Text>
              <TouchableOpacity
                onPress={() => setAutoCapture((v) => !v)}
                className={`mt-2 rounded-lg py-2 items-center ${autoCapture ? 'bg-blue-600' : 'border border-blue-200 dark:border-blue-800'}`}
              >
                <Text className={`text-[10px] font-extrabold ${autoCapture ? 'text-white' : 'text-blue-700 dark:text-blue-300'}`}>
                  AUTO-CAPTURE EVERY {AUTO_CAPTURE_METRES} m: {autoCapture ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {phoneError ? (
            <Text className="text-[10px] text-amber-700 dark:text-amber-300 mt-2 leading-4">{phoneError}</Text>
          ) : null}
          {phonePermission === 'denied' ? (
            <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-4">
              Location permission was refused. You can still map everything by tapping the map, or allow the permission
              in the phone's settings and press PHONE WALK again.
            </Text>
          ) : null}
        </Card>

        {/* Session */}
        <Card className="mt-4">
          <SectionTitle>MAPPING SESSION</SectionTitle>
          {!active ? (
            <TouchableOpacity
              onPress={begin}
              disabled={!robotOnline}
              className={`bg-brand-600 rounded-xl py-3 mt-3 items-center justify-center ${!robotOnline ? 'opacity-50' : ''}`}
            >
              <Text className="text-white text-center text-xs font-extrabold">START MAPPING MODE</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={finish} className="bg-brand-600 rounded-xl py-3 mt-3 items-center justify-center">
              <Text className="text-white text-center text-xs font-extrabold">FINISH & SAVE MAP</Text>
            </TouchableOpacity>
          )}
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
            {active
              ? 'The rover takes manual commands while mapping, and the map is written to the SD card when you finish.'
              : 'Starting mapping puts the rover into manual tele-operation (it will not drive a patrol until you finish).'}
          </Text>
        </Card>

        {active && (
          <Card className="mt-4">
            <SectionTitle>MANUAL DRIVE (OPTIONAL)</SectionTitle>
            <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Only needed for ROBOT GPS capture — walking the block with the phone does not move the robot.
            </Text>
            <View className="items-center mt-3">
              <MoveButton dir="forward" label="FORWARD" />
              <Row className="gap-3 mt-2">
                <MoveButton dir="left" label="LEFT" />
                <TouchableOpacity
                  onPress={() => emergencyStop()}
                  className="w-20 h-14 bg-rose-600 rounded-xl items-center justify-center"
                >
                  <Text className="text-white text-xs font-extrabold">STOP</Text>
                </TouchableOpacity>
                <MoveButton dir="right" label="RIGHT" />
              </Row>
              <View className="mt-2">
                <MoveButton dir="backward" label="BACK" />
              </View>
            </View>
          </Card>
        )}

        <Card className="mt-4">
          <SectionTitle>FIELD OUTER BOUNDARY</SectionTitle>
          <TouchableOpacity
            onPress={() => setTarget('boundary')}
            className={`rounded-xl py-2.5 mt-3 items-center justify-center border ${
              target === 'boundary' ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/40' : 'border-slate-400 dark:border-slate-500'
            }`}
          >
            <Text className="text-slate-700 dark:text-slate-200 text-center text-xs font-extrabold">
              NEXT POINT = BOUNDARY CORNER ({map.boundary.length} captured)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMap((m) => ({ ...m, boundary: m.boundary.slice(0, -1) }))} className="py-2">
            <Text className="text-center text-[10px] text-rose-600 dark:text-rose-400">Undo last boundary point</Text>
          </TouchableOpacity>
        </Card>

        <Card className="mt-4">
          <SectionTitle>BASE POINT (ROBOT RETURNS HERE)</SectionTitle>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            The parking spot the robot returns to when a mission ends, when rain is detected, or when the operator sends
            it home from WhatsApp.
          </Text>
          <TouchableOpacity
            onPress={() => setTarget('base')}
            className={`rounded-xl py-2.5 mt-3 items-center justify-center border ${
              target === 'base' ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/40' : 'border-brand-600'
            }`}
          >
            <Text className="text-brand-700 dark:text-brand-300 text-center text-xs font-extrabold">
              NEXT POINT = BASE
            </Text>
          </TouchableOpacity>
          {map.base && (
            <Text className="text-[10px] font-bold text-brand-700 dark:text-brand-300 mt-2">
              Base: {map.base.latitude.toFixed(6)}, {map.base.longitude.toFixed(6)}
            </Text>
          )}
        </Card>

        {/* Block capture */}
        <Card className="mt-4">
          <SectionTitle>CAPTURE A CROP BLOCK</SectionTitle>
          <TextInput
            value={blockName}
            onChangeText={setBlockName}
            placeholder="Block name"
            className="border border-slate-300 dark:border-slate-600 rounded-xl p-3 mt-2 text-slate-900 dark:text-slate-100"
          />
          <Row className="gap-1.5 mt-2 flex-wrap">
            {plants.map((x) => (
              <TouchableOpacity
                key={x}
                onPress={() => setPlant(x)}
                className={`px-3 py-1.5 rounded-full border ${
                  plant === x ? 'bg-brand-600 border-brand-600' : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                <Text className={`text-[10px] font-bold ${plant === x ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                  {x}
                </Text>
              </TouchableOpacity>
            ))}
          </Row>
          <TouchableOpacity
            onPress={() => setTarget('block')}
            className={`rounded-xl py-2.5 mt-3 items-center justify-center border ${
              target === 'block' ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/40' : 'border-slate-400 dark:border-slate-500'
            }`}
          >
            <Text className="text-slate-700 dark:text-slate-200 text-center text-xs font-extrabold">
              NEXT POINT = BLOCK CORNER ({blockPoints.length} captured)
            </Text>
          </TouchableOpacity>
          <Row className="gap-2 mt-2">
            <TouchableOpacity onPress={() => setBlockPoints((p) => p.slice(0, -1))} className="flex-1 py-2">
              <Text className="text-center text-[10px] text-rose-600 dark:text-rose-400">Undo corner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={finishBlock}
              disabled={blockPoints.length < 3 || !blockName.trim()}
              className={`flex-1 bg-brand-600 rounded-xl py-2 items-center justify-center ${
                blockPoints.length < 3 || !blockName.trim() ? 'opacity-50' : ''
              }`}
            >
              <Text className="text-white text-center text-[10px] font-extrabold">SAVE BLOCK</Text>
            </TouchableOpacity>
          </Row>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
            Saved blocks: {map.blocks.map((b) => `${b.name} (${b.stopPoints?.length ?? 0} stops)`).join(' → ') || 'none'}
          </Text>
        </Card>

        {/* Stop points */}
        <Card className="mt-4">
          <Row className="justify-between">
            <SectionTitle>STOP POINTS (ROBOT HALTS HERE)</SectionTitle>
            <Badge
              label={`${stopPoints.length} IN BLOCK`}
              className="bg-orange-500/10"
              textClassName="text-orange-600 dark:text-orange-300"
            />
          </Row>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-[17px]">
            A stop point is a place the robot must come to a full stop — a row end, a gate, a water point or a plant that
            needs a close look. Choose “Stop point” above, then capture it from the robot, from the phone while walking,
            or by tapping the map. They are stored with the block, so re-mapping the block keeps exactly these stops.
          </Text>

          {stopPoints.length === 0 ? (
            <Text className="text-[11px] text-slate-400 mt-3">No stop point captured yet.</Text>
          ) : (
            stopPoints.map((s, i) => (
              <View key={s.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 mt-2.5">
                <Row className="justify-between">
                  <Row>
                    <View className="w-6 h-6 rounded-full bg-orange-500 items-center justify-center">
                      <Text className="text-white text-[10px] font-extrabold">{i + 1}</Text>
                    </View>
                    <TextInput
                      value={s.label}
                      onChangeText={(v) => renameStop(s.id, v)}
                      placeholder={`Stop ${i + 1}`}
                      className="ml-2 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-800 dark:text-slate-100 min-w-[110px]"
                    />
                  </Row>
                  <TouchableOpacity onPress={() => removeStop(s.id)} className="p-1.5">
                    <Feather name="trash-2" size={14} color={colors.rose600} />
                  </TouchableOpacity>
                </Row>
                <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                  {s.latitude.toFixed(6)}, {s.longitude.toFixed(6)}
                </Text>
              </View>
            ))
          )}

          <TouchableOpacity
            onPress={() => setTarget('stop')}
            className={`rounded-xl py-2.5 mt-3 items-center justify-center border ${
              target === 'stop' ? 'border-orange-500 bg-orange-500/10' : 'border-slate-400 dark:border-slate-500'
            }`}
          >
            <Text className="text-slate-700 dark:text-slate-200 text-center text-xs font-extrabold">
              NEXT POINT = STOP POINT
            </Text>
          </TouchableOpacity>

          {map.blocks.length > 0 && (
            <>
              <Text className="text-[10px] font-extrabold text-slate-400 mt-4 tracking-wide">
                KEEP THE STOP POINTS OF AN EXISTING BLOCK
              </Text>
              {map.blocks.map((b) => (
                <Row key={b.id} className="justify-between border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 mt-2">
                  <View className="flex-1 pr-2">
                    <Text className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100">{b.name}</Text>
                    <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                      {b.stopPoints?.length ?? stopLibrary[b.name]?.length ?? 0} stop point
                      {(b.stopPoints?.length ?? stopLibrary[b.name]?.length ?? 0) === 1 ? '' : 's'} stored
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => reuseStopPoints(b)}
                    className="border border-orange-500 rounded-lg px-3 py-2"
                  >
                    <Text className="text-[10px] font-extrabold text-orange-600 dark:text-orange-300">REUSE THESE</Text>
                  </TouchableOpacity>
                </Row>
              ))}
            </>
          )}
        </Card>

        <Row className="mt-4 bg-sidebar rounded-2xl p-4">
          <MaterialCommunityIcons name="map-marker-path" size={16} color={colors.emerald400} />
          <Text className="text-[10px] text-slate-200 ml-2 flex-1 leading-4">
            The rover stops at each stop point in the order above and only then drives on, so a mapped block can be
            walked exactly the way you want it walked.
          </Text>
        </Row>
      </Page>
    </View>
  );
}
