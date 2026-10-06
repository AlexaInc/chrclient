import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
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

/** Same default field position as the native map (see LiveMap.tsx). */
const FALLBACK = { latitude: 7.489087449264883, longitude: 80.36537714662697 };

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
  points,
  interactive = false,
  onTap,
  phone,
  follow = true,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);

  const initial = location ?? FALLBACK;
  const html = useMemo(
    () => buildLeafletHtml(initial.latitude, initial.longitude, 17, { interactive }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interactive],
  );

  const post = (payload: unknown) => iframeRef.current?.contentWindow?.postMessage(payload, '*');

  useEffect(() => {
    if (!location || !readyRef.current) return;
    post({
      type: 'position',
      latitude: location.latitude,
      longitude: location.longitude,
      trail: trail.map((p) => [p.latitude, p.longitude]),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // A tap inside the iframe arrives as a window message; only trust messages
  // that really come from this frame.
  useEffect(() => {
    if (!interactive || !onTap) return;
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
      if (data?.type === 'tap') onTap(data.latitude, data.longitude);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [interactive, onTap]);

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

export type { LeafletPointIn };
