import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

const NAV_ITEMS: { key: string; label: string; icon: keyof typeof Feather.glyphMap; badge?: string }[] = [
  { key: 'Dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'Robot', label: 'Robot', icon: 'cpu' },
  { key: 'Controller', label: 'Controller', icon: 'navigation' },
  { key: 'Crops', label: 'Crops', icon: 'feather' },
  { key: 'AIScan', label: 'AI Scan', icon: 'camera' },
  { key: 'Location', label: 'Location', icon: 'map-pin' },
  { key: 'Analytics', label: 'Analytics', icon: 'bar-chart-2' },
  { key: 'Alerts', label: 'Alerts', icon: 'bell', badge: '2' },
  { key: 'Reports', label: 'Reports', icon: 'file-text' },
  { key: 'Settings', label: 'Settings', icon: 'settings' },
];

export default function DrawerContent(props: DrawerContentComponentProps) {
  const { state, navigation } = props;
  const activeRoute = state.routes[state.index]?.name;
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-sidebar" style={{ paddingTop: insets.top + 8 }}>
      {/* Brand header */}
      <View className="flex-row items-center px-6 py-5">
        <View className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 items-center justify-center">
          <MaterialCommunityIcons name="robot-outline" size={26} color={colors.emerald400} />
        </View>
        <View className="ml-3">
          <Text className="text-white text-[17px] font-extrabold">AI CROP ROBOT</Text>
          <Text className="text-brand-300 text-[10px] font-semibold mt-0.5">
            Smart Farming, Better Future
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8 }}>
        {NAV_ITEMS.map((item) => {
          const active = activeRoute === item.key;
          const inner = (
            <View className="flex-row items-center">
              <Feather name={item.icon} size={19} color={active ? colors.white : colors.emerald100} />
              <Text
                className={`flex-1 ml-3.5 text-sm ${
                  active ? 'text-white font-extrabold' : 'text-brand-100 font-semibold'
                }`}
              >
                {item.label}
              </Text>
              {item.badge ? (
                <View className="min-w-[20px] h-5 rounded-full bg-rose-500 items-center justify-center px-1.5 mr-1.5">
                  <Text className="text-white text-[11px] font-extrabold">{item.badge}</Text>
                </View>
              ) : null}
              {active ? <Feather name="chevron-right" size={15} color={colors.white} /> : null}
            </View>
          );
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.75}
              onPress={() => navigation.navigate(item.key as never)}
              className="mb-1.5"
            >
              {active ? (
                <LinearGradient
                  colors={[colors.emerald500, colors.green500]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 }}
                >
                  {inner}
                </LinearGradient>
              ) : (
                <View className="rounded-lg py-2.5 px-4">{inner}</View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom promo card */}
      <View
        className="mx-4 bg-sidebar-card border border-sidebar-card-border rounded-2xl p-4"
        style={{ marginBottom: insets.bottom + 16 }}
      >
        <MaterialCommunityIcons name="sprout" size={44} color={colors.green400} style={{ alignSelf: 'center' }} />
        <Text className="text-white text-sm font-extrabold text-center mt-2">
          Sustainable{'\n'}Agriculture
        </Text>
        <Text className="text-brand-300 text-[11px] text-center mt-1.5">Grow Smart, Live Green</Text>
      </View>
    </View>
  );
}
