import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, SectionTitle, Badge, IconBox, Row, PillButton, Page } from '../components/ui';
import { colors } from '../theme';
import { acknowledgeAlerts } from '../scripts/Commands';
import { useCommand } from '../hooks/useCommand';
import ActionFeedback from '../components/ActionFeedback';
import { useRealtime, AlertEntry } from '../realtime/RealtimeContext';
import FilterTabs from '../components/FilterTabs';

const FILTERS = ['All', 'Unacknowledged', 'Critical', 'Warning', 'Info'];

function timeAgo(ts: number | string | undefined): string {
  const t = typeof ts === 'number' ? ts : ts ? new Date(ts).getTime() : null;
  if (!t) return '—';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 5) return 'Just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const SEVERITY_STYLE: Record<AlertEntry['severity'], { badge: string; text: string; iconBg: string; icon: keyof typeof Feather.glyphMap; color: string }> = {
  critical: { badge: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-100 dark:bg-rose-900/40', icon: 'alert-octagon', color: colors.rose600 },
  warning: { badge: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', iconBg: 'bg-amber-100 dark:bg-amber-900/40', icon: 'alert-triangle', color: colors.amber600 },
  info: { badge: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700', iconBg: 'bg-blue-100 dark:bg-blue-900/40', icon: 'info', color: colors.blue600 },
};

export default function AlertsScreen() {
  const [filter, setFilter] = useState(0);
  const { alerts, acknowledgeLocally, isDemo } = useRealtime();

  const ackAll = useCommand(acknowledgeAlerts);
  const ackOne = useCommand(acknowledgeAlerts);

  const filtered = alerts.filter((a) => {
    switch (FILTERS[filter]) {
      case 'Unacknowledged': return !a.acknowledgedAt;
      case 'Critical': return a.severity === 'critical';
      case 'Warning': return a.severity === 'warning';
      case 'Info': return a.severity === 'info';
      default: return true;
    }
  });

  const unacknowledgedIds = alerts.filter((a) => !a.acknowledgedAt).map((a) => a.id);
  const critCount = alerts.filter((a) => !a.acknowledgedAt && a.severity === 'critical').length;
  const warnCount = alerts.filter((a) => !a.acknowledgedAt && a.severity === 'warning').length;
  const infoCount = alerts.filter((a) => !a.acknowledgedAt && a.severity === 'info').length;

  const handleAckAll = async () => {
    const res = await ackAll.run(unacknowledgedIds.length ? unacknowledgedIds : undefined);
    if (res.success) acknowledgeLocally(unacknowledgedIds.length ? unacknowledgedIds : undefined);
  };
  const handleAckOne = async (id: number) => {
    const res = await ackOne.run([id]);
    if (res.success) acknowledgeLocally([id]);
  };

  return (
    <View className="flex-1 bg-surface dark:bg-slate-950">
      <Header title="Alerts" />
      <Page>
        <Row className="gap-2 flex-wrap">
          <Badge label="LIVE ALERT STREAM" className="bg-rose-100 dark:bg-rose-900/40" textClassName="text-rose-600 dark:text-rose-400" />
          {isDemo && <Badge label="DEMO DATA" className="bg-amber-100 dark:bg-amber-900/40" textClassName="text-amber-700 dark:text-amber-300" dotClassName="bg-amber-500" />}
        </Row>
        <Text className="text-[22px] font-extrabold text-slate-900 dark:text-slate-100 mt-3">Alerts</Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-[18px]">
          Device offline/online transitions, rain detection, mission faults, low soil moisture, disease detections, and completed patrol reports.
          The counters reset by themselves: an alert is acknowledged automatically a few seconds after it arrives
          (repeats of the same GPS / field-map message are collapsed onto the newest one), so the badge returns to zero
          without anybody pressing a button — and nothing disappears from this history.
        </Text>

        <Row className="mt-3.5 gap-3 flex-wrap">
          <View className="flex-row items-center gap-1.5">
            <View className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{critCount} Critical</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{warnCount} Warning</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{infoCount} Info</Text>
          </View>
        </Row>

        <Row className="mt-3.5 gap-2.5 lg:max-w-[400px]">
          <PillButton
            label={ackAll.pending ? 'Clearing…' : `Clear counter now (${unacknowledgedIds.length})`}
            className={`flex-1 bg-brand-600 ${ackAll.pending || unacknowledgedIds.length === 0 ? 'opacity-60' : ''}`}
            textClassName="text-white"
            onPress={handleAckAll}
          />
        </Row>
        <ActionFeedback result={ackAll.result} />

        <View className="mt-3">
          <FilterTabs
            tabs={FILTERS.map((f, i) => (i === 0 ? `${f} (${alerts.length})` : f))}
            active={filter}
            onSelect={setFilter}
            activeClassName="bg-rose-600 border-rose-600"
          />
        </View>

        <Card className="mt-4">
          <SectionTitle>ALERT QUEUE</SectionTitle>
          <View className="mt-2">
            {filtered.length === 0 ? (
              <Text className="text-xs text-slate-400 py-8 text-center">No alerts in this filter.</Text>
            ) : (
              filtered.map((a, i) => {
                const s = SEVERITY_STYLE[a.severity];
                return (
                  <View
                    key={a.id}
                    className={`flex-row items-start py-3 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}
                  >
                    <IconBox className={s.iconBg} size={38}>
                      <Feather name={s.icon} size={18} color={s.color} />
                    </IconBox>
                    <View className="flex-1 ml-3">
                      <Text className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{a.title}</Text>
                      {!!a.description && <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{a.description}</Text>}
                      <Row className="mt-1.5 gap-2 flex-wrap">
                        <Badge label={a.severity.toUpperCase()} className={s.badge} textClassName={s.text} />
                        {a.acknowledgedAt && <Badge label="ACKNOWLEDGED" className="bg-slate-100 dark:bg-slate-800" textClassName="text-slate-500 dark:text-slate-400" />}
                      </Row>
                    </View>
                    <View className="items-end">
                      <Text className="text-[10px] font-bold text-slate-400">{timeAgo(a.timestamp ?? a.receivedAt)}</Text>
                      {!a.acknowledgedAt && (
                        <TouchableOpacity onPress={() => handleAckOne(a.id)} activeOpacity={0.7} className="mt-1.5">
                          <Text className="text-[10px] font-extrabold text-brand-700 dark:text-brand-300">Acknowledge</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </Card>
      </Page>
    </View>
  );
}
