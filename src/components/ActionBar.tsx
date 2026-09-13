import React from 'react';
import { View } from 'react-native';
import { PillButton, Row } from './ui';
import ActionFeedback from './ActionFeedback';
import { CommandResponse } from '../types/actions';

export interface ActionBarButton {
  label: string;
  /** label shown while its command is pending */
  pendingLabel?: string;
  onPress: () => void;
  pending?: boolean;
  className: string;
  textClassName: string;
}

interface Props {
  buttons: ActionBarButton[];
  result?: CommandResponse | null;
  className?: string;
}

export default function ActionBar({ buttons, result = null, className = 'mt-3.5' }: Props) {
  return (
    <View className={className}>
      <Row className="gap-2.5 lg:max-w-[560px]">
        {buttons.map((b) => (
          <PillButton
            key={b.label}
            label={b.pending ? b.pendingLabel ?? '…' : b.label}
            onPress={b.onPress}
            className={`flex-1 ${b.className} ${b.pending ? 'opacity-60' : ''}`}
            textClassName={b.textClassName}
          />
        ))}
      </Row>
      <ActionFeedback result={result} />
    </View>
  );
}
