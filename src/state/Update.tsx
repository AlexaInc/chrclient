import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { APP_VERSION, SERVER_URL } from '../config';
import { readPref, writePref } from './deviceStorage';
import { compareVersions, isNewerRelease, versionFromText } from '../utils/version';

export { compareVersions } from '../utils/version';

/**
 * Self-update.
 *
 * The operator's rule: as soon as a new build is published as a GitHub release,
 * every installed copy must pick it up by itself. When that is not possible
 * without a permission the app does not have (iOS has no side-loadable install;
 * Android needs "install unknown apps"; a desktop browser needs a reload), the
 * app must instead raise a clear "new version available" notice — never fail
 * silently.
 *
 * How each platform is served:
 *   • android — a fresh APK asset is opened for installation (Android shows its
 *               own "allow this source" prompt the first time). If that cannot
 *               start, the notice stays on screen.
 *   • web     — chrserver already replaces the served build (see the server's
 *               web-app publisher), so the app only has to reload: the banner
 *               offers one tap, and the server's /api/webapp tells us which
 *               release is currently served.
 *   • ios     — Apple gives no in-app install path for a non-App-Store build,
 *               so a new release is reported and linked.
 *
 * The check goes through chrserver first (GET /api/app/release) and falls back
 * to the public GitHub releases API, so it also works on a phone that cannot
 * reach github.com directly but can reach the farm server.
 */

const REPO = process.env.EXPO_PUBLIC_UPDATE_REPO ?? 'AlexaInc/chrclient';
/** This project publishes rolling builds under a tag literally named "latest". */
const RELEASE_TAG = process.env.EXPO_PUBLIC_UPDATE_TAG ?? 'latest';
const GITHUB_RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/tags/${RELEASE_TAG}`;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * When this build was produced (the CI stamps it, see .github/workflows/release.yml).
 * `null` for builds that predate the stamp — those fall back to version
 * comparison only, which is still correct for tagged releases.
 */
const BUILD_TIME: number | null = (() => {
  const raw = process.env.EXPO_PUBLIC_BUILD_TIME;
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  // The CI writes epoch milliseconds; guard against a seconds value anyway.
  return n < 1e12 ? n * 1000 : n;
})();

const KEY_AUTO = 'chrclient.update.auto';
const KEY_DISMISSED = 'chrclient.update.dismissed';
const KEY_AUTO_TRIED = 'chrclient.update.autoTried';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'installing'
  | 'blocked'
  | 'error';

export interface ReleaseInfo {
  version: string;
  tag: string;
  name: string | null;
  /** when the assets were last uploaded — used for rolling "latest" releases,
   *  whose tag carries no version number at all */
  assetsUpdatedAt: string | null;
  notes: string | null;
  publishedAt: string | null;
  pageUrl: string;
  apkUrl: string | null;
  apkName: string | null;
  ipaUrl: string | null;
  webUrl: string | null;
  /** what the farm server is currently serving (web build), when reported */
  servedTag: string | null;
}

interface UpdateContextValue {
  currentVersion: string;
  status: UpdateStatus;
  latest: ReleaseInfo | null;
  checkedAt: number | null;
  error: string | null;
  /** the notice the operator must see, null when there is nothing to report */
  notice: string | null;
  autoUpdate: boolean;
  setAutoUpdate: (value: boolean) => void;
  dismissed: boolean;
  dismiss: () => void;
  checkNow: (opts?: { silent?: boolean }) => Promise<void>;
  install: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextValue | undefined>(undefined);

function assetUrl(assets: any[], pattern: RegExp): { url: string; name: string } | null {
  if (!Array.isArray(assets)) return null;
  const hit = assets.find((a) => typeof a?.name === 'string' && pattern.test(a.name) && a.browser_download_url);
  return hit ? { url: hit.browser_download_url, name: hit.name } : null;
}

function parseRelease(raw: any): ReleaseInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const tag: string = raw.tag_name ?? raw.tag ?? '';
  if (!tag) return null;
  const name: string | null = typeof raw.name === 'string' ? raw.name : null;
  const notes: string | null = typeof raw.body === 'string' ? raw.body.slice(0, 2000) : null;
  const assets: any[] = Array.isArray(raw.assets) ? raw.assets : [];
  const apk = assetUrl(assets, /\.apk$/i);
  const ipa = assetUrl(assets, /\.ipa$/i);
  const web = assetUrl(assets, /web.*\.zip$/i);
  const assetsUpdatedAt =
    assets.map((a) => a?.updated_at).filter((v) => typeof v === 'string').sort().pop() ?? null;
  // The version can live in the tag (v1.0.1), in the release name ("Latest build
  // (main) · 1.0.0-dev.12") or in the body — a rolling "latest" release uses the
  // last two, so all three are checked before giving up.
  const version =
    String(raw.version ?? '').trim() ||
    (/\d+\.\d+/.test(tag) ? tag.replace(/^v/i, '') : '') ||
    versionFromText(name) ||
    versionFromText(notes) ||
    tag.replace(/^v/i, '');
  return {
    version,
    tag: String(tag),
    name,
    assetsUpdatedAt,
    notes,
    publishedAt: raw.published_at ?? raw.publishedAt ?? null,
    pageUrl: raw.html_url ?? `https://github.com/${REPO}/releases/tag/${encodeURIComponent(tag)}`,
    apkUrl: apk?.url ?? null,
    apkName: apk?.name ?? null,
    ipaUrl: ipa?.url ?? null,
    webUrl: web?.url ?? null,
    servedTag: raw.servedTag ?? null,
  };
}

