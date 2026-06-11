import { Component, signal } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThreeDemo } from '../../core/three/three-demo';
import { CodeBlock } from '../../shared/code-block';

const SNIPPET = `
// A PerspectiveCamera is four numbers defining a truncated pyramid —
// the FRUSTUM. Everything inside it gets drawn; everything outside is
// clipped before the GPU ever shades a pixel.
const camera = new THREE.PerspectiveCamera(
  50,             // fov: vertical angle, in degrees
  width / height, // aspect: MUST match the canvas, or everything stretches
  0.1,            // near plane: closer than this → clipped
  200,            // far plane: farther → clipped (keep this tight! depth
);                //   precision is spread across the near–far range)

// Changing any of these later needs an explicit recompute:
camera.fov = 35;
camera.updateProjectionMatrix();

// The OrthographicCamera drops perspective entirely: parallel projection,
// same size at any distance. CAD, 2.5D games, minimaps, UI overlays.
const ortho = new THREE.OrthographicCamera(
  -frustumWidth / 2, frustumWidth / 2,   // left, right
  frustumHeight / 2, -frustumHeight / 2, // top, bottom
  0.1, 200,
);

// OrbitControls: the de-facto standard "grab and spin" interaction.
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;  // inertia — feels 10× better
// damping means controls integrate over time:
function tick() {
  controls.update();            // required every frame when damping is on
  renderer.render(scene, camera);
}
`;

@Component({
  selector: 'app-lesson-05',
  imports: [CodeBlock],
  template: `
    <div class="article">
      <p>
        A camera is a <strong>frustum</strong> — a pyramid with the tip cut off, hanging in
        space. The four numbers you pass to <code>PerspectiveCamera</code> define its shape,
        and the renderer's first job each frame is brutal triage: anything outside the
        frustum is discarded unrendered. Most “why is my object invisible?” bugs are frustum
        bugs: behind the camera, past the far plane, or inside the near plane.
      </p>

      <app-code [code]="snippet" title="cameras.ts" />

      <h2>See the frustum itself</h2>
      <p>
        This demo has <em>two</em> cameras. You're looking through the director's camera —
        drag to orbit it (that's <code>OrbitControls</code>, imported from three's addons).
        The wireframe pyramid in the scene is the other camera, drawn by a
        <code>CameraHelper</code>. Drag the FOV slider and watch the pyramid widen; then
        flip to <em>through the lens</em> to see exactly what that frustum captures.
      </p>

      <div class="demo">
        <div class="demo-stage" style="height: 460px">
          <canvas #canvas></canvas>
          <span class="stage-tag"><span class="dot"></span>live · drag to orbit</span>
        </div>
        <div class="demo-rack">
          <div class="ctl">
            <label>lens fov <span class="val">{{ fov() }}°</span></label>
            <input type="range" min="15" max="100" [value]="fov()"
              (input)="setFov(+$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>lens far plane <span class="val">{{ far() }}</span></label>
            <input type="range" min="4" max="20" step="0.5" [value]="far()"
              (input)="setFar(+$any($event.target).value)" />
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l5lens" [checked]="throughLens()" (change)="toggleLens()" />
            <label for="l5lens">through the lens</label>
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l5damp" [checked]="damping()" (change)="toggleDamping()" />
            <label for="l5damp">damping</label>
          </div>
        </div>
      </div>

      <p>
        Notice how objects vanish mid-body when you pull the <em>far plane</em> in — sliced
        clean by the back of the frustum. In real apps you want near and far as tight as
        your scene allows: the GPU's depth buffer spreads its precision across that range,
        and a lazy <code>near: 0.001, far: 100000</code> is the classic recipe for flickering
        z-fighting surfaces.
      </p>

      <h2>Aspect ratio is your job</h2>
      <p>
        The camera doesn't know about the canvas. When the element resizes you must update
        both the renderer <em>and</em> the camera, or the scene stretches like a bad CSS
        background:
      </p>
      <app-code
        code="new ResizeObserver(() => {
  const { clientWidth: w, clientHeight: h } = host;
  renderer.setSize(w, h, false); // false: let CSS own the element size
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}).observe(host);"
        title="resize.ts"
      />

      <div class="ng-note">
        <div class="ng-note-tag">The Angular angle</div>
        <p>
          <code>OrbitControls</code> attaches pointer listeners to the canvas. If you create
          it inside Angular's zone, every drag event runs change detection. Create it in the
          same <code>runOutsideAngular</code> scope as your render loop — interaction that
          only mutates three.js state has no business waking Angular up.
        </p>
      </div>
    </div>
  `,
})
export class Lesson05Cameras extends ThreeDemo {
  protected readonly snippet = SNIPPET;

