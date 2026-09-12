/**
 * Self-contained Leaflet map page rendered inside a WebView (native) or an
 * iframe (web). It draws the rover marker + its recent GPS trail and listens
 * for JSON messages of the shape:
 *
 *     { type: 'position', latitude, longitude, trail: [[lat,lng], ...] }
 *
 * sent via WebView.postMessage / iframe contentWindow.postMessage, so the
 * marker glides live without reloading tiles.
 */
export function buildLeafletHtml(lat: number, lng: number, zoom = 17): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #e8efe9; }
  .rover-dot {
    width: 18px; height: 18px; border-radius: 50%;
    background: #10b981; border: 3px solid #ffffff;
    box-shadow: 0 0 0 6px rgba(16,185,129,0.25);
  }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], ${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  var icon = L.divIcon({ className: '', html: '<div class="rover-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  var marker = L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);
  var trail = L.polyline([], { color: '#10b981', weight: 3, opacity: 0.8 }).addTo(map);
  var follow = true;
  map.on('dragstart', function () { follow = false; });

  function handle(raw) {
    try {
      var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!data || data.type !== 'position') return;
      var ll = [data.latitude, data.longitude];
      marker.setLatLng(ll);
      if (Array.isArray(data.trail)) trail.setLatLngs(data.trail);
      if (follow) map.panTo(ll, { animate: true });
    } catch (e) { /* ignore malformed */ }
  }

  /* RN WebView (Android fires on document, iOS on window) + iframe postMessage */
  document.addEventListener('message', function (e) { handle(e.data); });
  window.addEventListener('message', function (e) { handle(e.data); });
</script>
</body>
</html>`;
}
