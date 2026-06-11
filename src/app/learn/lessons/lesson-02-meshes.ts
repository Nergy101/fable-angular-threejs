import { Component, signal } from '@angular/core';
import * as THREE from 'three';
import { ThreeDemo } from '../../core/three/three-demo';
import { CodeBlock } from '../../shared/code-block';

const SNIPPET = `
// A Mesh = Geometry (the data) × Material (the surface shader).
const mesh = new THREE.Mesh(
  new THREE.TorusKnotGeometry(1, 0.35, 128, 32),
  new THREE.MeshStandardMaterial({
    color: 0xd7ff3e,
    metalness: 0.4,   // 0 = dielectric (plastic), 1 = metal
    roughness: 0.25,  // 0 = mirror, 1 = chalk
  }),
);
scene.add(mesh);

// Materials are cheap to reconfigure…
mesh.material.roughness = 0.8;

// …but geometry is GPU data. Replacing it means disposing the old one:
mesh.geometry.dispose();
mesh.geometry = new THREE.SphereGeometry(1.4, 48, 24);
`;

const GEOMETRIES: Record<string, () => THREE.BufferGeometry> = {
  TorusKnot: () => new THREE.TorusKnotGeometry(1, 0.35, 160, 32),
  Box: () => new THREE.BoxGeometry(1.8, 1.8, 1.8, 1, 1, 1),
  Sphere: () => new THREE.SphereGeometry(1.4, 48, 24),
  Torus: () => new THREE.TorusGeometry(1.1, 0.42, 24, 64),
  Icosahedron: () => new THREE.IcosahedronGeometry(1.5, 0),
  Cylinder: () => new THREE.CylinderGeometry(1, 1, 2, 32),
};

type MaterialKind = 'standard' | 'normal' | 'basic' | 'phong' | 'toon';

@Component({
  selector: 'app-lesson-02',
  imports: [CodeBlock],
  template: `
    <div class="article">
      <p>
        Lesson 01 put <em>something</em> on screen; now we dissect what that something is.
        Everything visible in three.js is a <code>Mesh</code>, and a mesh is the product of
        exactly two parts:
      </p>
      <ul>
        <li>
          <strong>Geometry</strong> — the raw vertex data: positions, normals, UVs, packed
          into typed arrays on the GPU. Pure structure, no opinion about appearance.
        </li>
        <li>
          <strong>Material</strong> — the program that shades that structure: color,
          how it reacts to light, transparency, wireframe…
        </li>
      </ul>
      <p>
        If you squint, it's a familiar separation: geometry is your component's
        <em>data model</em>, material is its <em>template and styles</em>. Swap either side
        independently and you get a completely different result — which is precisely what the
        demo below lets you do.
      </p>

      <app-code [code]="snippet" title="mesh-anatomy.ts" />

      <h2>The material spectrum</h2>
      <p>
        Materials form a cost/realism ladder. <code>MeshBasicMaterial</code> ignores light
        entirely (and is the only one that works without any lights in the scene).
        <code>MeshNormalMaterial</code> is the debugging classic — it colors faces by their
        orientation. <code>MeshPhongMaterial</code> is the cheap-and-cheerful 90s shiny.
        <code>MeshStandardMaterial</code> is the modern default: physically-based rendering
        (PBR) driven by two intuitive dials, <strong>metalness</strong> and
        <strong>roughness</strong>. Real assets — including everything you'll download from
        Sketchfab later — are authored for this model.
      </p>

      <div class="demo">
        <div class="demo-stage" style="height: 420px">
          <canvas #canvas></canvas>
          <span class="stage-tag"><span class="dot"></span>live · lesson 02</span>
        </div>
        <div class="demo-rack">
          <div class="ctl">
            <label>geometry</label>
            <select [value]="geo()" (change)="setGeo($any($event.target).value)">
              @for (g of geoNames; track g) {
                <option [value]="g">{{ g }}Geometry</option>
              }
            </select>
          </div>
          <div class="ctl">
            <label>material</label>
            <select [value]="mat()" (change)="setMat($any($event.target).value)">
              <option value="standard">MeshStandardMaterial</option>
              <option value="phong">MeshPhongMaterial</option>
              <option value="toon">MeshToonMaterial</option>
              <option value="normal">MeshNormalMaterial</option>
              <option value="basic">MeshBasicMaterial</option>
            </select>
          </div>
          <div class="ctl">
            <label>metalness <span class="val">{{ metalness() }}</span></label>
            <input type="range" min="0" max="1" step="0.05" [value]="metalness()"
              (input)="setMetalness(+$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>roughness <span class="val">{{ roughness() }}</span></label>
            <input type="range" min="0" max="1" step="0.05" [value]="roughness()"
              (input)="setRoughness(+$any($event.target).value)" />
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l2wire" [checked]="wireframe()"
              (change)="toggleWireframe()" />
            <label for="l2wire">wireframe</label>
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l2flat" [checked]="flat()" (change)="toggleFlat()" />
            <label for="l2flat">flat shading</label>
          </div>
        </div>
      </div>

      <p>
        Try this sequence: <em>Standard</em> material, metalness <code>1</code>, roughness
        <code>0.15</code> — brushed metal. Now roughness <code>0.9</code> — cast iron. Now
        metalness <code>0</code> — ceramic. Two floats, the whole material universe. Then
        switch to <em>Basic</em> and watch all lighting vanish: that flat silhouette is what
        “unlit” means.
      </p>

      <div class="ng-note">
        <div class="ng-note-tag">The Angular angle</div>
        <p>
          Every control above is a plain Angular signal. Cheap properties
          (<code>roughness</code>, <code>wireframe</code>) are mutated directly in the
          event handler — no re-render of anything, three.js picks the value up on the next
          frame. Replacing the <em>geometry</em>, though, calls
          <code>geometry.dispose()</code> first: GPU buffers are manual memory. The rule of
          thumb — mutate materials, replace-and-dispose geometries.
        </p>
      </div>
    </div>
  `,
})
export class Lesson02Meshes extends ThreeDemo {
  protected readonly snippet = SNIPPET;
  protected readonly geoNames = Object.keys(GEOMETRIES);

