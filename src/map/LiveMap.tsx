import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { LocationMessage } from '../types/messages';
import { buildLeafletHtml, LeafletPointIn } from './leafletHtml';

export interface MapPhoneFix {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  active?: boolean;
}

interface Props {
  location: LocationMessage | null;
  trail?: LocationMessage[];
  /** map height in px */
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
  /** keep the map centred on the rover as it moves (default true) */
  follow?: boolean;
}

/**
 * Fallback centre before the first GPS fix arrives. The operator asked for the
 * field's own position here rather than a generic city centre, so a rover with
 * no GPS fix still shows the right place instead of "somewhere in Colombo".
 */
export const DEFAULT_FIELD_LOCATION = { latitude: 7.489087449264883, longitude: 80.36537714662697 };
const FALLBACK = { latitude: DEFAULT_FIELD_LOCATION.latitude, longitude: DEFAULT_FIELD_LOCATION.longitude };

/**
 * Live rover map (native: renders Leaflet inside a WebView). The marker, trail,
 * captured mapping points and the phone's position are pushed with postMessage
 * so the map never reloads between GPS fixes.
 */
export default function LiveMap({
  location,
  trail = [],
  height = 220,
  points,
  interactive = false,
  onTap,
  phone,
  follow = true,
}: Props) {
  const webviewRef = useRef<WebView>(null);
  const readyRef = useRef(false);

  const initial = location ?? FALLBACK;
  // Built once per interaction mode — later updates arrive via postMessage.
  const html = useMemo(
    () => buildLeafletHtml(initial.latitude, initial.longitude, 17, { interactive }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interactive],
  );

  const post = (payload: unknown) => webviewRef.current?.postMessage(JSON.stringify(payload));

  useEffect(() => {
    if (!location || !readyRef.current) return;
    post({
      type: 'position',
      latitude: location.latitude,
      longitude: location.longitude,
      trail: trail.map((p) => [p.latitude, p.longitude]),
    });
  }, [location, trail]);

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
    post({ type: 'follow', enabled: follow });
  }, [follow]);

  const onReady = () => {
    readyRef.current = true;
    if (location) {
      post({
        type: 'position',
        latitude: location.latitude,
        longitude: location.longitude,
        trail: trail.map((p) => [p.latitude, p.longitude]),
      });
    }
    post({ type: 'points', points: points ?? [] });
    if (phone) post({ type: 'phone', ...phone, active: phone.active !== false });
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
          } catch {
            /* ignore malformed */
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}

export type { LeafletPointIn };
