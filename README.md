# 🌱 AI Crop Robot — Smart Farming App

React Native (Expo) app converted from the **Project.fig** Figma design — an AI-powered smart crop monitoring dashboard with an autonomous rover fleet.

## Screens (all 9 from the Figma file)

| Screen | Contents |
|---|---|
| **Dashboard** | Welcome header, 5 KPI stat cards with sparklines (Crop Health 87%, Soil Moisture 62%, Temperature 28°C, Pest Alerts 2, Field A), Robot Status card, Current Location map, Pest Alerts, Crop Health Analytics line chart, Recent Activity, Quick Summary |
| **Robot** | Fleet management, Rover Alpha-01 active unit, battery/solar, speed & RTK precision, live unit controls, diagnostics, mission progress, real-time sensor streams |
| **Crops** | Crop inventory & health intelligence, 5 KPI cards, sensor array hub with crop tabs, phenological growth stage tracker, substrate vitals (EC, pH, PAR, CO₂) |
| **AI Scan** | Edge AI inference stream, 4K gimbal camera feed with HUD overlay, channel tabs (RGB/NIR/NDVI/Thermal), optical zoom, detection & classification stream |
| **Location** | Geospatial intelligence, field area/rovers/RTK/geofence/microclimate KPIs, interactive parcel digital twin map with layers, rover tracking, RTK status |
| **Analytics** | Yield intelligence, projected yield/Brix/harvest readiness KPIs, digital twin simulation, weekly harvest bar chart, Brix accumulation curve |
| **Alerts** | Hazard intelligence, active hazards/MTTR/sensor integrity KPIs, live anomaly inspection, incident queue, hazard frequency chart |
| **Reports** | Agronomy & telemetry reports, compliance/carbon offset KPIs, ISO dossier, recent report list, compliance trend chart |
| **Settings** | Fleet status cards, autonomous navigation config (velocity, LiDAR clearance, RTB protocol), Edge AI & vision parameters (model, FPS, confidence threshold) |

Navigation: **responsive** — on phones/small windows a slide-in drawer replicating the dark-green Figma sidebar (gradient active item, alert badge, Sustainable Agriculture promo card); on desktop/web ≥1024px the sidebar becomes **permanent**, matching the original PC design.

## Responsive behaviour (mobile ↔ desktop)

| | Mobile (<1024px) | Desktop / Web (≥1024px) |
|---|---|---|
| Sidebar | Hamburger → slide-in drawer | Permanent fixed sidebar (like Figma) |
| Header | Menu button + compact search | Full search bar + Admin profile block |
| KPI cards | Horizontal swipe rail | Wrapping multi-column grid |
| Dashboard layout | Stacked cards | Figma 12-col grid (5/4/3 middle row, 7/5 lower row) |
| Charts | Fill screen width | Auto-measure & fill card column (`AutoWidth`) |
| Hero images / camera feed | Compact heights | Taller (up to 420px) |
| Content | Edge-to-edge | Centered, max-width 1120px |

Resize the browser window — the layout switches live at the 1024px breakpoint.

## Run with Expo Go (on your phone)

1. Install **Expo Go** from the App Store / Play Store.
2. On your computer:
   ```bash
   cd ai-crop-robot
   npm install
   npx expo start
   ```
3. Scan the QR code shown in the terminal:
   - **Android** → scan from inside the Expo Go app
   - **iOS** → scan with the Camera app
4. The app opens in Expo Go. Phone and computer must be on the same Wi-Fi.

## Run on web

```bash
npx expo start --web
```

## Project structure

```
src/
  theme/index.ts            # Figma color tokens, radii, spacing
  components/
    ui.tsx                  # Card, Badge, IconBox, PillButton, ProgressBar...
    charts.tsx              # Sparkline, LineChart, BarChart (react-native-svg)
    Header.tsx              # Top bar: menu, search, bell badge, avatar
  navigation/
    DrawerContent.tsx       # Custom dark-green sidebar drawer
  screens/                  # 9 screens matching the Figma pages
assets/images/              # Images extracted from the .fig file
```

## Tech

- Expo SDK 54, TypeScript
- **NativeWind v4 (Tailwind CSS)** — all screens & components styled with `className` utilities
- @react-navigation/drawer
- react-native-svg (charts), expo-linear-gradient
- Design tokens pulled directly from the Figma file — custom Tailwind theme in `tailwind.config.js` (`brand-*` emerald palette, `sidebar`, `surface` colors)

## NativeWind setup files

- `tailwind.config.js` — content paths + custom Figma color theme
- `global.css` — Tailwind directives (imported in `App.tsx`)
- `babel.config.js` — `nativewind/babel` preset + jsxImportSource
- `metro.config.js` — `withNativeWind` wrapper
- `nativewind-env.d.ts` — className typings
