/**
 * chrclient — map checks (Task 7 follow-up: "the map is unusable" round).
 *
 * Two halves:
 *
 *  1. BEHAVIOUR — the page returned by buildLeafletHtml() is executed for real
 *     in a sandbox with a recording Leaflet stub, and the messages the app sends
 *     (position / phone / focus / provider / tap / trace) are fed to it. That
 *     catches the real bugs: does the map centre on the phone when walking
 *     starts, is satellite the layer that gets drawn, does a tile outage fall
 *     back instead of going grey, do the zoom buttons zoom.
 *
 *  2. WIRING — the app side: every map gets the provider from Preferences,
 *     the maps are handed a position even when the robot is offline, and the
 *     mapping screen gates corner capture on GPS accuracy.
 *
 * Run:  npx tsx chrclient-verify-map.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { buildLeafletHtml, DEFAULT_FIELD_POSITION, DEFAULT_MAP_PROVIDER, MAP_PROVIDERS } from './src/map/leafletHtml';
import { mapStatus } from './src/map/mapStatus';

let passed = 0;
const failures: string[] = [];
const ok = (m: string) => { passed++; console.log(`✅ ${m}`); };
const fail = (m: string) => { failures.push(m); console.log(`❌ ${m}`); };
const check = (cond: boolean, m: string) => (cond ? ok(m) : fail(m));

/* ------------------------------------------------------------------ *
 *  1. Behaviour: run the generated page against a Leaflet stub
 * ------------------------------------------------------------------ */
interface Call { fn: string; args: any[] }

class FakeElement {
  id: string;
  textContent = '';
  className = '';
  handlers: Record<string, ((e?: any) => void)[]> = {};
  constructor(id: string) { this.id = id; }
  addEventListener(evt: string, fn: (e?: any) => void) { (this.handlers[evt] ||= []).push(fn); }
  click() { (this.handlers.click || []).forEach((f) => f({ preventDefault() {} })); }
}

