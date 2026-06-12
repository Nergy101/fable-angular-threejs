import { Component, signal } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThreeDemo } from '../../core/three/three-demo';
import { CodeBlock } from '../../shared/code-block';

const GRID = 128; // segments per side → 129×129 vertices

const SNIPPET_VERTS = `
// Start with a subdivided plane — a flat grid of triangles
const geo = new THREE.PlaneGeometry(20, 20, GRID, GRID);
geo.rotateX(-Math.PI / 2); // lay it flat in the XZ plane, Y is up

// Vertex positions live in a flat Float32Array: [x0,y0,z0, x1,y1,z1, …]
const pos = geo.attributes.position as THREE.BufferAttribute;

for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const z = pos.getZ(i);

  // displace Y with any height function you like
  pos.setY(i, heightAt(x, z));
}

// Re-derive normals after moving verts — otherwise lighting breaks
geo.computeVertexNormals();
pos.needsUpdate = true;
`;

const SNIPPET_FBM = `
// Fractional Brownian Motion — the workhorse of terrain generation.
// Stack octaves of noise at doubling frequency / halving amplitude:
function fbm(x: number, y: number, octaves = 5): number {
  let value = 0, amplitude = 0.5, frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2d(x * frequency, y * frequency);
    frequency *= 2;   // next octave: twice as fine
    amplitude *= 0.5; // … but half as loud
  }
  return value; // ≈ [0, 1)
}

// Minimal 2-D value noise with smooth interpolation:
function noise2d(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx); // smoothstep
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix,     iy    ), b = hash(ix + 1, iy    );
  const c = hash(ix,     iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// Deterministic pseudo-random hash from an (x, y) integer pair:
function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
`;

@Component({
  selector: 'app-lesson-09',
  imports: [CodeBlock],
  template: `
    <div class="article">
      <p>
        Every mountain, canyon and ocean floor is just a <strong>height field</strong>: a 2-D
        grid where each sample stores an elevation. Three.js has no terrain primitive, but it
        gives you <code>PlaneGeometry</code> — a subdivided flat grid — and direct write access
        to every vertex. A noise function connects the two.
      </p>

      <app-code [code]="snippetVerts" title="displace-plane.ts" />

      <h2>Noise that looks like land</h2>
      <p>
        A single sine wave produces rolling hills; raw random values produce static.
        <strong>Fractional Brownian Motion (fBm)</strong> layers several octaves of noise — each
        one twice as frequent and half as loud — which is why real terrain has both wide valleys
        and fine ridge-line detail at the same time.
      </p>

      <app-code [code]="snippetFbm" title="fbm.ts" />

      <h2>Live terrain</h2>
      <p>
        Drag to orbit. Adjust the sliders to feel how each parameter shapes the result. Enable
        <em>animate</em> to scroll the noise field and watch the landscape drift in real time —
        the same technique used for animated clouds and water shaders.
      </p>

      <div class="demo">
        <div class="demo-stage" style="height: 460px">
          <canvas #canvas></canvas>
          <span class="stage-tag">
            <span class="dot"></span>
            {{ vertexCount().toLocaleString() }} vertices · drag to orbit
          </span>
        </div>
        <div class="demo-rack">
          <div class="ctl">
            <label>amplitude <span class="val">{{ amplitude() }}</span></label>
            <input type="range" min="0.5" max="8" step="0.1" [value]="amplitude()"
              (input)="setAmplitude(+$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>frequency <span class="val">{{ frequency() }}</span></label>
            <input type="range" min="0.3" max="4" step="0.1" [value]="frequency()"
              (input)="setFrequency(+$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>octaves <span class="val">{{ octaves() }}</span></label>
            <input type="range" min="1" max="8" step="1" [value]="octaves()"
              (input)="setOctaves(+$any($event.target).value)" />
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l9wire" [checked]="wireframe()"
              (change)="toggleWireframe()" />
            <label for="l9wire">wireframe overlay</label>
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l9anim" [checked]="animate()"
              (change)="animate.set(!animate())" />
            <label for="l9anim">animate</label>
          </div>
          <button class="btn" (click)="reseed()">↺ new seed</button>
        </div>
      </div>

      <h2>Colouring by elevation</h2>
      <p>
        Each vertex gets a colour based on its height — water, sand, grass, rock, snow — stored
        in a <code>color</code> <code>BufferAttribute</code> and read by setting
        <code>vertexColors: true</code> on the material. Three.js interpolates the gradient
        across each triangle for free. The important detail is calling
        <code>geo.computeVertexNormals()</code> every time you move verts, otherwise the
        lighting vectors go stale.
      </p>

      <div class="ng-note">
        <div class="ng-note-tag">Performance tip</div>
        <p>
          Rebuilding the height field every frame is fine for a small demo. In a game or large
          world you would move the noise into a <strong>vertex shader</strong> — the GPU runs it
          in parallel across all vertices at essentially zero JS cost. GLSL has built-in
          <code>fract</code>, <code>mix</code> and dot-product operations that make fBm
          about 20 lines long.
        </p>
      </div>
    </div>
  `,
})
export class Lesson09Terrain extends ThreeDemo {
  protected readonly snippetVerts = SNIPPET_VERTS;
  protected readonly snippetFbm = SNIPPET_FBM;

