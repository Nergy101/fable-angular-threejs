import { Component, computed, inject, input, signal, WritableSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { unzipSync } from 'fflate';
import { ThreeDemo } from '../core/three/three-demo';
import { SketchfabService } from '../core/sketchfab/sketchfab.service';
import { SketchfabModel } from '../core/sketchfab/sketchfab.types';

type Phase = 'token' | 'links' | 'downloading' | 'parsing' | 'ready' | 'error';

interface ClipInfo {
  name: string;
  duration: number;
}

/** MIME types for the blob URLs we mint from zip entries — some browsers
 *  refuse to decode images from typeless blobs. */
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ktx2: 'image/ktx2',
  bin: 'application/octet-stream',
};

const SPEC_GLOSS = 'KHR_materials_pbrSpecularGlossiness';

/**
 * Older Sketchfab exports use the spec/gloss PBR extension, which modern
 * three.js silently ignores — the classic "my model is plain white" bug.
 * Rewrite those materials to metallic/roughness before parsing: diffuse
 * becomes base color, glossiness inverts into roughness. Approximate, but
 * textured-and-close beats white-and-wrong.
 */
function specGlossToMetalRough(json: {
  materials?: Array<Record<string, unknown>>;
  extensionsUsed?: string[];
  extensionsRequired?: string[];
}): boolean {
  let changed = false;
  for (const mat of json.materials ?? []) {
    const extensions = mat['extensions'] as Record<string, unknown> | undefined;
    const sg = extensions?.[SPEC_GLOSS] as
      | {
          diffuseFactor?: number[];
          diffuseTexture?: unknown;
          glossinessFactor?: number;
        }
      | undefined;
    if (!sg) continue;
    changed = true;
    mat['pbrMetallicRoughness'] = {
      ...(mat['pbrMetallicRoughness'] as object | undefined),
      baseColorFactor: sg.diffuseFactor ?? [1, 1, 1, 1],
      ...(sg.diffuseTexture ? { baseColorTexture: sg.diffuseTexture } : {}),
      metallicFactor: 0,
      roughnessFactor: sg.glossinessFactor != null ? 1 - sg.glossinessFactor : 1,
    };
    delete extensions![SPEC_GLOSS];
    if (Object.keys(extensions!).length === 0) delete mat['extensions'];
  }
  if (changed) {
    for (const key of ['extensionsUsed', 'extensionsRequired'] as const) {
      const list = json[key];
      if (Array.isArray(list)) {
        json[key] = list.filter((e) => e !== SPEC_GLOSS);
        if (json[key]!.length === 0) delete json[key];
      }
    }
  }
  return changed;
}

/** Apply a JSON transform inside a binary GLB container (header + chunks). */
function rewriteGlbJson(
  buffer: ArrayBuffer,
  transform: (json: Record<string, unknown>) => boolean,
): ArrayBuffer {
  const dv = new DataView(buffer);
  if (buffer.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67) return buffer; // 'glTF'
  const jsonLen = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== 0x4e4f534a) return buffer; // 'JSON'
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen)));
  if (!transform(json)) return buffer;

  let jsonOut = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (jsonOut.length % 4)) % 4;
  if (pad) {
    const padded = new Uint8Array(jsonOut.length + pad);
    padded.set(jsonOut);
    padded.fill(0x20, jsonOut.length); // spec: pad JSON chunks with spaces
    jsonOut = padded;
  }
  const rest = new Uint8Array(buffer, 20 + jsonLen);
  const result = new Uint8Array(20 + jsonOut.length + rest.length);
  const rdv = new DataView(result.buffer);
  rdv.setUint32(0, 0x46546c67, true);
  rdv.setUint32(4, dv.getUint32(4, true), true);
  rdv.setUint32(8, result.length, true);
  rdv.setUint32(12, jsonOut.length, true);
  rdv.setUint32(16, 0x4e4f534a, true);
  result.set(jsonOut, 20);
  result.set(rest, 20 + jsonOut.length);
  return result.buffer;
}

/**
 * The capstone of the curriculum: a real glTF viewer built from the same
 * ThreeDemo base class as every lesson. It asks Sketchfab for the model's
 * archive (glb preferred, zipped glTF as fallback — unzipped in-browser
 * with fflate), parses it with GLTFLoader, frames it with Box3, and lights
 * it with a PMREM'd RoomEnvironment.
 *
 * Navigation is two-handed: orbit/pan/zoom on the mouse (OrbitControls)
 * plus WASD/arrow fly-through that trucks the camera AND its orbit pivot.
 * Animated models get a mixer desk: scrub, speed, and per-clip weight
 * blending via THREE.AnimationMixer.
 */