function runPage(html: string) {
  const calls: Call[] = [];
  /** the layer objects themselves, so handler wiring can be inspected */
  const created: any[] = [];
  const record = (fn: string) => (...args: any[]) => { calls.push({ fn, args }); };
  const elements = new Map<string, FakeElement>();
  const outbound: any[] = [];
  const bodyClasses = new Set<string>();

  // Leaflet accepts L.latLng([lat, lng]) as well as L.latLng(lat, lng) — the page
  // uses both, so the stub must too (a stub that only knew the second form once
  // hid a real "does it centre on the walker" failure).
  const latLng = (a: any, b?: any) =>
    Array.isArray(a) ? { lat: a[0], lng: a[1] } : typeof a === 'object' ? { lat: a?.lat, lng: a?.lng } : { lat: a, lng: b };
  const layer = (kind: string, args: any[]) => {
    const handlers: Record<string, ((e?: any) => void)[]> = {};
    const self: any = {
      kind, args, handlers,
      addTo: (m: any) => { calls.push({ fn: `${kind}.addTo`, args: [m] }); return self; },
      on: (evt: string, fn: any) => { (handlers[evt] ||= []).push(fn); return self; },
      setLatLng: (ll: any) => { self.latlng = ll; return self; },
      getLatLng: () => self.latlng,
      setIcon: record(`${kind}.setIcon`),
      setRadius: record(`${kind}.setRadius`),
      setLatLngs: (pts: any) => { self.points = pts; return self; },
      getLatLngs: () => self.points ?? [],
    };
    created.push(self);
    return self;
  };

  const map: any = {
    setView: (ll: any, z: any) => { calls.push({ fn: 'map.setView', args: [ll, z] }); map.view = [ll, z]; return map; },
    getZoom: () => (map.view ? map.view[1] : 17),
    setZoom: (z: number) => { calls.push({ fn: 'map.setZoom', args: [z] }); return map; },
    setMaxZoom: (z: number) => { calls.push({ fn: 'map.setMaxZoom', args: [z] }); return map; },
    panTo: (ll: any) => { calls.push({ fn: 'map.panTo', args: [ll] }); return map; },
    on: (evt: string, fn: any) => { (map.handlers ||= {}); (map.handlers[evt] ||= []).push(fn); return map; },
    removeLayer: record('map.removeLayer'),
    fitBounds: (b: any, o: any) => { calls.push({ fn: 'map.fitBounds', args: [b, o] }); return map; },
    getCenter: () => map.view?.[0] ?? { lat: 0, lng: 0 },
    distance: () => 100,
    handlers: {} as Record<string, ((e?: any) => void)[]>,
  };

  const L = {
    map: (id: string, opts: any) => { calls.push({ fn: 'L.map', args: [id, opts] }); return map; },
    tileLayer: (url: string, opts: any) => {
      calls.push({ fn: 'tileLayer', args: [url, opts] });
      const l = layer('tileLayer', [url, opts]);
      l.url = url;
      return l;
    },
    marker: (ll: any, opts: any) => layer('marker', [ll, opts]),
    circle: (ll: any, opts: any) => layer('circle', [ll, opts]),
    polyline: (pts: any, opts: any) => layer('polyline', [pts, opts]),
    divIcon: (o: any) => ({ ...o }),
    latLng,
    latLngBounds: (pts: any[]) => ({ pts, pad: () => ({ pts }) }),
    control: { scale: (o: any) => ({ addTo: record('scale.addTo'), o }) },
    DomEvent: { stopPropagation() {}, disableClickPropagation() {}, disableScrollPropagation() {} },
  };

  const sandbox: any = {
    L, JSON, Math, Object, String, Number, Array, console,
    document: {
      getElementById: (id: string) => {
        if (!elements.has(id)) elements.set(id, new FakeElement(id));
        return elements.get(id);
      },
      addEventListener: (evt: string, fn: any) => { (sandbox.__docHandlers ||= {}); (sandbox.__docHandlers[evt] ||= []).push(fn); },
      body: { classList: { add: (c: string) => bodyClasses.add(c) } },
    },
    window: {
      parent: { postMessage: (payload: any) => outbound.push(typeof payload === 'string' ? JSON.parse(payload) : payload) },
      addEventListener: (evt: string, fn: any) => { (sandbox.__winHandlers ||= {}); (sandbox.__winHandlers[evt] ||= []).push(fn); },
      localStorage: {
        store: {} as Record<string, string>,
        getItem(k: string) { return this.store[k] ?? null; },
        setItem(k: string, v: string) { this.store[k] = v; },
      },
    },
    /**
     * Deliver one message the way a real WebView does: React Native fires on
     * document (Android) or on window (iOS) — never both. Delivering to both
     * would run every handler twice and hide the real behaviour.
     */
    emit_message: (data: any) => {
      const payload = JSON.stringify(data);
      (sandbox.__docHandlers?.message || []).forEach((f: any) => f({ data: payload }));
    },
  };
  sandbox.window.localStorage = sandbox.window.localStorage;
  sandbox.globalThis = sandbox;

  const script = html.split('<script>')[1].split('</script>')[0];
  vm.runInNewContext(script, sandbox, { filename: 'leaflet-page.js' });

  const find = (fn: string) => calls.filter((c) => c.fn === fn);
  const last = (fn: string) => find(fn).at(-1);
  const tileUrls = () => find('tileLayer').map((c) => String(c.args[0]));
  const el = (id: string) => elements.get(id);

  return { calls, created, outbound, map, elements, bodyClasses, find, last, tileUrls, el, sandbox };
}

const page = runPage(buildLeafletHtml(DEFAULT_FIELD_POSITION.latitude, DEFAULT_FIELD_POSITION.longitude, 17, {
  interactive: true,
  provider: DEFAULT_MAP_PROVIDER,
}));

// --- default layer: satellite imagery, high detail, with place labels -------
check(
  page.tileUrls().some((u) => u.includes('World_Imagery')),
  'the map opens on SATELLITE imagery (Esri/Maxar), not the cartoon road map',
);
check(
  page.tileUrls().some((u) => u.includes('World_Boundaries_and_Places')),
  'place / road labels are drawn on top of the imagery so it stays readable',
);
const satCalls = page.find('tileLayer').filter((c) => String(c.args[0]).includes('World_Imagery'));
check(
  !!satCalls.length && satCalls[0].args[1].maxNativeZoom === 19 && satCalls[0].args[1].maxZoom === 21,
  'satellite keeps zooming past its native zoom (upscaled) instead of refusing',
);

