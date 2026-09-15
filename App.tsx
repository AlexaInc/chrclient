import 'react-native-gesture-handler';
import './global.css';
import React from 'react';
import { useWindowDimensions } from 'react-native';
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
import ControllerScreen from './src/screens/ControllerScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/theme';
import { DESKTOP_BP } from './src/components/ui';
import { AuthProvider } from './src/auth/AuthContext';
import LoginModal from './src/auth/LoginModal';
import { RealtimeProvider } from './src/realtime/RealtimeContext';

const Drawer = createDrawerNavigator();

export default function App() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= DESKTOP_BP;


    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <AuthProvider>
                    <RealtimeProvider>
                    <NavigationContainer>
                        <StatusBar style="dark" />
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
                                sceneStyle: { backgroundColor: colors.bg },
                            }}
                        >
                            <Drawer.Screen name="Dashboard" component={DashboardScreen} />
                            <Drawer.Screen name="Robot" component={RobotScreen} />
                            <Drawer.Screen name="Controller" component={ControllerScreen} />
                            <Drawer.Screen name="Crops" component={CropsScreen} />
                            <Drawer.Screen name="AIScan" component={AIScanScreen} />
                            <Drawer.Screen name="Location" component={LocationScreen} />
                            <Drawer.Screen name="Analytics" component={AnalyticsScreen} />
                            <Drawer.Screen name="Alerts" component={AlertsScreen} />
                            <Drawer.Screen name="Reports" component={ReportsScreen} />
                            <Drawer.Screen name="Settings" component={SettingsScreen} />
                        </Drawer.Navigator>
                    </NavigationContainer>
                    </RealtimeProvider>
                    <LoginModal />
                </AuthProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
