import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';

// ---- Responsive helpers ----

export const DESKTOP_BP = 1024;

export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BP;
}

/** Page: scroll container that centers content with a max width on desktop */
export function Page({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  return (
    <ScrollView contentContainerStyle={{ padding: isDesktop ? 32 : 16, paddingBottom: 40 }}>
      <View className="w-full max-w-[1120px] self-center">{children}</View>
    </ScrollView>
  );
}

/** CardRail: horizontal scroll rail on mobile, wrapping flex grid on desktop */
export function CardRail({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <View className={`flex-row flex-wrap ${className}`} style={{ gap: 12 }}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={className}
      contentContainerStyle={{ gap: 12 }}
    >
      {children}
    </ScrollView>
  );
}

/** Grid: stacks on mobile, N columns on desktop */
export function Grid({
  children,
  className = '',
  gap = 16,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
}) {
  const isDesktop = useIsDesktop();
  return (
    <View className={`${isDesktop ? 'flex-row flex-wrap items-stretch' : ''} ${className}`} style={{ gap }}>
      {children}
    </View>
  );
}

/** GridItem: full width on mobile, fractional width on desktop */
export function GridItem({
  children,
  span = 1,
  cols = 2,
  gap = 16,
  className = '',
}: {
  children: React.ReactNode;
  span?: number;
  cols?: number;
  gap?: number;
  className?: string;
}) {
  const isDesktop = useIsDesktop();
  const pct = (span / cols) * 100;
  return (
    <View
      className={className}
      style={isDesktop ? { flexGrow: 1, flexBasis: `${pct}%`, maxWidth: '100%', minWidth: 280, flex: span } : undefined}
    >
      {children}
    </View>
  );
}

// ---- UI primitives ----

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={`bg-white rounded-2xl border border-slate-100 p-4 ${className}`}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <Text className={`text-xs font-extrabold text-slate-700 tracking-wide ${className}`}>
      {children}
    </Text>
  );
}

export function Badge({
  label,
  className = '',
  textClassName = '',
  dotClassName,
}: {
  label: string;
  className?: string;
  textClassName?: string;
  dotClassName?: string;
}) {
  return (
    <View className={`flex-row items-center rounded-full px-2.5 py-1 self-start ${className}`}>
      {dotClassName ? <View className={`w-2 h-2 rounded-full mr-1.5 ${dotClassName}`} /> : null}
      <Text className={`text-[11px] font-extrabold ${textClassName}`}>{label}</Text>
    </View>
  );
}

export function IconBox({
  children,
  className = '',
  size = 40,
}: {
  children: React.ReactNode;
  className?: string;
  size?: number;
}) {
  return (
    <View
      className={`rounded-xl items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
    </View>
  );
}

export function Row({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <View className={`flex-row items-center ${className}`}>{children}</View>;
}

export function PillButton({
  label,
  onPress,
  className = '',
  textClassName = '',
}: {
  label: string;
  onPress?: () => void;
  className?: string;
  textClassName?: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className={`rounded-lg py-2.5 px-4 items-center justify-center ${className}`}
    >
      <Text className={`text-xs font-extrabold ${textClassName}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ProgressBar({
  value,
  barClassName,
  trackClassName = 'bg-slate-100',
  height = 8,
}: {
  value: number;
  barClassName: string;
  trackClassName?: string;
  height?: number;
}) {
  return (
    <View className={`overflow-hidden rounded-full ${trackClassName}`} style={{ height }}>
      <View
        className={`h-full rounded-full ${barClassName}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </View>
  );
}