// --- free zoom -------------------------------------------------------------
const mapOpts = page.find('L.map')[0].args[1];
check(
  mapOpts.zoomSnap === 0.5 && mapOpts.touchZoom && mapOpts.scrollWheelZoom && mapOpts.doubleClickZoom && mapOpts.boxZoom && mapOpts.maxZoom >= 20,
  'zoom is free: pinch, wheel, double-tap, box-zoom, half steps, maxZoom 21',
);
page.el('z-in')?.click();
page.el('z-out')?.click();
check(
  page.find('map.setZoom').length >= 2,
  'the on-map + / − buttons really zoom (they do not rely on gesture support in the app shell)',
);

// --- centre on me / fit ----------------------------------------------------
page.sandbox.emit_message({ type: 'phone', latitude: 7.48, longitude: 80.36, accuracy: 8, active: true });
const firstPhoneView = page.find('map.setView').at(-1);
check(
  firstPhoneView && firstPhoneView.args[0].lat === 7.48 && firstPhoneView.args[1] >= 18,
  'starting a phone walk snaps the map onto the walker at walking zoom (auto-centre)',
);
page.sandbox.emit_message({ type: 'position', latitude: 7.49, longitude: 80.37, trail: [], status: 'LIVE GPS', statusTone: 'ok' });
check(
  page.find('map.panTo').length === 0,
  'while walking, the rover moving does NOT drag the map away from the operator',
);
page.sandbox.emit_message({ type: 'phone', latitude: 7.481, longitude: 80.361, accuracy: 9, active: true });
check(page.find('map.panTo').length >= 1, 'the map keeps following the phone as it moves');
page.el('z-here')?.click();
check(page.find('map.setView').length >= 2, '◎ re-centres on the walker / rover on demand');
page.el('z-fit')?.click();
check(page.find('map.fitBounds').length === 1, '⤢ frames everything (rover + walker + captured points)');

// --- tile provider switching ----------------------------------------------
page.el('p-streets')?.click();
check(
  page.tileUrls().some((u) => u.includes('tile.openstreetmap.org')),
  'tapping STREETS swaps the layer to OpenStreetMap without reloading the map',
);
check(
  page.outbound.some((m) => m.type === 'provider' && m.id === 'streets'),
  'the tile choice is reported back so the app can remember it',
);
page.el('p-terrain')?.click();
check(page.tileUrls().some((u) => u.includes('opentopomap')), 'TERRAIN is available as a third provider');

// --- tile outage: fall back, never a grey void ----------------------------
const satellitePage = runPage(buildLeafletHtml(7.48, 80.36, 17, { provider: 'satellite' }));
const satTile = satellitePage.created.find((l) => String(l.args?.[0] ?? '').includes('World_Imagery'))
  ?? satellitePage.created.find((l) => l.kind === 'tileLayer');
const errHandler = satTile?.handlers?.tileerror?.[0];
check(!!errHandler, 'the tile layer watches for tile errors');
for (let i = 0; i < 8 && errHandler; i++) errHandler();
check(
  satellitePage.tileUrls().some((u) => u.includes('tile.openstreetmap.org')),
  'if the satellite tiles fail, the map falls back to STREETS instead of going blank',
);
check(
  satellitePage.el('status')?.textContent?.includes('UNAVAILABLE') === true,
  'and it says so on the map badge',
);

// --- no robot link: show the configured field position, and say why -------
check(
  mapStatus({ hasFix: false }).label.includes('DEFAULT POSITION') && mapStatus({ hasFix: false }).tone === 'warn',
  'with no robot link the map badge reads "DEFAULT POSITION • ROBOT OFFLINE"',
);
check(
  mapStatus({ hasFix: true, isDefault: true }).label.includes('NO GPS FIX'),
  'a default position with a robot that has no fix is labelled too',
);
check(mapStatus({ hasFix: true }).tone === 'ok', 'a real fix is labelled LIVE GPS (ok tone)');

