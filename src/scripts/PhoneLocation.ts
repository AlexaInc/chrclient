import { Platform } from 'react-native';

/**
 * The phone's own GPS.
 *
 * Mapping a block should not depend on the rover: the operator can pick the
 * phone up, walk the boundary of the crop and mark the corners as they go, then
 * let the robot drive the same polygon later. That needs the phone's location,
 * which lives behind a permission prompt, so this file keeps the platform
 * differences (browser Geolocation API vs expo-location) in one place.
 */

export interface PhoneFix {
  latitude: number;
  longitude: number;
  /** metres — shown to the operator so they know whether a corner is trustworthy */
  accuracy: number | null;
  at: number;
}

export type PhonePermission = 'granted' | 'denied' | 'unavailable';

let webWatchId: number | null = null;
let nativeSub: { remove: () => void } | null = null;

function webGeo(): Geolocation | null {
  const nav: any = (globalThis as any)?.navigator;
  return nav?.geolocation ?? null;
}

/** Ask once, up front, and report exactly what came back. */
export async function requestPhoneLocationPermission(): Promise<PhonePermission> {
  if (Platform.OS === 'web') {
    const geo = webGeo();
    if (!geo) return 'unavailable';
    if (typeof (geo as any).permissions?.query !== 'function') return 'granted'; // older browsers prompt on first use
    try {
      const status = await (geo as any).permissions.query({ name: 'geolocation' });
      if (status?.state === 'denied') return 'denied';
      return 'granted';
    } catch {
      return 'granted';
    }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Location = require('expo-location');
    const current = await Location.getForegroundPermissionsAsync();
    const res = current?.granted ? current : await Location.requestForegroundPermissionsAsync();
    return res?.granted ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** Start streaming the phone's position. Returns a stop function. */
export function watchPhoneLocation(
  onFix: (fix: PhoneFix) => void,
  onError?: (message: string) => void,
): () => void {
  stopPhoneLocation();

  if (Platform.OS === 'web') {
    const geo = webGeo();
    if (!geo) {
      onError?.('This browser has no location service.');
      return () => undefined;
    }
    webWatchId = geo.watchPosition(
      (pos) =>
        onFix({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          at: Date.now(),
        }),
      (err) => onError?.(err?.message ?? 'Location unavailable'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
    return stopPhoneLocation;
  }

  (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location');
      nativeSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy?.High ?? 4, timeInterval: 2000, distanceInterval: 0.5 },
        (pos: any) =>
          onFix({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
            at: Date.now(),
          }),
      );
    } catch (e: any) {
      onError?.(e?.message ?? 'Location unavailable');
    }
  })();

  return stopPhoneLocation;
}

export function stopPhoneLocation(): void {
  if (webWatchId != null) {
    try {
      webGeo()?.clearWatch(webWatchId);
    } catch {
      /* ignore */
    }
    webWatchId = null;
  }
  if (nativeSub) {
    try {
      nativeSub.remove();
    } catch {
      /* ignore */
    }
    nativeSub = null;
  }
}
