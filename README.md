# Vector Atelier

Three.js for Angular developers — an interactive curriculum plus a Sketchfab model
explorer, in one Angular 22 app.

## Run it

```bash
npm install
npm start          # → http://localhost:4200
```

## What's inside

### A — The Curriculum (`/learn`)

Eight lessons, each with a **live three.js canvas driven by Angular signals** and the
code behind it:

| # | Lesson | Teaches |
|---|--------|---------|
| 01 | The Stage | Scene / camera / renderer, `afterNextRender`, `NgZone`, `DestroyRef` |
| 02 | Geometry × Material | Meshes, PBR, metalness/roughness, dispose discipline |
| 03 | The Scene Graph | Groups, nested transforms, local vs world space |
| 04 | Light & Shadow | The four light types, why shadows are opt-in ×3 |
| 05 | Cameras & Controls | Frustums, `CameraHelper`, `OrbitControls` |
| 06 | The Render Loop | Delta time, `InstancedMesh`, the zone-bridge pattern |
| 07 | Pointing at Pixels | Raycasting, NDC coordinates, zone-free listeners |
| 08 | Loading Worlds | `GLTFLoader`, `RoomEnvironment`, `Box3` framing |

Every demo extends one base class, `src/app/core/three/three-demo.ts`, which is the
canonical Angular ⇄ three.js bridge: `viewChild` for the canvas, `afterNextRender`
bootstrap, `runOutsideAngular` render loop, `ResizeObserver` sizing, `DestroyRef`
GPU cleanup. Steal it for your own projects.

### B — The Model Explorer (`/explorer`)

Searches Sketchfab's **free, downloadable** models via the public Data API (no key
needed for browsing). Each model page shows the official embed preview, license and
stats. Downloads — and the built-in **Atelier viewer** (`/viewer/:uid`), which loads
the actual `.glb`/`.gltf` into this app's own three.js scene — require a personal
Sketchfab API token: free with any account, under
**sketchfab.com → Settings → Password & API**. The token is stored in
`localStorage` only.

Zipped `.gltf` archives are unpacked in-browser with `fflate` and fed to
`GLTFLoader` through blob-URL remapping — see `src/app/viewer/atelier-viewer.ts`.

The viewer flies: orbit/pan/zoom on the mouse plus WASD/arrow-key flight (Q/E for
down/up, Shift to sprint) that trucks the camera and its orbit pivot together.
Animated models get a mixer desk — play/pause, speed, timeline scrubbing, and
per-clip weight sliders that blend animations into each other in real time. It
also accepts any direct glTF URL: `/viewer/demo?src=<url-to-glb>`.

### C — The Games Explorer (`/games`)

Playable remakes built with the curriculum's own techniques, each one a single
component on the `ThreeDemo` base class:

- **Blobby Volley** (2000) — classic rules: only the serving side scores, three
  touches per side, first to 15. Red plays A/D + W; blue plays arrows, or flip on
  the CPU opponent for single-player. Delta-time physics, circle collision,
  zone-free keyboard input (`src/app/games/blobby-volley.ts`).
- **Tiny Legend** — a fan-made miniature in the spirit of the 1986 top-down
  classic: four moonlit screens with NES-style edge transitions, sword combat,
  chasing blobs that drop hearts and rupees, and a golden trishard to find in the
  shrine. ASCII tilemaps, AABB tile collision, knockback and invulnerability
  frames (`src/app/games/tiny-legend.ts`).

## Stack

Angular 22 (standalone, signals, zone-based) · three 0.184 · fflate · SCSS, no UI
framework.
