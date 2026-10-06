import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'nativewind';
import { readPref, writePref } from './deviceStorage';
import { DEFAULT_MAP_PROVIDER, MapProvider, isMapProvider } from '../map/leafletHtml';
import { DEFAULT_PUSH_SEVERITY, PushSeverity, isPushSeverity } from '../notifications/pushPlan';

/**
 * Small set of display preferences that live on the device (not fleet settings).
 *
 *  graphDots — draw a marker on every sample of a plot graph. DEFAULT IS OFF:
 *              the operator asked for the smooth line to be the default view and
 *              for the dots to be a switch, not the other way round.
 *  darkMode  — app-wide dark theme, toggled from Settings or the side menu and
 *              remembered on this device.
 *  mapProvider — which tiles every live map draws. SATELLITE by default, because
 *              the operator maps crop blocks: the road map was a cartoon next to
 *              the imagery. Changeable from Settings and from the map itself.
 *  pushEnabled — master switch for phone notifications (Settings → NOTIFICATIONS).
 *              ON by default: the operator asked for the phone to be told about
 *              rain / petrol / offline events, so a fresh install asks for the
 *              permission instead of waiting to be discovered.
 *  pushSeverity — the quietest level that still reaches the phone, default
 *              “warnings & critical”. Informational entries stay in the app.
 */
export interface Preferences {
  graphDots: boolean;
  setGraphDots: (value: boolean) => void;
  toggleGraphDots: () => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  toggleDarkMode: () => void;
  mapProvider: MapProvider;
  setMapProvider: (value: MapProvider) => void;
  pushEnabled: boolean;
  setPushEnabled: (value: boolean) => void;
  togglePushEnabled: () => void;
  pushSeverity: PushSeverity;
  setPushSeverity: (value: PushSeverity) => void;
}

const KEY_GRAPH_DOTS = 'chrclient.prefs.graphDots';
const KEY_DARK_MODE = 'chrclient.prefs.darkMode';
const KEY_MAP_PROVIDER = 'chrclient.prefs.mapProvider';
const KEY_PUSH_ENABLED = 'chrclient.prefs.pushEnabled';
const KEY_PUSH_SEVERITY = 'chrclient.prefs.pushSeverity';

const PreferencesContext = createContext<Preferences | undefined>(undefined);

function boolFromStorage(key: string, fallback: boolean): boolean {
  const raw = readPref(key);
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [graphDots, setGraphDotsState] = useState<boolean>(() => boolFromStorage(KEY_GRAPH_DOTS, false));
  const [darkMode, setDarkModeState] = useState<boolean>(() => boolFromStorage(KEY_DARK_MODE, false));
  const [mapProvider, setMapProviderState] = useState<MapProvider>(() => {
    const saved = readPref(KEY_MAP_PROVIDER);
    return isMapProvider(saved) ? saved : DEFAULT_MAP_PROVIDER;
  });
  const [pushEnabled, setPushEnabledState] = useState<boolean>(() => boolFromStorage(KEY_PUSH_ENABLED, true));
  const [pushSeverity, setPushSeverityState] = useState<PushSeverity>(() => {
    const saved = readPref(KEY_PUSH_SEVERITY);
    return isPushSeverity(saved) ? saved : DEFAULT_PUSH_SEVERITY;
  });
  const colorScheme = useColorScheme();

  // Push the choice into NativeWind so every `dark:` class in the app follows it.
  useEffect(() => {
    try {
      colorScheme.setColorScheme(darkMode ? 'dark' : 'light');
    } catch {
      /* darkMode flag not set to "class" in the tailwind config — the app still
         runs, it just falls back to the system scheme */
    }
  }, [darkMode, colorScheme]);

  const setGraphDots = useCallback((value: boolean) => {
    setGraphDotsState(value);
    writePref(KEY_GRAPH_DOTS, value ? '1' : '0');
  }, []);

  const toggleGraphDots = useCallback(() => setGraphDots(!graphDots), [graphDots, setGraphDots]);

  const setDarkMode = useCallback((value: boolean) => {
    setDarkModeState(value);
    writePref(KEY_DARK_MODE, value ? '1' : '0');
  }, []);

  const toggleDarkMode = useCallback(() => setDarkMode(!darkMode), [darkMode, setDarkMode]);

  const setMapProvider = useCallback((value: MapProvider) => {
    setMapProviderState(isMapProvider(value) ? value : DEFAULT_MAP_PROVIDER);
    writePref(KEY_MAP_PROVIDER, value);
  }, []);

  const setPushEnabled = useCallback((value: boolean) => {
    setPushEnabledState(value);
    writePref(KEY_PUSH_ENABLED, value ? '1' : '0');
  }, []);

  const togglePushEnabled = useCallback(() => setPushEnabled(!pushEnabled), [pushEnabled, setPushEnabled]);

  const setPushSeverity = useCallback((value: PushSeverity) => {
    setPushSeverityState(isPushSeverity(value) ? value : DEFAULT_PUSH_SEVERITY);
    writePref(KEY_PUSH_SEVERITY, value);
  }, []);

  const value = useMemo<Preferences>(
    () => ({
      graphDots, setGraphDots, toggleGraphDots,
      darkMode, setDarkMode, toggleDarkMode,
      mapProvider, setMapProvider,
      pushEnabled, setPushEnabled, togglePushEnabled,
      pushSeverity, setPushSeverity,
    }),
    [graphDots, setGraphDots, toggleGraphDots, darkMode, setDarkMode, toggleDarkMode, mapProvider, setMapProvider, pushEnabled, setPushEnabled, togglePushEnabled, pushSeverity, setPushSeverity]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}

/** Safe variant for components that may render outside the provider (e.g. a
 *  standalone chart inside a modal that is not wrapped yet). */
export function usePreferencesOptional(): Preferences | null {
  return useContext(PreferencesContext) ?? null;
}
