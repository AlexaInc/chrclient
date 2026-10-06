/**
 * Self-contained Leaflet map page rendered inside a WebView (native) or an
 * iframe (web). It draws the rover marker + its recent GPS trail, any captured
 * mapping points, the phone's own position while the operator walks a block,
 * and listens for JSON messages of the shape:
 *
 *     { type: 'position', latitude, longitude, trail: [[lat,lng], ...],
 *       status: 'LIVE GPS' | 'DEFAULT POSITION • NO GPS FIX', statusTone: 'ok'|'warn' }
 *     { type: 'points',   points: [{ id, latitude, longitude, kind, label }] }
 *     { type: 'phone',    latitude, longitude, accuracy, active }
 *     { type: 'trace',    points: [[lat,lng], ...] }   // the path walked with the phone
 *     { type: 'focus',    target: 'rover' | 'phone' }
 *     { type: 'follow',   enabled: boolean }
 *     { type: 'provider', id: 'satellite' | 'streets' | 'terrain' }
 *     { type: 'fit' }
 *
 * sent via WebView.postMessage / iframe contentWindow.postMessage, so markers
 * glide live without reloading the page.
 *
 * With `interactive: true` a tap/click on the map is answered back with
 *
 *     { type: 'tap', latitude, longitude }
 *
 * which is how points can be marked straight on the map — no GPS fix and no
 * walking required. A provider change made with the on-map buttons is answered
 * with `{ type: 'provider', id }` so the app can remember it.
 *
 * Operator feedback built into this page (the "map bugs" round):
 *   • SATELLITE imagery is the default — the cartoon road map was not usable to
 *     see crop rows. Esri World Imagery + place labels, with STREETS (OSM) and
 *     TERRAIN (OpenTopoMap) one tap away, remembered on the device.
 *   • Zoom is free: pinch, double-tap, wheel, box-zoom, and big on-map + / −
 *     buttons; the tile layer keeps zooming past its native zoom by upscaling
 *     instead of refusing to go closer.
 *   • "Where am I": the map centres on the phone the moment walking starts (and
 *     keeps following it), ◎ re-centres on the rover or on the walker, ⤢ shows
 *     everything.
 *   • No robot link: the map always has a position — it shows the configured
 *     field position and says so in a badge instead of an empty grey box.
 */

export type MapProvider = 'google' | 'satellite' | 'streets' | 'terrain';

/**
 * GOOGLE is the default. The Esri imagery that used to be the default simply has
 * no photos of a lot of the island — zoom past its coverage and every tile says
 * "Map data not yet available" (a grey tile with white text), which is exactly
 * what the operator saw when zooming in over the field. Google's imagery covers
 * the same spot down to street level, so the default is the provider that
 * actually has the field in it.
 */
export const DEFAULT_MAP_PROVIDER: MapProvider = 'google';

export const MAP_PROVIDERS: { id: MapProvider; label: string; hint: string }[] = [
  { id: 'google', label: 'GOOGLE', hint: 'Google imagery with place/road labels — detailed everywhere around the field' },
  { id: 'satellite', label: 'ESRI SAT', hint: 'Esri / Maxar imagery (no coverage in some areas — zoomed in it upscales the newest real photo)' },
  { id: 'streets', label: 'STREETS', hint: 'OpenStreetMap roads, tracks and place names' },
  { id: 'terrain', label: 'TERRAIN', hint: 'OpenTopoMap contour lines for slopes' },
];

/** Fallback centre while there is no fix at all — the operator's own field. */
export const DEFAULT_FIELD_POSITION = { latitude: 7.489087449264883, longitude: 80.36537714662697 };

export function isMapProvider(value: unknown): value is MapProvider {
  return value === 'google' || value === 'satellite' || value === 'streets' || value === 'terrain';
}

/**
 * Round-3 installations saved the old default ('satellite') on the device, so
 * simply changing DEFAULT_MAP_PROVIDER would leave those phones on the provider
 * without imagery. Stored choices are migrated once; after that the operator is
 * free to pick ESRI SAT again and it sticks.
 */
export const LEGACY_DEFAULT_PROVIDER: MapProvider = 'satellite';

export function migrateStoredProvider<T extends { read: (key: string) => string | null; write: (key: string, value: string) => void }>(
  store: T,
  key: string,
  flagKey: string,
): string | null {
  const stored = store.read(key);
  if (store.read(flagKey) === '1') return stored;
  store.write(flagKey, '1');
  if (stored === LEGACY_DEFAULT_PROVIDER) {
    store.write(key, DEFAULT_MAP_PROVIDER);
    return DEFAULT_MAP_PROVIDER;
  }
  return stored;
}

