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
        result.success ? 'text-brand-700 dark:text-brand-300' : 'text-rose-600 dark:text-rose-400'
      } ${className}`}
    >
      {result.success
        ? `✓ ${result.message ?? 'Command accepted'}`
        : `✕ ${result.reason ?? 'Command failed'}`}
    </Text>
  );
}
