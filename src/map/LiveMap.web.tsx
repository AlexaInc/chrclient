import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { LocationMessage } from '../types/messages';
import { buildLeafletHtml } from './leafletHtml';

interface Props {
  location: LocationMessage | null;
  trail?: LocationMessage[];
  height?: number;
}

const FALLBACK = { latitude: 6.9271, longitude: 79.8612 };

/**
 * Web variant of LiveMap: react-native-webview does not run in the browser,
 * so the same Leaflet page is rendered in a sandboxed <iframe> and updated
 * with contentWindow.postMessage.
 */
export default function LiveMap({ location, trail = [], height = 220 }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);

  const initial = location ?? FALLBACK;
  const html = useMemo(
    () => buildLeafletHtml(initial.latitude, initial.longitude),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const push = (loc: LocationMessage) => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'position',
        latitude: loc.latitude,
        longitude: loc.longitude,
        trail: trail.map((p) => [p.latitude, p.longitude]),
      },
      '*',
    );
  };

  useEffect(() => {
    if (location && readyRef.current) push(location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, trail]);

  return (
    <View
      style={{ height }}
      className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
    >
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="Live rover map"
        style={{ border: 0, width: '100%', height: '100%' }}
        onLoad={() => {
          readyRef.current = true;
          if (location) push(location);
        }}
      />
    </View>
  );
}
