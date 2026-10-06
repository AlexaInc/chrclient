# chrclient — AI Crop Robot (Mobile / Client App)

> ✅ **Status: in use.** Every item on the project list is built and running: live maps and
> field mapping, robot and pump control, irrigation per well, WhatsApp operator control, app
> updates, dark mode and phone notifications. The **[Manual](#manual--what-is-finished-and-how-to-use-it)**
> below is the operator's guide to all of it — start there.

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
- [Manual — what is finished and how to use it](#manual--what-is-finished-and-how-to-use-it)
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
{ "Type": "motion_config", "Message": { "reason": "avoiding", "avoidState": "steer-right", "avoidDir": 1,
    "blockedBy": "plant-left", "gapLeftCm": 20, "gapRightCm": 48, "frontCm": 26, "appliedPwm": 61,
    "driveSpeedPercent": 70, "turnSpeedPercent": 65, "sensorAngleLeftDeg": 45, "sensorAngleRightDeg": 45, "avoidAssist": true } }
{ "Type": "alert",     "Message": { "severity": "warning", "title": "Pest detected", "description": "Aphids in Block C" } }
```

All envelope/payload TypeScript types live in `src/types/messages.ts`
(`RealtimeEnvelope` discriminated union + `parseEnvelope()` validator); the
avoidance sentences the screens show are built by
`src/scripts/robotMotion.ts` (`describeAvoidState()`, `isAvoiding()`,
`isStuck()`), so the Controller banner and the Settings report always agree.
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
| `set_speed` | `{ percent }` or `{ driveSpeedPercent, turnSpeedPercent, sensorAngleLeftDeg, sensorAngleRightDeg, avoidAssist }` (speeds 0-100 %, angles 0-80°) | Settings → robot speed limits + front-arc geometry |
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
| `apply_config` | `FleetConfig` (patrol geometry, thresholds, **robot speed limits**, **front-arc angles + avoid assist**) | Settings |
| `add_field_boundary` | — | Location |

UI code never touches the socket directly for actions — everything goes through the
typed service `src/scripts/Commands.ts` (ack timeout 5 s, resolves
`{success:false, reason}` instead of throwing) and the `useCommand()` hook
(`src/hooks/useCommand.ts`) which provides pending state + auto-clearing ack feedback
(`src/components/ActionFeedback.tsx`). In **demo mode** commands are acked locally, so
every button works without a server.

### Robot speed limits, front-arc sensors & SD field-map cache (Settings)

`Settings → Fleet Configuration` now starts with the values that decide how the
rover moves:

* **Robot Drive Speed** and **Robot Turn Speed** — percentages of the safe
  cruise/turn values compiled into the firmware. 100 % is the fastest the rover
  is allowed to move; the firmware clamps every value against its own hard
  ceiling, so the panel can only ever make it **slower**. Saving pushes
  `apply_config` (stored server-side and forwarded to the rover as
  `motion_config`); the SD-card copy on the rover means it keeps obeying the
  limit after a reboot even while the server is unreachable.
* **Left / Right Sensor Angle** (25-80°) — the angle the ultrasonic brackets are
  really bolted at, measured outwards from straight ahead. The rover turns each
  side reading into *"how wide is the gap on that side"* with this number, so
  after re-bolting a bracket you only change this setting; there is nothing to
  re-flash. With the side beams splayed outwards the three cones overlap, which
  is what removes the blind spots at the front corners.
* **Auto-avoid steering (manual driving)** — ON: holding a drive button at a
  plant makes the rover steer around it and creep past instead of stopping at
  the safety distance. OFF: it brakes at the safety distance and the operator
  decides. Autonomous mode always avoids; it only stops when no side gap is wide
  enough to pass.
* Under the sliders the app echoes the rover's own report:
  `Rover reports: 77 PWM drive · 62 PWM turn · hard ceiling 150 PWM`,
  `Motors now at 44 PWM · arc ±45°/±45°`, plus a plain-language line while a
  manoeuvre is running, e.g. *"Going around a plant — steering right (26 cm
  ahead · gaps 20 cm left / 48 cm right)"*.
* **Field map (SD cache)** — a third device-status card shows whether the rover
  already holds the current map (`IN SYNC`) or needs it re-sent
  (`NOT SYNCED`), using `status.fieldMap` (`serverRev` vs `robotRev`).
* On the **Controller** screen the live *Speed limit* and *Front arc* rows show
  what the rover is configured with next to the PWM it is using right now. A
  blue banner reports a manoeuvre (going around a plant), a red one the only
  self-protection stop that is left (`no-path` / `emergency`), an amber one the
  dead-man failsafe — so the operator sees *why* the rover is doing what it is
  doing instead of guessing. While a plant is close, the ultrasonic bars mark
  the centre and the two angled side beams separately.

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

## Manual — what is finished and how to use it

Everything in this section is **done and running in the current build**. It is written the way
you would hand the app to another operator: what to do, in what order, and what you should see.
Nothing here needs code changes — where a step is one-time, it says so.

### 1. First run on a phone (5 minutes)

1. Install the APK from the newest **GitHub release** (`latest`), or open the web build that
   chrserver serves from its own `public/` folder.
2. Log in with the operator account (or **`demo` / `demo`** to look around with no robot —
   the app then shows a *DEMO DATA* badge and never talks to the server).
3. **Settings → NOTIFICATIONS** → the alert switch is ON on a fresh install. Press
   **Register this phone**, then **Send test notification**. The test must appear in the phone's
   own notification bar — see *§6 Notifications* for the one-time Firebase step that makes them
   arrive with the app closed.
4. **Settings → DISPLAY & APP**: pick **DARK MODE** if the phone sits on the rover, and leave
   *Show dots on graphs* OFF (the smooth line is the default view).
5. **Settings → MAP STYLE**: SATELLITE is the default. Change it to STREETS or TERRAIN from here
   or from the buttons on any map — all four maps follow the choice.

### 2. The map

* **Zoom is free.** Pinch, or use `+` / `−` on the map, down to the whole island and up to
  street level (the imagery upscales past zoom 19 instead of going blank).
* **Which tiles**: satellite imagery by default (Esri World Imagery with place labels),
  OpenStreetMap for streets, OpenTopoMap for terrain contours.
* **No robot connected?** The map still opens — on the field position
  `7.489087449264883, 80.36537714662697` with the note *DEFAULT POSITION • ROBOT OFFLINE*.
  An empty grey map means the phone has no tiles (no data); the position stays live.
* **`◎`** re-centres on the rover, **`⤢`** opens the map full-screen (the same live map, not a
  screenshot), and the row of chips switches provider without leaving the screen.
* The rover's dot is coloured by GPS accuracy (green ≤ 15 m, amber ≤ 30 m, red beyond, with the
  `±Nm` figure beside it), and the recent GPS trail is drawn behind it.

### 3. Mapping a crop block (mapping screen)

1. Open **Mapping**. Mark the block either by **walking it with the phone** (PHONE WALK — the map
   centres on the phone by itself, and every few metres a point is recorded; the dashed line is
   your trace) or by **driving the rover** and tapping the map, or by typing coordinates.
2. Points are only accepted when the reading is good enough (accuracy gate 25 m); the screen says
   why a tap was refused instead of silently dropping it.
3. Press **STOP / SAVE**. The block is stored with its **stop points**, and those stop points are
   reused the next time the block is re-mapped — you do not re-walk them.
4. **FULL SCREEN** gives you the whole screen for marking; **CENTRE ON ME / ROBOT** switches what
   the map follows.

### 4. Driving the robot safely

* The **Controller** screen always shows the live map, the three ultrasonic distances (front,
  left, right — the side beams mark their bracket angle separately) and the speed the rover is
  really using.
* Nothing can be driven faster than the firmware's own ceiling: the Settings sliders only make
  the rover **slower**. Drive 70 % / turn 65 % is the fresh-install default because the rover
  works between closely planted crops.
* Side-sensor bracket angles default to **35°** (the angle the brackets are bolted at). After
  re-bolting a bracket you change this number in Settings — nothing to re-flash.
* **Auto-avoid** (ON by default) steers around a plant and creeps past; with it off the rover
  brakes at the safety distance. A blue banner tells you a manoeuvre is running, red one of the
  two self-protection stops (`no-path`, `emergency`), amber the dead-man failsafe — so you always
  know *why* the rover stopped.
* **Rain** (≥ 60 %, with hysteresis) → the pump is switched off, the rover returns to base, every
  owner number is alerted, and the petrol-empty state is reported in the same alert.
* **Petrol empty** blocks a new mission until it is refilled (`POST /api/safety/fuel-refilled`).

### 5. Irrigation (per well)

* The robot has **no soil-moisture sensor** — every moisture reading comes from the **water pump**
  (ESP32-C3). The app says so on the screen, so nobody goes looking for a sensor that is not there.
* Each well has its **own AUTO MOISTURE THRESHOLD**; the fleet value in Settings is only the
  fallback for a well that has never been given one.
* **Pump ON** has an adjustable run time, default **60 s**, and stops by itself.

### 6. Notifications (push to the phone)

The phone gets its own notification for the events that matter — rain, petrol empty, emergency
stop, drive failsafe, robot offline, GPS/field-map problems. They arrive while the app is open
**and, once the one-time step below is done, while the app is closed**.

* **Settings → NOTIFICATIONS** shows the exact state of this phone: *REGISTERED*, *ON (APP
  RUNNING)*, *BLOCKED BY THE PHONE*, or *OFF*, and the reason whenever it is not simply “on”.
* **WHAT SHOULD REACH THE PHONE** — pick the quietest level that still wakes you:
  *Critical only* (rain, petrol, e-stop, failsafe), *Warnings & critical* (default), or
  *Everything*.
* The alert history in the app is not replayed as notifications: opening the app after a week
  does not buzz the phone for last week's alerts.
* **One-time step for notifications while the app is closed** (Android needs Firebase; the app
  itself is already wired for it):
  1. Create a Firebase project and add an Android app with package `com.hansaka01.aicroprobot`.
  2. Put `google-services.json` into the repository as the secret
     **`GOOGLE_SERVICES_JSON_BASE64`** (base64 of that file) — the release workflow writes it into
     the build automatically; without the secret the build still succeeds and notifications stay
     in-app only.
  3. In Firebase → Project settings → **Service accounts**, create a key and upload it to
     **Expo → Credentials → Android → FCM V1 service account key**.
  4. Build once (push the repository), install, then **Settings → NOTIFICATIONS → Send test
     notification**. If the test arrives with the app closed, everything is wired.
* The server side is already in place: `POST /api/push/register`, `GET /api/push`,
  `POST /api/push/test`, `POST /api/push/unregister` (see the chrserver README). `PUSH_ENABLED=false`
  on the server switches all of it off without touching the phones.

### 7. WhatsApp operator control

* **Settings → WHATSAPP SERVICE** links the bot to the operator's number, shows the session state
  (*LINKED* / *PAIRING* / *INVALID*), and can delete the session or re-link another number.
* **Owner numbers**: add them one by one with **Add another number** — up to 10, each with the
  country code. They are stored in the database and every one of them is alerted (and can command)
  the bot.
* Commands use **buttons that follow the live state** (pump ON/OFF and mission start/stop swap
  with what the robot is actually doing) — never a fixed pair.
* Every bot message carries the footer **Powered by hazu@AlexaInc.github.io** in the message
  footer itself, not pasted into the text.

### 8. App updates

* Every app start compares its build stamp with the newest GitHub release.
* **Android**: the new APK downloads and asks for the install confirmation. If the phone refuses
  the “install unknown apps” permission, the app raises a **new version available** notice instead
  — there is no silent hole in the update path.
* **iPhone / web**: a notice with the release link, because those platforms cannot self-install.
* **Settings → DISPLAY & APP** shows *installed version*, *newest release*, *last checked*, and the
  reason for any failure.

### 9. Maintenance checklist

| When | What to do |
| --- | --- |
| A new build is released | Nothing — Android phones update themselves, others show the notice. |
| You move the robot to a new field | Mapping screen → re-map the block (stop points are reused), save; the rover pulls the new map from the SD cache. |
| You re-bolt a sensor bracket | Settings → the matching *Sensor Angle* (°), save. No re-flash. |
| The rover drives too close to plants | Lower *Robot Drive Speed* (Settings). It can only go slower, never faster. |
| Alerts stop reaching a phone | Settings → NOTIFICATIONS: read the state. *BLOCKED* → allow notifications in the phone settings; *ON (APP RUNNING)* → the Firebase step in §6 is still missing. |
| A new phone is added for the family | Log in on it, then Settings → NOTIFICATIONS → **Register this phone** (up to 20 phones are kept; the least recently used is dropped). |
| WhatsApp bot stops answering | Settings → WHATSAPP SERVICE → the state badge, then **Delete session** and link again. |
| The server stops serving the web app | chrserver fetches the newest chrclient web build at start; restart it once with the release available. |

### Still open (honest list)

- The **one-time Firebase secret** in §6 is the only piece of phone notifications that needs an
  account, not a device: everything up to it is already built.
- **Account / family delete** has no working implementation yet (the app has no delete-account
  call and the server has no route for it). Everything else on the project list is finished.

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
