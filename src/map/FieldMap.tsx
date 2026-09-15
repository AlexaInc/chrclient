import React, { useMemo } from 'react';
import { View, Text, Pressable, GestureResponderEvent } from 'react-native';
import Svg, { Circle, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { FieldBlock, FieldMapMessage } from '../types/map';
import { LocationMessage } from '../types/messages';

interface Props {
  map: FieldMapMessage;
  location: LocationMessage | null;
  trail?: LocationMessage[];
  currentBlock?: FieldBlock | null;
  height?: number;
  width: number;
  selectedBlockId?: string | null;
  onSelectBlock?: (block: FieldBlock) => void;
  draftPoints?: [number, number][];
  onTapPoint?: (lat: number, lng: number) => void;
}

const M_PER_DEG_LAT = 111320;
const PAD = 14;

/* Projection = { toXY(lat,lng): {x,y}, toLatLng(x,y): [lat,lng] } */
function useProjection(map: FieldMapMessage, width: number, height: number) {
  return useMemo(() => {
    const pts = [...map.boundary, ...map.blocks.flatMap((b) => b.polygon)];
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    const latMin = Math.min(...lats), latMax = Math.max(...lats);
    const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
    const mLng = M_PER_DEG_LAT * Math.cos((((latMin + latMax) / 2) * Math.PI) / 180);
    const w = (lngMax - lngMin) * mLng || 1;
    const h = (latMax - latMin) * M_PER_DEG_LAT || 1;
    const scale = Math.min((width - 2 * PAD) / w, (height - 2 * PAD) / h);
    const ox = (width - w * scale) / 2;
    const oy = (height - h * scale) / 2;
    return {
      toXY: (lat: number, lng: number) => ({
        x: ox + (lng - lngMin) * mLng * scale,
        y: oy + (latMax - lat) * M_PER_DEG_LAT * scale,
      }),
      toLatLng: (x: number, y: number): [number, number] => [
        latMax - (y - oy) / (M_PER_DEG_LAT * scale),
        lngMin + (x - ox) / (mLng * scale),
      ],
    };
  }, [map, width, height]);
}

export default function FieldMap({
  map, location, trail = [], currentBlock, height = 260, width,
  selectedBlockId, onSelectBlock, draftPoints = [], onTapPoint,
}: Props) {
  const proj = useProjection(map, width, height);
  const ring = (poly: [number, number][]) =>
    poly.map(([la, ln]) => { const p = proj.toXY(la, ln); return `${p.x},${p.y}`; }).join(' ');
  const centroid = (poly: [number, number][]) => {
    const la = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const ln = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    return proj.toXY(la, ln);
  };
  const rover = location ? proj.toXY(location.latitude, location.longitude) : null;

  const handleTap = (e: GestureResponderEvent) => {
    if (!onTapPoint) return;
    const { locationX, locationY } = e.nativeEvent;
    const [la, ln] = proj.toLatLng(locationX, locationY);
    onTapPoint(+la.toFixed(6), +ln.toFixed(6));
  };

  return (
    <View className="rounded-xl overflow-hidden border border-slate-200 bg-emerald-50/40" style={{ width, height }}>
      <Pressable onPress={handleTap} disabled={!onTapPoint}>
        <Svg width={width} height={height}>
          <Polygon points={ring(map.boundary)} fill="#f0fdf4" stroke="#043622" strokeWidth={2} />
          {map.blocks.map((b) => {
            const highlight = currentBlock?.id === b.id || selectedBlockId === b.id;
            const c = b.color ?? '#22c55e';
            return (
              <Polygon
                key={b.id}
                points={ring(b.polygon)}
                fill={c + (highlight ? '88' : '40')}
                stroke={c}
                strokeWidth={highlight ? 3 : 1.5}
                onPress={onTapPoint ? undefined : () => onSelectBlock?.(b)}
              />
            );
          })}
          {map.blocks.map((b) => {
            const c = centroid(b.polygon);
            return (
              <SvgText key={b.id + '-t'} x={c.x} y={c.y} fontSize={10} fontWeight="bold"
                fill="#043622" textAnchor="middle">
                {`${b.name} • ${b.plant}`}
              </SvgText>
            );
          })}
          {trail.length > 1 && (
            <Polyline
              points={trail.map((t) => { const p = proj.toXY(t.latitude, t.longitude); return `${p.x},${p.y}`; }).join(' ')}
              fill="none" stroke="#10b981" strokeWidth={2} opacity={0.7}
            />
          )}
          {draftPoints.length > 0 && (
            <>
              <Polygon points={ring(draftPoints)} fill="#f59e0b33" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5,4" />
              {draftPoints.map((p, i) => {
                const q = proj.toXY(p[0], p[1]);
                return <Circle key={i} cx={q.x} cy={q.y} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />;
              })}
            </>
          )}
          {rover && (
            <>
              <Circle cx={rover.x} cy={rover.y} r={10} fill="#10b98133" />
              <Circle cx={rover.x} cy={rover.y} r={5.5} fill="#10b981" stroke="#fff" strokeWidth={2} />
            </>
          )}
        </Svg>
      </Pressable>
      <View className="absolute bottom-1.5 left-2" pointerEvents="none">
        <Text className="text-[9px] font-extrabold text-emerald-900/70">
          {map.name}{currentBlock ? ` • IN ${currentBlock.name.toUpperCase()} (${currentBlock.plant})` : ''}
        </Text>
      </View>
    </View>
  );
}
