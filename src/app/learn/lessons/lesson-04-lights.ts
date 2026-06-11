import { Component, signal } from '@angular/core';
import * as THREE from 'three';
import { ThreeDemo } from '../../core/three/three-demo';
import { CodeBlock } from '../../shared/code-block';

const SNIPPET = `
// The four lights you'll actually use, cheapest first:

// 1. Ambient — flat fill from everywhere. No direction, no shadows. Free.
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

// 2. Directional — parallel rays, like the sun. Position sets DIRECTION only.
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 8, 4);
scene.add(sun);

// 3. Point — a bare bulb radiating in all directions, with falloff.
const bulb = new THREE.PointLight(0xff8855, 30);
bulb.position.set(-3, 2, 1);
scene.add(bulb);

// 4. Spot — a cone, like a stage light. Aim it via its .target.
const spot = new THREE.SpotLight(0xffffff, 40, 0, Math.PI / 7, 0.3);
spot.position.set(0, 6, 3);
scene.add(spot, spot.target);

// ---- Shadows: three switches, all opt-in, because they cost real GPU time
renderer.shadowMap.enabled = true;          // 1) on the renderer
sun.castShadow = true;                      // 2) on each light
mesh.castShadow = mesh.receiveShadow = true; // 3) on each mesh
`;

@Component({
  selector: 'app-lesson-04',
  imports: [CodeBlock],
  template: `
    <div class="article">
      <p>
        Lights are not decoration — for every material except <code>Basic</code> and
        <code>Normal</code>, they are <em>the thing being computed</em>. A
        <code>MeshStandardMaterial</code> in an unlit scene renders pitch black. So the
        question is never “do I need lights?” but “which mix?”, and the answer is almost
        always the same recipe: <strong>one soft fill + one strong directional key</strong>,
        then point/spot lights for drama.
      </p>

      <app-code [code]="snippet" title="lighting-rig.ts" />

      <h2>Mix your own rig</h2>
      <p>
        All four light types are in this scene. Solo each one (turn the others off) to learn
        its character: <em>ambient</em> flattens everything, <em>directional</em> sculpts
        forms with parallel shade, <em>point</em> pools light locally and falls off,
        <em>spot</em> cuts a hard cone. Then enable shadows and watch the directional light
        anchor the objects to the floor — that grounding is most of what shadows buy you.
      </p>

      <div class="demo">
        <div class="demo-stage" style="height: 440px">
          <canvas #canvas></canvas>
          <span class="stage-tag"><span class="dot"></span>live · lesson 04</span>
        </div>
        <div class="demo-rack">
          <div class="ctl">
            <label>
              <span><input type="checkbox" [checked]="ambientOn()" (change)="toggle('ambient')" />
                ambient</span>
              <span class="val">{{ ambientI() }}</span>
            </label>
            <input type="range" min="0" max="1" step="0.05" [value]="ambientI()"
              (input)="setIntensity('ambient', +$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>
              <span><input type="checkbox" [checked]="dirOn()" (change)="toggle('dir')" />
                directional</span>
              <span class="val">{{ dirI() }}</span>
            </label>
            <input type="range" min="0" max="5" step="0.1" [value]="dirI()"
              (input)="setIntensity('dir', +$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>
              <span><input type="checkbox" [checked]="pointOn()" (change)="toggle('point')" />
                point</span>
              <span class="val">{{ pointI() }}</span>
            </label>
            <input type="range" min="0" max="80" step="1" [value]="pointI()"
              (input)="setIntensity('point', +$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>
              <span><input type="checkbox" [checked]="spotOn()" (change)="toggle('spot')" />
                spot</span>
              <span class="val">{{ spotI() }}</span>
            </label>
            <input type="range" min="0" max="120" step="1" [value]="spotI()"
              (input)="setIntensity('spot', +$any($event.target).value)" />
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l4shadow" [checked]="shadows()" (change)="toggleShadows()" />
            <label for="l4shadow">shadows</label>
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l4help" [checked]="helpers()" (change)="toggleHelpers()" />
            <label for="l4help">helpers</label>
          </div>
        </div>
      </div>

      <h2>Why shadows are opt-in, three times</h2>
      <p>
        A shadow is not a side effect of light — it's an extra render. For every
        shadow-casting light, three.js draws the whole scene again from the light's point of
        view into a depth texture (the <em>shadow map</em>), then consults it per pixel.
        That's why you flip three independent switches: the renderer (allocate the machinery),
        the light (one extra scene render each), and the meshes (which ones participate).
        On mobile, one shadow-casting directional light is the sensible budget.
      </p>

      <div class="ng-note">
        <div class="ng-note-tag">The Angular angle</div>
        <p>
          Toggling <code>helpers</code> here adds and removes
          <code>DirectionalLightHelper</code>, <code>PointLightHelper</code> and
          <code>SpotLightHelper</code> objects — the three.js equivalent of Angular DevTools.
          Keep a <code>helpers</code> flag in your dev builds; debugging an invisible light
          by staring at a black canvas is a rite of passage you only need once.
        </p>
      </div>
    </div>
  `,
})
export class Lesson04Lights extends ThreeDemo {
  protected readonly snippet = SNIPPET;

