import { Component, signal } from '@angular/core';
import * as THREE from 'three';
import { ThreeDemo } from '../../core/three/three-demo';
import { CodeBlock } from '../../shared/code-block';

const SNIPPET = `
// The scene graph is a tree, exactly like your component tree.
// Transforms COMPOSE downwards: a child's position/rotation/scale
// is expressed in its parent's local space.

const sunOrbit = new THREE.Group();      // <app-solar-system>
scene.add(sunOrbit);

const sun = new THREE.Mesh(sunGeo, sunMat);
sunOrbit.add(sun);

const planetOrbit = new THREE.Group();   //   <app-planet> inside it
planetOrbit.position.x = 0;              //   pivot sits at the sun
sunOrbit.add(planetOrbit);

const planet = new THREE.Mesh(planetGeo, planetMat);
planet.position.x = 4;                   //   4 units out, in PARENT space
planetOrbit.add(planet);

const moonOrbit = new THREE.Group();     //     <app-moon> inside THAT
moonOrbit.position.x = 4;                //     pivot rides on the planet
planetOrbit.add(moonOrbit);

const moon = new THREE.Mesh(moonGeo, moonMat);
moon.position.x = 1.2;
moonOrbit.add(moon);

// Animate by rotating the GROUPS — children come along for free.
function tick(dt: number) {
  sunOrbit.rotation.y    += dt * 0.5;  // planet circles the sun
  planetOrbit.rotation.y += dt * 1.5;  // moon circles the planet
}
`;

@Component({
  selector: 'app-lesson-03',
  imports: [CodeBlock],
  template: `
    <div class="article">
      <p>
        Here is the concept that makes 3D scenes manageable, and it's one you already own:
        <strong>the scene is a tree, and transforms inherit.</strong> Where a child component
        inherits injectors and styles from its ancestors, a child <code>Object3D</code>
        inherits <em>coordinate space</em>. Set <code>position.x = 4</code> on a child and
        that means “4 units from my parent's origin, along my parent's X axis” — wherever
        and however rotated that parent happens to be.
      </p>
      <p>
        The workhorse is <code>THREE.Group</code>: an invisible <code>Object3D</code> used
        purely for structure, the <code>&lt;ng-container&gt;</code> of three.js. The classic
        teaching example is a solar system, because it forces the insight: you don't animate
        the moon's looping spirograph path — you rotate two nested pivots and the
        composition <em>is</em> the path.
      </p>

      <app-code [code]="snippet" title="solar-system.ts" />

      <div class="demo">
        <div class="demo-stage" style="height: 440px">
          <canvas #canvas></canvas>
          <span class="stage-tag"><span class="dot"></span>live · lesson 03</span>
        </div>
        <div class="demo-rack">
          <div class="ctl">
            <label>sun orbit speed <span class="val">{{ sunSpeed() }}</span></label>
            <input type="range" min="-2" max="2" step="0.1" [value]="sunSpeed()"
              (input)="sunSpeed.set(+$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>moon orbit speed <span class="val">{{ moonSpeed() }}</span></label>
            <input type="range" min="-4" max="4" step="0.1" [value]="moonSpeed()"
              (input)="moonSpeed.set(+$any($event.target).value)" />
          </div>
          <div class="ctl">
            <label>planet distance <span class="val">{{ planetDist() }}</span></label>
            <input type="range" min="2.5" max="6" step="0.1" [value]="planetDist()"
              (input)="setPlanetDist(+$any($event.target).value)" />
          </div>
          <div class="ctl ctl-row">
            <input type="checkbox" id="l3axes" [checked]="showAxes()" (change)="toggleAxes()" />
            <label for="l3axes">show local axes</label>
          </div>
        </div>
      </div>

      <p>
        Turn on <em>local axes</em> and watch the moon's red/green/blue tripod: it stays
        rigidly oriented relative to its pivot group while the whole assembly swings around
        the sun. That's transform composition made visible. Now drag <em>planet distance</em>
        — one property on one group, and the moon system follows, because the moon never knew
        where it was in world space to begin with.
      </p>

      <h2>Local vs world space</h2>
      <p>
        Sometimes you genuinely need world coordinates — “where is the moon, really?” for a
        camera target or a physics check. Never read <code>object.position</code> for that;
        it's local by definition. Ask for the composed result:
      </p>
      <app-code
        code="const worldPos = new THREE.Vector3();
moon.getWorldPosition(worldPos); // walks up the tree, composing matrices

// related helpers:
object.getWorldQuaternion(q);  // composed rotation
object.getWorldScale(s);       // composed scale
child.attach(otherParent);     // re-parent KEEPING world transform"
        title="world-space.ts"
      />

      <div class="ng-note">
        <div class="ng-note-tag">The Angular angle</div>
        <p>
          Notice what the sliders bind to here: the two <em>speed</em> sliders are read
          inside the render loop every frame (signals are just fast getters — reading one
          60×/s costs nothing), while <em>planet distance</em> writes through to
          <code>group.position.x</code> in the event handler. Two clean patterns:
          loop-read for continuous values, write-through for structural ones. An
          <code>effect()</code> would also work, but for three.js you rarely need it.
        </p>
      </div>
    </div>
  `,
})
export class Lesson03SceneGraph extends ThreeDemo {
  protected readonly snippet = SNIPPET;

