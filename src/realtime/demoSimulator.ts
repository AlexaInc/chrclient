import { RealtimeEnvelope } from '../types/messages';


export function startDemoSimulator(
  emit: (envelope: RealtimeEnvelope) => void,
): () => void {
  // --- rover state -------------------------------------------------
  const base = { lat: 6.9271, lng: 79.8612 };
  // rectangular field ~120m x 80m, rover sweeps rows
  let t = 0;
  let battery = 82;
  let solar = 90;
  let row = 14;
  const totalRows = 18;
  let distanceKm = 6.8;
  let soil = 62;
  let temp = 28;
  let health = 87;
  let pests = 2;

  const alerts: { severity: 'info' | 'warning' | 'critical'; title: string; description: string }[] = [
    { severity: 'info', title: 'Crop scan completed', description: 'Tomato Field — Block A' },
    { severity: 'warning', title: 'Irrigation recommended', description: 'Soil moisture is low in Block B' },
    { severity: 'warning', title: 'Pest detected', description: 'Aphids detected in Block C' },
    { severity: 'info', title: 'Waypoint reached', description: 'Pivot waypoint #15-A' },
  ];
  let alertIdx = 0;

  const jitter = (amp: number) => (Math.random() - 0.5) * amp;

  function position(tick: number) {
    // serpentine sweep: x goes back and forth, y steps per row
    const rowLenTicks = 40;
    const rowIdx = Math.floor(tick / rowLenTicks);
    const along = (tick % rowLenTicks) / rowLenTicks;
    const dir = rowIdx % 2 === 0 ? along : 1 - along;
    const dLat = (rowIdx % totalRows) * 0.00004; // ~4.4m row spacing
    const dLng = dir * 0.0011; // ~120m row length
    return {
      latitude: +(base.lat + dLat + jitter(0.000004)).toFixed(6),
      longitude: +(base.lng + dLng + jitter(0.000004)).toFixed(6),
    };
  }

  // field map: sent once so blocks render like a real server push
  const { DEMO_FIELD } = require('../map/demoField') as typeof import('../map/demoField');
  emit({ Type: 'map', Message: DEMO_FIELD });

  const timer = setInterval(() => {
    t += 1;

    // ultrasonic: every tick, 5 sensors
    emit({
      Type: 'ultrasonic',
      Message: { distances_cm: Array.from({ length: 5 }, () => +(40 + Math.random() * 260).toFixed(1)) },
    });

    // location: every tick (1.5s)
    const { latitude, longitude } = position(t);
    emit({
      Type: 'location',
      Message: {
        latitude,
        longitude,
        altitude: +(15.4 + jitter(0.6)).toFixed(1),
        satellites: 7 + Math.floor(Math.random() * 4), // 7–10
      },
    });

    // telemetry: every 2nd tick
    if (t % 2 === 0) {
      distanceKm += 0.002;
      const progress = Math.min(99, 78 + t / 60);
      emit({
        Type: 'telemetry',
        Message: {
          speed: +(1.4 + jitter(0.3)).toFixed(2),
          heading: Math.round((42 + t * 1.3) % 360),
          pitch: +(1.4 + jitter(0.8)).toFixed(1),
          routeProgress: Math.round(progress),
          distanceKm: +distanceKm.toFixed(2),
          rowsDone: row,
          rowsTotal: totalRows,
        },
      });
    }

    // battery: every 4th tick
    if (t % 4 === 0) {
      battery = Math.max(20, battery - 0.05);
      solar = Math.max(40, Math.min(120, solar + jitter(8)));
      emit({
        Type: 'battery',
        Message: {
          level: Math.round(battery),
          voltage: +(3.7 + (battery / 100) * 0.5).toFixed(2),
          charging: false,
          solarWatts: Math.round(solar),
          minutesRemaining: Math.round(battery * 3.1),
        },
      });
    }

    // sensors: every 3rd tick
    if (t % 3 === 0) {
      soil = Math.max(35, Math.min(80, soil + jitter(1.5)));
      temp = Math.max(24, Math.min(33, temp + jitter(0.4)));
      health = Math.max(70, Math.min(97, health + jitter(1)));
      emit({
        Type: 'sensors',
        Message: {
          soilMoisture: Math.round(soil),
          temperature: +temp.toFixed(1),
          humidity: Math.round(68 + jitter(6)),
          cropHealth: Math.round(health),
          pestAlerts: pests,
        },
      });
    }

    // status: every 8th tick
    if (t % 8 === 0) {
      if (t % 80 === 0 && row < totalRows) row += 1;
      emit({
        Type: 'status',
        Message: {
          state: 'patrolling',
          mode: 'Autonomous Weeding',
          currentRow: row,
          totalRows,
          firmware: 'v4.8.2-AgOS',
          message: `Patrolling • Row #${row}`,
        },
      });
    }

    // alert: every ~20th tick
    if (t % 20 === 0) {
      const a = alerts[alertIdx % alerts.length];
      alertIdx += 1;
      if (a.title === 'Pest detected') pests += 1;
      emit({
        Type: 'alert',
        Message: { ...a, timestamp: Date.now() },
      });
    }
  }, 1500);

  return () => clearInterval(timer);
}
