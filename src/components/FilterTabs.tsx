import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';

interface Props {
  tabs: string[];
  active: number;
  onSelect: (index: number) => void;
  activeClassName?: string;
  className?: string;
}

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
            i === active ? activeClassName : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
          }`}
        >
          <Text className={`text-[11px] font-bold ${i === active ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
            {t}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
