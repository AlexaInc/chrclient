import React from 'react';
import { Text } from 'react-native';
import { Badge, Row } from './ui';

export interface IntroBadge {
  label: string;
  className?: string;
  textClassName?: string;
  dotClassName?: string;
}

interface Props {
  /** small badges shown above the title */
  badges?: IntroBadge[];
  title: string;
  subtitle?: string;
  /** tiny eyebrow line above the title (e.g. mission id) */
  eyebrow?: string;
}

/** Standard screen heading: badges + title + subtitle, same on all screens. */
export default function ScreenIntro({ badges, title, subtitle, eyebrow }: Props) {
  return (
    <>
      {badges && badges.length > 0 && (
        <Row className="gap-2 flex-wrap">
          {badges.map((b) => (
            <Badge
              key={b.label}
              label={b.label}
              className={b.className ?? 'bg-brand-50'}
              textClassName={b.textClassName ?? 'text-brand-700'}
              dotClassName={b.dotClassName}
            />
          ))}
        </Row>
      )}
      {eyebrow && (
        <Text className="text-[10px] font-extrabold text-brand-700 tracking-wider mt-1">
          {eyebrow}
        </Text>
      )}
      <Text className="text-[22px] font-extrabold text-slate-900 mt-3">{title}</Text>
      {subtitle && (
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">{subtitle}</Text>
      )}
    </>
  );
}
