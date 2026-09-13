import React from 'react';
import { Text } from 'react-native';
import { Card, CardRail, IconBox } from './ui';

export interface KpiItem {
  label: string;
  value: string;
  sub?: string;
  note?: string;
  iconBg: string;
  icon: React.ReactNode;
}

interface Props {
  items: KpiItem[];
  /** mobile card width class, e.g. 'w-[190px]' */
  cardWidth?: string;
  className?: string;
}

/**
 * Horizontal KPI card rail used at the top of every screen
 * (rail on mobile, equal-width row on desktop).
 */
export default function KpiRail({ items, cardWidth = 'w-[190px]', className = 'mt-4' }: Props) {
  return (
    <CardRail className={className}>
      {items.map((k) => (
        <Card key={k.label} className={`${cardWidth} lg:w-auto lg:flex-1 lg:min-w-[190px]`}>
          <IconBox className={k.iconBg} size={36}>
            {k.icon}
          </IconBox>
          <Text className="text-[10px] font-extrabold text-slate-400 mt-2.5 tracking-wide">
            {k.label}
          </Text>
          <Text className="text-[17px] font-extrabold text-slate-900 mt-0.5">{k.value}</Text>
          {k.sub != null && (
            <Text className="text-[11px] font-bold text-brand-700 mt-1">{k.sub}</Text>
          )}
          {k.note != null && <Text className="text-[10px] text-slate-400 mt-0.5">{k.note}</Text>}
        </Card>
      ))}
    </CardRail>
  );
}
