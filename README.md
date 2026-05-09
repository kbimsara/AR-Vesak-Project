# AR Vesak Project 🏮

An Augmented Reality web experience that places an animated Vesak lantern shrine into the real world. Built with **Next.js**, **Three.js**, and the **WebXR Hit-Test API**.

---

## Features

- **WebXR AR mode** — Android Chrome: scan a surface, tap to place, watch the shrine animate in real space
- **GPS fallback mode** — Any device without WebXR: camera feed + device orientation so the lantern sits at a real-world position ahead of you
- **iOS AR Quick Look** — iPhone/iPad: tap to open the USDZ model natively in AR Quick Look
- **AnimationMixer** — All GLB animations (rotating tiers, pulsing lanterns, orbiting sparks) play automatically
- **Emission fix** — Blender emission materials that export as black are restored at runtime
- **Full HUD controls** — Pause/play animation, toggle auto-spin, resize the shrine, remove it
- **Status pill** — Auto-dismissing floating notifications for placement events
- **PWA-ready** — COOP/COEP/CORP headers set globally for WebXR + Draco compatibility

---

## Platform Support

| Platform | Experience |
|---|---|
| Android Chrome 81+ | WebXR immersive-AR with hit-test surface detection |
| iOS Safari 16+ | AR Quick Look (USDZ) — native iOS AR |
| Desktop / unsupported | GPS + DeviceOrientation scene with camera feed |

> WebXR requires **HTTPS**. Use the HTTPS dev server or deploy to Vercel for device testing.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy Draco decoder (required for compressed GLB files)
cp -r node_modules/three/examples/jsm/libs/draco public/draco

# 3. Place your Vesak lantern model
cp /path/to/vesak_lantern_v4.glb public/models/lantern.glb
cp /path/to/vesak_lantern_v4.usdz public/models/lantern.usdz   # iOS fallback

# 4. Start dev server
npm run dev
# → http://localhost:3000

# 5. For WebXR on a real device (requires HTTPS)
npx next dev --experimental-https
# OR use ngrok: ngrok http 3000 → open the https://xxxx.ngrok.io URL on your phone
```

---

## Commands

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run start      # Serve production build
npx tsc --noEmit   # Type-check without emitting

node scripts/generate-model.mjs   # Regenerate placeholder lantern.glb
```

---

## Project Structure

```
ar-vesak-project/
├── app/
│   ├── layout.tsx              # Root layout — viewport meta
│   ├── page.tsx                # Mode detection → routes to AR / GPS / Quick Look
│   └── globals.css
│
├── components/
│   ├── ARScene.tsx             # WebXR scene: hit-test, placement, render loop
│   ├── AROverlay.tsx           # Pre-AR landing screen with Launch AR button
│   ├── ARHud.tsx               # In-AR HUD: pause, spin, size, remove controls
│   ├── GPSScene.tsx            # GPS + DeviceOrientation fallback scene
│   ├── StatusPill.tsx          # Floating auto-dismiss status messages
│   ├── LoadingOverlay.tsx      # Animated loading screen
│   ├── ModeIndicator.tsx       # Mode badge (AR / iOS-AR / GPS)
│   └── QuickLookLauncher.tsx   # iOS AR Quick Look launcher
│
├── hooks/
│   ├── useGLTFLoader.ts        # Load GLB + start AnimationMixer, return mixer
│   ├── useXRSupport.ts         # Detect: supported / ios-quicklook / unsupported
│   ├── useDeviceOrientation.ts # DeviceOrientation events + iOS permission gate
│   └── usePlatform.ts          # iOS detection
│
├── lib/
│   ├── three/
│   │   ├── loadModel.ts        # GLTFLoader + DRACOLoader, emission fix, per-URL cache
│   │   ├── createRenderer.ts   # Shared WebGLRenderer factory
│   │   └── createReticle.ts    # Gold ring reticle for AR surface targeting
│   └── geo/
│       └── forwardOffset.ts    # Compass heading + distance → Three.js Vector3
│
├── public/
│   ├── models/
│   │   ├── lantern.glb         # ← Replace with your Vesak lantern GLB
│   │   └── lantern.usdz        # ← Replace with your USDZ for iOS
│   └── draco/                  # Draco WASM decoder (copy from three/examples)
│
├── vercel.json                 # COOP / COEP / CORP headers for Vercel deploy
└── plan.md                     # Full project plan and milestones
```

---

## How It Works

### Mode Detection

`app/page.tsx` calls `useXRSupport()` which runs `navigator.xr.isSessionSupported("immersive-ar")` on mount:

- **AR supported** → `<ARScene>` (WebXR hit-test pipeline)
- **iOS detected** → `<QuickLookLauncher>` (USDZ AR Quick Look)
- **Neither** → `<GPSScene>` (Geolocation + DeviceOrientation)

### AR Mode (Android Chrome)

1. `useGLTFLoader` loads the GLB, applies emission fixes, and starts all animation clips on a `THREE.AnimationMixer`
2. The WebGL renderer is created with `xr.enabled = true`
3. The XR session is started on **Launch AR** tap, requesting `hit-test` + `dom-overlay`
4. Each frame: hit-test results update the gold reticle position
5. On controller `select` (screen tap): model is placed at the reticle pose, facing the camera
6. HUD controls: pause/play animation, toggle auto-spin, resize, remove

### GPS Mode (Fallback)

1. Back camera feed is displayed as a `<video>` background
2. `useDeviceOrientation` drives the Three.js camera quaternion (handles iOS 13+ permission gate)
3. A crosshair ray-casts to the ground plane — the ghost preview follows it
4. Tap to place; drag to rotate, pinch to scale

### Emission Fix

Blender's emission shader nodes don't always export correctly to glTF `emissiveFactor`. On load, `loadModel.ts` traverses every mesh:

```ts
// If emissive is near-black but the mesh has colour, copy base color at 35%
if (e.r + e.g + e.b < 0.02 && mat.color) {
  mat.emissive.copy(mat.color).multiplyScalar(0.35);
}
mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 1.0);
```

---

## 3D Model

Place your exported Vesak lantern GLB at `public/models/lantern.glb`.

**Export settings from Blender:**
- Format: **glTF Binary (.glb)**
- Include: ✅ Animation ✅ Punctual Lights ✅ Materials
- Compression: ✅ Draco (requires `public/draco/` decoder files)

The loader normalises the model into a **0.4 m bounding box** at import time, so the actual Blender scale doesn't matter.

---

## Deployment (Vercel)

```bash
# Push to GitHub, then connect the repo in vercel.com/new
# All required headers are set in vercel.json:
#   Cross-Origin-Opener-Policy:   same-origin
#   Cross-Origin-Embedder-Policy: require-corp
#   Cross-Origin-Resource-Policy: same-site
```

These headers are required so the Draco WASM decoder (`SharedArrayBuffer`) works in-browser.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 16.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| 3D Engine | Three.js | 0.184 |
| AR API | WebXR Hit-Test | browser |
| Model Format | glTF 2.0 (.glb) | — |
| Compression | Draco | 1.5.x |
| iOS Fallback | USDZ / AR Quick Look | — |
| Deployment | Vercel | — |

---

## Known Limitations

| Issue | Workaround |
|---|---|
| Chrome on iOS has no WebXR | Detected automatically → USDZ button shown |
| WebXR requires HTTPS | Use `--experimental-https` locally or deploy to Vercel |
| Large GLB files (5–20 MB) | Draco compression reduces size ~60% |
| No light estimation | Static scene lights used as fallback |
| Emission baking differences | Runtime traversal fix applied on every load |
