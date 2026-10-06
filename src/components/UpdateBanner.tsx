import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUpdate } from '../state/Update';
import { Row, useIsDesktop } from './ui';

/**
 * The "new version available" notice.
 *
 * It floats above whatever screen is open, because the operator is usually
 * standing in the field looking at the robot controls — an update notice buried
 * in Settings would never be seen. It disappears as soon as the app installs
 * the update (Android) or reloads (web); "LATER" hides it for that release only.
 */
export default function UpdateBanner() {
  const { notice, dismiss, install, status, latest } = useUpdate();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();

  if (!notice) return null;

  const isWeb = Platform.OS === 'web';
  const installing = status === 'installing';
  const actionLabel = isWeb ? 'RELOAD NOW' : 'UPDATE NOW';

  return (
    <View
      className="absolute z-50"
      style={{
        top: insets.top + (isDesktop ? 10 : 6),
        left: isDesktop ? 276 : 10,
        right: 10,
      }}
      pointerEvents="box-none"
    >
      <View className="bg-slate-900 dark:bg-slate-800 rounded-xl border border-brand-500 px-3 py-2.5 flex-row items-center shadow-lg">
        <View className="w-8 h-8 rounded-lg bg-brand-600 items-center justify-center">
          <Feather name={installing ? 'download-cloud' : 'arrow-down-circle'} size={17} color="#ffffff" />
        </View>
        <View className="flex-1 ml-2.5 mr-2">
          <Text className="text-[11px] font-extrabold text-white" numberOfLines={2}>
            {installing ? 'INSTALLING NEW VERSION…' : `NEW VERSION AVAILABLE${latest ? ` — ${latest.tag}` : ''}`}
          </Text>
          <Text className="text-[10px] text-slate-300 dark:text-slate-400 mt-0.5" numberOfLines={2}>
            {notice}
          </Text>
        </View>
        <Row>
          <TouchableOpacity onPress={() => void install()} className="bg-brand-600 rounded-lg px-3 py-2 mr-1.5">
            <Text className="text-[10px] font-extrabold text-white">{installing ? 'WORKING…' : actionLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={dismiss} className="bg-white/10 rounded-lg px-2.5 py-2">
            <Text className="text-[10px] font-extrabold text-slate-200 dark:text-slate-200">LATER</Text>
          </TouchableOpacity>
        </Row>
      </View>
    </View>
  );
}
