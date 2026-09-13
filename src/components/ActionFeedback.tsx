import React from 'react';
import { Text } from 'react-native';
import { CommandResponse } from '../types/actions';


export default function ActionFeedback({
  result,
  className = '',
}: {
  result: CommandResponse | null;
  className?: string;
}) {
  if (!result) return null;
  return (
    <Text
      className={`text-[11px] font-bold mt-2 ${
        result.success ? 'text-brand-700' : 'text-rose-600'
      } ${className}`}
    >
      {result.success
        ? `✓ ${result.message ?? 'Command accepted'}`
        : `✕ ${result.reason ?? 'Command failed'}`}
    </Text>
  );
}