async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } finally {
    clearTimeout(timer);
  }
}

/** Ask chrserver first (it can authenticate to GitHub), then GitHub itself. */
async function fetchLatestRelease(): Promise<{ release: ReleaseInfo | null; error: string | null }> {
  try {
    const res = await fetchWithTimeout(`${SERVER_URL}/api/app/release`);
    if (res.ok) {
      const body = await res.json().catch(() => null);
      const parsed = parseRelease(body?.release ?? body);
      if (parsed) {
        if (body?.servedTag && !parsed.servedTag) parsed.servedTag = body.servedTag;
        return { release: parsed, error: null };
      }
    }
  } catch {
    /* server unreachable or the endpoint is not deployed yet — try GitHub */
  }
  try {
    const res = await fetchWithTimeout(GITHUB_RELEASE_URL);
    if (!res.ok) return { release: null, error: `GitHub replied ${res.status}` };
    return { release: parseRelease(await res.json()), error: null };
  } catch (e: any) {
    return { release: null, error: e?.message ? String(e.message) : 'Update check failed' };
  }
}

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [latest, setLatest] = useState<ReleaseInfo | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoUpdate, setAutoUpdateState] = useState<boolean>(() => readPref(KEY_AUTO) !== '0');
  const [dismissedTag, setDismissedTag] = useState<string | null>(() => readPref(KEY_DISMISSED));

  const autoTriedRef = useRef<string | null>(readPref(KEY_AUTO_TRIED));
  const inFlight = useRef(false);

  const setAutoUpdate = useCallback((value: boolean) => {
    setAutoUpdateState(value);
    writePref(KEY_AUTO, value ? '1' : '0');
  }, []);

  const installFor = useCallback(async (release: ReleaseInfo): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // chrserver swaps the served build by itself; a reload picks it up.
      const g: any = globalThis;
      if (typeof g?.location?.reload === 'function') {
        g.location.reload();
        return true;
      }
      return false;
    }
    if (Platform.OS === 'android') {
      if (!release.apkUrl) {
        setNotice(`New version ${release.tag} is available, but the release has no Android build attached.`);
        setStatus('blocked');
        return false;
      }
      try {
        const canOpen = await Linking.canOpenURL(release.apkUrl).catch(() => true);
        if (!canOpen) throw new Error('no handler for the download URL');
        await Linking.openURL(release.apkUrl);
        setStatus('installing');
        setNotice(`Downloading ${release.tag}. Android will ask you to allow the install — accept it to finish the update.`);
        return true;
      } catch (e: any) {
        setStatus('blocked');
        setNotice(
          `New version ${release.tag} is available. The phone blocked the automatic install ` +
            `(Android needs "install unknown apps" for this app, or no browser/downloader is available). ` +
            `Open the release page to install it manually.`
        );
        return false;
      }
    }
    // iOS and anything else: no self-install path without a provisioning profile.
    setStatus('blocked');
    setNotice(
      `New version ${release.tag} is available. This device cannot install it by itself — ` +
        `open the release page to update.`
    );
    return false;
  }, []);

  /**
   * Is the published release newer than what this device is running?
   *
   * 1. a higher version number → yes, straight away;
   * 2. the same base version but a higher rolling counter (`1.0.0-dev.9` over
   *    `1.0.0-dev.3`) → yes;
   * 3. otherwise (a rolling "latest" whose tag carries no number) → the publish
   *    time of the build is compared with the stamp this app was compiled with.
   *    That is what makes "every install updates itself as soon as a new build
   *    is published" work for pushes to main, which is how this project ships.
   */
  const isNewer = useCallback(
    (release: ReleaseInfo) =>
      isNewerRelease({
        releaseVersion: release.version,
        appVersion: APP_VERSION,
        publishedAtMs: Date.parse(release.assetsUpdatedAt ?? release.publishedAt ?? '') || null,
        buildTimeMs: BUILD_TIME,
      }),
    []
  );

  const checkNow = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (!opts?.silent) setStatus('checking');
      try {
        const { release, error: err } = await fetchLatestRelease();
        setCheckedAt(Date.now());
        if (!release) {
          setError(err);
          setStatus('error');
          return;
        }
        setLatest(release);
        setError(null);
        if (isNewer(release)) {
          setStatus('available');
          const dismissedAlready = dismissedTag === release.tag;
          setNotice(
            dismissedAlready
              ? null
              : Platform.OS === 'web'
                ? `New version ${release.tag} is live — reload to load it.`
                : `New version ${release.tag} is available.`
          );
          if (autoUpdate && Platform.OS !== 'web' && autoTriedRef.current !== release.tag) {
            autoTriedRef.current = release.tag;
            writePref(KEY_AUTO_TRIED, release.tag);
            await installFor(release);
          }
        } else {
          setStatus('up-to-date');
          setNotice(null);
        }
      } finally {
        inFlight.current = false;
      }
    },
    [autoUpdate, dismissedTag, installFor, isNewer]
  );

  // first check shortly after launch, then periodically, then whenever the app
  // comes back to the foreground (a phone in a shed is usually backgrounded)
  useEffect(() => {
    const first = setTimeout(() => checkNow({ silent: true }), 4000);
    const interval = setInterval(() => checkNow({ silent: true }), CHECK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checkNow({ silent: true });
    });
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      sub?.remove?.();
    };
  }, [checkNow]);

  const install = useCallback(async () => {
    if (!latest) {
      await checkNow();
      return;
    }
    if (!isNewer(latest)) {
      setStatus('up-to-date');
      setNotice(null);
      return;
    }
    await installFor(latest);
  }, [latest, checkNow, installFor, isNewer]);

  const dismiss = useCallback(() => {
    if (latest) {
      setDismissedTag(latest.tag);
      writePref(KEY_DISMISSED, latest.tag);
    }
    setNotice(null);
  }, [latest]);

  const value = useMemo<UpdateContextValue>(
    () => ({
      currentVersion: APP_VERSION,
      status,
      latest,
      checkedAt,
      error,
      notice,
      autoUpdate,
      setAutoUpdate,
      dismissed: !!latest && dismissedTag === latest.tag,
      dismiss,
      checkNow,
      install,
    }),
    [status, latest, checkedAt, error, notice, autoUpdate, setAutoUpdate, dismissedTag, dismiss, checkNow, install]
  );

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error('useUpdate must be used inside <UpdateProvider>');
  return ctx;
}

export function useUpdateOptional(): UpdateContextValue | null {
  return useContext(UpdateContext) ?? null;
}
