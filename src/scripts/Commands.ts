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
 */

import { getSocket } from './Websocket';
import {
  CONTROL_EVENT,
  CommandResponse,
  ControlAction,
  ControlMessage,
  CameraChannel,
  CameraZoom,
  CropBatchRequest,
  ExportRequest,
  FleetConfig,
  MissionRequest,
  RoverMode,
  ScheduleReportRequest,
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

export const emergencyStop = () => sendCommand({ action: 'stop', data: { speed: 0 } });
export const startPatrol = () => sendCommand({ action: 'start_patrol' });
export const pausePatrol = () => sendCommand({ action: 'pause_patrol' });
export const returnToBase = () => sendCommand({ action: 'return_to_base' });
export const setManualTeleop = (enabled: boolean) =>
  sendCommand({ action: 'manual_teleop', data: { enabled } });
export const calibrateGimbal = () => sendCommand({ action: 'calibrate_gimbal' });
export const changeRoverMode = (mode: RoverMode) =>
  sendCommand({ action: 'change_mode', data: { mode } });
export const setRoverSpeed = (speed: number) =>
  sendCommand({ action: 'set_speed', data: { speed } });
export const deployMission = (mission: MissionRequest = {}) =>
  sendCommand({ action: 'deploy_mission', data: mission });

/* ------------------------------------------------------------------ */
/* Camera / AI scan                                                    */
/* ------------------------------------------------------------------ */

export const setCameraChannel = (channel: CameraChannel) =>
  sendCommand({ action: 'camera_set_channel', data: { channel } });
export const setCameraZoom = (zoom: CameraZoom) =>
  sendCommand({ action: 'camera_set_zoom', data: { zoom } });
export const setRecording = (recording: boolean) =>
  sendCommand({ action: 'camera_record', data: { recording } });
export const captureRawBurst = (frames = 5) =>
  sendCommand({ action: 'camera_capture_burst', data: { frames } });

/* ------------------------------------------------------------------ */
/* Alerts / reports / analytics / crops                                */
/* ------------------------------------------------------------------ */

export const acknowledgeAlerts = (ids?: number[]) =>
  sendCommand({ action: 'acknowledge_alerts', data: ids ? { ids } : undefined });
export const exportReport = (req: ExportRequest) =>
  sendCommand({ action: 'export_report', data: req });
export const scheduleReport = (req: ScheduleReportRequest) =>
  sendCommand({ action: 'schedule_report', data: req });
export const runPredictiveModel = (crop?: string) =>
  sendCommand({ action: 'run_predictive_model', data: crop ? { crop } : undefined });
export const registerCropBatch = (batch: CropBatchRequest) =>
  sendCommand({ action: 'register_crop_batch', data: batch });
export const selectCropSource = (crop: string) =>
  sendCommand({ action: 'select_crop_source', data: { crop } });

/* ------------------------------------------------------------------ */
/* Settings / map                                                      */
/* ------------------------------------------------------------------ */

export const applyFleetConfig = (config: FleetConfig) =>
  sendCommand({ action: 'apply_config', data: config });
export const addFieldBoundary = () => sendCommand({ action: 'add_field_boundary' });
export const deployWaypointMission = (mission?: MissionRequest) =>
  sendCommand({ action: 'deploy_waypoint_mission', data: mission });
export const saveFieldMap = (map: import('../types/map').FieldMapMessage) =>
  sendCommand({ action: 'save_field_map', data: map });
export const requestFieldMap = () => sendCommand({ action: 'get_field_map' });

/* ------------------------------------------------------------------ */
/* Manual drive (Controller screen)                                    */
/* ------------------------------------------------------------------ */

export const drive = (direction: import('../types/actions').DriveDirection, speed: number) =>
  sendCommand({ action: 'drive', data: { direction, speed } });