  protected readonly geo = signal('TorusKnot');
  protected readonly mat = signal<MaterialKind>('standard');
  protected readonly metalness = signal(0.4);
  protected readonly roughness = signal(0.25);
  protected readonly wireframe = signal(false);
  protected readonly flat = signal(false);

  private mesh!: THREE.Mesh;

  protected onInit(): void {
    this.camera.position.set(0, 1.2, 6);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 6, 5);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x4d9fff, 18);
    rim.position.set(-5, 2, -4);
    this.scene.add(rim);

    this.mesh = new THREE.Mesh(GEOMETRIES['TorusKnot'](), this.buildMaterial());
    this.scene.add(this.mesh);
  }

  protected override onFrame(dt: number): void {
    this.mesh.rotation.y += dt * 0.4;
  }

  private buildMaterial(): THREE.Material {
    const common = {
      color: 0xd7ff3e,
      wireframe: this.wireframe(),
      flatShading: this.flat(),
    };
    switch (this.mat()) {
      case 'basic':
        return new THREE.MeshBasicMaterial({ color: common.color, wireframe: common.wireframe });
      case 'normal':
        return new THREE.MeshNormalMaterial(common);
      case 'phong':
        return new THREE.MeshPhongMaterial({ ...common, shininess: 80 });
      case 'toon':
        return new THREE.MeshToonMaterial({ color: common.color, wireframe: common.wireframe });
      default:
        return new THREE.MeshStandardMaterial({
          ...common,
          metalness: this.metalness(),
          roughness: this.roughness(),
        });
    }
  }

  protected setGeo(name: string): void {
    this.geo.set(name);
    this.mesh.geometry.dispose();
    this.mesh.geometry = GEOMETRIES[name]();
  }

  protected setMat(kind: MaterialKind): void {
    this.mat.set(kind);
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.material = this.buildMaterial();
  }

  protected setMetalness(v: number): void {
    this.metalness.set(v);
    const m = this.mesh.material as THREE.MeshStandardMaterial;
    if (m instanceof THREE.MeshStandardMaterial) m.metalness = v;
  }

  protected setRoughness(v: number): void {
    this.roughness.set(v);
    const m = this.mesh.material as THREE.MeshStandardMaterial;
    if (m instanceof THREE.MeshStandardMaterial) m.roughness = v;
  }

  protected toggleWireframe(): void {
    this.wireframe.set(!this.wireframe());
    const m = this.mesh.material as THREE.MeshStandardMaterial;
    if ('wireframe' in m) m.wireframe = this.wireframe();
  }

  protected toggleFlat(): void {
    this.flat.set(!this.flat());
    // flatShading changes the compiled shader — needs a rebuild flag
    const m = this.mesh.material as THREE.MeshStandardMaterial;
    if ('flatShading' in m) {
      m.flatShading = this.flat();
      m.needsUpdate = true;
    }
  }
}
