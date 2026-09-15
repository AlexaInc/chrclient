# chrclient — AI Crop Robot (Mobile / Client App)

> 🚧 **Status: Work in progress.** This app is still being actively developed — screens,
> features, and the server integration are evolving. Expect things to change.

Hi 👋 I'm **Hansaka.** This repository is the **client application** for our
**AI Smart Crop Health Monitoring Robot** — a Year 1 / Semester 1 mini project for the module
**IT1140 – Fundamentals of Computing** at the **Sri Lanka Institute of Information Technology
(SLIIT)**, IT Late Intake July, Kurunegala.

`chrclient` is the cross-platform app (Android / iOS / Web) that farmers and operators use to
**monitor crops, view sensor data, control the robot, and see AI disease-scan results** in
real time. It talks to our backend server ([`chrserver`](https://github.com/AlexaInc/chrserver))
over a REST API for login and a Socket.IO connection for live data and commands.

---

## Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [App Screens](#app-screens)
- [How It Connects to the Robot](#how-it-connects-to-the-robot)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Available Scripts](#available-scripts)
- [Authentication Flow](#authentication-flow)
- [Real-Time Messaging](#real-time-messaging)
- [Roadmap](#roadmap)
- [Team & Credits](#team--credits)
- [License & Usage](#license--usage)

---

## About the Project

Our robot uses an **ESP32-S3** controller with multiple sensors and an AI camera to monitor
crop health, soil conditions, and the field environment. It detects plant diseases and supports
automated irrigation. The full system has three main parts:

- **The Robot (ESP32-S3)** — collects sensor data and crop images, runs edge AI, handles
  irrigation.
- **[chrserver](https://github.com/AlexaInc/chrserver)** — the backend server that relays data
  and commands.
- **chrclient (this repo)** — the mobile/web app the user actually looks at and controls the
  system with.

---

## Features

- 📊 **Dashboard** — live overview of the farm, robot status, and key sensor readings.
- 🤖 **Robot control** — send commands to the robot in real time.
- 🌱 **Crops** — track crop information and conditions.
- 🔬 **AI Scan** — view AI-based crop disease-detection results from the camera.
- 📍 **Location** — see the robot / field map position.
- 📈 **Analytics** — charts and trends from collected data.
- 🔔 **Alerts** — get notified when abnormal conditions are detected.
- 📄 **Reports** — summaries of field activity and results.
- ⚙️ **Settings** — app and connection configuration.
- 🔐 **Secure login** — the app starts unauthorized and blocks until login succeeds; credentials
  are hashed client-side before being sent.
- 📱 **Responsive layout** — adapts between mobile (drawer overlay) and desktop/tablet
  (permanent sidebar).

---

## Tech Stack

| Layer             | Technology                                        |
| ----------------- | ------------------------------------------------- |
| Framework         | React Native `0.86` + Expo `~57`                  |
| Language          | TypeScript                                        |
| UI runtime        | React `19`                                        |
| Navigation        | React Navigation (Drawer)                         |
| Styling           | NativeWind (Tailwind CSS for RN) + custom theme   |
| Graphics / charts | react-native-svg + custom chart components        |
| Real-time         | socket.io-client                                  |
| Storage           | react-native-mmkv                                 |
| Crypto            | crypto-js / expo-crypto / react-native-quick-crypto|
| Animations        | react-native-reanimated, gesture-handler          |
| Platforms         | Android · iOS · Web                               |

---

## App Screens

The app uses a drawer navigator (`App.tsx`) with these screens:

| Screen        | Purpose                                     |
| ------------- | ------------------------------------------- |
| `Dashboard`   | Main overview and status                    |
| `Robot`       | Robot controls and telemetry                |
| `Crops`       | Crop tracking                               |
| `AIScan`      | AI disease-detection results                |
| `Location`    | Robot/field map location                    |
| `Analytics`   | Charts and data trends                      |
| `Alerts`      | Notifications and warnings                  |
| `Reports`     | Generated reports                           |
| `Settings`    | App and connection settings                 |

---

## How It Connects to the Robot

```
┌──────────────────────────┐   REST: POST /auth/login    ┌───────────────────┐
│  chrclient (this app)    │ ──────────────────────────► │                   │
│  React Native + Expo     │                             │     chrserver     │
│  role: "authorized"      │ ◄─── Socket.IO (live) ────► │  (backend relay)  │
└──────────────────────────┘                             └─────────┬─────────┘
                                                                    │ Socket.IO
                                                          ┌─────────▼─────────┐
                                                          │  ESP32-S3 Robot   │
                                                          │  role: "esp_32"   │
                                                          └───────────────────┘
```

The app authenticates over REST, then opens a Socket.IO connection (as an `authorized` client)
to send control commands to the robot and receive live sensor/scan data through the server.

### Realtime message contract (`message.upsert`)

Every realtime update the server sends arrives on a **single Socket.IO event** named
`message.upsert`, wrapped in an envelope whose `Type` field tells the client how to
interpret `Message`:

```jsonc
// socket.emit('message.upsert', envelope) — examples:
{ "Type": "location",  "Message": { "latitude": 6.9271, "longitude": 79.8612, "altitude": 15.4, "satellites": 7 } }
{ "Type": "telemetry", "Message": { "speed": 1.4, "heading": 42, "routeProgress": 78, "rowsDone": 14, "rowsTotal": 18 } }
{ "Type": "battery",   "Message": { "level": 82, "solarWatts": 94, "minutesRemaining": 255 } }
{ "Type": "status",    "Message": { "state": "patrolling", "mode": "Autonomous Weeding", "currentRow": 14, "totalRows": 18 } }
{ "Type": "sensors",   "Message": { "soilMoisture": 62, "temperature": 28, "cropHealth": 87, "pestAlerts": 2 } }
{ "Type": "alert",     "Message": { "severity": "warning", "title": "Pest detected", "description": "Aphids in Block C" } }
```

All envelope/payload TypeScript types live in `src/types/messages.ts`
(`RealtimeEnvelope` discriminated union + `parseEnvelope()` validator).
`src/realtime/RealtimeContext.tsx` subscribes once to `message.upsert`, reduces the
envelopes into app-wide state, and screens consume it with the `useRealtime()` hook.

### Command contract (`control_message`)

Every button/icon action in the UI is emitted on the single event `control_message`
with a Socket.IO **ack callback** the server must invoke:

```js
socket.on('control_message', (msg, ack) => {
  // msg = { action: '<name>', data?: {...}, timestamp: 169... }
  // ... perform / forward to robot ...
  ack({ success: true, message: 'patrol paused' });
  // or: ack({ success: false, reason: 'robot offline' });
});
```

Actions the client sends (full types in `src/types/actions.ts`, `ControlAction` union):

| action | data | sent from |
|---|---|---|
| `stop` | `{ speed? }` | Robot E-Stop |
| `start_patrol` / `pause_patrol` / `return_to_base` / `calibrate_gimbal` | — | Robot unit controls |
| `manual_teleop` | `{ enabled }` | Robot unit controls |
| `change_mode` | `{ mode: 'autonomous'\|'manual'\|'paused'\|'charging' }` | Robot operator mode |
| `set_speed` | `{ speed }` | Settings |
| `deploy_mission` / `deploy_waypoint_mission` | `{ name?, blocks?, waypoints? }` | Robot / Location |
| `camera_set_channel` | `{ channel: 'rgb'\|'nir'\|'ndvi'\|'thermal' }` | AI Scan |
| `camera_set_zoom` | `{ zoom: '1x'\|'2x'\|'4x'\|'macro' }` | AI Scan |
| `camera_record` | `{ recording }` | AI Scan |
| `camera_capture_burst` | `{ frames? }` | AI Scan |
| `acknowledge_alerts` | `{ ids? }` | Alerts |
| `export_report` | `{ kind, format, from?, to? }` | Alerts / Analytics / Crops |
| `schedule_report` | `{ kind, every, format }` | Reports |
| `run_predictive_model` | `{ crop? }` | Analytics |
| `register_crop_batch` | `{ crop, block?, plantedAt?, notes? }` | Crops |
| `select_crop_source` | `{ crop }` | Crops sensor hub |
| `apply_config` | `FleetConfig` (speed, clearance, RTB, spray, confidence…) | Settings |
| `add_field_boundary` | — | Location |

UI code never touches the socket directly for actions — everything goes through the
typed service `src/scripts/Commands.ts` (ack timeout 5 s, resolves
`{success:false, reason}` instead of throwing) and the `useCommand()` hook
(`src/hooks/useCommand.ts`) which provides pending state + auto-clearing ack feedback
(`src/components/ActionFeedback.tsx`). In **demo mode** commands are acked locally, so
every button works without a server.

### Demo mode

Log in with **username `demo` / password `demo`** to run the app with **no server**:
the socket is never opened and `src/realtime/demoSimulator.ts` fabricates the same
`message.upsert` envelopes on a timer (moving GPS track in Colombo, draining battery,
sensor drift, periodic alerts). Screens show a "DEMO DATA" badge in this mode.

### Live map

`src/map/LiveMap.tsx` renders an OpenStreetMap/Leaflet map (WebView on Android/iOS —
Expo Go compatible; iframe on web) showing the rover's live position and recent GPS
trail, updated in place via `postMessage` — no reloads between fixes.

---

## Project Structure

```
chrclient/
├── App.tsx                     # Root: navigation, providers, login gate
├── index.ts                    # Entry point
├── app.json                    # Expo app config
├── src/
│   ├── config.ts               # Server URL configuration
│   ├── theme/                  # Colors and theme
│   ├── auth/
│   │   ├── AuthContext.tsx     # Login state, token, socket connect/disconnect
│   │   └── LoginModal.tsx      # Blocking login UI
│   ├── navigation/
│   │   └── DrawerContent.tsx   # Sidebar / drawer
│   ├── components/             # Header, UI, charts, field map card
│   ├── screens/                # Dashboard, Robot, Crops, AIScan, etc.
│   └── scripts/
│       ├── Websocket.tsx       # Socket.IO client helpers
│       ├── Cryptohelper.ts     # Native crypto (hashing/nonce)
│       └── Cryptohelper.web.ts # Web crypto implementation
└── assets/                     # Icons and images
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (recommended 20+)
- **npm**
- **Expo Go** app on your phone, or an Android/iOS emulator
- Our backend [`chrserver`](https://github.com/AlexaInc/chrserver) running and reachable

### Installation

```bash
# Clone the repository
git clone https://github.com/AlexaInc/chrclient.git
cd chrclient

# Install dependencies
npm install
```

### Run the app

```bash
npm start        # start the Expo dev server (then scan the QR with Expo Go)
npm run android  # open on Android emulator/device
npm run ios      # open on iOS simulator (macOS)
npm run web      # run in the browser
```

> 💡 **Tip:** Try logging in with username `demo` and password `demo` to explore the app in
> demo mode without a live server.

---

## Configuration

The app needs to know where the backend server is. This is set in `src/config.ts` and can be
overridden with an environment variable:

```bash
# .env
EXPO_PUBLIC_SERVER_URL=http://192.168.0.2:8000
```

| Variable                 | Default                  | Description                                         |
| ------------------------ | ------------------------ | --------------------------------------------------- |
| `EXPO_PUBLIC_SERVER_URL` | `http://192.168.1.3:8000`| Base URL of `chrserver` (used for both REST + WS).  |

> ⚠️ Make sure your phone and the machine running `chrserver` are on the **same network**, and
> update the IP to match your server. `localhost` will not work from a physical phone.

---

## Available Scripts

| Script            | Description                                |
| ----------------- | ------------------------------------------ |
| `npm start`       | Start the Expo development server.         |
| `npm run android` | Launch on an Android device/emulator.      |
| `npm run ios`     | Launch on an iOS simulator.                |
| `npm run web`     | Run the app in a web browser.              |

---

## Authentication Flow

The app **starts unauthorized**. A blocking `LoginModal` stays up until login succeeds:

1. User enters username + password.
2. The client generates a nonce and **hashes the credentials** (`Cryptohelper`) before sending.
3. It sends `POST {SERVER_URL}/auth/login`.
4. On success, it stores the returned **token**, sets the user, and **connects the Socket.IO
   client** with that token.
5. Logging out disconnects the socket and clears the session.

> A built-in `demo` / `demo` login lets you preview the app without the backend.

---

## Real-Time Messaging

Socket.IO helpers live in `src/scripts/Websocket.tsx`:

- `connectSocket(serverUrl, token)` — connect as an `authorized` client (transports: polling +
  websocket).
- `emitMessage(event, data)` — send an event to the server (e.g. control commands).
- `addEventListener(event, cb)` / `removeEventListener(event)` — subscribe to live updates.
- `disconnectSocket()` — tear down the connection.

The socket connects **only after a successful login**, using the auth token.

---

## Roadmap

Since this project is still ongoing, here's roughly what's done and what's next:

- [x] App navigation, screens, and responsive layout
- [x] Login flow with client-side hashing + demo mode
- [x] Socket.IO connection to the backend
- [ ] Wire every screen to live server/robot data
- [ ] Full AI-scan results view
- [ ] Persist session/token across app restarts
- [ ] Push notifications for alerts
- [ ] Polish, testing, and final evaluation

---

## Team & Credits

**Group 01 — SLIIT, BSc (Hons) in Information Technology (IT Late Intake July, Kurunegala)**

Maintained and written by **Hansaka (Alexainc)**.

| Role                | Member                                                                                                                              |
| ------------------- |-------------------------------------------------------------------------------------------------------------------------------------|
| 🎨 **UI/UX Design** | Amalka [IT26101774] — [github.com/amalka321](https://github.com/amalka321)                                                          |
| 💻 **Development**  | Hansaka [IT26101404]  — [github.com/AlexaInc](https://github.com/AlexaInc) · [github.com/it26101404](https://github.com/it26101404) |

**Full team:**

| IT Number   | Name                    |
| ----------- | ----------------------- |
| IT26101404  | P.G. Hansaka Rasanjana  |
| IT26101824  | T.D. Avishka Dewinda    |
| IT26101774  | P.G. Amalka Sandanayani |
| IT26102072  | N.D. Maddumage          |
| IT26100283  | M.K.M. Raamy Khaleel    |

---

## License & Usage

**© 2026 Group 01 (SLIIT IT Late Intake July, Kurunegala). All rights reserved.**

This project — including its concept, idea, design, and source code — is the original work and
intellectual property of Group 01. It is **not** open source and is **not** released under any
permissive license (no MIT, Apache, or similar).

**You may:**

- View and inspect the code and **architecture** for **educational and reference purposes only**.

**You may NOT:**

- Use, copy, reuse, or redistribute this project or any part of it for **commercial use**.
- Use it for **any other purpose** beyond educational inspection.
- Reproduce, adapt, or build upon the **underlying idea/concept** — the idea is not open to
  everyone and remains the exclusive property of the authors.
- Claim, submit, or present this work (or the idea behind it) as your own.

Any use beyond educational inspection of the architecture requires the **prior written
permission** of the project authors.
