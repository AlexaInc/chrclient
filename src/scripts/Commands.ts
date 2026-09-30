/**
 * Typed command service — the ONLY place UI code talks to the socket for
 * actions. Every button/icon handler ends up here.
 *
 * - Wraps the `control_message` event with the `ControlAction` union, so
 *   TypeScript rejects unknown actions or malformed payloads at compile time.
 * - Uses Socket.IO acks (emit callback) with a timeout, always resolving to a
 *   `CommandResponse` — callers never need try/catch.
 * - Demo mode (demo/demo login → no socket): commands are answered locally
 *   with a simulated success ack, so every button still "works" offline.
 *
 * Every action here is one the physical robot/pump can actually carry out —
 * see chrserver's ROVER_ACTIONS / PUMP_ACTIONS allow-lists. Report/CSV
 * export and one-shot state snapshots are plain REST calls (see Api.ts),
 * not socket commands, since they don't need an ack round-trip.
 */

import { getSocket } from './Websocket';
import {
  CONTROL_EVENT,
  CommandResponse,
  ControlAction,
  ControlMessage,
  CropBatchRequest,
  FleetConfig,
  MissionRequest,
  RoverMode,
} from '../types/actions';

const ACK_TIMEOUT_MS = 5000;

/** Set by AuthContext / RealtimeContext when the user logs in as demo. */
let demoMode = false;
export const setCommandDemoMode = (enabled: boolean): void => {
  demoMode = enabled;
};

/** Simulated ack for demo mode — resolves like a healthy server would. */
function demoAck(action: ControlAction): Promise<CommandResponse> {
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          success: true,
          message: `[demo] ${action.action} accepted`,
        }),
      300 + Math.random() * 400,
    );
  });
}

/**
 * Send a typed command and await the server ack.
 * Resolves `{ success: false, reason }` on no-socket / timeout — never throws.
 */
export function sendCommand(action: ControlAction): Promise<CommandResponse> {
  if (demoMode) return demoAck(action);

  const socket = getSocket();
  if (!socket) {
    console.warn('[commands] socket not initialized — is the user logged in?');
    return Promise.resolve({ success: false, reason: 'Not connected to server' });
  }
  if (!socket.connected) socket.connect();

  const payload: ControlMessage = { ...action, timestamp: Date.now() };

  return new Promise<CommandResponse>((resolve) => {
    const timer = setTimeout(() => {
      resolve({ success: false, reason: 'Server did not respond (timeout)' });
    }, ACK_TIMEOUT_MS);

    socket.emit(CONTROL_EVENT, payload, (response: CommandResponse) => {
      clearTimeout(timer);
      if (response && typeof response.success === 'boolean') {
        resolve(response);
      } else {
        // server acked without a proper body — treat as success
        resolve({ success: true, message: 'Acknowledged' });
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Robot motion / mission                                              */
/* ------------------------------------------------------------------ */

export const emergencyStop = () => sendCommand({ action: 'stop' });
export const startPatrol = () => sendCommand({ action: 'start_patrol' });
export const pausePatrol = () => sendCommand({ action: 'pause_patrol' });
export const returnToBase = () => sendCommand({ action: 'return_to_base' });
export const setManualTeleop = (enabled: boolean) =>
  sendCommand({ action: 'manual_teleop', data: { enabled } });
export const changeRoverMode = (mode: RoverMode) =>
  sendCommand({ action: 'change_mode', data: { mode } });
export const deployMission = (mission: MissionRequest = {}) =>
  sendCommand({ action: 'deploy_mission', data: mission });

/* ------------------------------------------------------------------ */
/* Camera / AI scan — manual/ad-hoc capture only. The real patrol       */
/* capture+analysis flow is fully automatic and needs no client action. */
/* ------------------------------------------------------------------ */

export const capturePhoto = () => sendCommand({ action: 'cap_photo' });
export const captureBurst = () => sendCommand({ action: 'camera_capture_burst' });

/* ------------------------------------------------------------------ */
/* Alerts / crops                                                       */
/* ------------------------------------------------------------------ */

export const acknowledgeAlerts = (ids?: number[]) =>
  sendCommand({ action: 'acknowledge_alerts', data: ids ? { ids } : undefined });
export const registerCropBatch = (batch: CropBatchRequest) =>
  sendCommand({ action: 'register_crop_batch', data: batch });

/* ------------------------------------------------------------------ */
/* Settings / map                                                      */
/* ------------------------------------------------------------------ */

export const applyFleetConfig = (config: FleetConfig) =>
  sendCommand({ action: 'apply_config', data: config });
export const saveFieldMap = (map: import('../types/map').FieldMapMessage) =>
  sendCommand({ action: 'save_field_map', data: map });
export const requestFieldMap = () => sendCommand({ action: 'get_field_map' });

/* ------------------------------------------------------------------ */
/* ESP32-C3 irrigation / water pump                                    */
/* ------------------------------------------------------------------ */

export const pumpOn = (durationSeconds?: number, blockId?: string) =>
  sendCommand({ action: 'pump_on', data: { durationSeconds, blockId } });
export const pumpOff = () => sendCommand({ action: 'pump_off' });
export const setPumpAuto = (enabled: boolean) =>
  sendCommand({ action: 'pump_auto', data: { enabled } });
export const setIrrigationThreshold = (moisturePercent: number) =>
  sendCommand({ action: 'set_irrigation_threshold', data: { moisturePercent } });
export const irrigateBlock = (blockId: string, durationSeconds?: number) =>
  sendCommand({ action: 'irrigate_block', data: { blockId, durationSeconds } });
export const stopIrrigation = () => sendCommand({ action: 'stop_irrigation' });

/* ------------------------------------------------------------------ */
/* Manual drive (Controller screen)                                    */
/* ------------------------------------------------------------------ */

export const drive = (direction: import('../types/actions').DriveDirection) =>
  sendCommand({ action: 'drive', data: { direction } });
