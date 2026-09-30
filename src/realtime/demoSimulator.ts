import { RealtimeEnvelope } from '../types/messages';

/** Demo/demo login: no server, no robot. Feeds fabricated envelopes that
 *  match EXACTLY what the real chrserver emits, so every screen renders
 *  identically to a real connected session. Only the 4 real robot sensor
 *  sources are simulated (raindrop/temperature, camera photos, GPS) plus
 *  the pump's own soil-moisture reading — nothing fantasy. */
export function startDemoSimulator(
  emit: (envelope: RealtimeEnvelope) => void,
): () => void {
  const base = { lat: 6.9271, lng: 79.8612 };
  let t = 0;
  let row = 14;
  const totalRows = 18;
  let soil = 46;
  let temp = 28;
  let humidity = 64;
  let missionActive = false;
  let waypointIdx = 0;
  const totalWaypoints = 24;
  let scanCount = 0;

  const jitter = (amp: number) => (Math.random() - 0.5) * amp;

  function position(tick: number) {
    const rowLenTicks = 40;
    const rowIdx = Math.floor(tick / rowLenTicks);
    const along = (tick % rowLenTicks) / rowLenTicks;
    const dir = rowIdx % 2 === 0 ? along : 1 - along;
    const dLat = (rowIdx % totalRows) * 0.00004;
    const dLng = dir * 0.0011;
    return {
      latitude: +(base.lat + dLat + jitter(0.000004)).toFixed(6),
      longitude: +(base.lng + dLng + jitter(0.000004)).toFixed(6),
    };
  }

  // field map: sent once so blocks render like a real server push
  const { DEMO_FIELD } = require('../map/demoField') as typeof import('../map/demoField');
  emit({ Type: 'map', Message: DEMO_FIELD });

  // devices come online immediately, like a real connected fleet
  emit({ Type: 'device', Message: { deviceId: 'robot-01', role: 'esp_32', online: true, lastSeen: Date.now() } });
  emit({ Type: 'device', Message: { deviceId: 'pump-01', role: 'esp_c3_pump', online: true, lastSeen: Date.now() } });
  emit({
    Type: 'status',
    Message: { state: 'patrolling', mode: 'autonomous', missionId: 'demo-mission', currentWaypoint: 0, totalWaypoints, progress: 0 },
  });

  const timer = setInterval(() => {
    t += 1;

    // ultrasonic: every tick (3 sensors: front/left/right)
    emit({
      Type: 'ultrasonic',
      Message: { distances_cm: [1, 2, 3].map(() => +(40 + Math.random() * 260).toFixed(1)) },
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
        deviceId: 'robot-01',
      },
    });

    // sensors: every 3rd tick — the 4 real robot sources only (raindrop, temp; plus GPS/photos handled elsewhere)
    if (t % 3 === 0) {
      temp = Math.max(24, Math.min(33, temp + jitter(0.4)));
      humidity = Math.max(50, Math.min(80, humidity + jitter(2)));
      const isRaining = Math.random() < 0.03;
      emit({
        Type: 'sensors',
        Message: {
          temperature: +temp.toFixed(1),
          humidity: Math.round(humidity),
          rainDrop: isRaining ? Math.round(60 + Math.random() * 30) : Math.round(Math.random() * 8),
          isRaining,
          distForward: Math.round(80 + Math.random() * 150),
          distLeft: Math.round(60 + Math.random() * 150),
          distRight: Math.round(60 + Math.random() * 150),
          blockId: 'block-a',
          plant: 'tomato',
          deviceId: 'robot-01',
        },
      });
    }

    // irrigation (pump controller): every 4th tick — the ONLY legit soil-moisture source
    if (t % 4 === 0) {
      soil = Math.max(15, Math.min(75, soil + jitter(2)));
      const pumpOn = soil < 30;
      emit({
        Type: 'irrigation',
        Message: {
          deviceId: 'pump-01',
          pumpOn,
          autoMode: true,
          soilMoisture: Math.round(soil),
          threshold: 35,
          activeBlockId: pumpOn ? 'block-a' : null,
          remainingSeconds: pumpOn ? Math.round(30 + Math.random() * 60) : 0,
          lastSeen: Date.now(),
        },
      });
    }

    // mission progress: every 8th tick
    if (t % 8 === 0) {
      missionActive = true;
      waypointIdx = Math.min(totalWaypoints, waypointIdx + 1);
      if (waypointIdx % 80 === 0 && row < totalRows) row += 1;
      const progress = Math.round((waypointIdx / totalWaypoints) * 100);
      emit({
        Type: 'mission_progress',
        Message: {
          missionId: 'demo-mission',
          patrolId: 1,
          state: 'running',
          currentWaypoint: waypointIdx,
          totalWaypoints,
          progress,
          message: `Patrolling • Waypoint ${waypointIdx}/${totalWaypoints}`,
        },
      });
      emit({
        Type: 'status',
        Message: { state: 'patrolling', mode: 'autonomous', missionId: 'demo-mission', currentWaypoint: waypointIdx, totalWaypoints, progress },
      });

      if (waypointIdx >= totalWaypoints) {
        // mission complete → auto report, exactly like the real server
        emit({
          Type: 'mission_complete',
          Message: { missionId: 'demo-mission', patrolId: 1, state: 'completed', currentWaypoint: totalWaypoints, totalWaypoints, progress: 100, message: 'Demo patrol completed' },
        });
        emit({
          Type: 'report',
          Message: {
            id: 1,
            missionId: 'demo-mission',
            report: {
              missionId: 'demo-mission',
              patrolId: 1,
              imageCount: 6,
              blocks: ['block-a', 'block-b'],
              averages: [
                { className: 'healthy', averageConfidence: 0.71, samples: 4 },
                { className: 'tomato_early_blight', averageConfidence: 0.42, samples: 2 },
              ],
              scans: [],
              completedAt: Date.now(),
            },
          },
        });
        emit({
          Type: 'alert',
          Message: { id: 9001, severity: 'info', title: 'Patrol report ready', description: 'Demo mission analyzed 6 images.', timestamp: Date.now() },
        });
        waypointIdx = 0;
        row = 0;
      }
    }

    // ai_scan: every 15th tick, only while a mission is "running"
    if (missionActive && t % 15 === 0) {
      scanCount += 1;
      emit({
        Type: 'ai_scan',
        Message: {
          deviceId: 'robot-01',
          plant: 'tomato',
          blockId: 'block-a',
          blockName: 'Block A',
          missionId: 'demo-mission',
          patrolId: 1,
          scanPoint: scanCount,
          side: scanCount % 2 === 0 ? 'left' : 'right',
          predictions: [
            { className: 'healthy', confidence: 0.6 + Math.random() * 0.3 },
            { className: 'tomato_early_blight', confidence: Math.random() * 0.4 },
          ],
          capturedAt: Date.now(),
        },
      });
    }

    // alert: rain event, rare
    if (t % 37 === 0) {
      emit({
        Type: 'alert',
        Message: { id: 9000 + t, severity: 'warning', title: 'Rain detected', description: 'Rain sensor triggered near Block A. Consider pausing the patrol.', timestamp: Date.now() },
      });
    }
  }, 1500);

  return () => clearInterval(timer);
}