@Component({
  selector: 'app-atelier-viewer',
  imports: [RouterLink],
  templateUrl: './atelier-viewer.html',
  styleUrl: './atelier-viewer.scss',
})
export class AtelierViewer extends ThreeDemo {
  readonly uid = input.required<string>();
  /** Optional ?src= query param: load any glTF/GLB URL directly, no token. */
  readonly src = input<string>();

  private readonly api = inject(SketchfabService);

  protected readonly model = signal<SketchfabModel | undefined>(undefined);
  protected readonly phase = signal<Phase>('links');
  protected readonly progress = signal(0);
  protected readonly errorMsg = signal('');
  protected readonly tokenDraft = signal('');
  protected readonly hasToken = computed(() => !!this.api.token());
  protected readonly directName = signal('');

  protected readonly wireframe = signal(false);
  protected readonly autoRotate = signal(true);
  protected readonly showGrid = signal(true);
  protected readonly exposure = signal(1);
  protected readonly triCount = signal(0);

  /* ---- animation desk ---- */
  protected readonly clips = signal<ClipInfo[]>([]);
  protected readonly animOpen = signal(false);
  protected readonly animPlaying = signal(true);
  protected readonly animSpeed = signal(1);
  protected readonly animProgress = signal(0); // 0..1 of the primary clip
  protected readonly animTime = signal('0.0s');
  protected readonly weights = signal<number[]>([]);
  protected readonly primaryClip = computed(() => {
    const w = this.weights();
    let best = 0;
    for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
    return best;
  });

  private controls!: OrbitControls;
  private pmrem?: THREE.PMREMGenerator;
  private grid!: THREE.GridHelper;
  private loaded?: THREE.Object3D;
  private mixer?: THREE.AnimationMixer;
  private actions: THREE.AnimationAction[] = [];
  private hudClock = 0;
  private readonly blobUrls: string[] = [];
  private readonly keys = new Set<string>();
  private keydownFn?: (e: KeyboardEvent) => void;
  private keyupFn?: (e: KeyboardEvent) => void;

  protected onInit(): void {
    this.camera.position.set(3, 2, 4);

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.exposure();

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.grid = new THREE.GridHelper(20, 40, 0x2a2e3a, 0x171a21);
    this.scene.add(this.grid);

    this.zone.runOutsideAngular(() => {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.enablePan = true;
      this.controls.autoRotate = this.autoRotate();
      this.controls.autoRotateSpeed = 1.2;

      // fly keys live on window so they work without clicking the canvas first
      this.keydownFn = (e) => this.onKey(e, true);
      this.keyupFn = (e) => this.onKey(e, false);
      window.addEventListener('keydown', this.keydownFn);
      window.addEventListener('keyup', this.keyupFn);
    });

    void this.begin();
  }

  protected override onFrame(dt: number): void {
    this.flyCamera(dt);
    this.controls?.update();

    if (this.mixer && this.animPlaying()) {
      this.mixer.update(dt * this.animSpeed());
    }

    // publish the timeline to the HUD at ~10Hz, not 60
    this.hudClock += dt;
    if (this.hudClock > 0.1 && this.actions.length > 0) {
      this.hudClock = 0;
      const action = this.actions[this.primaryClip()];
      const dur = action.getClip().duration || 1;
      const t = action.time % dur;
      this.publish(this.animProgress, t / dur);
      this.publish(this.animTime, t.toFixed(1) + 's');
    }
  }

  protected override onDispose(): void {
    if (this.keydownFn) window.removeEventListener('keydown', this.keydownFn);
    if (this.keyupFn) window.removeEventListener('keyup', this.keyupFn);
    this.controls?.dispose();
    this.pmrem?.dispose();
    this.dracoLoader?.dispose();
    this.ktx2Loader?.dispose();
    for (const url of this.blobUrls) URL.revokeObjectURL(url);
  }

  /* ================= fly navigation ================= */

  private onKey(e: KeyboardEvent, down: boolean): void {
    // never steal keys from form fields (the token input)
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const handled = [
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'ShiftLeft', 'ShiftRight',
    ];
    if (!handled.includes(e.code)) return;
    e.preventDefault();
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
  }