export interface LeafletPointIn {
  id: string;
  latitude: number;
  longitude: number;
  kind: 'boundary' | 'block' | 'stop' | 'base' | 'phone' | string;
  label?: string;
}

const KIND_COLORS: Record<string, { bg: string; ring: string; size: number }> = {
  boundary: { bg: '#0ea5e9', ring: '#e0f2fe', size: 12 },
  block: { bg: '#22c55e', ring: '#dcfce7', size: 12 },
  stop: { bg: '#f97316', ring: '#ffedd5', size: 15 },
  base: { bg: '#7c3aed', ring: '#ede9fe', size: 14 },
  phone: { bg: '#2563eb', ring: '#dbeafe', size: 14 },
};

export interface LeafletOpts {
  interactive?: boolean;
  provider?: MapProvider;
  /** start already centred on this zoom (default 17) */
  zoom?: number;
}

export function buildLeafletHtml(
  lat: number,
  lng: number,
  zoom = 17,
  opts: LeafletOpts = {},
): string {
  const interactive = opts.interactive === true;
  const provider: MapProvider = isMapProvider(opts.provider) ? opts.provider : DEFAULT_MAP_PROVIDER;
  const colors = JSON.stringify(KIND_COLORS);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #0f172a; }
  body.no-tiles { background: #0f172a url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><path d='M0 39H40M39 0V40' stroke='%23223' stroke-width='1'/></svg>"); }
  .rover-dot {
    width: 18px; height: 18px; border-radius: 50%;
    background: #10b981; border: 3px solid #ffffff;
    box-shadow: 0 0 0 6px rgba(16,185,129,0.25);
  }
  .map-pin { border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 1px 4px rgba(0,0,0,0.35); }
  .pin-label {
    position: absolute; left: 16px; top: -2px; white-space: nowrap;
    font: 700 10px system-ui, sans-serif; color: #0f172a;
    background: rgba(255,255,255,0.9); border-radius: 6px; padding: 1px 4px;
  }
  /* ---- on-map controls: zoom, re-centre, fit, tiles ---- */
  .ctl {
    position: absolute; z-index: 900; display: flex; flex-direction: column; gap: 6px;
  }
  .ctl-right { right: 10px; top: 10px; }
  .ctl button {
    width: 40px; height: 40px; border-radius: 12px; border: 0;
    background: rgba(255,255,255,0.94); color: #0f172a;
    font: 800 20px system-ui, sans-serif; line-height: 1;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer;
  }
  .ctl button:active { transform: scale(0.96); }
  .layers { position: absolute; z-index: 900; left: 10px; top: 10px; display: flex; gap: 6px; }
  .layers button {
    border: 0; border-radius: 10px; padding: 7px 10px;
    background: rgba(15,23,42,0.72); color: #e2e8f0;
    font: 800 10px system-ui, sans-serif; letter-spacing: 0.4px; cursor: pointer;
  }
  .layers button.on { background: #10b981; color: #04231a; }
  #status {
    position: absolute; z-index: 900; left: 10px; bottom: 22px;
    border-radius: 8px; padding: 4px 8px;
    font: 800 10px system-ui, sans-serif; letter-spacing: 0.3px;
    background: rgba(15,23,42,0.78); color: #a7f3d0;
  }
  #status.warn { color: #fde68a; }
  @media (max-width: 480px) { .ctl button { width: 34px; height: 34px; font-size: 17px; } }
  .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.75); }
  ${interactive ? 'body { cursor: crosshair; }' : ''}
</style>
</head>
<body>
<div id="map"></div>

<div class="layers">
  <button id="p-google" data-provider="google">GOOGLE</button>
  <button id="p-satellite" data-provider="satellite">ESRI SAT</button>
  <button id="p-streets" data-provider="streets">STREETS</button>
  <button id="p-terrain" data-provider="terrain">TERRAIN</button>
</div>

<div class="ctl ctl-right">
  <button id="z-in" title="zoom in">+</button>
  <button id="z-out" title="zoom out">&minus;</button>
  <button id="z-here" title="centre on the rover / on me">&#9678;</button>
  <button id="z-fit" title="show everything">&#10530;</button>
</div>

<div id="status">STARTING MAP…</div>

