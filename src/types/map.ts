// Field map: blocks are polygons mapped to a plant; backend picks the AI model per plant.

export interface FieldBlock {
  id: string;
  name: string;
  plant: string;
  aiModel?: string;
  color?: string;
  polygon: [number, number][]; // [lat, lng] ring, first point != last required
}

export interface FieldMapMessage {
  name: string;
  boundary: [number, number][];
  blocks: FieldBlock[];
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
