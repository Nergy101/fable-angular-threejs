import { Component, signal } from '@angular/core';
import * as THREE from 'three';
import { ThreeDemo } from '../../core/three/three-demo';
import { CodeBlock } from '../../shared/code-block';

const SNIPPET = `
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

canvas.addEventListener('pointermove', (event) => {
  // 1 — convert pixels → Normalized Device Coordinates.
  //     NDC is the GPU's screen space: x and y both run -1…+1,
  //     with +y UP (so the y axis flips vs. DOM coordinates).
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

  // 2 — fire a ray from the camera through that point…
  raycaster.setFromCamera(pointer, camera);

  // 3 — …and ask what it hits, sorted nearest-first.
  const hits = raycaster.intersectObjects(scene.children);
  if (hits.length > 0) {
    const { object, point, distance } = hits[0];
    //      ^ the mesh    ^ world position  ^ from camera
  }
});
`;

@Component({
  selector: 'app-lesson-07',
  imports: [CodeBlock],
  template: `
    <div class="article">
      <p>
        The DOM gives you <code>(click)</code> on any element for free because the browser
        knows where every box is. A WebGL canvas is one opaque rectangle — three.js objects
        are not elements, and nothing routes events to them. <strong>Raycasting</strong> is
        how you build that routing yourself: shoot a mathematical ray from the camera through
        the mouse position, and ask which objects it pierces.
      </p>

      <app-code [code]="snippet" title="raycast.ts" />

      <h2>Touch the grid</h2>
      <p>
        Move across the field — the ray runs on every pointer move, the nearest hit glows.
        Click to select (and grow) a cell. The readout below the stage is Angular template
        state, updated only when the hovered object actually <em>changes</em> — not per
        pointer event.
      </p>

      <div class="demo">
        <div class="demo-stage" style="height: 440px">
          <canvas #canvas></canvas>
          <span class="stage-tag"><span class="dot"></span>{{ hovered() || 'nothing hovered' }}</span>
        </div>
        <div class="demo-rack">
          <div class="ctl ctl-row">
            <span class="kicker">selected: <span class="tick">{{ selectedCount() }}</span> /
              49 · click a tile to toggle it</span>
          </div>
        </div>
      </div>

      <h2>What the intersection tells you</h2>
      <p>
        Each hit is rich: the <code>object</code> itself, the exact world-space
        <code>point</code> of contact, the <code>face</code> and its normal, UV coordinates,
        and the <code>distance</code>. That's enough to place decals, snap dragged objects to
        surfaces, or paint on meshes. Two practical habits:
      </p>
      <ul>
        <li>
          <strong>Raycast against a short list,</strong> not <code>scene.children</code> with
          <code>recursive: true</code>, once scenes grow. Keep an array of interactive
          meshes; testing 10,000 triangles per pointer-move because your floor was in the
          list is a classic jank source.
        </li>
        <li>
          <strong>Names and userData are your event targets.</strong>
          <code>mesh.name = 'tile-3-4'</code> or <code>mesh.userData['tile'] = tile</code>
          turn an anonymous hit back into domain state — the 3D analogue of
          <code>data-*</code> attributes.
        </li>
      </ul>

      <div class="ng-note">
        <div class="ng-note-tag">The Angular angle</div>
        <p>
          zone.js patches <code>addEventListener</code>, so a naïve
          <code>pointermove</code> handler triggers app-wide change detection at mouse-speed.
          This demo registers its listeners inside <code>runOutsideAngular</code>, does the
          raycast and highlight silently, and only calls <code>zone.run()</code> when the
          hovered object's name actually changes — that's when the signal backing the
          readout updates. Filter at the boundary; let the hot path stay dark.
        </p>
      </div>
    </div>
  `,
})
export class Lesson07Raycasting extends ThreeDemo {
  protected readonly snippet = SNIPPET;
  protected readonly hovered = signal('');
  protected readonly selectedCount = signal(0);

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(-10, -10);
  private tiles: THREE.Mesh[] = [];
  private hoveredTile?: THREE.Mesh;
  private readonly listeners: Array<[string, EventListener]> = [];

  protected onInit(): void {
    this.camera.position.set(0, 8, 9);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 8, 5);
    this.scene.add(key);

    for (let x = 0; x < 7; x++) {
      for (let z = 0; z < 7; z++) {
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(0.92, 0.4, 0.92),
          new THREE.MeshStandardMaterial({ color: 0x3a3f4d, roughness: 0.6 }),
        );
        tile.position.set((x - 3) * 1.05, 0, (z - 3) * 1.05);
        tile.name = 'tile ' + x + '·' + z;
        tile.userData['selected'] = false;
        this.tiles.push(tile);
        this.scene.add(tile);
      }
    }

    // pointer listeners live OUTSIDE the zone — see the note in the article
    this.zone.runOutsideAngular(() => {
      const move = (e: Event) => this.trackPointer(e as PointerEvent);
      const click = () => this.clickTile();
      const leave = () => this.pointer.set(-10, -10);
      this.canvas.addEventListener('pointermove', move);
      this.canvas.addEventListener('click', click);
      this.canvas.addEventListener('pointerleave', leave);
      this.listeners.push(['pointermove', move], ['click', click], ['pointerleave', leave]);
    });
  }

  protected override onFrame(dt: number, t: number): void {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.tiles)[0];
    const tile = hit?.object as THREE.Mesh | undefined;

    if (tile !== this.hoveredTile) {
      if (this.hoveredTile) this.styleTile(this.hoveredTile, false);
      this.hoveredTile = tile;
      if (tile) this.styleTile(tile, true);
      // hovered name is Angular state — publish only on change
      this.zone.run(() => this.hovered.set(tile ? tile.name : ''));
    }

    // selected tiles breathe
    for (const t2 of this.tiles) {
      const targetY = t2.userData['selected'] ? 0.55 + Math.sin(t * 3) * 0.05 : 0;
      t2.position.y += (targetY - t2.position.y) * Math.min(1, dt * 10);
    }
  }

  protected override onDispose(): void {
    for (const [type, fn] of this.listeners) this.canvas.removeEventListener(type, fn);
  }

  private trackPointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }

  private clickTile(): void {
    if (!this.hoveredTile) return;
    const tile = this.hoveredTile;
    tile.userData['selected'] = !tile.userData['selected'];
    this.styleTile(tile, true);
    const count = this.tiles.filter((t) => t.userData['selected']).length;
    this.zone.run(() => this.selectedCount.set(count));
  }

  private styleTile(tile: THREE.Mesh, hover: boolean): void {
    const mat = tile.material as THREE.MeshStandardMaterial;
    const selected = tile.userData['selected'] as boolean;
    mat.color.set(selected ? 0xd7ff3e : hover ? 0x6b7387 : 0x3a3f4d);
    mat.emissive.set(hover ? (selected ? 0x39440e : 0x12141c) : 0x000000);
  }
}
