import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { colors } from '../theme';

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

export function Sparkline({
  points,
  color,
  width = 140,
  height = 34,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const { d, xy } = buildPath(points, width, height);
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={2} fill="none" />
      {xy.map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={3} fill={color} />
      ))}
    </Svg>
  );
}

export function LineChart({
  series,
  width,
  height = 200,
  yLabels = ['100', '75', '50', '25', '0'],
  xLabels,
}: {
  series: { points: number[]; color: string }[];
  width: number;
  height?: number;
  yLabels?: string[];
  xLabels?: string[];
}) {
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
          <Line key={i} x1={padL} y1={y} x2={width - padR} y2={y} stroke={colors.slate100} strokeWidth={1} />
        ))}
        {series.map((s, si) => {
          const min = 0;
          const max = 100;
          const xy: [number, number][] = s.points.map((p, i) => [
            padL + 8 + (i * (chartW - 16)) / (s.points.length - 1),
            padT + chartH - ((p - min) / (max - min)) * chartH,
          ]);
          const d = xy.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
          return (
            <React.Fragment key={si}>
              <Path d={d} stroke={s.color} strokeWidth={2.5} fill="none" />
              {xy.map(([x, y], i) => (
                <Circle key={i} cx={x} cy={y} r={4} fill={s.color} />
              ))}
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
            <Text key={i} className="text-[10px] font-bold text-slate-500">
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
            <Text key={i} className="flex-1 text-center text-[9px] font-bold text-slate-500">
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
