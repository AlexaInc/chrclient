/**
 * Release-version helpers, kept free of React Native imports so the same code
 * can be exercised by a plain node script (see chrclient-verify-task7.ts).
 *
 * The project ships two kinds of builds:
 *   • tagged releases → "v1.0.1" (app.json version: 1.0.1)
 *   • rolling builds  → tag "latest", release name/body carry "1.0.0-dev.57"
 */

export interface ParsedVersion {
  base: [number, number, number];
  /** the rolling-build counter, when the version carries "-dev.N" */
  dev: number | null;
  /** false for a tag with no number in it at all, e.g. "latest" */
  valid: boolean;
}

export function parseVersion(raw: string | null | undefined): ParsedVersion {
  const text = raw ? String(raw) : '';
  const m = text.match(/(\d+)\.(\d+)(?:\.(\d+))?(?:-dev\.(\d+))?/);
  if (!m) return { base: [0, 0, 0], dev: null, valid: false };
  return { base: [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)], dev: m[4] != null ? Number(m[4]) : null, valid: true };
}

/** 1 = a newer than b, -1 = older, 0 = same version or "cannot tell". */
export function compareVersions(a: string, b: string): number {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  // A versionless tag ("latest", the rolling release) cannot be ordered against
  // a real version: say "cannot tell" so the build-stamp rule decides.
  if (!av.valid || !bv.valid) return 0;
  for (let i = 0; i < 3; i++) {
    if (av.base[i] !== bv.base[i]) return av.base[i] > bv.base[i] ? 1 : -1;
  }
  if (av.dev != null && bv.dev != null) {
    if (av.dev !== bv.dev) return av.dev > bv.dev ? 1 : -1;
    return 0;
  }
  // Same base and one of them is a rolling build: the counter cannot be compared
  // with a plain version, so this says "cannot tell" (see isNewerRelease).
  return 0;
}

/** A version-looking string inside the release name/body ("… · 1.0.0-dev.12"). */
export function versionFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = String(text).match(/\d+\.\d+\.\d+(?:-dev\.\d+)?/);
  return m ? m[0] : null;
}

/**
 * "Is the published release newer than this install?"
 *
 * 1. a higher version → yes;
 * 2. same base, higher rolling counter → yes;
 * 3. otherwise the publish time is compared with the build stamp the CI baked
 *    into this app (`EXPO_PUBLIC_BUILD_TIME`). That is what detects a fresh
 *    push-to-main build, whose tag ("latest") has no number in it.
 * Never claims an update it cannot prove.
 */
export function isNewerRelease(args: {
  releaseVersion: string;
  appVersion: string;
  publishedAtMs: number | null;
  buildTimeMs: number | null;
}): boolean {
  const cmp = compareVersions(args.releaseVersion, args.appVersion);
  if (cmp !== 0) return cmp > 0;
  if (args.buildTimeMs && args.publishedAtMs != null && Number.isFinite(args.publishedAtMs)) {
    return args.publishedAtMs > args.buildTimeMs;
  }
  return false;
}
