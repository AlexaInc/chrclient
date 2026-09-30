import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { useIsDesktop } from './ui';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../realtime/RealtimeContext';

export default function Header({ title }: { title?: string }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const { user, logout } = useAuth();
  const { alerts } = useRealtime();
  const alertCount = alerts.filter((a) => !a.acknowledgedAt).length;

  return (
    <View
      className="flex-row items-center bg-white border-b border-slate-200 px-4 pb-2.5"
      style={{ paddingTop: isDesktop ? 14 : insets.top + 8, paddingBottom: isDesktop ? 14 : 10 }}
    >
      {!isDesktop && (
        <TouchableOpacity
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          className="w-9 h-9 items-center justify-center"
          activeOpacity={0.7}
        >
          <Feather name="menu" size={22} color={colors.slate600} />
        </TouchableOpacity>
      )}

      {title && !isDesktop ? (
        <Text className="flex-1 ml-2 text-base font-extrabold text-slate-900" numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View className="flex-row items-center ml-1">
          <Image
            source={require('../../assets/images/chr-logo.png')}
            style={{ width: 26, height: 26, marginRight: 8 }}
            resizeMode="contain"
            accessibilityLabel="CropHealth Robot logo"
          />
          <Text className="text-lg font-extrabold text-slate-900">{title ?? 'Dashboard'}</Text>
        </View>
      )}

      {isDesktop && <View className="flex-1" />}

      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => navigation.navigate('Alerts')}
          activeOpacity={0.7}
        >
          <View className="w-9 h-9 rounded-xl items-center justify-center bg-slate-50">
            <Feather name="bell" size={18} color={colors.slate600} />
          </View>
          {alertCount > 0 && (
            <View className="absolute -top-1 -right-1 min-w-[17px] h-[17px] rounded-full bg-rose-500 border-[1.5px] border-white items-center justify-center px-0.5">
              <Text className="text-white text-[9px] font-extrabold">
                {alertCount > 99 ? '99+' : alertCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
            className="w-9 h-9 rounded-xl bg-brand-800 items-center justify-center"
          >
            <MaterialCommunityIcons name="account" size={20} color={colors.emerald100} />
          </TouchableOpacity>
          {isDesktop && (
            <View>
              <Text className="text-xs font-extrabold text-slate-800">{user?.username ?? 'Guest'}</Text>
              <Text className="text-[11px] font-semibold text-slate-400">{user?.role ?? 'Signed in'}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={logout}
            activeOpacity={0.7}
            className="w-9 h-9 rounded-xl items-center justify-center bg-slate-50"
          >
            <Feather name="log-out" size={16} color={colors.slate600} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
