/**
 * Thin REST client for the one-shot / historical endpoints chrserver exposes
 * alongside the socket (initial state hydration, alert history, reports,
 * crops, sensor/irrigation history, CSV export links, fleet config). The
 * socket stays the source of truth for live updates; these calls are for
 * "give me what's true right now / what happened historically" and are
 * skipped entirely in demo mode (see callers).
 */

import { SERVER_URL } from '../config';
import { FieldMapMessage } from '../types/map';
import { AlertMessage, MissionProgressMessage, RobotState, ScanPrediction } from '../types/messages';
import { FleetConfig } from '../types/actions';

async function authedGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json();
}

async function authedPost<T>(path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`POST ${path} failed (${res.status})`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* One-shot state snapshot                                             */
/* ------------------------------------------------------------------ */

export interface PatrolSummary {
  id: number;
  started_at: number;
  ended_at: number | null;
  status: 'running' | 'completed' | 'analyzed' | 'aborted';
  notes: string | null;
}

export interface StateSnapshot {
  ok: boolean;
  location: { latitude: number; longitude: number; altitude: number | null; satellites: number | null; received_at: number } | null;
  sensors: {
    temperature: number | null; humidity: number | null; rain_percent: number | null; is_raining: number | null;
    dist_forward_cm: number | null; dist_left_cm: number | null; dist_right_cm: number | null;
    block_id: string | null; plant: string | null; received_at: number;
  } | null;
  irrigation: {
    device_id: string; pump_on: number; auto_mode: number; soil_moisture: number | null;
    threshold: number | null; active_block_id: string | null; received_at: number;
  } | null;
  fieldMap: FieldMapMessage | null;
  hasFieldMap: boolean;
  activeMission: {
    missionId: string; patrolId: number; blocks: string[];
    config: { rowSpacingM: number; scanSpacingM: number; arrivalRadiusM: number };
    waypoints: { index: number; latitude: number; longitude: number; blockId: string; blockName: string; plant: string; scan: boolean; row: number }[];
  } | null;
  fleetConfig: FleetConfig;
  devices: { robotOnline: boolean; pumpOnline: boolean };
  status: { state: RobotState; mode: 'autonomous' | 'manual'; missionId?: string; currentWaypoint?: number; totalWaypoints?: number; progress?: number; message?: string };
  alerts: { unacknowledged: number; recent: (AlertMessage & { source: string; acknowledged_at: number | null; created_at: number })[] };
  recentPatrols: PatrolSummary[];
}

export const fetchState = (token: string) => authedGet<StateSnapshot>('/api/state', token);

/* ------------------------------------------------------------------ */
/* Alerts                                                               */
/* ------------------------------------------------------------------ */

export interface AlertRowDto {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string | null;
  source: string;
  created_at: number;
  acknowledged_at: number | null;
}

export const fetchAlerts = (token: string, unacknowledgedOnly = false) =>
  authedGet<{ ok: boolean; alerts: AlertRowDto[] }>(
    `/api/alerts${unacknowledgedOnly ? '?unacknowledged=1' : ''}`,
    token,
  );

export const ackAlerts = (token: string, ids?: number[]) =>
  authedPost<{ ok: boolean; changed: number }>('/api/alerts/ack', token, ids ? { ids } : {});

/* ------------------------------------------------------------------ */
/* Reports (AI image-analysis batch results)                           */
/* ------------------------------------------------------------------ */

export interface ReportDto {
  id: number;
  patrol_id: number;
  trigger_type: 'auto' | 'manual';
  summary: string;
  created_at: number;
  report: {
    missionId: string;
    patrolId: number;
    imageCount: number;
    blocks: string[];
    averages: { className: string; averageConfidence: number; samples: number }[];
    scans: { id: number; block_id: string; plant: string; scan_point: number; side: string; predictions: ScanPrediction[]; created_at: number }[];
    completedAt: number;
  };
}

export const fetchReports = (token: string) => authedGet<{ ok: boolean; reports: ReportDto[] }>('/api/reports', token);

/** Authenticated CSV download link — the server also accepts the session
 *  token as `?token=` for these two export routes specifically, since a
 *  native "open in browser" / share-sheet action can't send an
 *  Authorization header. */
/* ------------------------------------------------------------------ */
/* Push notifications (phone alerts)                                   */
/* ------------------------------------------------------------------ */

export interface PushDeviceDto {
  /** masked on purpose: the app never needs the full token back */
  token: string;
  platform: string;
  label?: string;
  addedAt: number;
  lastSeenAt: number;
  disabledReason?: string;
}

export interface PushStatusDto {
  enabled: boolean;
  url: string;
  minSeverity: string;
  deviceCount: number;
  activeDevices: number;
  sent: number;
  failed: number;
  lastSentAt: number | null;
  lastError: string | null;
  deviceList?: PushDeviceDto[];
}

/** Tell chrserver which phone to notify. Called on every app start. */
export async function registerPushDevice(
  device: { token: string; platform: string; label?: string },
  sessionToken: string,
): Promise<{ ok: boolean; devices: number }> {
  return authedPost<{ ok: boolean; devices: number }>('/api/push/register', sessionToken, device);
}

/** Stop notifying this phone (Settings → notifications off, or log-out). */
export async function unregisterPushDevice(token: string, sessionToken: string): Promise<{ ok: boolean; devices: number }> {
  return authedPost<{ ok: boolean; devices: number }>('/api/push/unregister', sessionToken, { token });
}

export async function fetchPushStatus(sessionToken: string): Promise<PushStatusDto> {
  const out = await authedGet<{ ok: boolean; push: PushStatusDto }>('/api/push', sessionToken);
  return out.push;
}

export async function sendPushTest(
  sessionToken: string,
  text?: string,
): Promise<{ ok: boolean; sent: number; failed: number; reason?: string }> {
  return authedPost<{ ok: boolean; sent: number; failed: number; reason?: string }>('/api/push/test', sessionToken, { text });
}

export const reportExportUrl = (id: number, token: string) => `${SERVER_URL}/api/reports/${id}/export.csv?token=${encodeURIComponent(token)}`;
export const cropsExportUrl = (token: string) => `${SERVER_URL}/api/crops/export.csv?token=${encodeURIComponent(token)}`;

/** Authenticated image URL for a captured scan photo (see reportExportUrl
 *  for why the token is passed as a query param here too). */
export const scanImageUrl = (id: number, token: string) => `${SERVER_URL}/api/scans/${id}/image?token=${encodeURIComponent(token)}`;

export const fetchRecentScans = (token: string, limit = 20) =>
  authedGet<{ ok: boolean; scans: { id: number; block_id: string; plant: string; scan_point: number; side: string; predictions: ScanPrediction[]; created_at: number; mission_id: string }[] }>(
    `/api/scans/recent?limit=${limit}`,
    token,
  );

/* ------------------------------------------------------------------ */
/* Crops                                                                */
/* ------------------------------------------------------------------ */

export interface CropBatchDto {
  id: number;
  crop: string;
  block: string | null;
  planted_at: string | null;
  notes: string | null;
  created_at: number;
}

export const fetchCrops = (token: string) => authedGet<{ ok: boolean; crops: CropBatchDto[] }>('/api/crops', token);

/* ------------------------------------------------------------------ */
/* Sensor / irrigation history (Analytics screen)                      */
/* ------------------------------------------------------------------ */

export interface SensorHistoryRow {
  id: number;
  temperature: number | null;
  humidity: number | null;
  rain_percent: number | null;
  is_raining: number | null;
  dist_forward_cm: number | null;
  dist_left_cm: number | null;
  dist_right_cm: number | null;
  block_id: string | null;
  plant: string | null;
  received_at: number;
}

export interface IrrigationHistoryRow {
  id: number;
  device_id: string;
  pump_on: number;
  auto_mode: number;
  soil_moisture: number | null;
  threshold: number | null;
  active_block_id: string | null;
  received_at: number;
}

export const fetchSensorHistory = (token: string, hours = 24) =>
  authedGet<{ ok: boolean; readings: SensorHistoryRow[] }>(`/api/sensors/history?hours=${hours}`, token);

export const fetchIrrigationHistory = (token: string, hours = 24) =>
  authedGet<{ ok: boolean; readings: IrrigationHistoryRow[] }>(`/api/irrigation/history?hours=${hours}`, token);

/* ------------------------------------------------------------------ */
/* Fleet config                                                        */
/* ------------------------------------------------------------------ */

export const fetchConfig = (token: string) => authedGet<{ ok: boolean; config: FleetConfig }>('/api/config', token);

/* ------------------------------------------------------------------ */
/* WhatsApp service (Settings → "WhatsApp Service")                    */
/*                                                                     */
/* One WhatsApp account is paired to the server with a pairing code and */
/* then operates the robot/pump from chat. These calls manage that link: */
/* pair a fresh account, delete the session, relink another account and */
/* store the owner number (country code required) that the bot's gate   */
/* checks before it lets anybody touch the hardware.                    */
/* ------------------------------------------------------------------ */

export type WhatsAppState = 'disabled' | 'idle' | 'pairing' | 'connected';

/** Verdict for the stored session (server-computed, see chrserver's SessionHealth). */
export type WhatsAppSessionHealth = 'active' | 'inactive' | 'invalid' | 'not_linked';

export interface WhatsAppStatusDto {
  ok?: boolean;
  state: WhatsAppState;
  /** the bot's on/off switch — when off, the socket is closed but the session stays */
  enabled: boolean;
  /** the primary owner number (E.164 digits, no "+") — first entry of the list */
  ownerNumber: string | null;
  /** every number allowed to command the robot/pump (max MAX_OWNER_NUMBERS) */
  ownerNumbers?: string[] | null;
  /** number the current session was paired for */
  linkedNumber: string | null;
  linkedAt: number | null;
  /** true when a session exists on disk (creds.json) */
  sessionExists: boolean;
  /**
   * active     - connected right now
   * inactive   - session on disk, service currently off/starting
   * invalid    - linked before but the session is gone → link again
   * not_linked - nothing paired yet
   */
  sessionHealth: WhatsAppSessionHealth;
  /** pairing code to enter in WhatsApp → Linked devices, while state === 'pairing' */
  pairingCode: string | null;
  meNumber: string | null;
  lastError: string | null;
}

/** Same as authedPost, but surfaces the server's own error message (the
 *  WhatsApp routes answer 400 with a human-readable reason, e.g. a number
 *  without a country code) instead of just the HTTP status. */
async function postDetailed<T>(path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json?.message ?? `POST ${path} failed (${res.status})`);
  return json as T;
}

