<div align="center">

# FitFreak

**A workout and nutrition tracker that shows which muscles you've trained on a 3D body model.**

Log your sets, track your meals, and see training load across 31 muscle groups, all in one Android app that keeps working offline.

[![Download APK](https://img.shields.io/badge/Download-APK-2ea44f?style=for-the-badge&logo=android&logoColor=white)](https://github.com/Mk-debugger11/FitFreak/releases/latest/download/FitFreak.apk)

[![Android APK Release](https://github.com/Mk-debugger11/FitFreak/actions/workflows/android-release.yml/badge.svg)](https://github.com/Mk-debugger11/FitFreak/actions/workflows/android-release.yml)
[![Backend CI/CD](https://github.com/Mk-debugger11/FitFreak/actions/workflows/ci.yml/badge.svg)](https://github.com/Mk-debugger11/FitFreak/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/Mk-debugger11/FitFreak)](https://github.com/Mk-debugger11/FitFreak/releases/latest)

</div>

---

## Download

**[⬇ Download the latest APK](https://github.com/Mk-debugger11/FitFreak/releases/latest/download/FitFreak.apk)** (Android 7.0+)

1. Open the link on your Android phone and download `FitFreak.apk`.
2. Open the file. If Android asks, allow installs from your browser or file manager.
3. Launch FitFreak. It connects to the hosted API at `https://mukulkr.space/api` automatically.

Older versions are on the [Releases page](https://github.com/Mk-debugger11/FitFreak/releases).

---

## Features

### 🏠 Home: 3D muscle heatmap
- An interactive anatomical body model (Three.js) you can rotate and zoom. Each of the **31 muscle groups** is colored by how much you've trained it.
- Switch between **daily** and **weekly** views. Tap a muscle to see its training load and which exercises contributed.
- The scoring engine gives full credit to primary movers and partial credit to secondary and stabilizer muscles. It sorts each muscle into volume zones, from *warm-up only* through *optimal* to *diminishing returns*.
- A calorie card shows today's intake against your target.

### 🏋️ Workout logging
- A catalog of **62 exercises** across chest, back, shoulders, arms, legs, core and neck. You can also add your own exercises.
- Supports dumbbell, barbell, machine, cable and bodyweight exercises.
- A live workout session with a running timer, per-set weight and reps, and a minimized bar so you can leave the screen mid-workout.
- Browse history by date with a horizontal calendar. Set target muscles for the day.
- Export a day's workout as JSON through the system share sheet.

### 🥗 Nutrition
- A catalog of **168 foods** in 9 categories, including Indian cooked dishes. You can add custom foods too.
- Log foods by grams, millilitres or number of pieces, and split them across breakfast, lunch, snacks and dinner.
- Edit the macros of cooked dishes, since home recipes vary.
- Calculates calorie and macro targets from your profile: BMR with **Mifflin-St Jeor**, or **Katch-McArdle** when you've entered body fat %, then adjusted for activity level and goal (cut, maintain or bulk).

### 📶 Offline-first
- Every change appears instantly and is saved on the device. Writes wait in a persistent queue and sync with the server, in order, once you're back online. Nothing is lost if you log a workout with no signal.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Mobile app** | React Native 0.85, Expo SDK 56, TypeScript, React Navigation |
| **State & offline** | Zustand (5 stores), AsyncStorage persistence, NetInfo-driven sync queue |
| **3D rendering** | Three.js, React Three Fiber, Drei, expo-gl |
| **Backend** | Node.js, Express 5, Mongoose |
| **Database** | MongoDB 7.0 |
| **Infrastructure** | Docker, Docker Compose, nginx, Let's Encrypt TLS, Oracle Cloud (ARM64) |
| **CI/CD** | GitHub Actions, GitHub Container Registry, EAS / Gradle Android builds |
| **Testing** | Node test runner (58 unit tests), TypeScript strict typecheck |

---

## Architecture

```
┌──────────────────────────────┐
│  Android app (React Native)  │
│  ├─ UI + 3D body viewer      │
│  ├─ Zustand stores ──────────┼──► AsyncStorage (local cache + write queue)
│  └─ api.ts (single API layer)│
└──────────────┬───────────────┘
               │ HTTPS
               ▼
┌──────────── Oracle Cloud VM (ARM64, Docker Compose) ────────────┐
│  nginx         :80 → 301 to HTTPS, :443 TLS 1.2/1.3              │
│    │           Let's Encrypt certificates                         │
│    ▼                                                              │
│  Express API   :3000   image pulled from GHCR (tagged by commit) │
│    │                                                              │
│    ▼                                                              │
│  MongoDB 7.0   data on a persistent Docker volume                 │
│                                                                   │
│  All three containers share a private Docker network;             │
│  only nginx is exposed to the internet.                           │
└───────────────────────────────────────────────────────────────────┘
```

**How a write flows:** the app updates local state right away and adds the request to a persistent queue. The sync store sends queued requests to the API one at a time, in order. If the phone is offline, the queue stays saved, and `NetworkListener` drains it as soon as the connection returns.

**Data validation:** [`src/services/api.ts`](src/services/api.ts) is the only file that talks to the backend. It parses every response into typed models, so the rest of the app never handles raw or unvalidated data.

---

## CI/CD

Two GitHub Actions workflows handle deployment, with no manual steps.

### Backend: [`ci.yml`](.github/workflows/ci.yml)
Runs on every push to `main` that touches `backend/`, `nginx/` or `docker-compose.yaml`.

1. **Test:** installs dependencies, checks the server code, and validates the Compose file.
2. **Build & push:** builds a `linux/arm64` Docker image with Buildx (with layer caching) and pushes it to GHCR, tagged with the commit SHA and `latest`.
3. **Deploy:** connects to the server over SSH, pulls the new image, and restarts the stack. It then:
   - waits for the Express API to respond
   - checks and reloads the nginx config
   - re-seeds the exercise and food catalogs (safe to run repeatedly)
   - confirms the public HTTPS endpoint returns 200
   - cleans up old images

Every image is tagged with its commit SHA, so rolling back means redeploying an older tag.

### Android: [`android-release.yml`](.github/workflows/android-release.yml)
Runs when a version tag such as `v1.0.2` is pushed.

1. Installs dependencies, then runs the typecheck and all 58 unit tests.
2. Checks that the tag matches the `version` in `app.json`.
3. Generates the native Android project with `expo prebuild` and builds a signed release APK with Gradle.
4. Publishes the APK to a **GitHub Release** as `FitFreak.apk`. The [download link](https://github.com/Mk-debugger11/FitFreak/releases/latest/download/FitFreak.apk) always points to the newest release.

You can also run it by hand from the **Actions** tab. A manual run builds the APK and attaches it to the run without publishing a release.

---

## Project Structure

```
FitFreak/
├── src/
│   ├── core/              # App shell, navigation, network listener
│   ├── features/
│   │   ├── home/          # 3D body viewer, muscle scoring engine, calorie card
│   │   ├── workout-log/   # Workout history, exercise picker, export
│   │   ├── active-workout/# Live workout session
│   │   └── nutrition/     # Food logging, energy formulas, macro totals
│   ├── store/             # Zustand stores (history, nutrition, profile, sync, active workout)
│   ├── services/api.ts    # The single API layer
│   ├── constants/         # Exercise & food catalogs, muscle map, nutrition constants
│   └── components/        # Shared UI components
├── backend/
│   ├── controllers/ routes/ models/ middleware/
│   ├── data/              # Exercise and food catalogs used for seeding
│   ├── seedExercises.js   # Idempotent catalog seeding
│   ├── seedFoods.js
│   └── dockerfile
├── nginx/express.conf     # Reverse proxy + TLS config
├── docker-compose.yaml    # nginx + Express + MongoDB
├── tests/                 # Unit tests (scoring engine, nutrition, stores, sessions)
├── scripts/               # Catalog validation scripts
└── .github/workflows/     # Backend deploy + Android APK release
```

---

## Running Locally

**Requirements:** Node.js 22+, a MongoDB instance (local or Atlas), and an Android device or emulator.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env          # set MONGO_URI to your MongoDB connection string
node seedExercises.js         # load the exercise catalog
npm run seed:foods            # load the food catalog
npm start                     # API on http://localhost:3000
```

### 2. Mobile app

```bash
npm install
cp .env.example .env          # EXPO_PUBLIC_API_URL=http://<your-computer-ip>:3000/api
npm start                     # then press "a" to open on Android
```

> On a physical phone, use your computer's local network IP instead of `localhost`.

### 3. Tests

```bash
npm test                      # 58 unit tests
npm run typecheck             # TypeScript check
```

---

## API Reference

All routes are prefixed with `/api`.

| Resource | Endpoints |
|---|---|
| **Workouts** | `GET /workouts` · `POST /workouts` · `PUT /workouts/:id/name` · `DELETE /workouts/:id` |
| **Exercises** | `GET /exercises` · `GET /exercises/:name` · `POST /exercises` |
| **Custom exercises** | `GET /custom-exercises` · `POST /custom-exercises` |
| **Target muscles** | `GET /target-muscles` · `POST /target-muscles` · `DELETE /target-muscles` |
| **Foods** | `GET /foods` · `GET /foods/:name` · `POST /foods` |
| **Custom foods** | `GET /custom-foods` · `POST /custom-foods` · `DELETE /custom-foods/:id` |
| **Nutrition entries** | `GET /nutrition-entries` · `POST /nutrition-entries` · `PUT /nutrition-entries/:id` · `DELETE /nutrition-entries/:id` |
| **Profile** | `GET /profile` · `PUT /profile` |

> **Note:** the app currently runs in single-user mode. All data is stored under one default user, and per-user authentication is planned.

---

## Releasing a New APK

1. Bump `expo.version` and `expo.android.versionCode` in [`app.json`](app.json). The versionCode must go up by at least 1 each release, or Android won't install the update.
2. Commit and push to `main`.
3. Tag the release and push the tag:
   ```bash
   git tag v1.0.2
   git push origin v1.0.2
   ```
4. The workflow builds the APK and publishes it to the Releases page, which takes about 15–25 minutes.

---

## Credits

The 3D anatomy model (`assets/models/body.glb`) is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). It is derived from [free-muscles](https://github.com/tiralonghipol/free-muscles), [Z-Anatomy](https://www.z-anatomy.com/) and [BodyParts3D](https://lifesciencedb.jp/bp3d/). See [`assets/models/LICENSE.txt`](assets/models/LICENSE.txt) for full attribution.
