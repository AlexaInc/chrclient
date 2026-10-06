import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { LocationMessage } from '../types/messages';
import {
  buildLeafletHtml,
  LeafletPointIn,
  MapProvider,
  DEFAULT_MAP_PROVIDER,
  DEFAULT_FIELD_POSITION,
  isMapProvider,
} from './leafletHtml';
import { mapStatus, MapStatus } from './mapStatus';

export interface MapPhoneFix {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  active?: boolean;
}

/** Which marker the map follows and centres on. */
export type MapFocus = 'rover' | 'phone';

interface Props {
  location: LocationMessage | null;
  trail?: LocationMessage[];
  height?: number;
  /** true when `location` is the configured default, not a real GPS fix */
  isDefault?: boolean;
  /** extra markers: boundary corners, block corners, stop points, the base point */
  points?: LeafletPointIn[];
  /** taps on the map come back as lat/lng — this is how points get marked by hand */
  interactive?: boolean;
  onTap?: (latitude: number, longitude: number) => void;
  /** the phone's own position, shown while the operator walks a block */
  phone?: MapPhoneFix | null;
  /** the path already walked with the phone (drawn as a dashed line) */
  phoneTrail?: [number, number][];
  /** keep the map centred on the followed marker as it moves (default true) */
  follow?: boolean;
  /** follow the rover or the walking phone (default: the rover) */
  focus?: MapFocus;
  /** bump this to re-centre on `focus` even when the value did not change */
  focusToken?: number;
  /** which tiles to draw — satellite by default (see leafletHtml.ts) */
  provider?: MapProvider;
  /** the user tapped a tile button inside the map */
  onProviderChange?: (provider: MapProvider) => void;
  /** override the badge in the corner of the map */
  statusLabel?: string;
  statusTone?: 'ok' | 'warn';
}

export type { LeafletPointIn, MapProvider, MapStatus };
export { DEFAULT_FIELD_POSITION, DEFAULT_MAP_PROVIDER, isMapProvider, mapStatus };
/** Kept for the screens that already import it (Location, Controller, FieldMapcard). */
export const DEFAULT_FIELD_LOCATION = DEFAULT_FIELD_POSITION;

/**
 * Fallback centre before the first GPS fix arrives — the operator's own field,
 * never a generic city centre (see leafletHtml.DEFAULT_FIELD_POSITION).
 */
const FALLBACK = DEFAULT_FIELD_POSITION;

/**
 * Live rover map (native: renders Leaflet inside a WebView). The marker, trail,
 * captured mapping points and the phone's position are pushed with postMessage
 * so the map never reloads between GPS fixes.
 */
export default function LiveMap({
  location,
  trail = [],
  height = 220,
  isDefault,
  points,
  interactive = false,
  onTap,
  phone,
  phoneTrail = [],
  follow = true,
  focus = 'rover',
  focusToken = 0,
  provider = DEFAULT_MAP_PROVIDER,
  onProviderChange,
  statusLabel,
  statusTone,
}: Props) {
  const webviewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  /** What the page is already showing, so we never re-create its tile layer. */
  const pageProviderRef = useRef<MapProvider | null>(null);

  const initial = location ?? FALLBACK;
  const initialProviderRef = useRef<MapProvider>(provider);
  // Built once per interaction mode — later updates arrive via postMessage.
  const html = useMemo(
    () => buildLeafletHtml(initial.latitude, initial.longitude, 17, { interactive, provider: initialProviderRef.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interactive],
  );

  const status = mapStatus({ hasFix: !!location, isDefault, statusLabel, statusTone });

  const post = (payload: unknown) => webviewRef.current?.postMessage(JSON.stringify(payload));

  const sendPosition = () => {
    if (!location) {
      // No robot link: keep the map on the field position and say so.
      post({
        type: 'position',
        latitude: FALLBACK.latitude,
        longitude: FALLBACK.longitude,
        trail: [],
        status: status.label,
        statusTone: status.tone,
      });
      return;
    }
    post({
      type: 'position',
      latitude: location.latitude,
      longitude: location.longitude,
      trail: trail.map((p) => [p.latitude, p.longitude]),
      status: status.label,
      statusTone: status.tone,
    });
  };

  useEffect(() => {
    if (!readyRef.current) return;
    sendPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, trail, status.label, status.tone]);

  useEffect(() => {
    if (!readyRef.current) return;
    post({ type: 'points', points: points ?? [] });
  }, [points]);

  useEffect(() => {
    if (!readyRef.current) return;
    post(phone ? { type: 'phone', ...phone, active: phone.active !== false } : { type: 'phone', active: false });
  }, [phone]);

  useEffect(() => {
    if (!readyRef.current) return;
    post({ type: 'trace', points: phoneTrail });
  }, [phoneTrail]);

  useEffect(() => {
    if (!readyRef.current) return;
    post({ type: 'follow', enabled: follow });
  }, [follow]);

  // Centre on the rover or on the walker. focusToken re-centres on demand
  // (the "my location" button) even when the target did not change.
  useEffect(() => {
    if (!readyRef.current) return;
    post({ type: 'focus', target: focus });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, focusToken]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (pageProviderRef.current === provider) return;
    pageProviderRef.current = provider;
    post({ type: 'provider', id: provider });
  }, [provider]);

  const onReady = () => {
    readyRef.current = true;
    pageProviderRef.current = provider;
    sendPosition();
    post({ type: 'points', points: points ?? [] });
    post({ type: 'trace', points: phoneTrail });
    if (phone) post({ type: 'phone', ...phone, active: phone.active !== false });
    post({ type: 'provider', id: provider });
    if (focus !== 'rover') post({ type: 'focus', target: focus });
  };

  return (
    <View
      style={{ height }}
      className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
    >
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html }}
        onLoadEnd={onReady}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data?.type === 'tap' && onTap) onTap(data.latitude, data.longitude);
            if (data?.type === 'provider' && isMapProvider(data.id)) {
              pageProviderRef.current = data.id;
              onProviderChange?.(data.id);
            }
          } catch {
            /* ignore malformed */
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}
