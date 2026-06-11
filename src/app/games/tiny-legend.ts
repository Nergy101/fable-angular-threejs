import { Component, signal, WritableSignal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { ThreeDemo } from '../core/three/three-demo';

type Phase = 'title' | 'play' | 'dead' | 'win';

/* ---- world ---- */
const COLS = 16;
const ROWS = 11;
const TILE = 1;

/*
 * Four screens in a 2×2 grid, NES-style: crossing an open edge swaps the
 * whole screen. Legend: # tree · R rock · ~ water · = bridge · , sand ·
 * . grass · S start · E enemy · H heart · $ rupee · T trishard
 */
const SCREENS: Record<string, { name: string; rows: string[] }> = {
  '0,0': {
    name: 'verdant field',
    rows: [
      '################',
      '#......##.....,#',
      '#.S....##..E..,#',
      '#..............#',
      '#...~~~....#....',
      '#...~=~.........',
      '#...~~~....#....',
      '#..E...........#',
      '#.....$........#',
      '#..............#',
      '#######..#######',
    ],
  },
  '1,0': {
    name: 'lakeside',
    rows: [
      '################',
      '#..............#',
      '#...E....~~~~..#',
      '#........~~~~..#',
      '......~~..~~...#',
      '.....=......H..#',
      '......~~.......#',
      '#..~~....E.....#',
      '#..~~..........#',
      '#.....E........#',
      '#######..#######',
    ],
  },
  '0,1': {
    name: 'boulder shore',
    rows: [
      '#######..#######',
      '#....RR........#',
      '#..R.......R...#',
      '#......E.......#',
      '#..R............',
      '#.....H.........',
      '#..RR...........',
      '#.......E..R...#',
      '#..$.......R...#',
      '#....RR........#',
      '################',
    ],
  },
  '1,1': {
    name: 'the shrine',
    rows: [
      '#######..#######',
      '#..............#',
      '#..RR......RR..#',
      '#....E..E......#',
      '...............#',
      '.......T.......#',
      '....R......R...#',
      '#....E.........#',
      '#..RR......RR..#',
      '#......$.......#',
      '################',
    ],
  },
};

const SOLID = new Set(['#', 'R', '~']);
const MAX_HP = 3;
const HERO_SPEED = 4.2;
const HERO_HALF = 0.3;
const ATTACK_TIME = 0.18;
const ATTACK_COOLDOWN = 0.34;
const INVULN_TIME = 1.2;

interface Enemy {
  x: number;
  z: number;
  hp: number;
  speed: number;
  dirX: number;
  dirZ: number;
  dirTimer: number;
  flash: number;
  mesh: THREE.Mesh;
}

interface Drop {
  id: string;
  x: number;
  z: number;
  kind: 'heart' | 'rupee' | 'trishard';
  mesh: THREE.Object3D;
}

/**
 * Tiny Legend — a fan-made miniature in the spirit of the 1986 top-down
 * classic. One screen at a time, sword out, find the golden trishard.
 * All geometry procedural; mechanically it's lesson material end to end:
 * tile collision, screen transitions, timers, knockback, drops.
 */
@Component({
  selector: 'app-tiny-legend',
  imports: [RouterLink],
  templateUrl: './tiny-legend.html',
  styleUrl: './tiny-legend.scss',
})
export class TinyLegend extends ThreeDemo {
  /* ---- HUD ---- */
  protected readonly phase = signal<Phase>('title');
  protected readonly hp = signal(MAX_HP);
  protected readonly rupees = signal(0);
  protected readonly area = signal('verdant field');
  protected readonly message = signal('press space to begin');
  protected readonly hearts = computed(() =>
    Array.from({ length: MAX_HP }, (_, i) => i < this.hp()),
  );

  /* ---- sim ---- */
  private sx = 0;
  private sy = 0;
  private hero = { x: 2.5, z: 2.5, dirX: 0, dirZ: 1 };
  private attackT = 0;
  private cooldownT = 0;
  private invulnT = 0;
  private solids: boolean[][] = [];
  private enemies: Enemy[] = [];
  private drops: Drop[] = [];
  private collected = new Set<string>();
  private screenGroup?: THREE.Group;
  private heroGroup!: THREE.Group;
  private sword!: THREE.Mesh;
  private lantern!: THREE.PointLight;
  private waterMats: THREE.MeshStandardMaterial[] = [];
  private trishardPos?: { x: number; z: number };
  private readonly keys = new Set<string>();
  private keydownFn?: (e: KeyboardEvent) => void;
  private keyupFn?: (e: KeyboardEvent) => void;

  /* ---- shared assets (built once, reused across screen rebuilds) ---- */
  private readonly geoFlat = new THREE.BoxGeometry(TILE, 0.1, TILE);
  private readonly geoBlock = new THREE.BoxGeometry(TILE, 0.9, TILE);
  private readonly geoCanopy = new THREE.ConeGeometry(0.52, 0.8, 6);
  private readonly geoEnemy = new THREE.SphereGeometry(0.34, 20, 14);
  private readonly mats = {
    grass: new THREE.MeshStandardMaterial({ color: 0x2e5d33, roughness: 1 }),
    sand: new THREE.MeshStandardMaterial({ color: 0x8a744c, roughness: 1 }),
    water: null as unknown as THREE.MeshStandardMaterial, // per-screen animated clone
    bridge: new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 1 }),
    canopy: new THREE.MeshStandardMaterial({ color: 0x1f4424, roughness: 1 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x55596a, roughness: 0.95 }),
  };

  protected onInit(): void {
    this.camera.fov = 42;
    this.camera.position.set(COLS / 2, 14.5, ROWS / 2 + 5.2);
    this.camera.lookAt(COLS / 2, 0, ROWS / 2 - 0.6);
    this.camera.updateProjectionMatrix();

    this.scene.background = new THREE.Color(0x0a0d12);
    this.scene.fog = new THREE.Fog(0x0a0d12, 20, 38);

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // moonlight + the hero's lantern
    this.scene.add(new THREE.HemisphereLight(0x44507a, 0x14100c, 0.75));
    const moon = new THREE.DirectionalLight(0x9fb4e8, 1.1);
    moon.position.set(6, 14, 4);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = moon.shadow.camera.bottom = -12;
    moon.shadow.camera.right = moon.shadow.camera.top = 12;
    this.scene.add(moon);
    this.lantern = new THREE.PointLight(0xffc878, 14, 9, 1.8);
    this.scene.add(this.lantern);

    this.buildHero();
    this.loadScreen(0, 0);

    this.zone.runOutsideAngular(() => {
      this.keydownFn = (e) => this.onKey(e, true);
      this.keyupFn = (e) => this.onKey(e, false);
      window.addEventListener('keydown', this.keydownFn);
      window.addEventListener('keyup', this.keyupFn);
    });
  }

  protected override onDispose(): void {
    if (this.keydownFn) window.removeEventListener('keydown', this.keydownFn);
    if (this.keyupFn) window.removeEventListener('keyup', this.keyupFn);
  }

  /* ================= construction ================= */

  private buildHero(): void {
    this.heroGroup = new THREE.Group();
    const tunic = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.5, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x45d07b, roughness: 0.7 }),
    );
    tunic.position.y = 0.35;
    tunic.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.3, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 }),
    );
    head.position.y = 0.76;
    head.castShadow = true;
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.34, 4),
      new THREE.MeshStandardMaterial({ color: 0x2f9e58, roughness: 0.7 }),
    );
    cap.position.y = 1.02;
    cap.rotation.y = Math.PI / 4;
    this.sword = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.06, 0.85),
      new THREE.MeshStandardMaterial({
        color: 0xdfe6f5,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x3a4a6a,
      }),
    );
    this.sword.position.set(0.22, 0.4, 0.65);
    this.sword.visible = false;
    this.heroGroup.add(tunic, head, cap, this.sword);
    this.scene.add(this.heroGroup);
  }

  private loadScreen(sx: number, sy: number): void {
    this.sx = sx;
    this.sy = sy;
    const screen = SCREENS[`${sx},${sy}`];
    this.publish(this.area, screen.name);

    if (this.screenGroup) this.scene.remove(this.screenGroup);
    this.screenGroup = new THREE.Group();
    this.scene.add(this.screenGroup);
    this.enemies = [];
    this.drops = [];
    this.waterMats = [];
    this.trishardPos = undefined;

    // animated water material is per-screen so disposal stays simple
    const water = new THREE.MeshStandardMaterial({
      color: 0x1d3f6e,
      roughness: 0.3,
      emissive: 0x10294a,
    });
    this.waterMats.push(water);

    this.solids = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = screen.rows[r][c];
        const x = c + 0.5;
        const z = r + 0.5;
        this.solids[r][c] = SOLID.has(ch);

        // ground under everything
        const groundMat =
          ch === ',' ? this.mats.sand : ch === '~' ? water : ch === '=' ? this.mats.bridge : this.mats.grass;
        const ground = new THREE.Mesh(this.geoFlat, groundMat);
        ground.position.set(x, ch === '~' ? -0.06 : -0.05, z);
        ground.receiveShadow = true;
        this.screenGroup.add(ground);

        if (ch === '#') {
          const trunk = new THREE.Mesh(this.geoBlock, this.mats.trunk);
          trunk.scale.set(0.32, 0.6, 0.32);
          trunk.position.set(x, 0.25, z);
          const canopy = new THREE.Mesh(this.geoCanopy, this.mats.canopy);
          canopy.position.set(x, 0.95, z);
          canopy.castShadow = true;
          this.screenGroup.add(trunk, canopy);
        } else if (ch === 'R') {
          const rock = new THREE.Mesh(this.geoBlock, this.mats.rock);
          rock.scale.set(0.92, 0.62, 0.92);
          rock.position.set(x, 0.27, z);
          rock.castShadow = true;
          this.screenGroup.add(rock);
        } else if (ch === 'E') {
          this.spawnEnemy(x, z, sx + sy === 2);
        } else if (ch === 'H' || ch === '$') {
          const id = `${sx},${sy},${c},${r}`;
          if (!this.collected.has(id)) {
            this.addDrop(x, z, ch === 'H' ? 'heart' : 'rupee', id);
          }
        } else if (ch === 'T') {
          this.trishardPos = { x, z };
          this.addDrop(x, z, 'trishard', `${sx},${sy},${c},${r}`);
        }
      }
    }
  }

  private spawnEnemy(x: number, z: number, guard: boolean): void {
    const mesh = new THREE.Mesh(
      this.geoEnemy,
      new THREE.MeshStandardMaterial({
        color: guard ? 0x8a5cff : 0xff5566,
        roughness: 0.5,
      }),
    );
    mesh.scale.y = 0.78;
    mesh.castShadow = true;
    mesh.position.set(x, 0.27, z);
    this.screenGroup!.add(mesh);
    this.enemies.push({
      x, z,
      hp: guard ? 2 : 1,
      speed: guard ? 2.1 : 1.6,
      dirX: 0, dirZ: 0,
      dirTimer: Math.random(),
      flash: 0,
      mesh,
    });
  }

  private addDrop(x: number, z: number, kind: Drop['kind'], id: string): void {
    let mesh: THREE.Object3D;
    if (kind === 'heart') {
      mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2),
        new THREE.MeshStandardMaterial({ color: 0xff4455, emissive: 0x701018, roughness: 0.4 }),
      );
    } else if (kind === 'rupee') {
      mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.17),
        new THREE.MeshStandardMaterial({ color: 0x3fe0c0, emissive: 0x0c5a4a, roughness: 0.3 }),
      );
      mesh.scale.y = 1.7;
    } else {
      // the trishard: three golden tetrahedra in formation
      const tri = new THREE.Group();
      const gold = new THREE.MeshStandardMaterial({
        color: 0xffd75e,
        emissive: 0x8a6a10,
        metalness: 0.8,
        roughness: 0.25,
      });
      const positions = [
        [0, 0.5, 0],
        [-0.22, 0.12, 0],
        [0.22, 0.12, 0],
      ];
      for (const [px, py, pz] of positions) {
        const t = new THREE.Mesh(new THREE.TetrahedronGeometry(0.19), gold);
        t.position.set(px, py, pz);
        tri.add(t);
      }
      mesh = tri;
    }
    mesh.position.set(x, 0.45, z);
    this.screenGroup!.add(mesh);
    this.drops.push({ id, x, z, kind, mesh });
  }

  /* ================= input ================= */

  private onKey(e: KeyboardEvent, down: boolean): void {
    const handled = [
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'KeyJ', 'KeyR',
    ];
    if (!handled.includes(e.code)) return;
    e.preventDefault();
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
    if (!down) return;

    if (e.code === 'Space' || e.code === 'KeyJ') {
      const phase = this.phase();
      if (phase === 'title' || phase === 'dead' || phase === 'win') this.startGame();
      else if (this.cooldownT <= 0) {
        this.attackT = ATTACK_TIME;
        this.cooldownT = ATTACK_COOLDOWN;
      }
    }
    if (e.code === 'KeyR') {
      this.collected.clear();
      this.startGame();
    }
  }

  private startGame(): void {
    this.publish(this.hp, MAX_HP);
    this.publish(this.rupees, 0);
    this.hero = { x: 2.5, z: 2.5, dirX: 0, dirZ: 1 };
    this.invulnT = 0;
    this.attackT = 0;
    this.loadScreen(0, 0);
    this.publish(this.phase, 'play');
    this.publish(this.message, '');
  }

  /* ================= simulation ================= */

  protected override onFrame(dt: number, t: number): void {
    // ambient motion runs even on menus
    for (const mat of this.waterMats) {
      mat.emissiveIntensity = 0.7 + Math.sin(t * 1.8) * 0.3;
    }
    for (const d of this.drops) {
      d.mesh.rotation.y += dt * (d.kind === 'trishard' ? 1.2 : 2.2);
      d.mesh.position.y = 0.45 + Math.sin(t * 2.5 + d.x) * 0.06;
    }

    if (this.phase() === 'play') {
      this.stepHero(dt);
      this.stepEnemies(dt);
      this.checkPickups();
    }

    // state snapshot for automated playtesting (read-only, no game effect)
    (globalThis as Record<string, unknown>)['__legend'] = {
      x: this.hero.x,
      z: this.hero.z,
      sx: this.sx,
      sy: this.sy,
      phase: this.phase(),
    };

    this.heroGroup.position.set(this.hero.x, 0, this.hero.z);
    this.heroGroup.rotation.y = Math.atan2(this.hero.dirX, this.hero.dirZ);
    this.heroGroup.visible = this.invulnT <= 0 || Math.floor(this.invulnT * 12) % 2 === 0;
    this.sword.visible = this.attackT > 0;
    this.lantern.position.set(this.hero.x, 1.6, this.hero.z + 0.4);
  }

  private stepHero(dt: number): void {
    this.attackT = Math.max(0, this.attackT - dt);
    this.cooldownT = Math.max(0, this.cooldownT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);

    let mx = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
           - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    let mz = (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
           - (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0);
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      this.hero.dirX = mx;
      this.hero.dirZ = mz;
    }
    this.moveWithCollision(this.hero, mx * HERO_SPEED * dt, mz * HERO_SPEED * dt, HERO_HALF);

    // sword hits
    if (this.attackT > 0) {
      const hx = this.hero.x + this.hero.dirX * 0.75;
      const hz = this.hero.z + this.hero.dirZ * 0.75;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - hx, e.z - hz) < 0.75) {
          e.hp--;
          e.flash = 0.18;
          this.pushWithCollision(e, this.hero.dirX * 0.85, this.hero.dirZ * 0.85, 0.3);
          if (e.hp <= 0) this.killEnemy(e);
        }
      }
    }

    // screen transitions through carved gaps
    if (this.hero.x > COLS - 0.2 && this.sx === 0) {
      this.loadScreen(1, this.sy);
      this.hero.x = 0.4;
    } else if (this.hero.x < 0.2 && this.sx === 1) {
      this.loadScreen(0, this.sy);
      this.hero.x = COLS - 0.4;
    } else if (this.hero.z > ROWS - 0.2 && this.sy === 0) {
      this.loadScreen(this.sx, 1);
      this.hero.z = 0.4;
    } else if (this.hero.z < 0.2 && this.sy === 1) {
      this.loadScreen(this.sx, 0);
      this.hero.z = ROWS - 0.4;
    }
  }

  private stepEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.flash = Math.max(0, e.flash - dt);
      const mat = e.mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setScalar(e.flash > 0 ? 0.9 : 0);

      e.dirTimer -= dt;
      if (e.dirTimer <= 0) {
        e.dirTimer = 0.7 + Math.random() * 1.1;
        const dx = this.hero.x - e.x;
        const dz = this.hero.z - e.z;
        if (Math.hypot(dx, dz) < 5.5 && Math.random() < 0.65) {
          // chase, axis-locked like the old octoroks
          if (Math.abs(dx) > Math.abs(dz)) {
            e.dirX = Math.sign(dx);
            e.dirZ = 0;
          } else {
            e.dirX = 0;
            e.dirZ = Math.sign(dz);
          }
        } else {
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];
          [e.dirX, e.dirZ] = dirs[Math.floor(Math.random() * dirs.length)];
        }
      }
      this.moveWithCollision(e, e.dirX * e.speed * dt, e.dirZ * e.speed * dt, 0.3);
      e.mesh.position.set(e.x, 0.27 + Math.abs(Math.sin(performance.now() / 180)) * 0.06, e.z);

      // contact damage
      if (this.invulnT <= 0 && Math.hypot(e.x - this.hero.x, e.z - this.hero.z) < 0.62) {
        this.publish(this.hp, this.hp() - 1);
        this.invulnT = INVULN_TIME;
        const kx = Math.sign(this.hero.x - e.x) || 1;
        const kz = Math.sign(this.hero.z - e.z) || 0;
        this.pushWithCollision(this.hero, kx * 1.1, kz * 1.1, HERO_HALF);
        if (this.hp() <= 0) {
          this.publish(this.phase, 'dead');
          this.publish(this.message, 'you fell… press space');
          return;
        }
      }
    }
  }

  private killEnemy(e: Enemy): void {
    this.screenGroup!.remove(e.mesh);
    // octoroks pay out, occasionally
    const roll = Math.random();
    if (roll < 0.25) this.addDrop(e.x, e.z, 'heart', `drop-${Math.random()}`);
    else if (roll < 0.6) this.addDrop(e.x, e.z, 'rupee', `drop-${Math.random()}`);
  }

  private checkPickups(): void {
    for (const d of [...this.drops]) {
      if (Math.hypot(d.x - this.hero.x, d.z - this.hero.z) > 0.55) continue;
      if (d.kind === 'trishard') {
        this.publish(this.phase, 'win');
        this.publish(this.message, '✦ you found the trishard ✦');
        continue;
      }
      this.screenGroup!.remove(d.mesh);
      this.drops = this.drops.filter((x) => x !== d);
      if (!d.id.startsWith('drop-')) this.collected.add(d.id);
      if (d.kind === 'heart') this.publish(this.hp, Math.min(MAX_HP, this.hp() + 1));
      else this.publish(this.rupees, this.rupees() + 1);
    }
  }

  /* ---- tile collision: move one axis at a time, AABB corners vs solids ---- */

  private moveWithCollision(o: { x: number; z: number }, dx: number, dz: number, half: number): void {
    if (dx !== 0 && this.fits(o.x + dx, o.z, half)) o.x += dx;
    if (dz !== 0 && this.fits(o.x, o.z + dz, half)) o.z += dz;
  }

  private pushWithCollision(o: { x: number; z: number }, dx: number, dz: number, half: number): void {
    // knockback in small steps so it stops cleanly at walls
    for (let i = 0; i < 4; i++) this.moveWithCollision(o, dx / 4, dz / 4, half);
  }

  private fits(x: number, z: number, half: number): boolean {
    // shrink the AABB a hair so a corner flush against a wall (x+half
    // exactly on a tile boundary) doesn't read as inside it — without
    // this, sliding along a wall you're touching is impossible
    half -= 0.02;
    for (const [ox, oz] of [[-half, -half], [half, -half], [-half, half], [half, half]]) {
      const c = Math.floor(x + ox);
      const r = Math.floor(z + oz);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue; // off-screen = transition zone
      if (this.solids[r][c]) return false;
    }
    return true;
  }

  private publish<T>(sig: WritableSignal<T>, value: T): void {
    if (sig() !== value) this.zone.run(() => sig.set(value));
  }
}