<script>
  var KIND_COLORS = ${colors};
  var INTERACTIVE = ${interactive ? 'true' : 'false'};
  var START_PROVIDER = '${provider}';

  /* ------------------------------------------------------------------ *
   *  Tile providers.  GOOGLE is the default: the operator maps crop
   *  blocks in a field, where a road map is a cartoon and the imagery is
   *  the only layer that shows rows, plot edges and trees — and, unlike
   *  the Esri layer that used to be the default, it has an actual photo
   *  of the field at every zoom (Esri answers "Map data not yet
   *  available" past its coverage, which is what made the map grey).
   *  Each layer keeps zooming past its native zoom by upscaling, so
   *  "zoom in where I want" is never refused at the edge of the tile set.
   * ------------------------------------------------------------------ */
  var PROVIDERS = {
    google: {
      label: 'GOOGLE',
      url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en',
      subdomains: ['0', '1', '2', '3'],
      native: 20, max: 21,
      attribution: 'Imagery &copy; Google, Maxar Technologies'
    },
    satellite: {
      label: 'ESRI SAT',
      // World_Imagery really ends at zoom 18 over this part of the island: from
      // 19 up Esri answers with a placeholder tile that reads "Map data not yet
      // available". Claiming native 19 asked for those placeholder tiles; 18 is
      // the newest zoom with a real photo, and Leaflet upscales it from there.
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      native: 18, max: 21,
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
      labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
    },
    streets: {
      label: 'STREETS',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      native: 19, max: 20,
      attribution: '&copy; OpenStreetMap contributors'
    },
    terrain: {
      label: 'TERRAIN',
      url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
      native: 17, max: 19,
      attribution: '&copy; OpenTopoMap (CC-BY-SA), SRTM'
    }
  };

  var map = L.map('map', {
    zoomControl: false,            // our own bigger buttons, finger friendly
    zoomSnap: 0.5,                 // half steps: pinch feels free, not clunky
    zoomDelta: 1,
    wheelPxPerZoomLevel: 90,
    minZoom: 3, maxZoom: 21,
    touchZoom: true, scrollWheelZoom: true, doubleClickZoom: true, boxZoom: true,
    keyboard: true, zoomAnimation: true, fadeAnimation: true,
    attributionControl: true
  }).setView([${lat}, ${lng}], ${zoom});

  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

  var base = null, labels = null, providerId = null, tileErrors = 0, fellBack = false, tried = [];

  function providerCfg(id) { return PROVIDERS[id] || PROVIDERS.satellite; }

  function useProvider(id, announce) {
    var cfg = providerCfg(id);
    if (base) { map.removeLayer(base); base = null; }
    if (labels) { map.removeLayer(labels); labels = null; }
    tileErrors = 0;
    map.setMaxZoom(cfg.max);
    base = L.tileLayer(cfg.url, {
      maxZoom: cfg.max,
      maxNativeZoom: cfg.native,
      subdomains: cfg.subdomains || 'abc',
      attribution: cfg.attribution,
      crossOrigin: true
    }).addTo(map);
    if (cfg.labels) {
      // place / road names on top of the imagery, so the satellite view stays readable
      labels = L.tileLayer(cfg.labels, { maxZoom: cfg.max, maxNativeZoom: cfg.native, opacity: 0.85 }).addTo(map);
    }
    base.on('tileerror', function () {
      tileErrors++;
      if (tileErrors < 8) return;
      document.body.classList.add('no-tiles');
      // Walk down a fixed order and stop at the first provider that answers:
      // whatever was blocked (a firewall, a provider outage) the operator gets a
      // map instead of a grey void, and the badge says which one is missing.
      var order = ['google', 'satellite', 'streets', 'terrain'];
      var next = null;
      for (var i = 0; i < order.length; i++) {
        if (order[i] !== id && tried.indexOf(order[i]) === -1) { next = order[i]; break; }
      }
      if (next && !fellBack) {
        fellBack = true;
        tried.push(id);
        setStatus(providerCfg(id).label + ' UNAVAILABLE — SWITCHED TO ' + providerCfg(next).label, 'warn');
        useProvider(next, true);
        return;
      }
      setStatus('MAP TILES OFFLINE — POSITION STILL LIVE', 'warn');
    });
    providerId = id;
    try { window.localStorage.setItem('chrclient.map.provider', id); } catch (e) { /* blocked storage */ }
    ['google', 'satellite', 'streets', 'terrain'].forEach(function (key) {
      var b = document.getElementById('p-' + key);
      if (b) b.className = key === id ? 'on' : '';
    });
    if (announce) emit({ type: 'provider', id: id });
  }

  /* ---- markers ---- */
  var icon = L.divIcon({ className: '', html: '<div class="rover-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  var marker = L.marker([${lat}, ${lng}], { icon: icon, keyboard: false }).addTo(map);
  var trail = L.polyline([], { color: '#10b981', weight: 3, opacity: 0.8 }).addTo(map);
  var walked = L.polyline([], { color: '#2563eb', weight: 3, opacity: 0.85, dashArray: '6,5' }).addTo(map);

  var follow = true;
  var focus = 'rover';                 // which marker the map follows and centres on
  var roverLatLng = L.latLng(${lat}, ${lng});
  var phoneLatLng = null;
  var hereLabel = 'ROVER';             // shown on the ◎ button

  map.on('dragstart', function () { follow = false; });

  function setStatus(text, tone) {
    var el = document.getElementById('status');
    if (!el) return;
    el.textContent = text;
    el.className = tone === 'warn' ? 'warn' : '';
  }

  function target() { return focus === 'phone' ? (phoneLatLng || roverLatLng) : (roverLatLng || phoneLatLng); }

  /** Centre the map on the followed marker, zooming in if we are still far out. */
  function recentre(ll, minZoom) {
    if (!ll) return;
    var z = Math.max(map.getZoom(), minZoom || 17);
    map.setView(ll, z, { animate: true });
    follow = true;
  }

  /* ---- captured mapping points (boundary corners, block corners, stop points, base) ---- */
  var pins = {};
  function pinIcon(kind, label) {
    var c = KIND_COLORS[kind] || KIND_COLORS.block;
    var size = c.size || 12;
    var html = '<div class="map-pin" style="width:' + size + 'px;height:' + size + 'px;background:' + c.bg +
      ';box-shadow:0 0 0 4px ' + c.ring + '"></div>' +
      (label ? '<div class="pin-label">' + String(label).replace(/[<>&]/g, '') + '</div>' : '');
    return L.divIcon({ className: '', html: html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }
  function renderPoints(list) {
    var seen = {};
    (list || []).forEach(function (p) {
      if (!p || typeof p.latitude !== 'number') return;
      seen[p.id] = true;
      var ll = [p.latitude, p.longitude];
      var existing = pins[p.id];
      if (existing) {
        existing.setLatLng(ll);
        existing.setIcon(pinIcon(p.kind, p.label));
      } else {
        pins[p.id] = L.marker(ll, { icon: pinIcon(p.kind, p.label), keyboard: false }).addTo(map);
      }
    });
    Object.keys(pins).forEach(function (id) {
      if (!seen[id]) { map.removeLayer(pins[id]); delete pins[id]; }
    });
  }

  /* ---- the phone's own position (walk-the-block mode) ---- */
  var phoneMarker = null, phoneRing = null;
  function phoneIcon(accuracy) {
    /* The colour tells the walker whether the corner they are standing on is
       worth capturing: green = a couple of metres, amber = tens, red = put the
       phone in your pocket and wait for a better fix. */
    var rough = typeof accuracy === 'number' && accuracy > 30;
    var mid = typeof accuracy === 'number' && accuracy > 15 && accuracy <= 30;
    KIND_COLORS.phone = rough
      ? { bg: '#ef4444', ring: '#fee2e2', size: 16 }
      : mid
        ? { bg: '#f59e0b', ring: '#fef3c7', size: 15 }
        : { bg: '#2563eb', ring: '#dbeafe', size: 14 };
    return pinIcon('phone', rough ? 'you (±' + Math.round(accuracy) + 'm)' : 'you');
  }
  function renderPhone(data) {
    if (!data || data.active === false) {
      if (phoneMarker) { map.removeLayer(phoneMarker); phoneMarker = null; }
      if (phoneRing) { map.removeLayer(phoneRing); phoneRing = null; }
      phoneLatLng = null;
      if (focus === 'phone') { focus = 'rover'; hereLabel = 'ROVER'; recentre(roverLatLng, 16); }
      return;
    }
    var ll = [data.latitude, data.longitude];
    phoneLatLng = L.latLng(ll);
    if (!phoneMarker) {
      phoneMarker = L.marker(ll, { icon: phoneIcon(data.accuracy), keyboard: false }).addTo(map);
      phoneRing = L.circle(ll, { radius: Math.max(3, data.accuracy || 5), color: '#2563eb', weight: 1, fillOpacity: 0.08 }).addTo(map);
      // Walking started (or the walker reappeared): go to them, at walking zoom.
      focus = 'phone';
      hereLabel = 'ME';
      recentre(phoneLatLng, 18);
      setStatus('FOLLOWING YOUR PHONE', 'ok');
    } else {
      phoneMarker.setLatLng(ll);
      phoneMarker.setIcon(phoneIcon(data.accuracy));
      phoneRing.setLatLng(ll);
      phoneRing.setRadius(Math.max(3, data.accuracy || 5));
      if (follow && focus === 'phone') map.panTo(phoneLatLng, { animate: true });
    }
  }

  function handle(raw) {
    try {
      var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!data) return;
      if (data.type === 'position') {
        roverLatLng = L.latLng(data.latitude, data.longitude);
        marker.setLatLng(roverLatLng);
        if (Array.isArray(data.trail)) trail.setLatLngs(data.trail);
        if (follow && focus === 'rover') map.panTo(roverLatLng, { animate: true });
        if (data.status) setStatus(String(data.status), data.statusTone);
      } else if (data.type === 'points') {
        renderPoints(data.points);
      } else if (data.type === 'phone') {
        renderPhone(data);
      } else if (data.type === 'trace') {
        walked.setLatLngs(Array.isArray(data.points) ? data.points : []);
      } else if (data.type === 'focus') {
        focus = data.target === 'phone' ? 'phone' : 'rover';
        hereLabel = focus === 'phone' ? 'ME' : 'ROVER';
        recentre(target(), focus === 'phone' ? 18 : 17);
      } else if (data.type === 'follow') {
        follow = data.enabled !== false;
        if (follow) map.panTo(target() || map.getCenter(), { animate: true });
      } else if (data.type === 'provider' && PROVIDERS[data.id]) {
        useProvider(data.id, false);
      } else if (data.type === 'fit') {
        fitAll();
      }
    } catch (e) { /* ignore malformed */ }
  }

  /** ⤢ — frame everything the map knows about, or just the followed marker. */
  function fitAll() {
    var pts = [];
    if (roverLatLng) pts.push(roverLatLng);
    if (phoneLatLng) pts.push(phoneLatLng);
    Object.keys(pins).forEach(function (id) { pts.push(pins[id].getLatLng()); });
    if (trail.getLatLngs().length) trail.getLatLngs().forEach(function (ll) { pts.push(ll); });
    if (walked.getLatLngs().length) walked.getLatLngs().forEach(function (ll) { pts.push(ll); });
    if (pts.length < 2) { recentre(pts[0] || target(), 17); return; }
    map.fitBounds(L.latLngBounds(pts).pad(0.2), { animate: true });
    follow = false;   // the operator asked to see everything; do not yank it back
    setStatus('SHOWING EVERYTHING', 'ok');
  }

  function emit(payload) {
    var text = JSON.stringify(payload);
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(text);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(text, '*');
      }
    } catch (e) { /* ignore */ }
  }

  /* ---- buttons (never let their clicks fall through to "mark a point") ---- */
  function bind(id, fn) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function (ev) {
      L.DomEvent.stopPropagation(ev);
      ev.preventDefault();
      fn(ev);
    });
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }
  bind('z-in', function () { map.setZoom(map.getZoom() + 1); });
  bind('z-out', function () { map.setZoom(map.getZoom() - 1); });
  bind('z-here', function () { recentre(target(), focus === 'phone' ? 18 : 17); });
  bind('z-fit', function () { fitAll(); });
  ['satellite', 'streets', 'terrain'].forEach(function (key) {
    bind('p-' + key, function () { useProvider(key, true); });
  });

  if (INTERACTIVE) {
    map.on('click', function (e) {
      emit({ type: 'tap', latitude: e.latlng.lat, longitude: e.latlng.lng });
    });
  }

  /* Provider: the app's choice wins, then the last one used on this device. */
  var wanted = PROVIDERS[START_PROVIDER] ? START_PROVIDER : 'google';
  if (!wanted) { try { wanted = window.localStorage.getItem('chrclient.map.provider') || 'google'; } catch (e) { wanted = 'google'; } }
  // A phone that still holds round-3's stored choice ('satellite') would keep
  // the provider with no imagery, so the old default is migrated once.
  var storedWanted = null;
  try { storedWanted = window.localStorage.getItem('chrclient.map.provider'); } catch (e) { storedWanted = null; }
  var migrated = null;
  try { migrated = window.localStorage.getItem('chrclient.map.provider.v2'); } catch (e) { migrated = null; }
  if (migrated !== '1') {
    try { window.localStorage.setItem('chrclient.map.provider.v2', '1'); } catch (e) { /* blocked */ }
    if (storedWanted === 'satellite') { wanted = 'google'; }
  }
  useProvider(wanted, false);
  setStatus('LIVE MAP READY', 'ok');

  /* RN WebView (Android fires on document, iOS on window) + iframe postMessage */
  document.addEventListener('message', function (e) { handle(e.data); });
  window.addEventListener('message', function (e) { handle(e.data); });
  emit({ type: 'ready' });
</script>
</body>
</html>`;
}
