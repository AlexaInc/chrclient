import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';

interface Props {
  tabs: string[];
  active: number;
  onSelect: (index: number) => void;
  /** active pill color classes */
  activeClassName?: string;
  className?: string;
}

/**
 * Horizontal filter/tab pill row (channels, crop tabs, layers, sections…).
 * `onSelect` receives the tapped index — screens combine it with a command
 * (e.g. setCameraChannel) and local state.
 */
export default function FilterTabs({
  tabs,
  active,
  onSelect,
  activeClassName = 'bg-brand-600 border-brand-600',
  className = 'mt-2.5',
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={className}
      contentContainerStyle={{ gap: 8 }}
    >
      {tabs.map((t, i) => (
        <TouchableOpacity
          key={t}
          onPress={() => onSelect(i)}
          activeOpacity={0.8}
          className={`px-3 py-[7px] rounded-lg border ${
            i === active ? activeClassName : 'bg-slate-50 border-slate-200'
          }`}
        >
          <Text className={`text-[11px] font-bold ${i === active ? 'text-white' : 'text-slate-600'}`}>
            {t}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