export const fetchWhatsAppStatus = (token: string) => authedGet<WhatsAppStatusDto>('/api/whatsapp', token);
export const linkWhatsApp = (token: string, number: string) =>
  postDetailed<WhatsAppStatusDto>('/api/whatsapp/link', token, { number });
export const relinkWhatsApp = (token: string, number: string) =>
  postDetailed<WhatsAppStatusDto>('/api/whatsapp/relink', token, { number });
export const unlinkWhatsApp = (token: string) =>
  postDetailed<WhatsAppStatusDto>('/api/whatsapp/unlink', token);
/** The bot ON/OFF switch — off closes the socket but keeps the session on disk. */
export const setWhatsAppEnabled = (token: string, enabled: boolean) =>
  postDetailed<WhatsAppStatusDto>('/api/whatsapp/enabled', token, { enabled });
export const setWhatsAppOwner = (token: string, number: string) =>
  postDetailed<WhatsAppStatusDto>('/api/whatsapp/owner', token, { number });

/* ------------------------------------------------------------------ */
/* Owner numbers (a LIST, up to MAX_OWNER_NUMBERS)                     */
/*                                                                     */
/* One owner is not enough on a farm: the field hand, the son who runs */
/* the pump and the agronomist all get alerts. chrserver stores the     */
/* list in its database, the bot accepts commands from every entry and  */
/* sends rain/petrol alerts to all of them.                             */
/* ------------------------------------------------------------------ */

