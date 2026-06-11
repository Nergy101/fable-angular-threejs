import { Component, signal, WritableSignal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { ThreeDemo } from '../core/three/three-demo';
import {
  pixelTexture,
  HERO_DOWN, HERO_UP, HERO_SIDE, SWORD,
  OCTOROK, GUARD,
  TREE, ROCK, GRASS, SAND, WATER_A, WATER_B, BRIDGE,
  HEART, RUPEE, TRIFORCE,
} from './pixel-sprites';

type Phase = 'title' | 'play' | 'dead' | 'win';

/* ---- world ---- */
const COLS = 16;
const ROWS = 11;

/* the whole game renders into a 256×176 buffer — 16px tiles, like 1991 */
const FRAME_W = COLS * 16;
const FRAME_H = ROWS * 16;

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

/* draw order, top-down: everything is a flat quad at a different height */
const LAYER = { ground: 0, deco: 0.02, drop: 0.04, enemy: 0.06, hero: 0.08, sword: 0.1 };

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
  mesh: THREE.Mesh;
}

/**
 * Tiny Legend — a fan-made miniature in the spirit of the 1986 top-down
 * classic, drawn the 1990 way: 16×16 code-painted sprites on a 256×176
 * framebuffer, nearest-neighbor upscaled. Mechanically it's lesson
 * material end to end: tile collision, screen transitions, timers,
 * knockback, drops.
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
  private moving = false;
  private walkClock = 0;
  private attackT = 0;
  private cooldownT = 0;
  private invulnT = 0;
  private waterClock = 0;
  private solids: boolean[][] = [];
  private enemies: Enemy[] = [];
  private drops: Drop[] = [];
  private collected = new Set<string>();
  private screenGroup?: THREE.Group;
  private heroSprite!: THREE.Mesh;
  private swordMesh!: THREE.Mesh;
  private waterMat?: THREE.MeshBasicMaterial;
  private readonly keys = new Set<string>();
  private keydownFn?: (e: KeyboardEvent) => void;
  private keyupFn?: (e: KeyboardEvent) => void;

  /* ---- pixel textures, painted once ---- */
  private readonly tex = {
    heroDown: pixelTexture(HERO_DOWN),
    heroUp: pixelTexture(HERO_UP),
    heroSide: pixelTexture(HERO_SIDE),
    sword: pixelTexture(SWORD),
    octorok: pixelTexture(OCTOROK),
    guard: pixelTexture(GUARD),
    tree: pixelTexture(TREE),
    rock: pixelTexture(ROCK),
    grass: pixelTexture(GRASS),
    sand: pixelTexture(SAND),
    waterA: pixelTexture(WATER_A),
    waterB: pixelTexture(WATER_B),
    bridge: pixelTexture(BRIDGE),
    heart: pixelTexture(HEART),
    rupee: pixelTexture(RUPEE),
    triforce: pixelTexture(TRIFORCE),
  };

  private readonly quad = new THREE.PlaneGeometry(1, 1);

  protected onInit(): void {
    // a fixed-size orthographic window onto the tile grid: pure 2D
    const cam = new THREE.OrthographicCamera(
      -COLS / 2, COLS / 2, ROWS / 2, -ROWS / 2, 0.1, 50,
    );
    cam.position.set(COLS / 2, 10, ROWS / 2);
    cam.up.set(0, 0, -1);
    cam.lookAt(COLS / 2, 0, ROWS / 2);
    this.camera = cam as unknown as THREE.PerspectiveCamera;

    this.renderer.setPixelRatio(1);
    this.scene.background = new THREE.Color('#0f0f0f');

    this.buildHero();
    this.loadScreen(0, 0);

    this.zone.runOutsideAngular(() => {
      this.keydownFn = (e) => this.onKey(e, true);
      this.keyupFn = (e) => this.onKey(e, false);
      window.addEventListener('keydown', this.keydownFn);
      window.addEventListener('keyup', this.keyupFn);
    });
  }

  /** Ignore the host size: the drawing buffer is always 256×176 and CSS
   *  upscales it with image-rendering: pixelated. That IS the look. */
  protected override onResize(): void {
    this.renderer.setSize(FRAME_W, FRAME_H, false);
  }

  protected override onDispose(): void {
    if (this.keydownFn) window.removeEventListener('keydown', this.keydownFn);
    if (this.keyupFn) window.removeEventListener('keyup', this.keyupFn);
  }

  /* ================= construction ================= */

  private spriteMat(tex: THREE.Texture): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 });
  }

  private sprite(tex: THREE.Texture, size: number, layer: number): THREE.Mesh {
    const mesh = new THREE.Mesh(this.quad, this.spriteMat(tex));
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(size);
    mesh.position.y = layer;
    return mesh;
  }

  private buildHero(): void {
    this.heroSprite = this.sprite(this.tex.heroDown, 0.95, LAYER.hero);
    this.swordMesh = this.sprite(this.tex.sword, 1, LAYER.sword);
    this.swordMesh.visible = false;
    this.scene.add(this.heroSprite, this.swordMesh);
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

    this.waterMat = new THREE.MeshBasicMaterial({ map: this.tex.waterA });
    const grassMat = new THREE.MeshBasicMaterial({ map: this.tex.grass });
    const sandMat = new THREE.MeshBasicMaterial({ map: this.tex.sand });
    const bridgeMat = new THREE.MeshBasicMaterial({ map: this.tex.bridge });

    this.solids = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = screen.rows[r][c];
        const x = c + 0.5;
        const z = r + 0.5;
        this.solids[r][c] = SOLID.has(ch);

        const groundMat =
          ch === ',' ? sandMat : ch === '~' ? this.waterMat : ch === '=' ? bridgeMat : grassMat;
        const ground = new THREE.Mesh(this.quad, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(x, LAYER.ground, z);
        if ((c + r) % 2 === 1) ground.scale.x = -1; // mirror alternate tiles for variety
        this.screenGroup.add(ground);

        if (ch === '#') {
          const tree = this.sprite(this.tex.tree, 1.06, LAYER.deco);
          tree.position.set(x, LAYER.deco, z);
          this.screenGroup.add(tree);
        } else if (ch === 'R') {
          const rock = this.sprite(this.tex.rock, 1, LAYER.deco);
          rock.position.set(x, LAYER.deco, z);
          this.screenGroup.add(rock);
        } else if (ch === 'E') {
          this.spawnEnemy(x, z, sx + sy === 2);
        } else if (ch === 'H' || ch === '$') {
          const id = `${sx},${sy},${c},${r}`;
          if (!this.collected.has(id)) {
            this.addDrop(x, z, ch === 'H' ? 'heart' : 'rupee', id);
          }
        } else if (ch === 'T') {
          this.addDrop(x, z, 'trishard', `${sx},${sy},${c},${r}`);
        }
      }
    }
  }

  private spawnEnemy(x: number, z: number, guard: boolean): void {
    const mesh = this.sprite(guard ? this.tex.guard : this.tex.octorok, 0.9, LAYER.enemy);
    mesh.position.set(x, LAYER.enemy, z);
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
    const tex =
      kind === 'heart' ? this.tex.heart : kind === 'rupee' ? this.tex.rupee : this.tex.triforce;
    const mesh = this.sprite(tex, kind === 'trishard' ? 1.05 : 0.7, LAYER.drop);
    mesh.position.set(x, LAYER.drop, z);
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
    // ambient animation runs even on menus
    this.waterClock += dt;
    if (this.waterMat) {
      this.waterMat.map =
        Math.floor(this.waterClock / 0.45) % 2 === 0 ? this.tex.waterA : this.tex.waterB;
    }
    for (const d of this.drops) {
      const base = d.kind === 'trishard' ? 1.05 : 0.7;
      d.mesh.scale.setScalar(base * (1 + Math.sin(t * 4 + d.x) * 0.07));
    }

    if (this.phase() === 'play') {
      this.stepHero(dt);
      this.stepEnemies(dt, t);
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

    this.presentHero(dt);
  }

  private presentHero(dt: number): void {
    this.walkClock = this.moving ? this.walkClock + dt : 0;
    const frame = Math.floor(this.walkClock / 0.13) % 2;

    const mat = this.heroSprite.material as THREE.MeshBasicMaterial;
    let flip = 1;
    if (this.hero.dirX !== 0 && Math.abs(this.hero.dirX) >= Math.abs(this.hero.dirZ)) {
      mat.map = this.tex.heroSide;
      flip = this.hero.dirX > 0 ? 1 : -1;
      this.heroSprite.scale.y = 0.95 * (frame ? 0.93 : 1); // little step-bob
      this.heroSprite.scale.x = 0.95 * flip;
    } else {
      mat.map = this.hero.dirZ < 0 ? this.tex.heroUp : this.tex.heroDown;
      // the 1986 trick: walk animation is just mirroring the sprite
      this.heroSprite.scale.x = 0.95 * (frame ? -1 : 1);
      this.heroSprite.scale.y = 0.95;
    }

    this.heroSprite.position.set(this.hero.x, LAYER.hero, this.hero.z);
    this.heroSprite.visible = this.invulnT <= 0 || Math.floor(this.invulnT * 12) % 2 === 0;

    this.swordMesh.visible = this.attackT > 0;
    if (this.swordMesh.visible) {
      this.swordMesh.position.set(
        this.hero.x + this.hero.dirX * 0.75,
        LAYER.sword,
        this.hero.z + this.hero.dirZ * 0.75,
      );
      this.swordMesh.rotation.set(-Math.PI / 2, 0, Math.atan2(-this.hero.dirX, -this.hero.dirZ));
    }
  }

  private stepHero(dt: number): void {
    this.attackT = Math.max(0, this.attackT - dt);
    this.cooldownT = Math.max(0, this.cooldownT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);

    let mx = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
           - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    let mz = (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
           - (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0);
    this.moving = mx !== 0 || mz !== 0;
    if (this.moving) {
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

  private stepEnemies(dt: number, t: number): void {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.flash = Math.max(0, e.flash - dt);

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

      // sprite presentation: waddle by mirroring, blink while hit
      e.mesh.position.set(e.x, LAYER.enemy, e.z);
      e.mesh.scale.x = 0.9 * (Math.floor(t / 0.24 + e.dirTimer) % 2 === 0 ? 1 : -1);
      e.mesh.visible = e.flash <= 0 || Math.floor(e.flash * 30) % 2 === 0;

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
