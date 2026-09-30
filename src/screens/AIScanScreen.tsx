import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, Row, Page } from '../components/ui';
import { colors } from '../theme';
import { capturePhoto, captureBurst } from '../scripts/Commands';
import { useRealtime } from '../realtime/RealtimeContext';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import { useAuth } from '../auth/AuthContext';
import { fetchReports, ReportDto, scanImageUrl } from '../scripts/Api';

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return 'Just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default function AIScanScreen() {
  const { currentBlock, status, latestScan, latestReport, mission, isDemo, robotOnline } = useRealtime();
  const { token } = useAuth();
  const burstCmd = useCommand(captureBurst);
  const photoCmd = useCommand(capturePhoto);

  const [fallbackReport, setFallbackReport] = useState<ReportDto | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // On first load, pull the most recent finished report from the server so
  // there's something to show even if no mission has completed yet in this
  // session. Live `latestReport` (pushed the instant a patrol finishes)
  // always takes priority once it arrives.
  useEffect(() => {
    if (isDemo || !token) return;
    setLoadingReport(true);
    fetchReports(token)
      .then((res) => setFallbackReport(res.reports[0] ?? null))
      .catch((e) => console.warn('[AIScanScreen] failed to load reports:', e?.message ?? e))
      .finally(() => setLoadingReport(false));
  }, [isDemo, token]);

  const report = latestReport
    ? { id: latestReport.id, patrol_id: latestReport.report.patrolId, trigger_type: 'auto' as const, summary: `Mission ${latestReport.missionId} completed with ${latestReport.report.imageCount} analyzed images`, created_at: latestReport.report.completedAt, report: latestReport.report }
    : fallbackReport;

  // Live capture progress during an active patrol — deliberately shows ONLY
  // a running count of photos captured, never per-image predictions. The
  // only place classification results are shown is the finished batch
  // report below, exactly as the AI-scan feature is designed to work.
  const patrolling = status?.state === 'patrolling';
  const [capturedCount, setCapturedCount] = useState(0);
  useEffect(() => {
    if (!mission) return;
    setCapturedCount(0);
  }, [mission?.missionId]);
  useEffect(() => {
    if (!latestScan || !mission || latestScan.missionId !== mission.missionId) return;
    setCapturedCount((c) => c + 1);
  }, [latestScan]);

  const canCapture = robotOnline && !!currentBlock;

  return (
    <View className="flex-1 bg-surface">
      <Header title="AI Scan" />
      <Page>
        <Text className="text-[22px] font-extrabold text-slate-900">
          AI Crop Health Scan
        </Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          The robot photographs each plant while patrolling a mapped block. All photos are analyzed together
          automatically once the patrol finishes — the result below is that finished report.
        </Text>

        <Row className="mt-3 gap-2 flex-wrap">
          <Badge
            label={patrolling ? 'PATROL IN PROGRESS' : 'IDLE'}
            className={patrolling ? 'bg-amber-100' : 'bg-brand-50'}
            textClassName={patrolling ? 'text-amber-700' : 'text-brand-700'}
            dotClassName={patrolling ? 'bg-amber-500' : 'bg-brand-500'}
          />
          {isDemo && <Badge label="DEMO DATA" className="bg-amber-100" textClassName="text-amber-700" dotClassName="bg-amber-500" />}
        </Row>

        {/* Live capture progress — count only, no per-image analysis UI */}
        {patrolling && (
          <Card className="mt-4">
            <Row className="justify-between items-center">
              <SectionTitle>CAPTURING PHOTOS</SectionTitle>
              <ActivityIndicator size="small" color={colors.emerald600} />
            </Row>
            <Text className="text-[11px] text-slate-500 mt-1">
              Photos are being taken as the robot reaches each plant. Analysis begins automatically once the patrol completes.
            </Text>
            <Row className="justify-between mt-3">
              <Text className="text-xs font-semibold text-slate-500">Mission waypoint</Text>
              <Text className="text-xs font-extrabold text-slate-900">{mission?.currentWaypoint ?? 0} / {mission?.waypoints.length ?? '—'}</Text>
            </Row>
            <Row className="justify-between mt-2">
              <Text className="text-xs font-semibold text-slate-500">Photos captured so far</Text>
              <Text className="text-xs font-extrabold text-slate-900">{capturedCount}</Text>
            </Row>
            {latestScan && (
              <Row className="justify-between mt-2">
                <Text className="text-xs font-semibold text-slate-500">Last photo captured</Text>
                <Text className="text-xs font-extrabold text-slate-900">{latestScan.blockName ?? latestScan.blockId} • {timeAgo(latestScan.capturedAt)}</Text>
              </Row>
            )}
          </Card>
        )}

        {/* Manual / ad-hoc capture — a real hardware capability, separate
            from the automatic per-waypoint patrol capture. */}
        <Card className="mt-4">
          <SectionTitle>MANUAL CAPTURE</SectionTitle>
          <Text className="text-[10px] text-slate-500 mt-1">
            Take a photo right now (outside a patrol). Requires the robot to be online and inside a mapped block.
          </Text>
          <Row className="justify-between mt-3">
            <Text className="text-xs font-semibold text-slate-500">Current block / AI model</Text>
            <Text className="text-xs font-extrabold text-slate-900">
              {currentBlock ? `${currentBlock.name} → ${currentBlock.aiModel ?? currentBlock.plant}` : 'Not in a mapped block'}
            </Text>
          </Row>
          <Row className="gap-2 mt-3">
            <TouchableOpacity
              onPress={() => photoCmd.run()}
              disabled={!canCapture || photoCmd.pending}
              activeOpacity={0.85}
              className={`flex-1 flex-row items-center justify-center bg-brand-600 rounded-xl py-2.5 ${!canCapture || photoCmd.pending ? 'opacity-50' : ''}`}
            >
              <Feather name="camera" size={15} color={colors.white} />
              <Text className="text-xs font-extrabold text-white ml-1.5">{photoCmd.pending ? 'Capturing…' : 'Capture Photo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => burstCmd.run()}
              disabled={!canCapture || burstCmd.pending}
              activeOpacity={0.85}
              className={`flex-1 flex-row items-center justify-center bg-slate-100 rounded-xl py-2.5 ${!canCapture || burstCmd.pending ? 'opacity-50' : ''}`}
            >
              <MaterialCommunityIcons name="camera-burst" size={16} color={colors.slate700} />
              <Text className="text-xs font-extrabold text-slate-700 ml-1.5">{burstCmd.pending ? 'Capturing…' : 'Capture Burst (2 photos)'}</Text>
            </TouchableOpacity>
          </Row>
          <ActionFeedback result={photoCmd.result ?? burstCmd.result} />
        </Card>

        {/* The finished batch report — the ONLY place analysis results appear */}
        <Card className="mt-4">
          <Row className="justify-between">
            <SectionTitle>LATEST PATROL REPORT</SectionTitle>
            {loadingReport && <ActivityIndicator size="small" color={colors.emerald600} />}
          </Row>
          {!report ? (
            <Text className="text-xs text-slate-500 mt-2">
              No completed patrol report yet. Deploy a mission from the Location screen — a report is generated automatically when it finishes.
            </Text>
          ) : (
            <>
              <Text className="text-[11px] text-slate-500 mt-1">{report.summary}</Text>
              <Row className="justify-between mt-3">
                <Text className="text-xs font-semibold text-slate-500">Images analyzed</Text>
                <Text className="text-xs font-extrabold text-slate-900">{report.report.imageCount}</Text>
              </Row>
              <Row className="justify-between mt-2">
                <Text className="text-xs font-semibold text-slate-500">Blocks covered</Text>
                <Text className="text-xs font-extrabold text-slate-900">{report.report.blocks.join(', ') || '—'}</Text>
              </Row>
              <Row className="justify-between mt-2">
                <Text className="text-xs font-semibold text-slate-500">Completed</Text>
                <Text className="text-xs font-extrabold text-slate-900">{timeAgo(report.report.completedAt)}</Text>
              </Row>

              <Text className="text-[10px] font-extrabold text-slate-400 mt-4 tracking-wide">CLASSIFICATION BREAKDOWN</Text>
              <View className="mt-2 gap-2">
                {report.report.averages.length === 0 && (
                  <Text className="text-xs text-slate-500">No classifications recorded.</Text>
                )}
                {report.report.averages.map((a) => {
                  const healthy = /healthy/i.test(a.className);
                  return (
                    <View
                      key={a.className}
                      className={`rounded-xl border-l-4 p-3 ${healthy ? 'bg-brand-50 border-brand-600' : 'bg-rose-50 border-rose-600'}`}
                    >
                      <Row className="justify-between">
                        <Text className={`text-[11px] font-extrabold ${healthy ? 'text-brand-700' : 'text-rose-600'}`}>
                          {a.className.replace(/_+/g, ' ')}
                        </Text>
                        <Text className={`text-[11px] font-extrabold ${healthy ? 'text-brand-700' : 'text-rose-600'}`}>
                          {(a.averageConfidence * 100).toFixed(0)}% avg
                        </Text>
                      </Row>
                      <Text className="text-[10px] text-slate-600 mt-1">{a.samples} sample(s)</Text>
                    </View>
                  );
                })}
              </View>

              {report.report.scans.length > 0 && (
                <>
                  <Text className="text-[10px] font-extrabold text-slate-400 mt-4 tracking-wide">CAPTURED PHOTOS</Text>
                  <Row className="mt-2 gap-2 flex-wrap">
                    {report.report.scans.slice(0, 12).map((s) => (
                      <View key={s.id} className="items-center">
                        {token && (
                          <Image
                            source={{ uri: scanImageUrl(s.id, token) }}
                            className="w-[72px] h-[54px] rounded-lg bg-slate-100"
                            resizeMode="cover"
                          />
                        )}
                        <Text className="text-[9px] font-bold text-slate-500 mt-1">{s.predictions?.[0]?.className?.replace(/_+/g, ' ') ?? '—'}</Text>
                      </View>
                    ))}
                  </Row>
                </>
              )}
            </>
          )}
        </Card>
      </Page>
    </View>
  );
}
