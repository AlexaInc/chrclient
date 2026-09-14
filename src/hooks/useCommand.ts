import { useCallback, useRef, useState } from 'react';
import { CommandResponse } from '../types/actions';

export interface CommandState {
  pending: boolean;
  result: CommandResponse | null;
}


export function useCommand<Args extends unknown[]>(
  fn: (...args: Args) => Promise<CommandResponse>,
  clearAfterMs = 3000,
) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CommandResponse | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    async (...args: Args): Promise<CommandResponse> => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      setPending(true);
      setResult(null);
      const res = await fn(...args);
      setPending(false);
      setResult(res);
      clearTimer.current = setTimeout(() => setResult(null), clearAfterMs);
      return res;
    },
    [fn, clearAfterMs],
  );

  return { run, pending, result };
}
