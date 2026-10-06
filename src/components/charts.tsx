import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { colors } from '../theme';
import { usePreferencesOptional } from '../state/Preferences';

/** Catmull-Rom → cubic bezier: a smooth curve through every sample point. */
function smoothPath(xy: [number, number][]): string {
  if (xy.length < 3) return xy.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  let d = `M ${xy[0][0]} ${xy[0][1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] ?? xy[i];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function buildPath(points: number[], w: number, h: number, pad = 6): { d: string; xy: [number, number][] } {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xy: [number, number][] = points.map((p, i) => [
    pad + (i * (w - pad * 2)) / (points.length - 1),
    h - pad - ((p - min) / range) * (h - pad * 2),
  ]);
  const d = xy.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  return { d, xy };
}

/**
 * The per-graph switch for the sample markers.
 *
 * Every plot graph of the app carries one, so the operator can see the dots
 * they need without hunting through a settings page; the choice is shared by
 * every graph and remembered on the device. Default is OFF (smooth line).
 */
export function GraphDotsToggle({ label = 'DOTS' }: { label?: string }) {
  const prefs = usePreferencesOptional();
  if (!prefs) return null;
  const on = prefs.graphDots;
  return (
    <TouchableOpacity
      onPress={prefs.toggleGraphDots}
      activeOpacity={0.8}
      className={`flex-row items-center border rounded-lg px-2 py-1 ${
        on ? 'border-brand-500 dark:border-brand-500 bg-brand-50 dark:bg-brand-900/40' : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <Feather name={on ? 'check-square' : 'square'} size={11} color={on ? colors.emerald600 : colors.slate400} />
      <Text
        className={`text-[9px] font-extrabold ml-1 ${
          on ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Plot-graph defaults: smooth line, no dots — unless the device preference
 *  says otherwise. Used by the screens so every chart behaves the same way. */
export function useGraphStyle(): { showDots: boolean; smooth: boolean } {
  const prefs = usePreferencesOptional();
  return { showDots: prefs?.graphDots ?? false, smooth: true };
}

export function Sparkline({
  points,
  color,
  width = 140,
  height = 34,
  showDots,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
  /** marker on every sample — follows the device preference when omitted
   *  (dots OFF by default: the default plot is a smooth line) */
  showDots?: boolean;
}) {
  const prefs = usePreferencesOptional();
  const dots = showDots ?? prefs?.graphDots ?? false;
  const { d, xy } = buildPath(points, width, height);
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={2} fill="none" />
      {dots && xy.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={3} fill={color} />)}
    </Svg>
  );
}

export function LineChart({
  series,
  width,
  height = 200,
  yLabels = ['100', '75', '50', '25', '0'],
  xLabels,
  showDots,
  smooth = true,
}: {
  series: { points: number[]; color: string }[];
  width: number;
  height?: number;
  yLabels?: string[];
  xLabels?: string[];
  /** marker on every sample — the operator asked for this to be a toggle, with
   *  the smooth line as the default view. Omit it and the device preference wins. */
  showDots?: boolean;
  /** bend the line between samples instead of drawing straight segments
   *  (default TRUE — the default view is a smooth graph) */
  smooth?: boolean;
}) {
  const prefs = usePreferencesOptional();
  const dots = showDots ?? prefs?.graphDots ?? false;
  // grid lines follow the theme: a light grey grid is unreadable on a dark canvas
  const grid = prefs?.darkMode ? colors.slate700 : colors.slate100;
  const padL = 28;
  const padR = 8;
  const padT = 10;
  const padB = xLabels ? 24 : 10;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const gridYs = yLabels.map((_, i) => padT + (i * chartH) / (yLabels.length - 1));

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {gridYs.map((y, i) => (
          <Line key={i} x1={padL} y1={y} x2={width - padR} y2={y} stroke={grid} strokeWidth={1} />
        ))}
        {series.map((s, si) => {
          const min = 0;
          const max = 100;
          const xy: [number, number][] = s.points.map((p, i) => [
            padL + 8 + (i * (chartW - 16)) / (s.points.length - 1),
            padT + chartH - ((p - min) / (max - min)) * chartH,
          ]);
          const d =
            smooth && xy.length > 2
              ? smoothPath(xy)
              : xy.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
          return (
            <React.Fragment key={si}>
              <Path d={d} stroke={s.color} strokeWidth={2.5} fill="none" />
              {dots && xy.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={4} fill={s.color} />)}
            </React.Fragment>
          );
        })}
      </Svg>
      {/* Y labels */}
      {yLabels.map((l, i) => (
        <Text
          key={i}
          className="absolute left-0 text-[10px] font-bold text-slate-400"
          style={{ top: gridYs[i] - 7 }}
        >
          {l}
        </Text>
      ))}
      {xLabels ? (
        <View
          className="absolute bottom-0 flex-row justify-between"
          style={{ left: padL, right: padR }}
        >
          {xLabels.map((l, i) => (
            <Text key={i} className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {l}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function BarChart({
  bars,
  width,
  height = 180,
  color = colors.emerald500,
  labels,
}: {
  bars: number[];
  width: number;
  height?: number;
  color?: string;
  labels?: string[];
}) {
  const padB = labels ? 22 : 6;
  const chartH = height - padB - 6;
  const gap = 10;
  const barW = (width - gap * (bars.length + 1)) / bars.length;
  const max = Math.max(...bars) || 1;
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {bars.map((b, i) => {
          const h = (b / max) * chartH;
          return (
            <Rect
              key={i}
              x={gap + i * (barW + gap)}
              y={6 + chartH - h}
              width={barW}
              height={h}
              rx={4}
              fill={color}
              opacity={0.5 + 0.5 * (b / max)}
            />
          );
        })}
      </Svg>
      {labels ? (
        <View className="absolute bottom-0 left-0 right-0 flex-row">
          {labels.map((l, i) => (
            <Text key={i} className="flex-1 text-center text-[9px] font-bold text-slate-500 dark:text-slate-400">
              {l}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Measures its own width and renders the chart via render-prop — makes charts responsive on any screen */
export function AutoWidth({
  children,
  minHeight = 0,
}: {
  children: (width: number) => React.ReactNode;
  minHeight?: number;
}) {
  const [w, setW] = React.useState(0);
  return (
    <View style={{ width: '100%', minHeight }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? children(w) : null}
    </View>
  );
}