  protected readonly ambientOn = signal(true);
  protected readonly dirOn = signal(true);
  protected readonly pointOn = signal(true);
  protected readonly spotOn = signal(false);
  protected readonly ambientI = signal(0.25);
  protected readonly dirI = signal(2);
  protected readonly pointI = signal(30);
  protected readonly spotI = signal(60);
  protected readonly shadows = signal(true);
  protected readonly helpers = signal(false);

  private ambient!: THREE.AmbientLight;
  private dir!: THREE.DirectionalLight;
  private point!: THREE.PointLight;
  private spot!: THREE.SpotLight;
  private helperObjects: THREE.Object3D[] = [];
  private pointPivot!: THREE.Group;

  protected onInit(): void {
    this.camera.position.set(0, 4, 9);
    this.camera.lookAt(0, 0.5, 0);
    this.renderer.shadowMap.enabled = this.shadows();
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // floor + cast
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const mats = [
      new THREE.MeshStandardMaterial({ color: 0xd7ff3e, roughness: 0.35, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0xc9ced9, roughness: 0.2, metalness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0xff5566, roughness: 0.7 }),
    ];
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.3, 128, 24), mats[0]);
    knot.position.set(0, 0.6, 0);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 24), mats[1]);
    ball.position.set(-2.6, -0.3, 0.6);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), mats[2]);
    box.position.set(2.6, -0.55, 0.4);
    box.rotation.y = 0.5;
    for (const m of [knot, ball, box]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }

    this.ambient = new THREE.AmbientLight(0xffffff, this.ambientI());
    this.scene.add(this.ambient);

    this.dir = new THREE.DirectionalLight(0xffffff, this.dirI());
    this.dir.position.set(5, 7, 4);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(1024, 1024);
    this.dir.shadow.camera.left = this.dir.shadow.camera.bottom = -8;
    this.dir.shadow.camera.right = this.dir.shadow.camera.top = 8;
    this.scene.add(this.dir);

    this.pointPivot = new THREE.Group();
    this.scene.add(this.pointPivot);
    this.point = new THREE.PointLight(0x4d9fff, this.pointI(), 0, 1.9);
    this.point.position.set(3.2, 1.6, 1.5);
    this.point.castShadow = true;
    this.pointPivot.add(this.point);

    this.spot = new THREE.SpotLight(0xfff3d6, this.spotI(), 0, Math.PI / 8, 0.35, 1.6);
    this.spot.position.set(0, 6.5, 2.5);
    this.spot.castShadow = true;
    this.spot.visible = this.spotOn();
    this.scene.add(this.spot, this.spot.target);

    this.helperObjects = [
      new THREE.DirectionalLightHelper(this.dir, 1, 0xffffff),
      new THREE.PointLightHelper(this.point, 0.25),
      new THREE.SpotLightHelper(this.spot),
    ];
    for (const h of this.helperObjects) {
      h.visible = false;
      this.scene.add(h);
    }
  }

  protected override onFrame(dt: number): void {
    this.pointPivot.rotation.y += dt * 0.7;
    if (this.helpers()) {
      for (const h of this.helperObjects) {
        (h as THREE.SpotLightHelper).update?.();
      }
    }
  }

  protected toggle(which: 'ambient' | 'dir' | 'point' | 'spot'): void {
    const map = {
      ambient: [this.ambientOn, this.ambient],
      dir: [this.dirOn, this.dir],
      point: [this.pointOn, this.point],
      spot: [this.spotOn, this.spot],
    } as const;
    const [sig, light] = map[which];
    sig.set(!sig());
    light.visible = sig();
  }

  protected setIntensity(which: 'ambient' | 'dir' | 'point' | 'spot', v: number): void {
    const map = {
      ambient: [this.ambientI, this.ambient],
      dir: [this.dirI, this.dir],
      point: [this.pointI, this.point],
      spot: [this.spotI, this.spot],
    } as const;
    const [sig, light] = map[which];
    sig.set(v);
    light.intensity = v;
  }

  protected toggleShadows(): void {
    this.shadows.set(!this.shadows());
    this.renderer.shadowMap.enabled = this.shadows();
    // shadow toggling requires materials to recompile
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.material) (mesh.material as THREE.Material).needsUpdate = true;
    });
  }

  protected toggleHelpers(): void {
    this.helpers.set(!this.helpers());
    for (const h of this.helperObjects) h.visible = this.helpers();
  }
}
