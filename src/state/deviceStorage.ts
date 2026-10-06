import { Platform } from 'react-native';

/**
 * Tiny per-device key/value store for UI preferences (dark mode, graph dots…).
 *
 * These are *device* choices, not fleet settings, so they must survive an app
 * restart without ever needing a server round-trip.
 *
 *  - web      → localStorage (guarded: it is absent in SSR / some webviews)
 *  - android
 *    / ios    → MMKV when the native module is present, otherwise an in-memory
 *               map so the app still runs (for example in Expo Go or a
 *               development client that was built without the module).
 */

const memory = new Map<string, string>();

type MmkvLike = { getString: (k: string) => string | undefined; set: (k: string, v: string) => void };

let mmkv: MmkvLike | null = null;
let mmkvTried = false;

function getMmkv(): MmkvLike | null {
  if (Platform.OS === 'web' || mmkvTried) return mmkv;
  mmkvTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-mmkv');
    const Ctor = mod?.MMKV;
    if (typeof Ctor === 'function') mmkv = new Ctor({ id: 'chrclient-prefs' }) as MmkvLike;
  } catch {
    mmkv = null;
  }
  return mmkv;
}

function webStorage(): Storage | null {
  try {
    const ls = (globalThis as any)?.localStorage;
    if (ls && typeof ls.getItem === 'function') return ls as Storage;
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

export function readPref(key: string): string | null {
  if (Platform.OS === 'web') {
    const ls = webStorage();
    if (ls) {
      try {
        return ls.getItem(key);
      } catch {
        return null;
      }
    }
    return memory.get(key) ?? null;
  }
  const store = getMmkv();
  if (store) {
    try {
      return store.getString(key) ?? null;
    } catch {
      return null;
    }
  }
  return memory.get(key) ?? null;
}

export function writePref(key: string, value: string): void {
  if (Platform.OS === 'web') {
    const ls = webStorage();
    if (ls) {
      try {
        ls.setItem(key, value);
        return;
      } catch {
        /* fall through to memory */
      }
    }
    memory.set(key, value);
    return;
  }
  const store = getMmkv();
  if (store) {
    try {
      store.set(key, value);
      return;
    } catch {
      /* fall through to memory */
    }
  }
  memory.set(key, value);
}
