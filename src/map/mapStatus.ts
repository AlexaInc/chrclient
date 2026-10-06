/**
 * What the badge in the corner of a live map says.
 *
 * It exists because of one operator report: when the robot is not connected the
 * map must still show the configured field position — and say that is what it is
 * showing, instead of an empty grey box or a blank corner.
 *
 * Kept in its own file (no React, no react-native) so the rules can be tested
 * directly, like src/utils/version.ts.
 */
export interface MapStatus {
  label: string;
  tone: 'ok' | 'warn';
}

export const MAP_OFFLINE_LABEL = 'DEFAULT POSITION • ROBOT OFFLINE';
export const MAP_NO_FIX_LABEL = 'DEFAULT POSITION • NO GPS FIX';
export const MAP_LIVE_LABEL = 'LIVE GPS';

export function mapStatus(opts: {
  hasFix: boolean;
  isDefault?: boolean;
  statusLabel?: string;
  statusTone?: 'ok' | 'warn';
}): MapStatus {
  if (opts.statusLabel) return { label: opts.statusLabel, tone: opts.statusTone ?? 'ok' };
  if (!opts.hasFix) return { label: MAP_OFFLINE_LABEL, tone: 'warn' };
  if (opts.isDefault) return { label: MAP_NO_FIX_LABEL, tone: 'warn' };
  return { label: MAP_LIVE_LABEL, tone: 'ok' };
}
