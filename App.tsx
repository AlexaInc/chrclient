import 'react-native-gesture-handler';
import './global.css';
import React, { useEffect } from 'react'; // 1. useEffect ඉම්පෝර්ට් කරගන්න
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
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/theme';
import { DESKTOP_BP } from './src/components/ui';
import { connectSocket, disconnectSocket } from './src/scripts/Websocket';

const SOCKET_URL = 'http://192.168.1.3:8000';
const Drawer = createDrawerNavigator();

export default function App() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= DESKTOP_BP;

    useEffect(() => {
        connectSocket(SOCKET_URL);

        return () => {
            disconnectSocket();
        };
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
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
                        <Drawer.Screen name="Crops" component={CropsScreen} />
                        <Drawer.Screen name="AIScan" component={AIScanScreen} />
                        <Drawer.Screen name="Location" component={LocationScreen} />
                        <Drawer.Screen name="Analytics" component={AnalyticsScreen} />
                        <Drawer.Screen name="Alerts" component={AlertsScreen} />
                        <Drawer.Screen name="Reports" component={ReportsScreen} />
                        <Drawer.Screen name="Settings" component={SettingsScreen} />
                    </Drawer.Navigator>
                </NavigationContainer>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}