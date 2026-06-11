import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { unzipSync } from 'fflate';
import { ThreeDemo } from '../core/three/three-demo';
import { SketchfabService } from '../core/sketchfab/sketchfab.service';
import { SketchfabModel } from '../core/sketchfab/sketchfab.types';

type Phase = 'token' | 'links' | 'downloading' | 'parsing' | 'ready' | 'error';

/**
 * The capstone of the curriculum: a real glTF viewer built from the same
 * ThreeDemo base class as every lesson. It asks Sketchfab for the model's
 * archive (glb preferred, zipped glTF as fallback — unzipped in-browser
 * with fflate), parses it with GLTFLoader, frames it with Box3, and lights
 * it with a PMREM'd RoomEnvironment.
 */
@Component({
  selector: 'app-atelier-viewer',
  imports: [RouterLink],
  templateUrl: './atelier-viewer.html',
  styleUrl: './atelier-viewer.scss',
})
export class AtelierViewer extends ThreeDemo {
  readonly uid = input.required<string>();

  private readonly api = inject(SketchfabService);

  protected readonly model = signal<SketchfabModel | undefined>(undefined);
  protected readonly phase = signal<Phase>('links');
  protected readonly progress = signal(0);
  protected readonly errorMsg = signal('');
  protected readonly tokenDraft = signal('');
  protected readonly hasToken = computed(() => !!this.api.token());

  protected readonly wireframe = signal(false);
  protected readonly autoRotate = signal(true);
  protected readonly showGrid = signal(true);
  protected readonly exposure = signal(1);
  protected readonly triCount = signal(0);
  protected readonly animCount = signal(0);

  private controls!: OrbitControls;
  private pmrem?: THREE.PMREMGenerator;
  private grid!: THREE.GridHelper;
  private loaded?: THREE.Object3D;
  private mixer?: THREE.AnimationMixer;
  private readonly blobUrls: string[] = [];

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
      this.controls.autoRotate = this.autoRotate();
      this.controls.autoRotateSpeed = 1.2;
    });

    void this.begin();
  }

  protected override onFrame(dt: number): void {
    this.controls?.update();
    this.mixer?.update(dt);
  }

  protected override onDispose(): void {
    this.controls?.dispose();
    this.pmrem?.dispose();
    for (const url of this.blobUrls) URL.revokeObjectURL(url);
  }

  private async begin(): Promise<void> {
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

  private parseGlb(buffer: ArrayBuffer): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      new GLTFLoader().parse(buffer, '', resolve, reject);
    });
  }

  /** .gltf archives are zips of JSON + buffers + textures — unzip in memory. */
  private parseGltfZip(buffer: ArrayBuffer): Promise<GLTF> {
    const files = unzipSync(new Uint8Array(buffer));
    const urlByPath = new Map<string, string>();
    for (const [path, data] of Object.entries(files)) {
      const url = URL.createObjectURL(new Blob([data as BlobPart]));
      urlByPath.set(path, url);
      this.blobUrls.push(url);
    }

    const gltfPath = Object.keys(files).find((p) => p.endsWith('.gltf'));
    if (!gltfPath) throw new Error('No .gltf found inside the archive.');

    // resources are referenced relative to the .gltf — remap them to blob URLs
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      const clean = decodeURIComponent(url).replace(/^\.\//, '');
      return urlByPath.get(clean) ?? url;
    });

    const json = new TextDecoder().decode(files[gltfPath]);
    return new Promise((resolve, reject) => {
      new GLTFLoader(manager).parse(json, '', resolve, reject);
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

    if (gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(gltf.scene);
      this.mixer.clipAction(gltf.animations[0]).play();
    }

    this.set(() => {
      this.triCount.set(Math.round(tris));
      this.animCount.set(gltf.animations.length);
    });
  }

  /* ---- toolbar ---- */

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

  /** Publish state from possibly-zone-free async code paths. */
  private set(fn: () => void): void {
    this.zone.run(fn);
  }
}
