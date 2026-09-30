import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Linking } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, Page } from '../components/ui';
import KpiRail from '../components/KpiRail';
import { colors } from '../theme';
import { useRealtime } from '../realtime/RealtimeContext';
import { useAuth } from '../auth/AuthContext';
import { fetchReports, reportExportUrl, ReportDto } from '../scripts/Api';

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function ReportsScreen() {
  const { mission, latestReport, isDemo } = useRealtime();
  const { token } = useAuth();
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = () => {
    if (isDemo || !token) return;
    setLoading(true);
    fetchReports(token)
      .then((res) => setReports(res.reports))
      .catch((e) => console.warn('[Reports] fetch failed:', e?.message ?? e))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [isDemo, token]);

  // A fresh live report supersedes the stale REST snapshot until the next reload.
  useEffect(() => {
    if (latestReport && !reports.some((r) => r.id === latestReport.id)) {
      setReports((prev) => [
        {
          id: latestReport.id,
          patrol_id: latestReport.report.patrolId,
          trigger_type: 'auto',
          summary: `Mission ${latestReport.missionId} • ${latestReport.report.imageCount} images analyzed`,
          created_at: latestReport.report.completedAt,
          report: latestReport.report,
        },
        ...prev,
      ]);
    }
  }, [latestReport]);

  const totalImages = reports.reduce((sum, r) => sum + r.report.imageCount, 0);
  const allAverages = reports.flatMap((r) => r.report.averages);
  const diseaseCount = allAverages.filter((a) => !/healthy/i.test(a.className)).reduce((s, a) => s + a.samples, 0);
  const totalSamples = allAverages.reduce((s, a) => s + a.samples, 0);
  const avgConfidence = totalSamples > 0
    ? allAverages.reduce((s, a) => s + a.averageConfidence * a.samples, 0) / totalSamples
    : null;

  const KPIS = [
    {
      label: 'PATROL REPORTS',
      value: String(reports.length),
      sub: `${totalImages} images analyzed total`,
      note: 'Auto-generated on patrol completion',
      iconBg: 'bg-brand-100',
      icon: <Feather name="file-text" size={18} color={colors.emerald600} />,
    },
    {
      label: 'DISEASE FLAGS',
      value: String(diseaseCount),
      sub: totalSamples > 0 ? `${((diseaseCount / totalSamples) * 100).toFixed(0)}% of classifications` : '—',
      note: 'Non-"healthy" classifications',
      iconBg: diseaseCount > 0 ? 'bg-rose-100' : 'bg-brand-100',
      icon: <MaterialCommunityIcons name="leaf-off" size={20} color={diseaseCount > 0 ? colors.rose600 : colors.emerald600} />,
    },
    {
      label: 'AVG MODEL CONFIDENCE',
      value: avgConfidence != null ? `${(avgConfidence * 100).toFixed(0)}%` : '—',
      sub: `${totalSamples} classifications`,
      note: 'Across all reports',
      iconBg: 'bg-blue-100',
      icon: <Feather name="cpu" size={18} color={colors.blue600} />,
    },
  ];

  return (
    <View className="flex-1 bg-surface">
      <Header title="Reports" />
      <Page>
        <Row className="gap-2 flex-wrap">
          <Badge label="AI PATROL REPORTS" className="bg-brand-50" textClassName="text-brand-700" />
          {isDemo && <Badge label="DEMO DATA" className="bg-amber-100" textClassName="text-amber-700" dotClassName="bg-amber-500" />}
        </Row>
        <Text className="text-[22px] font-extrabold text-slate-900 mt-3">Patrol Reports</Text>
        <Text className="text-xs text-slate-500 mt-1.5 leading-[18px]">
          One report is generated automatically for every completed patrol, summarizing the AI analysis of every
          photo captured along the way.
        </Text>

        {mission && mission.state && mission.state !== 'completed' && (
          <Card className="mt-4">
            <SectionTitle>PATROL IN PROGRESS</SectionTitle>
            <Text className="text-xs font-bold text-slate-700 mt-2">
              {mission.missionId} • {mission.state} • waypoint {mission.currentWaypoint ?? 0}/{mission.waypoints.length}
            </Text>
            <Text className="text-[11px] text-slate-500 mt-1">A report will appear here automatically once this patrol finishes.</Text>
          </Card>
        )}

        {!isDemo && <KpiRail items={KPIS} />}

        <Card className="mt-4">
          <Row className="justify-between">
            <SectionTitle>ALL REPORTS</SectionTitle>
            {loading && <Text className="text-[11px] text-slate-400">Loading…</Text>}
          </Row>
          <View className="mt-2">
            {isDemo ? (
              <Text className="text-xs text-slate-400 py-8 text-center">Reports require a real server connection — not simulated in demo mode.</Text>
            ) : reports.length === 0 ? (
              <Text className="text-xs text-slate-400 py-8 text-center">No reports yet. Deploy and complete a patrol to generate one.</Text>
            ) : (
              reports.map((r, i) => (
                <View key={r.id} className={`py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                  <Row className="items-start">
                    <IconBox className="bg-brand-100" size={38}>
                      <Feather name="file-text" size={17} color={colors.emerald600} />
                    </IconBox>
                    <View className="flex-1 ml-3">
                      <Text className="text-[10px] font-extrabold text-slate-400">
                        {r.trigger_type === 'auto' ? 'AUTO • PATROL COMPLETE' : 'MANUAL'} • {fmtDate(r.created_at)}
                      </Text>
                      <Text className="text-xs font-extrabold text-slate-800 mt-0.5">{r.summary}</Text>
                      <Text className="text-[10px] text-slate-500 mt-0.5">
                        {r.report.imageCount} images • Blocks: {r.report.blocks.join(', ') || '—'}
                      </Text>
                    </View>
                    {token && (
                      <TouchableOpacity onPress={() => openUrl(reportExportUrl(r.id, token))} activeOpacity={0.7}>
                        <Feather name="download" size={17} color={colors.emerald600} />
                      </TouchableOpacity>
                    )}
                  </Row>
                  {r.report.averages.length > 0 && (
                    <View className="mt-2 ml-[50px] gap-1">
                      {r.report.averages.slice(0, 5).map((a) => (
                        <Row key={a.className} className="justify-between">
                          <Text className="text-[11px] text-slate-600">{a.className.replace(/_+/g, ' ')}</Text>
                          <Text className="text-[11px] font-extrabold text-slate-700">{(a.averageConfidence * 100).toFixed(0)}% avg • {a.samples}x</Text>
                        </Row>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </Card>
      </Page>
    </View>
  );
}