// --- tap-to-mark still works ----------------------------------------------
const before = page.outbound.length;
page.map.handlers.click?.forEach((f: any) => f({ latlng: { lat: 7.5, lng: 80.4 } }));
check(
  page.outbound.slice(before).some((m) => m.type === 'tap' && m.latitude === 7.5),
  'tapping the map still marks a point (manual marking was not broken by the new buttons)',
);

// --- walked path -----------------------------------------------------------
page.sandbox.emit_message({ type: 'trace', points: [[7.48, 80.36], [7.481, 80.361]] });
check(
  page.created.filter((l) => l.kind === 'polyline').some((l) => (l.points ?? []).length === 2),
  'the walked path is drawn on the map while walking',
);

/* ------------------------------------------------------------------ *
 *  2. Wiring: the app side
 * ------------------------------------------------------------------ */
const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const has = (rel: string, needle: string, message: string) => check(read(rel).includes(needle), message);

check(
  DEFAULT_MAP_PROVIDER === 'satellite' && MAP_PROVIDERS.length === 3 && MAP_PROVIDERS[0].id === 'satellite',
  'SATELLITE is the default provider in code, and it is the first choice in Settings',
);
has('src/state/Preferences.tsx', "KEY_MAP_PROVIDER = 'chrclient.prefs.mapProvider'", 'the map style is remembered on the device');
has('src/screens/SettingsScreen.tsx', 'MAP STYLE', 'Settings has a MAP STYLE choice');
has('src/screens/SettingsScreen.tsx', 'setMapProvider(p.id)', 'Settings switches the provider');
has('src/map/LiveMap.tsx', 'phoneTrail', 'the native map accepts the walked path');
has('src/map/LiveMap.tsx', "post({ type: 'focus', target: focus })", 'the native map follows the chosen marker');
has('src/map/LiveMap.web.tsx', 'event.source !== iframeRef.current?.contentWindow', 'the web map only trusts messages from its own frame');
has('src/map/LiveMap.tsx', 'scalesPageToFit', 'the native WebView allows page zoom gestures');

const maps = ['src/screens/LocationScreen.tsx', 'src/screens/ControllerScreen.tsx', 'src/screens/MappingScreen.tsx'];
maps.forEach((f) => has(f, 'provider={mapProvider}', `${path.basename(f)} draws the chosen provider`));
has('src/components/FieldMapcard.tsx', 'provider={prefs?.mapProvider}', 'FieldMapcard draws the chosen provider');

has('src/map/mapStatus.ts', 'DEFAULT POSITION • ROBOT OFFLINE', 'the maps state the default position out loud when the robot is offline');
has('src/map/mapStatus.ts', 'DEFAULT POSITION • NO GPS FIX', 'and distinguish “robot offline” from “robot online, no fix”');
check(
  read('src/map/LiveMap.tsx').includes('FALLBACK.latitude') && read('src/map/LiveMap.web.tsx').includes('FALLBACK.latitude'),
  'with no location at all, both maps are still given the operator position (never an empty frame)',
);
has('src/screens/MappingScreen.tsx', 'MAX_CAPTURE_ACCURACY_M', 'corner capture is gated on GPS accuracy');
has('src/screens/MappingScreen.tsx', 'too rough, wait', 'the accuracy gate explains itself to the operator');
has('src/screens/MappingScreen.tsx', "focus={walking ? 'phone' : 'rover'}", 'the mapping map follows the walker while walking');
has('src/screens/MappingScreen.tsx', 'CENTRE ON', 'there is a “centre on me / robot” button');
has('src/map/leafletHtml.ts', "KIND_COLORS.phone = rough", 'the phone marker shows its accuracy by colour');

/* ------------------------------------------------------------------ */
console.log('');
if (failures.length) {
  console.log(`❌ ${passed} passed, ${failures.length} failed`);
  failures.forEach((f) => console.log(`   - ${f}`));
  process.exit(1);
}
console.log(`🎉 all ${passed} map checks passed`);
