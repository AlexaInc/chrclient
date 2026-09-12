import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { LocationMessage } from '../types/messages';
import { buildLeafletHtml } from './leafletHtml';

interface Props {
  location: LocationMessage | null;
  trail?: LocationMessage[];
  /** map height in px */
  height?: number;
}

/** Fallback centre before the first GPS fix arrives (Colombo). */
const FALLBACK = { latitude: 6.9271, longitude: 79.8612 };

/**
 * Live rover map (native: Expo Go compatible, renders Leaflet inside a
 * WebView). The marker + trail are pushed with postMessage so the map
 * never reloads between GPS fixes.
 */
export default function LiveMap({ location, trail = [], height = 220 }: Props) {
  const webviewRef = useRef<WebView>(null);
  const readyRef = useRef(false);

  const initial = location ?? FALLBACK;
  // Build the HTML once — later fixes arrive via postMessage.
  const html = useMemo(
    () => buildLeafletHtml(initial.latitude, initial.longitude),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!location || !readyRef.current) return;
    webviewRef.current?.postMessage(
      JSON.stringify({
        type: 'position',
        latitude: location.latitude,
        longitude: location.longitude,
        trail: trail.map((p) => [p.latitude, p.longitude]),
      }),
    );
  }, [location, trail]);

  return (
    <View
      style={{ height }}
      className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
    >
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html }}
        onLoadEnd={() => {
          readyRef.current = true;
          if (location) {
            webviewRef.current?.postMessage(
              JSON.stringify({
                type: 'position',
                latitude: location.latitude,
                longitude: location.longitude,
                trail: trail.map((p) => [p.latitude, p.longitude]),
              }),
            );
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}
