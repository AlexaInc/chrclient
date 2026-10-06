/**
 * Watches the live socket state and puts alerts on the phone.
 *
 * This is the piece that converts “the app knows” into “the phone tells me”.
 * It sits inside the realtime provider so a new alert is seen the moment the
 * socket delivers it — whether the app is in the foreground, in the background
 * behind another app, or (with remote push registered) not running at all.
 *
 * Two details matter and are easy to get wrong:
 *
 *   • History is not news. On start the alert list is hydrated from the server
 *     with everything that happened while the phone was off; those ids are
 *     marked as seen first, so the operator is not woken by yesterday's rain.
 *   • The robot going offline is worth a buzz by itself: from the app's point of
 *     view everything looks calm, and the operator would happily deploy a
 *     mission to a rover that is not listening.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRealtime } from '../realtime/RealtimeContext';
import { usePreferences } from '../state/Preferences';
import { usePushOptional } from './PushContext';
import { AlertLike, markAllSeen, newAlertsToNotify, notificationForAlert, notificationForRobot } from './pushPlan';
import { presentNotification } from './notify';

export function NotificationsBridge() {
  const { alerts, robotOnline, hydrated, isDemo } = useRealtime() as any;
  const { pushEnabled, pushSeverity } = usePreferences();
  const push = usePushOptional();

  const seen = useRef<Set<number>>(new Set());
  const baselined = useRef(false);
  const lastRobotOnline = useRef<boolean | null>(null);
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);

  const permission = push?.permission ?? 'unsupported';
  const showBanner = pushEnabled && !isDemo && permission === 'denied';

  /* ---------------- alerts ---------------- */
  useEffect(() => {
    if (!hydrated) return;
    const list: AlertLike[] = Array.isArray(alerts) ? alerts : [];

    if (!baselined.current) {
      // First hydrated state: everything in it is history.
      markAllSeen(list, seen.current);
      baselined.current = true;
      return;
    }

    const fresh = newAlertsToNotify(list, seen.current, { enabled: pushEnabled, minSeverity: pushSeverity });
    if (fresh.length === 0) return;

    void (async () => {
      for (const alert of fresh) {
        const content = notificationForAlert(alert);
        const shown = await presentNotification(content);
        // Nothing could be shown and this one matters: say it in the app
        // instead of losing it (the phone is the only other channel).
        if (!shown && content.severity === 'critical') {
          setBlockedNotice(`${content.title} — ${content.body}`);
        }
      }
    })();
  }, [alerts, hydrated, pushEnabled, pushSeverity, isDemo]);

  /* ---------------- robot online / offline ---------------- */
  useEffect(() => {
    if (!hydrated || isDemo) return;
    const previous = lastRobotOnline.current;
    lastRobotOnline.current = !!robotOnline;
    if (previous === null || previous === robotOnline) return;
    const content = notificationForRobot(!!robotOnline);
    void presentNotification(content).then((shown) => {
      if (!shown && content.severity === 'warning') {
        setBlockedNotice(`${content.title} — ${content.body}`);
      }
    });
  }, [robotOnline, hydrated, isDemo]);

  /* ---------------- in-app fallback ---------------- */
  useEffect(() => {
    if (!blockedNotice) return;
    const timer = setTimeout(() => setBlockedNotice(null), 15000);
    return () => clearTimeout(timer);
  }, [blockedNotice]);

  if (showBanner) {
    return (
      <View className="absolute left-3 right-3 top-3 z-50">
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => void push?.enable()}
          className="bg-amber-500 rounded-xl px-3 py-2.5 flex-row items-center"
        >
          <Text className="text-[11px] font-extrabold text-white flex-1 leading-4">
            Notifications are blocked on this phone — tap to allow them, or alerts will only be visible inside the app.
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (blockedNotice) {
    return (
      <View className="absolute left-3 right-3 top-3 z-50">
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setBlockedNotice(null)}
          className="bg-rose-600 rounded-xl px-3 py-2.5"
        >
          <Text className="text-[11px] font-extrabold text-white leading-4">{blockedNotice}</Text>
          <Text className="text-[9px] text-rose-100 mt-1">Tap to dismiss</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}