/** Hard limit agreed with the operator's specification. */
export const MAX_OWNER_NUMBERS = 10;

/** Read the list from any status payload, tolerating an older server that
 *  only knows the single `ownerNumber` field. */
export function ownerNumbersFrom(status: WhatsAppStatusDto | null | undefined): string[] {
  if (!status) return [];
  const list = Array.isArray(status.ownerNumbers) ? status.ownerNumbers.filter(Boolean) : [];
  if (list.length) return list;
  return status.ownerNumber ? [status.ownerNumber] : [];
}

/** Append one number to the saved list (server enforces the 10-number cap). */
export const addWhatsAppOwner = (token: string, number: string) =>
  postDetailed<WhatsAppStatusDto>('/api/whatsapp/owners', token, { number });

/** Remove one number from the list. */
export const removeWhatsAppOwner = (token: string, number: string) =>
  postDetailed<WhatsAppStatusDto>('/api/whatsapp/owners/remove', token, { number });

/** Replace the whole list in one call (used by "save all" style callers). */
export const setWhatsAppOwners = (token: string, numbers: string[]) =>
  postDetailed<WhatsAppStatusDto>('/api/whatsapp/owners/set', token, { numbers });
export const sendWhatsAppTest = (token: string) =>
  postDetailed<WhatsAppStatusDto>('/api/whatsapp/test', token);