  protected readonly amplitude = signal(3.5);
  protected readonly frequency = signal(1.2);
  protected readonly octaves = signal(5);
  protected readonly wireframe = signal(false);
  protected readonly animate = signal(false);
  protected readonly vertexCount = signal(0);

  private controls!: OrbitControls;
  private terrain!: THREE.Mesh;
  private wireMesh!: THREE.Mesh;
  private seed = Math.random() * 1000;
  private scrollOffset = 0;

  protected onInit(): void {
    this.camera.position.set(0, 14, 22);
    this.camera.lookAt(0, 0, 0);

    this.scene.fog = new THREE.FogExp2(0x0a0b0e, 0.018);
    this.scene.add(new THREE.AmbientLight(0x8899aa, 0.55));

    const sun = new THREE.DirectionalLight(0xfff4d6, 1.8);
    sun.position.set(-12, 22, 8);
    this.scene.add(sun);

    this.zone.runOutsideAngular(() => {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.target.set(0, 2, 0);
    });

    this.buildTerrain();
  }

  private buildTerrain(): void {
    if (this.terrain) {
      this.terrain.geometry.dispose();
      (this.terrain.material as THREE.Material).dispose();
      (this.wireMesh.material as THREE.Material).dispose();
      this.scene.remove(this.terrain, this.wireMesh);
    }

    const geo = new THREE.PlaneGeometry(28, 28, GRID, GRID);
    geo.rotateX(-Math.PI / 2);
    this.applyHeight(geo, 0);

    this.terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }),
    );
    this.scene.add(this.terrain);

    this.wireMesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.06,
      }),
    );
    this.wireMesh.visible = this.wireframe();
    this.scene.add(this.wireMesh);

    this.vertexCount.set(geo.attributes['position'].count);
  }

  private applyHeight(geo: THREE.BufferGeometry, scroll: number): void {
    const pos = geo.attributes['position'] as THREE.BufferAttribute;
    const amp = this.amplitude();
    const freq = this.frequency();
    const oct = this.octaves();
    const s = this.seed;

    let col = geo.attributes['color'] as THREE.BufferAttribute | undefined;
    if (!col || col.count !== pos.count) {
      col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
      geo.setAttribute('color', col);
    }

    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = fbm(x * freq * 0.18 + s + scroll, z * freq * 0.18 + s, oct) * amp - amp * 0.3;
      pos.setY(i, h);
      heightColor(c, (h + amp * 0.3) / amp);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    geo.computeVertexNormals();
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  protected override onFrame(dt: number): void {
    this.controls?.update();
    if (this.animate()) {
      this.scrollOffset += dt * 0.18;
      this.applyHeight(this.terrain.geometry as THREE.BufferGeometry, this.scrollOffset);
    }
  }

  setAmplitude(v: number): void {
    this.amplitude.set(v);
    this.scrollOffset = 0;
    this.applyHeight(this.terrain.geometry as THREE.BufferGeometry, 0);
  }

  setFrequency(v: number): void {
    this.frequency.set(v);
    this.scrollOffset = 0;
    this.applyHeight(this.terrain.geometry as THREE.BufferGeometry, 0);
  }

  setOctaves(v: number): void {
    this.octaves.set(v);
    this.scrollOffset = 0;
    this.applyHeight(this.terrain.geometry as THREE.BufferGeometry, 0);
  }

  toggleWireframe(): void {
    this.wireframe.update((w) => !w);
    if (this.wireMesh) this.wireMesh.visible = this.wireframe();
  }

  reseed(): void {
    this.seed = Math.random() * 1000;
    this.scrollOffset = 0;
    this.applyHeight(this.terrain.geometry as THREE.BufferGeometry, 0);
  }

  protected override onDispose(): void {
    this.controls?.dispose();
  }
}

/* ---- noise helpers ---- */

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise2d(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, octaves: number): number {
  let value = 0, amplitude = 0.5, frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2d(x * frequency, y * frequency);
    frequency *= 2;
    amplitude *= 0.5;
  }
  return value;
}

function heightColor(out: THREE.Color, t: number): void {
  const v = Math.max(0, Math.min(1, t));
  if (v < 0.15)      out.setRGB(0.04, 0.12, 0.28); // deep water
  else if (v < 0.22) out.setRGB(0.07, 0.20, 0.42); // shallow water
  else if (v < 0.30) out.setRGB(0.74, 0.68, 0.50); // sand
  else if (v < 0.55) out.setRGB(0.20, 0.44, 0.16); // grass
  else if (v < 0.70) out.setRGB(0.26, 0.54, 0.20); // highland
  else if (v < 0.82) out.setRGB(0.45, 0.40, 0.35); // rock
  else if (v < 0.92) out.setRGB(0.60, 0.57, 0.53); // grey rock
  else               out.setRGB(0.90, 0.92, 0.96); // snow
}