  protected readonly sunSpeed = signal(0.5);
  protected readonly moonSpeed = signal(1.6);
  protected readonly planetDist = signal(4);
  protected readonly showAxes = signal(false);

  private sunOrbit!: THREE.Group;
  private planetOrbit!: THREE.Group;
  private moonOrbit!: THREE.Group;
  private axes: THREE.AxesHelper[] = [];

  protected onInit(): void {
    this.camera.position.set(0, 6.5, 9.5);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.18));
    const core = new THREE.PointLight(0xffd28a, 60, 0, 1.8);
    this.scene.add(core);

    const grid = new THREE.GridHelper(24, 24, 0x2a2e3a, 0x171a21);
    grid.position.y = -2.2;
    this.scene.add(grid);

    this.sunOrbit = new THREE.Group();
    this.scene.add(this.sunOrbit);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0xffc24d }),
    );
    this.sunOrbit.add(sun);

    this.planetOrbit = new THREE.Group();
    this.sunOrbit.add(this.planetOrbit);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 32, 16),
      new THREE.MeshStandardMaterial({ color: 0x4d9fff, roughness: 0.6 }),
    );
    planet.position.x = this.planetDist();
    this.planetOrbit.add(planet);

    this.moonOrbit = new THREE.Group();
    this.moonOrbit.position.x = this.planetDist();
    this.planetOrbit.add(this.moonOrbit);

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 24, 12),
      new THREE.MeshStandardMaterial({ color: 0xc9ced9, roughness: 0.9 }),
    );
    moon.position.x = 1.1;
    this.moonOrbit.add(moon);

    // visible orbit rings (purely decorative)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x3a3f4d,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const planetRing = new THREE.Mesh(
      new THREE.RingGeometry(this.planetDist() - 0.01, this.planetDist() + 0.01, 128),
      ringMat,
    );
    planetRing.rotation.x = -Math.PI / 2;
    planetRing.name = 'planet-ring';
    this.sunOrbit.add(planetRing);

    for (const target of [this.planetOrbit, this.moonOrbit]) {
      const helper = new THREE.AxesHelper(0.9);
      helper.visible = false;
      target.add(helper);
      this.axes.push(helper);
    }

    this.planetOrbit.rotation.y = 1;
  }

  protected override onFrame(dt: number): void {
    this.sunOrbit.rotation.y += dt * this.sunSpeed();
    this.planetOrbit.rotation.y += dt * this.moonSpeed() * 0.6;
    this.moonOrbit.rotation.y += dt * this.moonSpeed();
  }

  protected setPlanetDist(v: number): void {
    this.planetDist.set(v);
    const planet = this.planetOrbit.children.find((c) => c instanceof THREE.Mesh);
    if (planet) planet.position.x = v;
    this.moonOrbit.position.x = v;
    const ring = this.sunOrbit.getObjectByName('planet-ring') as THREE.Mesh | undefined;
    if (ring) {
      ring.geometry.dispose();
      ring.geometry = new THREE.RingGeometry(v - 0.01, v + 0.01, 128);
    }
  }

  protected toggleAxes(): void {
    this.showAxes.set(!this.showAxes());
    for (const a of this.axes) a.visible = this.showAxes();
  }
}