/* ------------------------------------------------------------------ */
/* Mission progress row type re-exported for screens that only need it */
/* ------------------------------------------------------------------ */
export type { MissionProgressMessage };

/* ------------------------------------------------------------------ */
/* Photo collections / manual patrols                                  */
/* ------------------------------------------------------------------ */

export interface PhotoScanDto {
  id: number; patrol_id: number; mission_id: string; block_id: string; plant: string;
  scan_point: number; side: string; predictions: ScanPrediction[]; created_at: number;
}
export interface PhotoCollectionDto {
  id: number; started_at: number; ended_at: number | null;
  status: 'running' | 'completed' | 'analyzed' | 'aborted';
  notes: string | null; mode: 'auto' | 'manual' | 'mapping'; block_ids: string[];
  photo_count: number; scans: PhotoScanDto[]; report: ReportDto | null;
}

export const fetchPhotoCollections = (token: string) =>
  authedGet<{ ok: boolean; collections: PhotoCollectionDto[] }>('/api/photo-collections', token);
export const analyzePhotoCollection = (token: string, patrolId: number) =>
  authedPost<{ ok: boolean; reportId: number; report: ReportDto['report'] }>(`/api/photo-collections/${patrolId}/analyze`, token);
export interface ManualPatrolDto { patrolId: number; missionId: string; blockId: string; blockName: string; plant: string; startedAt: number; }
export const fetchManualPatrol = (token: string) =>
  authedGet<{ ok: boolean; patrol: ManualPatrolDto | null }>('/api/manual-patrol', token);
export const startManualPatrol = (token: string, blockId: string) =>
  authedPost<{ ok: boolean; patrol: ManualPatrolDto }>('/api/manual-patrol/start', token, { blockId });
export const endManualPatrol = (token: string) =>
  authedPost<{ ok: boolean; reportId: number; report: ReportDto['report'] }>('/api/manual-patrol/end', token);

async function authedDelete<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`DELETE ${path} failed (${res.status})`);
  return res.json();
}
export const deletePhotoCollection = (token: string, patrolId: number) =>
  authedDelete<{ ok: boolean; deletedPhotos: number }>(`/api/photo-collections/${patrolId}`, token);
export const deletePhoto = (token: string, scanId: number) =>
  authedDelete<{ ok: boolean }>(`/api/scans/${scanId}`, token);
