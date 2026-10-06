import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { LocationMessage } from '../types/messages';
import {
  buildLeafletHtml,
  LeafletPointIn,
  MapProvider,
  DEFAULT_MAP_PROVIDER,
  DEFAULT_FIELD_POSITION,
  isMapProvider,
} from './leafletHtml';
import { mapStatus } from './mapStatus';

export interface MapPhoneFix {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  active?: boolean;
}

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

/** Same default field position as the native map (see LiveMap.tsx). */
const FALLBACK = DEFAULT_FIELD_POSITION;

/**
 * Web variant of LiveMap: react-native-webview does not run in the browser,
 * so the same Leaflet page is rendered in an <iframe> and updated with
 * contentWindow.postMessage. Taps inside the frame are posted back with
 * window.postMessage, which is how manual point marking works on the web build.
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  /** What the page is already showing, so we never re-create its tile layer. */
  const pageProviderRef = useRef<MapProvider | null>(null);

  const initial = location ?? FALLBACK;
  const initialProviderRef = useRef<MapProvider>(provider);
  const html = useMemo(
    () => buildLeafletHtml(initial.latitude, initial.longitude, 17, { interactive, provider: initialProviderRef.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interactive],
  );

  const status = mapStatus({ hasFix: !!location, isDefault, statusLabel, statusTone });

  const post = (payload: unknown) => iframeRef.current?.contentWindow?.postMessage(payload, '*');

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

  // Centre on the rover or on the walker (see the native twin).
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

  // Messages from the frame: a tap (manual point marking) and the tile button.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      let data: any = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (data?.type === 'tap' && interactive && onTap) onTap(data.latitude, data.longitude);
      if (data?.type === 'provider' && isMapProvider(data.id)) {
        pageProviderRef.current = data.id;
        onProviderChange?.(data.id);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [interactive, onTap, onProviderChange]);

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
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="Live rover map"
        style={{ border: 0, width: '100%', height: '100%' }}
        onLoad={onReady}
      />
    </View>
  );
}

export type { LeafletPointIn, MapProvider };
export { DEFAULT_FIELD_POSITION, DEFAULT_MAP_PROVIDER, isMapProvider };
/** Kept for the screens that already import it (Location, Controller, FieldMapcard). */
export const DEFAULT_FIELD_LOCATION = DEFAULT_FIELD_POSITION;
