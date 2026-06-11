import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ThreeDemo } from '../../core/three/three-demo';
import { CodeBlock } from '../../shared/code-block';

const HELMET_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb';

const SNIPPET = `
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// loadAsync gives you a Promise — at home in any async Angular service
const gltf = await loader.loadAsync('assets/helmet.glb', (progress) => {
  this.percent.set(Math.round((100 * progress.loaded) / progress.total));
});

// gltf.scene is a ready-made Object3D subtree. Drop it in the graph:
scene.add(gltf.scene);

// Real assets arrive opinionated — walk the tree and adjust:
gltf.scene.traverse((node) => {
  if ((node as THREE.Mesh).isMesh) {
    node.castShadow = true;
    node.receiveShadow = true;
  }
});

// Frame it: compute the bounding box, aim the camera at its center
const box = new THREE.Box3().setFromObject(gltf.scene);
const center = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3()).length();
camera.position.copy(center).add(new THREE.Vector3(size, size * 0.5, size));
camera.lookAt(center);
`;

const SNIPPET_ENV = `
// PBR materials want an ENVIRONMENT to reflect, not just point lights.
// RoomEnvironment is a built-in, no-download studio lightbox:
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// Tone mapping turns raw HDR light into screen-friendly color —
// without it, metallic assets look blown out and chalky:
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
`;

@Component({
  selector: 'app-lesson-08',
  imports: [CodeBlock, RouterLink],
  template: `
    <div class="article">
      <p>
        Hand-built geometry got us this far; real projects load <strong>assets</strong>. The
        format that won is <strong>glTF</strong> — “the JPEG of 3D”: an open standard that
        packs geometry, PBR materials, textures, the scene hierarchy and animations into one
        file. Prefer the binary flavour, <code>.glb</code>, a single self-contained blob.
        It's also the format Sketchfab serves for every downloadable model, which is why this
        lesson ends at the Explorer.
      </p>

      <app-code [code]="snippet" title="load-gltf.ts" />

      <h2>A real asset, live</h2>
      <p>
        This is Khronos' famous <em>Damaged Helmet</em> sample (~3.6&nbsp;MB), streamed from
        their repository and loaded with the exact code above. Drag to orbit. Note what you
        did <em>not</em> write: no materials, no textures, no normal maps — the asset brought
        its own. Your job shrank to lighting, framing and integration.
      </p>

      <div class="demo">
        <div class="demo-stage" style="height: 480px">
          <canvas #canvas></canvas>
          <span class="stage-tag">
            <span class="dot"></span>
            @if (error()) { failed: {{ error() }} }
            @else if (percent() < 100) { loading · {{ percent() }}% }
            @else { DamagedHelmet.glb · drag to orbit }
          </span>
        </div>
        <div class="demo-rack">
          <div class="ctl">
            <label>exposure <span class="val">{{ exposure() }}</span></label>
            <input type="range" min="0.2" max="2.5" step="0.05" [value]="exposure()"
              (input)="setExposure(+$any($event.target).value)" />
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l8spin" [checked]="spin()" (change)="spin.set(!spin())" />
            <label for="l8spin">turntable</label>
          </div>
        </div>
      </div>

      <h2>Lighting downloaded PBR assets</h2>
      <p>
        Models like this look flat under simple point lights: their metallic surfaces need
        something to <em>reflect</em>. The cheap, idiomatic fix is an environment map — and
        three.js ships a procedural one so you don't even need an HDRI file:
      </p>

      <app-code [code]="snippetEnv" title="environment.ts" />

      <h2>The wider pipeline</h2>
      <ul>
        <li>
          <strong>DRACO &amp; Meshopt</strong> — compressed geometry. If a file fails with a
          decoder error, wire up <code>DRACOLoader</code> / <code>MeshoptDecoder</code>.
        </li>
        <li>
          <strong>KTX2</strong> — GPU-compressed textures; same idea, <code>KTX2Loader</code>.
        </li>
        <li>
          <strong>Animations</strong> — <code>gltf.animations</code> +
          <code>THREE.AnimationMixer</code>; call <code>mixer.update(dt)</code> in your loop.
        </li>
        <li>
          <strong>Disposal</strong> — a loaded scene is a tree of GPU resources. When it
          leaves for good, traverse and dispose geometries, materials and textures.
        </li>
      </ul>

      <div class="ng-note">
        <div class="ng-note-tag">Graduation</div>
        <p>
          You now know everything the <a routerLink="/explorer">Model Explorer</a> is built
          from: it searches Sketchfab's free library, downloads a <code>.glb</code>, hands it
          to <code>GLTFLoader</code>, frames it with <code>Box3</code>, and lights it with
          <code>RoomEnvironment</code> — inside the same <code>ThreeDemo</code> base class as
          every lesson on this site. Go get yourself some models.
        </p>
      </div>
    </div>
  `,
})
export class Lesson08Gltf extends ThreeDemo {
  protected readonly snippet = SNIPPET;
  protected readonly snippetEnv = SNIPPET_ENV;

  protected readonly percent = signal(0);
  protected readonly error = signal('');
  protected readonly exposure = signal(1.1);
  protected readonly spin = signal(true);

  private controls!: OrbitControls;
  private model?: THREE.Object3D;
  private pmrem?: THREE.PMREMGenerator;

  protected onInit(): void {
    this.camera.position.set(3, 1.2, 3);

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.exposure();

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.zone.runOutsideAngular(() => {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
    });

    const loader = new GLTFLoader();
    loader
      .loadAsync(HELMET_URL, (p) => {
        if (p.total > 0) {
          const pct = Math.min(99, Math.round((100 * p.loaded) / p.total));
          this.zone.run(() => this.percent.set(pct));
        }
      })
      .then((gltf) => {
        this.model = gltf.scene;
        gltf.scene.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) node.castShadow = node.receiveShadow = true;
        });

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center); // recenter on origin
        this.scene.add(gltf.scene);

        const size = box.getSize(new THREE.Vector3()).length();
        this.camera.position.set(size * 0.9, size * 0.35, size * 0.9);
        this.controls.target.set(0, 0, 0);

        this.zone.run(() => this.percent.set(100));
      })
      .catch((err: unknown) => {
        this.zone.run(() => this.error.set(err instanceof Error ? err.message : 'load error'));
      });
  }

  protected override onFrame(dt: number): void {
    this.controls?.update();
    if (this.model && this.spin()) this.model.rotation.y += dt * 0.25;
  }

  protected override onDispose(): void {
    this.controls?.dispose();
    this.pmrem?.dispose();
  }

  protected setExposure(v: number): void {
    this.exposure.set(v);
    this.renderer.toneMappingExposure = v;
  }
}
