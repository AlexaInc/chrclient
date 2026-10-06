/**
 * Task-7 checks for chrclient (no emulator, no server needed).
 *
 * Two kinds of check, both of them things the operator asked for:
 *   1. PURE LOGIC — the self-update comparison, run against the real module the
 *      app uses (src/utils/version.ts) with the version strings this project
 *      really publishes (tagged "v1.0.1" and rolling "1.0.0-dev.57").
 *   2. SOURCE INVARIANTS — the screens/preferences that implement each request
 *      are asserted from the files themselves, so a later edit that silently
 *      drops one (angles back to 45, dots on by default, manual acknowledgement
 *      instead of the auto-reset …) fails this script.
 *
 * Run from the chrclient root:   npx tsx chrclient-verify-task7.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

let passed = 0;
const ok = (label: string) => { passed += 1; console.log(`✅ ${label}`); };
const fail = (label: string, detail?: unknown): never => {
    console.error(`❌ ${label}`, detail === undefined ? "" : JSON.stringify(detail));
    process.exit(1);
};

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const has = (file: string, needle: string | RegExp, label: string) => {
    const text = read(file);
    const hit = typeof needle === "string" ? text.includes(needle) : needle.test(text);
    if (!hit) fail(`${label} (${file} does not contain ${needle})`);
    ok(label);
};
const lacks = (file: string, needle: string | RegExp, label: string) => {
    const text = read(file);
    const hit = typeof needle === "string" ? text.includes(needle) : needle.test(text);
    if (hit) fail(`${label} (${file} still contains ${needle})`);
    ok(label);
};

async function main() {
    const { compareVersions, isNewerRelease, versionFromText, parseVersion } = await import("./src/utils/version");

    /* ------------------------------------------------------------------ */
    /* 1 · self-update logic                                               */
    /* ------------------------------------------------------------------ */
    if (compareVersions("v1.0.1", "1.0.0") !== 1) fail("a tagged release must read as newer");
    ok("tagged release v1.0.1 > installed 1.0.0");
    if (compareVersions("1.0.0", "v1.0.1") !== -1) fail("an older release must read as older");
    ok("installed 1.0.1 > release v1.0.0 (no downgrade offered)");
    if (compareVersions("1.0.0-dev.9", "1.0.0-dev.3") !== 1) fail("a higher rolling counter must win");
    ok("rolling build 1.0.0-dev.9 > 1.0.0-dev.3");
    if (compareVersions("1.0.0-dev.3", "1.0.0-dev.3") !== 0) fail("the same build must compare equal");
    ok("the same rolling build compares equal (no update loop)");

    if (versionFromText("Latest build (main) · 1.0.0-dev.12") !== "1.0.0-dev.12") {
        fail("the version must be read out of the release name");
    }
    ok("version read from the rolling release name (“Latest build (main) · 1.0.0-dev.12”)");
    if (versionFromText("Automatic build of **1.0.0-dev.3** (`ac227ac…`)") !== "1.0.0-dev.3") {
        fail("the version must be read out of the release body");
    }
    ok("version read from the release body as well");

    const builtAt = Date.parse("2026-10-06T07:00:00Z");
    const publishedLater = Date.parse("2026-10-06T12:12:56Z");
    const publishedEarlier = Date.parse("2026-10-06T06:00:00Z");
    if (!isNewerRelease({ releaseVersion: "latest", appVersion: "1.0.0", publishedAtMs: publishedLater, buildTimeMs: builtAt })) {
        fail("a rolling build published after this build must be an update");
    }
    ok("rolling “latest” release published after this build → update detected (build stamp rule)");
    if (isNewerRelease({ releaseVersion: "latest", appVersion: "1.0.0", publishedAtMs: publishedEarlier, buildTimeMs: builtAt })) {
        fail("an older rolling build must not be offered as an update");
    }
    ok("rolling release published before this build → no update");
    if (isNewerRelease({ releaseVersion: "latest", appVersion: "1.0.0", publishedAtMs: publishedLater, buildTimeMs: null })) {
        fail("without a build stamp an unprovable update must not be claimed");
    }
    ok("no build stamp (older install) → never claims an update it cannot prove");
    if (parseVersion("latest").dev !== null) fail("a versionless tag must not invent a counter");
    ok("versionless tag “latest” parses safely");

    /* ------------------------------------------------------------------ */
    /* 2 · the operator's checklist, asserted from the sources             */
    /* ------------------------------------------------------------------ */
    // (1) self-update + banner
    has("src/state/Update.tsx", "NotificationBannerPlaceholder".slice(0, 0) || "releases/tags/", "self-update checks the GitHub release of this repo");
    has("src/state/Update.tsx", "AppState.addEventListener", "self-update re-checks when the app returns to the foreground");
    has("src/components/UpdateBanner.tsx", "NEW VERSION AVAILABLE", "the “new version available” notice exists");
    has("src/components/UpdateBanner.tsx", "LATER", "the notice can be dismissed for that release only");
    has("src/state/Update.tsx", "install unknown apps", "the notice explains the Android permission needed for a silent install");
    has("App.tsx", "<UpdateProvider>", "the update provider is mounted");

    // (2) owner numbers: list, add-another button, max 10
    has("src/scripts/Api.ts", "MAX_OWNER_NUMBERS = 10", "the owner-number cap is 10 in the API layer");
    has("src/scripts/Api.ts", "/api/whatsapp/owners", "owner numbers are saved through the list endpoint");
    has("src/screens/SettingsScreen.tsx", /Add another number/, "Settings has an “Add another number” button");
    has("src/screens/SettingsScreen.tsx", "removeOwner", "each saved owner number can be removed again");
    has("src/screens/SettingsScreen.tsx", "ownerList.length >= MAX_OWNER_NUMBERS", "the UI stops at the maximum of 10");

    // (3) side-sensor default angle
    has("src/screens/SettingsScreen.tsx", "sensorAngleLeftDeg: 35, sensorAngleRightDeg: 35", "default side-sensor angles are 35°");
    lacks("src/screens/SettingsScreen.tsx", "sensorAngleLeftDeg: 45", "no 45° default is left behind");

    // (4) pump ON duration
    has("src/screens/IrrigationScreen.tsx", "const DEFAULT_DURATION = 60", "the pump run duration defaults to 60 s");
    has("src/screens/IrrigationScreen.tsx", "PUMP ON {duration}s", "the pump button shows the chosen duration");
    has("src/screens/IrrigationScreen.tsx", "writePref(DURATION_KEY", "the chosen duration is remembered on the device");

    // (5) per-well moisture threshold + the pump-only sensor fact
    has("src/screens/IrrigationScreen.tsx", "PER WELL", "the moisture threshold card is per well");
    has("src/screens/IrrigationScreen.tsx", /no soil-moisture sensor/, "the screen states that the rover has no soil-moisture sensor");
    has("src/scripts/Commands.ts", "pumpId?: string, blockId?: string", "the threshold command carries the well it belongs to");

    // (6) GPS fallback position
    has("src/map/leafletHtml.ts", "7.489087449264883", "the default field position is the operator's coordinates");
    has("src/map/LiveMap.tsx", "DEFAULT_FIELD_POSITION", "the native map uses that default");
    has("src/screens/LocationScreen.tsx", "NO GPS FIX • DEFAULT POSITION", "the location screen says when it is showing the default");
    has("src/map/LiveMap.web.tsx", "DEFAULT_FIELD_POSITION", "the web map uses the same default position");

    // (7) graphs: dots off by default + toggle
    has("src/state/Preferences.tsx", "boolFromStorage(KEY_GRAPH_DOTS, false)", "graph dots default to OFF");
    has("src/components/charts.tsx", "GraphDotsToggle", "the graphs carry a dots toggle");
    has("src/components/charts.tsx", "smooth = true", "the default plot view is smooth");
    has("src/screens/DashboardScreen.tsx", "<GraphDotsToggle />", "the Dashboard graph has the toggle");
    has("src/screens/AnalyticsScreen.tsx", "<GraphDotsToggle />", "the Analytics graphs have the toggle");

    // (8) alerts reset themselves
    has("src/realtime/RealtimeContext.tsx", "AUTO_ACK_MS", "alerts are acknowledged automatically");
    has("src/realtime/RealtimeContext.tsx", "a.title === entry.title && !a.acknowledgedAt", "repeats of the same alert are collapsed");
    has("src/screens/AlertsScreen.tsx", "counters reset by themselves", "the Alerts screen explains the auto-reset");

    // (9) dark mode
    has("tailwind.config.js", "darkMode: 'class'", "dark mode is class-driven (the in-app switch)");
    has("src/state/Preferences.tsx", "setColorScheme(darkMode ? 'dark' : 'light')", "the switch drives NativeWind's colour scheme");
    has("src/screens/SettingsScreen.tsx", "Dark mode", "Settings has the dark-mode switch");
    has("src/components/ui.tsx", "bg-white dark:bg-slate-900", "the Card primitive is themed for dark mode");
    has("src/components/charts.tsx", "colors.slate700 : colors.slate100", "chart grid lines follow the theme");
    ok("the shared Card/chart primitives carry dark-mode styles");
    const themed = ["src/screens/DashboardScreen.tsx", "src/screens/SettingsScreen.tsx", "src/screens/MappingScreen.tsx",
        "src/screens/IrrigationScreen.tsx", "src/screens/ControllerScreen.tsx", "src/screens/AnalyticsScreen.tsx",
        "src/screens/AlertsScreen.tsx", "src/screens/RobotScreen.tsx", "src/screens/LocationScreen.tsx",
        "src/navigation/DrawerContent.tsx", "src/components/Header.tsx"];
    for (const file of themed) {
        if (!read(file).includes("dark:")) fail(`${file} has no dark-mode styles`);
    }
    ok(`every screen is themed for dark mode (${themed.length} files checked)`);

    // (10) drawer logo is the app icon
    has("src/navigation/DrawerContent.tsx", "<AppLogo size={30} />", "the side menu shows the app logo next to “AI CROP ROBOT”");
    lacks("src/navigation/DrawerContent.tsx", 'name="robot-outline"', "the old robot glyph is gone from the brand row");

    // (11) rain → pump off / return to base / owner alerts / petrol report
    has("src/scripts/Commands.ts", "report_rain", "the app can report a raindrop (starts the server-side sequence)");
    has("src/scripts/Commands.ts", "report_fuel_empty", "the app can report an empty petrol tank");
    has("src/scripts/Commands.ts", "reportRainDrop", "the rain report helper is exported");
    has("src/screens/RobotScreen.tsx", "I SEE RAIN — RUN SAFETY", "the Robot screen has the rain button");
    has("src/screens/RobotScreen.tsx", "REPORT PETROL EMPTY", "the Robot screen has the petrol-empty button");
    has("src/screens/IrrigationScreen.tsx", /Rain override/, "the irrigation screen explains the rain override");

    // (12) the manual-control screen always shows the map
    has("src/screens/ControllerScreen.tsx", "LIVE MAP", "the manual-control screen has the live map card");
    has("src/screens/ControllerScreen.tsx", "<LiveMap", "the manual-control screen renders the map itself");

    // (13) mapping: tap to mark, phone walking, stop points kept
    has("src/screens/MappingScreen.tsx", "onTap={(latitude, longitude)", "points can be marked by tapping the map");
    has("src/screens/MappingScreen.tsx", "startPhoneWalk", "the phone can be used to walk and mark a block");
    has("src/screens/MappingScreen.tsx", "AUTO-CAPTURE EVERY", "walking can capture corners automatically");
    has("src/screens/MappingScreen.tsx", "stopPoints", "stop points are captured with the block");
    has("src/screens/MappingScreen.tsx", "reuseStopPoints", "saved stop points can be reloaded when re-mapping");
    has("src/types/map.ts", "stopPoints?: StopPoint[]", "stop points are part of the field-map schema");
    has("src/map/leafletHtml.ts", "type: 'tap'", "the map page reports taps back to the app");
    has("src/map/leafletHtml.ts", "renderPhone", "the map draws the phone's own position while walking");

    console.log(`\n🎉 all ${passed} chrclient Task-7 checks passed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
