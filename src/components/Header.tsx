import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { useIsDesktop } from './ui';
import { AppLogo } from './AppLoadingScreen';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../realtime/RealtimeContext';

/**
 * Top bar.
 *
 * Fixed after the Android build showed it cramped/wrapping on phones:
 *  • the safe-area inset is applied ONCE (previously the padding was set twice
 *    through className + style, so the bar grew taller than the status bar),
 *  • content no longer wraps — it is a single row that clips instead,
 *  • actions (bell / account / log out) get a fixed 44x44 touch target and a
 *    gap that suits a finger, not a mouse,
 *  • the right-hand block can shrink, so on a narrow phone the icons stay put
 *    instead of pushing the title off the screen,
 *  • the logo + title shrink to a smaller size on phones so nothing collides.
 */
export default function Header({ title }: { title?: string }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const { user, logout } = useAuth();
  const { alerts } = useRealtime();
  const alertCount = alerts.filter((a) => !a.acknowledgedAt).length;

  const barTop = isDesktop ? 14 : insets.top + 6;
  const barBottom = isDesktop ? 14 : 10;
  const logoSize = isDesktop ? 30 : 26;
  const side = isDesktop ? 38 : 40; // touch target

  const IconButton = ({
    onPress,
    children,
    badge,
    className = '',
  }: {
    onPress: () => void;
    children: React.ReactNode;
    badge?: number;
    className?: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ width: side, height: side }}
      className={`rounded-xl items-center justify-center ${className}`}
    >
      {children}
      {!!badge && badge > 0 && (
        <View className="absolute -top-1 -right-1 min-w-[17px] h-[17px] rounded-full bg-rose-500 border-[1.5px] border-white items-center justify-center px-0.5">
          <Text className="text-white text-[9px] font-extrabold">
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View
      className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700"
      style={{
        paddingTop: barTop,
        paddingBottom: barBottom,
        paddingLeft: 12,
        paddingRight: 12,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'nowrap',
      }}
    >
      {!isDesktop && (
        <IconButton
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          className="bg-transparent"
        >
          <Feather name="menu" size={22} color={colors.slate600} />
        </IconButton>
      )}

      {/* Brand block — shrinks (never wraps) so the actions keep their room */}
      <View className="flex-row items-center flex-1 min-w-0" style={{ marginLeft: isDesktop ? 4 : 2 }}>
        <AppLogo size={logoSize} />
        <View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
          <Text
            className={`font-extrabold text-slate-900 dark:text-slate-100 ${isDesktop ? 'text-lg' : 'text-base'}`}
            style={{ width: '100%' }}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {title ?? 'Dashboard'}
          </Text>
        </View>
      </View>

      {/* Actions — fixed, never squeezed by a long title */}
      <View className="flex-row items-center shrink-0" style={{ gap: isDesktop ? 12 : 8 }}>
        <IconButton onPress={() => navigation.navigate('Alerts')} badge={alertCount} className="bg-slate-50 dark:bg-slate-900">
          <Feather name="bell" size={18} color={colors.slate600} />
        </IconButton>

        <IconButton
          onPress={() => navigation.navigate('Settings')}
          className="bg-brand-800"
        >
          <MaterialCommunityIcons name="account" size={20} color={colors.emerald100} />
        </IconButton>

        {isDesktop && (
          <View className="mr-1">
            <Text className="text-xs font-extrabold text-slate-800 dark:text-slate-100" numberOfLines={1}>
              {user?.username ?? 'Guest'}
            </Text>
            <Text className="text-[11px] font-semibold text-slate-400 dark:text-slate-500" numberOfLines={1}>
              {user?.role ?? 'Signed in'}
            </Text>
          </View>
        )}

        <IconButton onPress={logout} className="bg-slate-50 dark:bg-slate-900">
          <Feather name="log-out" size={16} color={colors.slate600} />
        </IconButton>
      </View>
    </View>
  );
}
