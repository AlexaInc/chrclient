import { MotionStatus } from '../types/messages';

/**
 * The rover drives around plants instead of stopping at them. The firmware
 * reports what its front-arc planner is doing in `motion.avoidState`; these
 * helpers turn that into the sentences the screens show, so the operator knows
 * whether the rover is going around something, creeping past it, or genuinely
 * stuck (no gap wide enough) - the only case it stops by itself.
 */

/** True while the rover is actively going AROUND something (not stopped). */
export const isAvoiding = (m?: MotionStatus | null): boolean =>
  m?.avoidState === 'steer-left' || m?.avoidState === 'steer-right' ||
  m?.avoidState === 'creep' || m?.avoidState === 'turn-back';

/** True when the arc planner could not find a way past and stopped the rover. */
export const isStuck = (m?: MotionStatus | null): boolean =>
  m?.avoidState === 'no-path' || m?.avoidState === 'emergency' ||
  m?.blockedBy === 'no-path' || m?.blockedBy === 'emergency';

const gapText = (m: MotionStatus): string =>
  m.gapLeftCm != null && m.gapRightCm != null ? `gaps ${m.gapLeftCm} cm left / ${m.gapRightCm} cm right` : '';

const frontText = (m: MotionStatus): string =>
  m.frontCm != null ? `${m.frontCm} cm ahead` : '';

/** One-line description of the manoeuvre, or null when nothing is happening. */
export const describeAvoidState = (m?: MotionStatus | null): string | null => {
  if (!m?.avoidState || m.avoidState === 'clear') return null;
  const details = [frontText(m), gapText(m)].filter(Boolean).join(' · ');
  const suffix = details ? ` (${details})` : '';
  switch (m.avoidState) {
    case 'steer-left':  return `Going around a plant - steering left${suffix}`;
    case 'steer-right': return `Going around a plant - steering right${suffix}`;
    case 'creep':       return `Creeping past a plant at crawl speed${suffix}`;
    case 'turn-back':   return 'Swinging back onto the mission heading';
    case 'no-path':     return `No way past - stopped: no side gap is wide enough to go around${suffix}`;
    case 'emergency':   return 'Emergency stop - something is inside the emergency ring';
    default:            return `Avoiding (${m.avoidState})`;
  }
};

/** Which side the rover is steering to, for the drive pad banner. */
export const avoidSide = (m?: MotionStatus | null): 'left' | 'right' | null =>
  m?.avoidDir === -1 ? 'left' : m?.avoidDir === 1 ? 'right' : null;
