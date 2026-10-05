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
