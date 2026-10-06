import 'react-native-gesture-handler';
import './global.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import DrawerContent from './src/navigation/DrawerContent';
import DashboardScreen from './src/screens/DashboardScreen';
import RobotScreen from './src/screens/RobotScreen';
import CropsScreen from './src/screens/CropsScreen';
import AIScanScreen from './src/screens/AIScanScreen';
import LocationScreen from './src/screens/LocationScreen';
import MappingScreen from './src/screens/MappingScreen';
import ControllerScreen from './src/screens/ControllerScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import IrrigationScreen from './src/screens/IrrigationScreen';
import { colors } from './src/theme';
import { DESKTOP_BP } from './src/components/ui';
import { AuthProvider } from './src/auth/AuthContext';
import LoginModal from './src/auth/LoginModal';
import { RealtimeProvider } from './src/realtime/RealtimeContext';
import { PushProvider } from './src/notifications/PushContext';
import { NotificationsBridge } from './src/notifications/NotificationsBridge';
import AppLoadingScreen from './src/components/AppLoadingScreen';
import { PreferencesProvider, usePreferences } from './src/state/Preferences';
import { UpdateProvider } from './src/state/Update';
import UpdateBanner from './src/components/UpdateBanner';

const Drawer = createDrawerNavigator();

// Keep the native splash (assets/splash-icon.png, the app icon) up until our
// own animated loading screen has painted — that way the launch goes
// native splash → branded loading screen, with no flash of a blank window.
SplashScreen.preventAutoHideAsync().catch(() => {});
const hideNativeSplash = () => {
  SplashScreen.hideAsync().catch(() => {});
};

/** How long the branded loading screen stays before the app shows through. */
const BOOT_MS = 1100;

/**
 * Everything below the providers. Split out so it can read the display
 * preferences: the theme decides the status-bar style, the navigator's scene
 * colour and the dark palette used by every screen.
 */
function AppTree() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= DESKTOP_BP;
    const { darkMode } = usePreferences();

    // On the web build the <body> sits outside the React tree, so its colour has
    // to be set by hand — otherwise scrolling past the app shows a white band.
    useEffect(() => {
      const doc: any = (globalThis as any)?.document;
      if (!doc) return;
      const root = doc.documentElement;
      const body = doc.body;
      root?.classList?.toggle?.('dark', darkMode);
      root?.style?.setProperty?.('color-scheme', darkMode ? 'dark' : 'light');
      if (body) body.style.backgroundColor = darkMode ? colors.slate950 : colors.bg;
    }, [darkMode]);

    return (
      <View style={{ flex: 1 }}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <NavigationContainer>
            <Drawer.Navigator
                initialRouteName="Dashboard"
                drawerContent={(props) => <DrawerContent {...props} />}
                screenOptions={{
                    headerShown: false,
                    drawerType: isDesktop ? 'permanent' : 'front',
                    drawerStyle: {
                        width: isDesktop ? 256 : 290,
                        backgroundColor: colors.sidebarBg,
                        borderRightWidth: 0,
                    },
                    sceneStyle: { backgroundColor: darkMode ? colors.slate950 : colors.bg },
                }}
            >
                <Drawer.Screen name="Dashboard" component={DashboardScreen} />
                <Drawer.Screen name="Robot" component={RobotScreen} />
                <Drawer.Screen name="Controller" component={ControllerScreen} />
                <Drawer.Screen name="Irrigation" component={IrrigationScreen} />
                <Drawer.Screen name="Crops" component={CropsScreen} />
                <Drawer.Screen name="AIScan" component={AIScanScreen} />
                <Drawer.Screen name="Location" component={LocationScreen} />
                <Drawer.Screen name="Mapping" component={MappingScreen} />
                <Drawer.Screen name="Analytics" component={AnalyticsScreen} />
                <Drawer.Screen name="Alerts" component={AlertsScreen} />
                <Drawer.Screen name="Reports" component={ReportsScreen} />
                <Drawer.Screen name="Settings" component={SettingsScreen} />
            </Drawer.Navigator>
        </NavigationContainer>
        {/* "new version available" notice — sits above every screen */}
        <UpdateBanner />
      </View>
    );
}

export default function App() {
    const [booted, setBooted] = useState(false);

    useEffect(() => {
      if (booted) return;
      const t = setTimeout(() => setBooted(true), BOOT_MS);
      return () => clearTimeout(t);
    }, [booted]);

    // the loading screen is on screen: swap the native splash for it
    const onLoadingPainted = useCallback(() => hideNativeSplash(), []);

    if (!booted) {
      return (
        // the same flex root as the main tree, so the loading screen fills the
        // window on every platform (web included)
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AppLoadingScreen label="Starting up…" onPainted={onLoadingPainted} />
        </GestureHandlerRootView>
      );
    }


    return (
        <GestureHandlerRootView style={{ flex: 1 }} onLayout={hideNativeSplash}>
            <SafeAreaProvider>
              <PreferencesProvider>
                <AuthProvider>
                  {/* Phone notifications: lives under Auth (it needs the session
                      token to register this device) and above Realtime (it
                      watches the live alerts and puts them on the lock screen). */}
                  <PushProvider>
                    <RealtimeProvider>
                      <NotificationsBridge />
                      <UpdateProvider>
                        <AppTree />
                      </UpdateProvider>
                    </RealtimeProvider>
                  </PushProvider>
                    <LoginModal />
                </AuthProvider>
              </PreferencesProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