  /**
   * Truck the camera and its orbit pivot together: W/S along the view
   * direction, A/D strafe, Q/E world up/down. Shift sprints. Because the
   * target moves too, mouse orbiting keeps working from wherever you fly.
   */
  private flyCamera(dt: number): void {
    if (this.keys.size === 0 || !this.controls) return;
    const k = this.keys;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0)
              - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0)
                 - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const lift = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    if (fwd === 0 && strafe === 0 && lift === 0) return;

    const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 9 : 3.2) * dt;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();
    const delta = new THREE.Vector3()
      .addScaledVector(dir, fwd * speed)
      .addScaledVector(right, strafe * speed)
      .addScaledVector(new THREE.Vector3(0, 1, 0), lift * speed);

    this.camera.position.add(delta);
    this.controls.target.add(delta);
  }

  /* ================= loading ================= */

  private async begin(): Promise<void> {
    const direct = this.src();
    if (direct) {
      // demo / power-user mode: any CORS-reachable glTF URL
      this.directName.set(decodeURIComponent(direct.split('/').pop() ?? 'model'));
      try {
        this.set(() => this.phase.set('downloading'));
        const buffer = await this.fetchWithProgress(direct, 0);
        this.set(() => this.phase.set('parsing'));
        this.placeInScene(await this.parseGlb(buffer));
        this.set(() => this.phase.set('ready'));
      } catch (err) {
        this.set(() => {
          this.errorMsg.set(err instanceof Error ? err.message : 'load error');
          this.phase.set('error');
        });
      }
      return;
    }

    this.api.getModel(this.uid()).then(
      (m) => this.zone.run(() => this.model.set(m)),
      () => undefined,
    );

    if (!this.api.token()) {
      this.set(() => this.phase.set('token'));
      return;
    }
    await this.loadModel();
  }

  protected async saveTokenAndLoad(): Promise<void> {
    this.api.setToken(this.tokenDraft());
    this.tokenDraft.set('');
    await this.loadModel();
  }

  private async loadModel(): Promise<void> {
    try {
      this.set(() => {
        this.phase.set('links');
        this.errorMsg.set('');
      });
      const links = await this.api.getDownloadUrls(this.uid());
      const archive = links.glb ?? links.gltf;
      if (!archive) throw new Error('Sketchfab offers no glTF archive for this model.');

      this.set(() => this.phase.set('downloading'));
      const buffer = await this.fetchWithProgress(archive.url, archive.size);

      this.set(() => this.phase.set('parsing'));
      const gltf = links.glb
        ? await this.parseGlb(buffer)
        : await this.parseGltfZip(buffer);

      this.placeInScene(gltf);
      this.set(() => this.phase.set('ready'));
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'unknown error';
      const msg =
        raw === 'BAD_TOKEN'
          ? 'Sketchfab rejected your API token (401).'
          : raw === 'NO_TOKEN'
            ? 'An API token is required to download models.'
            : raw;
      this.set(() => {
        this.errorMsg.set(msg);
        this.phase.set(raw === 'BAD_TOKEN' || raw === 'NO_TOKEN' ? 'token' : 'error');
      });
    }
  }

  private async fetchWithProgress(url: string, total: number): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Archive download failed (${res.status})`);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const pct = Math.min(99, Math.round((100 * received) / (total || received)));
      this.set(() => this.progress.set(pct));
    }
    const out = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out.buffer;
  }

  private dracoLoader?: DRACOLoader;
  private ktx2Loader?: KTX2Loader;

  /** A GLTFLoader with every common decoder wired up, so compressed
   *  Sketchfab assets (DRACO geometry, KTX2/Basis textures, Meshopt)
   *  load instead of failing or dropping textures. */
  private buildLoader(manager?: THREE.LoadingManager): GLTFLoader {
    this.dracoLoader ??= new DRACOLoader().setDecoderPath(
      'https://www.gstatic.com/draco/versioned/decoders/1.5.7/',
    );
    this.ktx2Loader ??= new KTX2Loader()
      .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/libs/basis/')
      .detectSupport(this.renderer);
    return new GLTFLoader(manager)
      .setDRACOLoader(this.dracoLoader)
      .setKTX2Loader(this.ktx2Loader)
      .setMeshoptDecoder(MeshoptDecoder);
  }

  private parseGlb(buffer: ArrayBuffer): Promise<GLTF> {
    const fixed = rewriteGlbJson(buffer, specGlossToMetalRough);
    return new Promise((resolve, reject) => {
      this.buildLoader().parse(fixed, '', resolve, reject);
    });
  }

  /** .gltf archives are zips of JSON + buffers + textures — unzip in memory. */
  private parseGltfZip(buffer: ArrayBuffer): Promise<GLTF> {
    const files = unzipSync(new Uint8Array(buffer));
    const urlByPath = new Map<string, string>();
    const urlByBasename = new Map<string, string>();
    for (const [path, data] of Object.entries(files)) {
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      const url = URL.createObjectURL(new Blob([data as BlobPart], { type: MIME[ext] ?? '' }));
      urlByPath.set(path, url);
      urlByBasename.set(path.split('/').pop()!, url);
      this.blobUrls.push(url);
    }

    const gltfPath = Object.keys(files).find((p) => p.endsWith('.gltf'));
    if (!gltfPath) throw new Error('No .gltf found inside the archive.');

    // resources are referenced relative to the .gltf — remap them to blob
    // URLs, falling back to a basename match when folder prefixes disagree
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http')) return url;
      const clean = decodeURIComponent(url).replace(/^\.\//, '');
      return (
        urlByPath.get(clean) ??
        urlByBasename.get(clean.split('/').pop()!) ??
        url
      );
    });

    const json = JSON.parse(new TextDecoder().decode(files[gltfPath]));
    specGlossToMetalRough(json);
    return new Promise((resolve, reject) => {
      this.buildLoader(manager).parse(JSON.stringify(json), '', resolve, reject);
    });
  }

  private placeInScene(gltf: GLTF): void {
    this.loaded = gltf.scene;

    let tris = 0;
    gltf.scene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        const index = mesh.geometry.index;
        tris += (index ? index.count : mesh.geometry.attributes['position'].count) / 3;
      }
    });

    // normalize: center on origin, rest on the grid, fit to ~3 units
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = 3 / Math.max(size.x, size.y, size.z, 0.0001);
    gltf.scene.scale.setScalar(scale);
    const scaled = new THREE.Box3().setFromObject(gltf.scene);
    const center = scaled.getCenter(new THREE.Vector3());
    gltf.scene.position.sub(center);
    gltf.scene.position.y -= scaled.min.y - center.y;

    this.scene.add(gltf.scene);
    this.camera.position.set(3.4, 2.2, 3.4);
    this.controls.target.set(0, 1.1, 0);

    // build the animation desk: every clip gets a running action whose
    // weight you can mix — clip 0 starts at full strength
    if (gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(gltf.scene);
      this.actions = gltf.animations.map((clip, i) => {
        const action = this.mixer!.clipAction(clip);
        action.setEffectiveWeight(i === 0 ? 1 : 0);
        action.play();
        return action;
      });
      const infos = gltf.animations.map((c, i) => ({
        name: c.name?.trim() || `clip ${i + 1}`,
        duration: c.duration,
      }));
      this.set(() => {
        this.clips.set(infos);
        this.weights.set(infos.map((_, i) => (i === 0 ? 1 : 0)));
      });
    }

    this.set(() => this.triCount.set(Math.round(tris)));
  }

  /* ================= animation desk ================= */

  protected toggleAnimPanel(): void {
    this.animOpen.set(!this.animOpen());
  }

  protected togglePlay(): void {
    this.animPlaying.set(!this.animPlaying());
  }

  protected setSpeed(v: number): void {
    this.animSpeed.set(v);
  }

  /** Scrub every clip to the same normalized position (0..1). */
  protected scrub(frac: number): void {
    for (const action of this.actions) {
      action.time = frac * action.getClip().duration;
    }
    this.mixer?.update(0); // apply the pose even while paused
    const action = this.actions[this.primaryClip()];
    if (action) {
      const dur = action.getClip().duration || 1;
      this.animProgress.set(frac);
      this.animTime.set((frac * dur).toFixed(1) + 's');
    }
  }

  protected setWeight(i: number, w: number): void {
    this.actions[i]?.setEffectiveWeight(w);
    this.weights.update((list) => list.map((old, j) => (j === i ? w : old)));
    if (!this.animPlaying()) this.mixer?.update(0);
  }

  /** Solo one clip: full weight for it, zero for the rest. */
  protected solo(i: number): void {
    this.actions.forEach((a, j) => a.setEffectiveWeight(j === i ? 1 : 0));
    this.weights.set(this.actions.map((_, j) => (j === i ? 1 : 0)));
    if (!this.animPlaying()) this.mixer?.update(0);
  }

  /* ================= toolbar ================= */

  protected toggleWireframe(): void {
    this.wireframe.set(!this.wireframe());
    this.loaded?.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = this.wireframe();
      }
    });
  }

  protected toggleRotate(): void {
    this.autoRotate.set(!this.autoRotate());
    this.controls.autoRotate = this.autoRotate();
  }

  protected toggleGrid(): void {
    this.showGrid.set(!this.showGrid());
    this.grid.visible = this.showGrid();
  }

  protected setExposure(v: number): void {
    this.exposure.set(v);
    this.renderer.toneMappingExposure = v;
  }

  protected retry(): void {
    void this.loadModel();
  }

  protected fmtDur(s: number): string {
    return s.toFixed(1) + 's';
  }

  /** Publish state from possibly-zone-free async code paths. */
  private set(fn: () => void): void {
    this.zone.run(fn);
  }

  private publish<T>(sig: WritableSignal<T>, value: T): void {
    if (sig() !== value) this.zone.run(() => sig.set(value));
  }
}
