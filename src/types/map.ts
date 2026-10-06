// Field map: blocks are polygons mapped to a plant; backend picks the AI model per plant.

/**
 * A place inside a block where the robot must come to a real stop: a row end, a
 * gate, a water point, a sick-plant spot… The operator marks these while mapping
 * (from the robot's GPS, the phone's GPS or straight on the map) and they are
 * stored with the block, so re-mapping a block never loses them.
 */
export interface StopPoint {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  /** the order the robot should visit them in (1-based when set) */
  order?: number;
}

export interface FieldBlock {
  id: string;
  name: string;
  plant: string;
  aiModel?: string;
  color?: string;
  polygon: [number, number][]; // [lat, lng] ring
  rowSpacingM?: number;
  scanSpacingM?: number;
  headingDeg?: number;
  /** places the robot stops at inside this block (kept across re-mapping) */
  stopPoints?: StopPoint[];
}

export interface FieldMapMessage {
  name: string;
  boundary: [number, number][];
  blocks: FieldBlock[];
  base?: { latitude: number; longitude: number; name?: string };
}

export interface UltrasonicMessage {
  distances_cm: number[];
}

// Ray-casting point-in-polygon on [lat,lng] rings.
export function blockAt(map: FieldMapMessage | null, lat: number, lng: number): FieldBlock | null {
  if (!map) return null;
  for (const b of map.blocks) {
    let inside = false;
    const ring = b.polygon;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i];
      const [yj, xj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return b;
  }
  return null;
}
