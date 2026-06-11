import { Component, signal } from '@angular/core';
import * as THREE from 'three';
import { ThreeDemo } from '../../core/three/three-demo';
import { CodeBlock } from '../../shared/code-block';

const SNIPPET = `
// THE cardinal rule: animate with TIME, not with frame counts.
// A 144Hz gaming monitor runs your loop 2.4× as often as a tired
// laptop — multiply every change by dt and both see the same motion.

const clock = new THREE.Clock();

function tick() {
  const dt = clock.getDelta();        // seconds since last frame
  const t  = clock.elapsedTime;       // seconds since start

  mesh.rotation.y += 0.8 * dt;        // ✓ speed in radians/second
  // mesh.rotation.y += 0.013;        // ✗ speed in radians/FRAME

  mesh.position.y = Math.sin(t * 2);  // ✓ pure function of time

  // smooth-follow: lerp by a dt-aware factor
  camera.position.lerp(target, 1 - Math.pow(0.001, dt));

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
`;

const SNIPPET_ZONE = `
// Inside an Angular component, the loop runs outside the zone…
this.zone.runOutsideAngular(() => {
  const tick = () => {
    controls.update();
    renderer.render(scene, camera);
    this.frames++;
    rafId = requestAnimationFrame(tick);
  };
  tick();
});

// …and when the 3D world needs to talk BACK to Angular state
// (a HUD, an fps meter, a "selected object" panel), re-enter
// deliberately and infrequently:
setInterval(() => {
  this.zone.run(() => this.fps.set(this.frames));  // 1×/second
  this.frames = 0;
}, 1000);
// One change-detection pass per second — not sixty.
`;

@Component({
  selector: 'app-lesson-06',
  imports: [CodeBlock],
  template: `
    <div class="article">
      <p>
        Static frames are an Angular skill; motion is a game-developer skill. The render loop
        is where the two cultures meet, and it has one iron law:
        <strong>scale everything by delta time.</strong> The browser calls
        <code>requestAnimationFrame</code> at the display's refresh rate — 60Hz, 120Hz, 144Hz,
        or 12Hz on an overheating phone. Your animation must not care.
      </p>

      <app-code [code]="snippet" title="tick.ts" />

      <h2>A field of time</h2>
      <p>
        361 boxes, zero per-box state. Each one's height is a pure function
        <code>sin(distance × frequency − t × speed)</code> — the whole animation is driven by
        a single number, elapsed time. Pause it (which simply stops adding to our own time
        accumulator) and notice the orbit still works: <em>simulation time and real time are
        separate things you control.</em>
      </p>

      <div class="demo">
        <div class="demo-stage" style="height: 440px">
          <canvas #canvas></canvas>
          <span class="stage-tag"><span class="dot"></span>{{ fps() }} fps · zone-free</span>
        </div>
        <div class="demo-rack">
          <div class="ctl">
            <label>wave speed <span class="val">{{ speed() }}</span></label>
            <input type="range" min="0" max="4" step="0.1" [value]="speed()"
              (input)="speed.set(+$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>amplitude <span class="val">{{ amplitude() }}</span></label>
            <input type="range" min="0" max="2.5" step="0.1" [value]="amplitude()"
              (input)="amplitude.set(+$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>frequency <span class="val">{{ frequency() }}</span></label>
            <input type="range" min="0.2" max="2.5" step="0.1" [value]="frequency()"
              (input)="frequency.set(+$any($event.target).value)" />
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l6pause" [checked]="paused()"
              (change)="paused.set(!paused())" />
            <label for="l6pause">pause simulation</label>
          </div>
        </div>
      </div>

      <h2>The zone problem, solved properly</h2>
      <p>
        That fps counter in the corner of the stage is Angular state — a signal rendered by
        this very template. But the loop producing it runs outside the zone. The bridge:
        count frames in a plain field (free), and once per second step back into the zone to
        publish the count. This is the general pattern for any 3D→Angular data flow: HUDs,
        selection state, loading progress.
      </p>

      <app-code [code]="snippetZone" title="zone-bridge.ts" />

      <div class="ng-note">
        <div class="ng-note-tag">The Angular angle</div>
        <p>
          Going the other direction — Angular→3D — needs no ceremony at all. The three wave
          sliders above write plain signals, and the loop simply <em>reads</em>
          <code>this.speed()</code> every frame. Signal reads are nanoseconds; there is no
          subscription, no effect, no marshalling. The loop becomes the single place where
          UI state is consumed, which is exactly how game engines structure input.
        </p>
      </div>
    </div>
  `,
})
export class Lesson06Loop extends ThreeDemo {
  protected readonly snippet = SNIPPET;
  protected readonly snippetZone = SNIPPET_ZONE;

  protected readonly speed = signal(1.4);
  protected readonly amplitude = signal(1);
  protected readonly frequency = signal(1);
  protected readonly paused = signal(false);
  protected readonly fps = signal(0);

  private field!: THREE.InstancedMesh;
  private simTime = 0;
  private frames = 0;
  private fpsTimer?: ReturnType<typeof setInterval>;
  private readonly dummy = new THREE.Object3D();

  private static readonly SIDE = 19;

  protected onInit(): void {
    this.camera.position.set(10, 9, 14);
    this.camera.lookAt(0, 0, 0);

    this.scene.fog = new THREE.Fog(0x0a0b0e, 18, 34);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(6, 10, 4);
    this.scene.add(key);

    const side = Lesson06Loop.SIDE;
    // one draw call for all 361 boxes — InstancedMesh is the cheap way
    // to render many copies of the same geometry/material pair
    this.field = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.7, 1, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xd7ff3e, roughness: 0.5 }),
      side * side,
    );
    this.scene.add(this.field);

    // the fps signal is Angular state — publish it from inside the zone,
    // once per second, instead of 60 times
    this.fpsTimer = setInterval(() => {
      this.zone.run(() => this.fps.set(this.frames));
      this.frames = 0;
    }, 1000);
  }

  protected override onFrame(dt: number): void {
    this.frames++;
    if (!this.paused()) this.simTime += dt * this.speed();

    const side = Lesson06Loop.SIDE;
    const amp = this.amplitude();
    const freq = this.frequency();
    let i = 0;
    for (let x = 0; x < side; x++) {
      for (let z = 0; z < side; z++) {
        const cx = (x - side / 2) * 0.85;
        const cz = (z - side / 2) * 0.85;
        const dist = Math.hypot(cx, cz);
        const h = 1.2 + (Math.sin(dist * freq - this.simTime * 2) * 0.5 + 0.5) * amp * 2;
        this.dummy.position.set(cx, h / 2 - 2, cz);
        this.dummy.scale.set(1, h, 1);
        this.dummy.updateMatrix();
        this.field.setMatrixAt(i++, this.dummy.matrix);
      }
    }
    this.field.instanceMatrix.needsUpdate = true;

    // slow orbit, deliberately tied to REAL time (dt), not simTime
    const t = performance.now() / 1000;
    this.camera.position.x = Math.sin(t * 0.08) * 15;
    this.camera.position.z = Math.cos(t * 0.08) * 15;
    this.camera.lookAt(0, 0, 0);
  }

  protected override onDispose(): void {
    clearInterval(this.fpsTimer);
  }
}
