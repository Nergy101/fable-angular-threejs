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

### C — The Games Explorer (`/games`)

Playable remakes built with the curriculum's own techniques. First on the shelf:
**Blobby Volley** (2000) with classic rules — only the serving side scores, three
touches per side, first to 15. Red plays A/D + W; blue plays arrows, or flip on the
CPU opponent for single-player. The whole game is one component on the same
`ThreeDemo` base class: delta-time physics, circle collision, zone-free keyboard
input (`src/app/games/blobby-volley.ts`).

## Stack

Angular 22 (standalone, signals, zone-based) · three 0.184 · fflate · SCSS, no UI
framework.
