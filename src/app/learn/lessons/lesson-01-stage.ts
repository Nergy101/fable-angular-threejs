import { Component, signal } from '@angular/core';
import * as THREE from 'three';
import { ThreeDemo } from '../../core/three/three-demo';
import { CodeBlock } from '../../shared/code-block';

const SNIPPET_CORE = `
import * as THREE from 'three';

// 1 — A Scene: the root of your object tree. Think of it as the DOM, in 3D.
const scene = new THREE.Scene();

// 2 — A Camera: decides WHAT gets drawn, and with which projection.
//     (fov in degrees, aspect ratio, near plane, far plane)
const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
camera.position.z = 6; // back away from the origin so we can see it

// 3 — A Renderer: owns the <canvas> and its WebGL context.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // cap retina cost

// Give the scene something to show:
const mesh = new THREE.Mesh(
  new THREE.IcosahedronGeometry(2, 0),   // shape data
  new THREE.MeshNormalMaterial(),        // surface: colors faces by normal
);
scene.add(mesh);

// Draw ONE frame. Nothing is automatic — rendering is an explicit act.
renderer.render(scene, camera);
`;

const SNIPPET_NG = `
@Component({
  selector: 'app-scene',
  template: '<canvas #canvas></canvas>',
})
export class SceneComponent {
  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // afterNextRender: runs once, browser-only, after the DOM exists.
    // The SSR-safe place for WebGL setup (no window/canvas on the server).
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      const scene = buildScene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

      // The render loop fires ~60×/second. Run it OUTSIDE Angular's zone,
      // or every single frame schedules change detection for the whole app.
      this.zone.runOutsideAngular(() => {
        renderer.setAnimationLoop(() => renderer.render(scene, camera));
      });

      // GPU memory is not garbage-collected. Free it with the component.
      this.destroyRef.onDestroy(() => {
        renderer.setAnimationLoop(null);
        renderer.dispose();
      });
    });
  }
}
`;

@Component({
  selector: 'app-lesson-01',
  imports: [CodeBlock],
  template: `
    <div class="article">
      <p>
        Every three.js application — from a spinning logo to a AAA-looking product
        configurator — reduces to one sentence: <strong>a renderer draws a scene as seen by a
        camera, onto a canvas.</strong> Those are the three objects you will create in every
        project, and they map surprisingly well onto concepts you already use daily.
      </p>

      <table>
        <tr><th>three.js</th><th>What it is</th><th>Angular reflex</th></tr>
        <tr>
          <td><code>Scene</code></td>
          <td>The root container of everything renderable — a tree of objects.</td>
          <td>The component tree / the DOM</td>
        </tr>
        <tr>
          <td><code>PerspectiveCamera</code></td>
          <td>A point of view with a projection: field of view, aspect, near &amp; far planes.</td>
          <td>The viewport — what the user actually sees of the tree</td>
        </tr>
        <tr>
          <td><code>WebGLRenderer</code></td>
          <td>Owns the <code>&lt;canvas&gt;</code> + GPU context; turns scene + camera into pixels.</td>
          <td>Change detection's render phase — but you call it yourself</td>
        </tr>
      </table>

      <p>
        The crucial mindset shift: <strong>nothing renders unless you ask.</strong> Angular
        re-renders when state changes; three.js draws exactly when you call
        <code>renderer.render(scene, camera)</code> — once for a still image, or once per
        animation frame for motion. The framework never schedules anything behind your back.
      </p>

      <app-code [code]="snippetCore" title="hello-three.ts" />

      <h2>See it run</h2>
      <p>
        This is that exact scene, plus a per-frame rotation. The two sliders touch the
        <em>camera</em>, not the mesh — notice how changing the field of view feels like a
        zoom lens, while moving the camera feels like walking. They are not the same thing:
        a wide FOV up close distorts like a GoPro; a narrow FOV far away flattens like a
        telephoto.
      </p>

      <div class="demo">
        <div class="demo-stage" style="height: 380px">
          <canvas #canvas></canvas>
          <span class="stage-tag"><span class="dot"></span>live · lesson 01</span>
        </div>
        <div class="demo-rack">
          <div class="ctl">
            <label>camera.fov <span class="val">{{ fov() }}°</span></label>
            <input type="range" min="15" max="110" [value]="fov()"
              (input)="setFov(+$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>camera.position.z <span class="val">{{ dist() }}</span></label>
            <input type="range" min="3" max="16" step="0.5" [value]="dist()"
              (input)="setDist(+$any($event.target).value)" />
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l1spin" [checked]="spin()" (change)="spin.set(!spin())" />
            <label for="l1spin">rotate mesh</label>
          </div>
        </div>
      </div>

      <h2>The Angular way to host it</h2>
      <p>
        Three.js is framework-agnostic and imperative; Angular is declarative. The bridge is a
        component that owns a <code>&lt;canvas&gt;</code> and respects three rules:
      </p>
      <ul>
        <li>
          <strong>Set up after render.</strong> WebGL needs a real canvas in a real browser.
          <code>afterNextRender</code> is the modern, SSR-safe hook for exactly this.
        </li>
        <li>
          <strong>Animate outside the zone.</strong> zone.js patches
          <code>requestAnimationFrame</code> — a naïve loop triggers change detection 60
          times per second, app-wide. <code>NgZone.runOutsideAngular</code> opts out.
        </li>
        <li>
          <strong>Dispose on destroy.</strong> Geometries, materials, textures and the
          renderer hold GPU memory that the garbage collector cannot see. Tie cleanup to
          <code>DestroyRef</code>.
        </li>
      </ul>

      <app-code [code]="snippetNg" title="scene.component.ts" />

      <div class="ng-note">
        <div class="ng-note-tag">The Angular angle</div>
        <p>
          Every live demo on this site extends one abstract <code>ThreeDemo</code> class that
          implements exactly the pattern above — viewChild signal for the canvas,
          <code>afterNextRender</code> bootstrap, zone-free loop, <code>DestroyRef</code>
          teardown, plus a <code>ResizeObserver</code> to keep the drawing buffer in sync
          with CSS layout. Steal it: <code>src/app/core/three/three-demo.ts</code>.
        </p>
      </div>
    </div>
  `,
})
export class Lesson01Stage extends ThreeDemo {
  protected readonly snippetCore = SNIPPET_CORE;
  protected readonly snippetNg = SNIPPET_NG;

  protected readonly fov = signal(50);
  protected readonly dist = signal(6);
  protected readonly spin = signal(true);

  private mesh!: THREE.Mesh;

  protected onInit(): void {
    this.camera.position.z = this.dist();
    this.mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2, 0),
      new THREE.MeshNormalMaterial({ flatShading: true }),
    );
    this.scene.add(this.mesh);

    const grid = new THREE.GridHelper(30, 30, 0x2a2e3a, 0x1d212b);
    grid.position.y = -2.6;
    this.scene.add(grid);
  }

  protected override onFrame(dt: number): void {
    if (this.spin()) {
      this.mesh.rotation.y += dt * 0.6;
      this.mesh.rotation.x += dt * 0.25;
    }
  }

  protected setFov(v: number): void {
    this.fov.set(v);
    this.camera.fov = v;
    this.camera.updateProjectionMatrix(); // projection params need an explicit refresh
  }

  protected setDist(v: number): void {
    this.dist.set(v);
    this.camera.position.z = v;
  }
}