  protected readonly fov = signal(45);
  protected readonly far = signal(10);
  protected readonly throughLens = signal(false);
  protected readonly damping = signal(true);

  private lens!: THREE.PerspectiveCamera;
  private helper!: THREE.CameraHelper;
  private controls!: OrbitControls;
  private lensPivot!: THREE.Group;

  protected onInit(): void {
    this.camera.position.set(10, 7, 12);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(6, 8, 4);
    this.scene.add(key);

    const grid = new THREE.GridHelper(30, 30, 0x2a2e3a, 0x171a21);
    grid.position.y = -1.5;
    this.scene.add(grid);

    // a small city of boxes for the lens to look at
    const mat = new THREE.MeshStandardMaterial({ color: 0x9aa1b4, roughness: 0.7 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xd7ff3e, roughness: 0.45 });
    for (let i = 0; i < 24; i++) {
      const h = 0.5 + Math.random() * 2.6;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), i % 6 ? mat : accentMat);
      box.position.set((Math.random() - 0.5) * 14, h / 2 - 1.5, (Math.random() - 0.5) * 14);
      this.scene.add(box);
    }

    // the observed camera ("the lens") slowly pans on a pivot
    this.lensPivot = new THREE.Group();
    this.scene.add(this.lensPivot);
    this.lens = new THREE.PerspectiveCamera(this.fov(), 16 / 9, 0.5, this.far());
    this.lens.position.set(0, 1.5, 9);
    this.lens.lookAt(0, 0, 0);
    this.lensPivot.add(this.lens);

    this.helper = new THREE.CameraHelper(this.lens);
    this.scene.add(this.helper);

    this.zone.runOutsideAngular(() => {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = this.damping();
    });
  }

  protected override onFrame(dt: number): void {
    this.lensPivot.rotation.y += dt * 0.12;
    this.controls.update();
    this.helper.update();
  }

  protected override onResize(width: number, height: number): void {
    // keep whichever camera is active in sync with the canvas
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.lens.aspect = width / height;
    this.lens.updateProjectionMatrix();
  }

  protected override onDispose(): void {
    this.controls?.dispose();
  }

  protected setFov(v: number): void {
    this.fov.set(v);
    this.lens.fov = v;
    this.lens.updateProjectionMatrix();
  }

  protected setFar(v: number): void {
    this.far.set(v);
    this.lens.far = v;
    this.lens.updateProjectionMatrix();
  }

  protected toggleLens(): void {
    this.throughLens.set(!this.throughLens());
    // swap which camera the base class renders with
    const useLens = this.throughLens();
    this.helper.visible = !useLens;
    this.controls.enabled = !useLens;
    this.swapCamera(useLens ? this.lens : undefined);
  }

  protected toggleDamping(): void {
    this.damping.set(!this.damping());
    this.controls.enableDamping = this.damping();
  }

  /** Render through the lens (or back through the default editor camera). */
  private editorCamera?: THREE.PerspectiveCamera;
  private swapCamera(lens?: THREE.PerspectiveCamera): void {
    if (lens) {
      this.editorCamera = this.camera;
      this.camera = lens;
    } else if (this.editorCamera) {
      this.camera = this.editorCamera;
    }
  }
}
