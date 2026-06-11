import { Component, signal, WritableSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { ThreeDemo } from '../core/three/three-demo';

type Phase = 'idle' | 'serve' | 'rally' | 'over';
type Side = 'L' | 'R';

/* ---- court & physics constants (world units; x = width, y = up) ---- */
const COURT_HALF = 8.5;
const NET_TOP = 3.1;
const NET_HALF = 0.06;
const BLOB_R = 0.95;
const BALL_R = 0.45;
const BALL_G = 11;
const BLOB_G = 30;
const BLOB_SPEED = 7;
const JUMP_V = 11;
const BALL_SPEED_MIN = 8;
const BALL_SPEED_MAX = 14.5;
const WIN_SCORE = 15;
const MAX_TOUCHES = 3;
const SERVE_DELAY = 1.1;

interface Blob {
  side: Side;
  x: number;
  y: number; // y of the blob's BOTTOM (0 = on the sand)
  vy: number;
  grounded: boolean;
  squash: number;
  mesh: THREE.Group;
  body: THREE.Mesh;
}

/**
 * Blobby Volley (2000), remade on the same ThreeDemo base class as the
 * lessons. Classic rules: only the serving side scores, three touches
 * per side, first to 15. The simulation is plain lesson material —
 * delta-time integration (06), circle collision like raycasting math
 * (07), groups and transforms (03), zone-free input listeners (07).
 */
@Component({
  selector: 'app-blobby-volley',
  imports: [RouterLink],
  templateUrl: './blobby-volley.html',
  styleUrl: './blobby-volley.scss',
})
export class BlobbyVolley extends ThreeDemo {
  /* ---- HUD state (Angular signals, published from the loop via zone.run) ---- */
  protected readonly phase = signal<Phase>('idle');
  protected readonly scoreL = signal(0);
  protected readonly scoreR = signal(0);
  protected readonly server = signal<Side>('L');
  protected readonly message = signal('');
  protected readonly cpu = signal(true);
  protected readonly paused = signal(false);

  /* ---- simulation state (plain fields — the loop owns these) ---- */
  private blobL!: Blob;
  private blobR!: Blob;
  private ballMesh!: THREE.Mesh;
  private ball = { x: -4.5, y: 5.5, vx: 0, vy: 0 };
  private touches: Record<Side, number> = { L: 0, R: 0 };
  private lastBallSide: Side = 'L';
  private touchingBlob: Blob | null = null;
  private serveTimer = 0;
  private readonly keys = new Set<string>();
  private keydownFn?: (e: KeyboardEvent) => void;
  private keyupFn?: (e: KeyboardEvent) => void;

  /* ================= scene ================= */

  protected onInit(): void {
    this.camera.position.set(0, 5.4, 13);
    this.camera.lookAt(0, 2.6, 0);

    this.scene.background = new THREE.Color(0x0b0e16);
    this.scene.fog = new THREE.Fog(0x0b0e16, 24, 46);

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // midnight beach lighting: cool moon + warm court floodlight
    this.scene.add(new THREE.HemisphereLight(0x36406b, 0x1a1410, 0.9));
    const moon = new THREE.DirectionalLight(0xbfd2ff, 1.6);
    moon.position.set(-6, 12, 7);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = moon.shadow.camera.bottom = -12;
    moon.shadow.camera.right = moon.shadow.camera.top = 12;
    this.scene.add(moon);
    const flood = new THREE.PointLight(0xffd9a0, 30, 0, 1.9);
    flood.position.set(0, 8, 4);
    this.scene.add(flood);

    // sand
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 30),
      new THREE.MeshStandardMaterial({ color: 0x8a744c, roughness: 1 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.receiveShadow = true;
    this.scene.add(sand);

    // court boundary lines
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd7ff3e, transparent: true, opacity: 0.35 });
    for (const x of [-COURT_HALF, COURT_HALF]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 4), lineMat);
      line.position.set(x, 0.011, 0);
      this.scene.add(line);
    }

    // net: posts, mesh, top band
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4d, roughness: 0.5 });
    for (const z of [-2, 2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, NET_TOP + 0.25), postMat);
      post.position.set(0, (NET_TOP + 0.25) / 2, z);
      post.castShadow = true;
      this.scene.add(post);
    }
    const netPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4, NET_TOP - 0.9, 16, 8),
      new THREE.MeshStandardMaterial({
        color: 0xe9ebf1,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
      }),
    );
    netPlane.rotation.y = Math.PI / 2;
    netPlane.position.set(0, 0.9 + (NET_TOP - 0.9) / 2, 0);
    this.scene.add(netPlane);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.18, 4),
      new THREE.MeshStandardMaterial({ color: 0xe9ebf1, roughness: 0.6 }),
    );
    band.position.set(0, NET_TOP - 0.09, 0);
    band.castShadow = true;
    this.scene.add(band);

    // players & ball
    this.blobL = this.makeBlob('L', 0xff5566, -4.5);
    this.blobR = this.makeBlob('R', 0x4d9fff, 4.5);

    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 32, 16),
      new THREE.MeshStandardMaterial({ color: 0xd7ff3e, roughness: 0.4 }),
    );
    this.ballMesh.castShadow = true;
    this.scene.add(this.ballMesh);

    // input — outside the zone; game state is not Angular state (lesson 07)
    this.zone.runOutsideAngular(() => {
      this.keydownFn = (e) => this.onKey(e, true);
      this.keyupFn = (e) => this.onKey(e, false);
      window.addEventListener('keydown', this.keydownFn);
      window.addEventListener('keyup', this.keyupFn);
    });

    this.publish(this.message, 'press space to serve');
    this.syncMeshes();
  }

  private makeBlob(side: Side, color: number, x: number): Blob {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(BLOB_R, 32, 24),
      new THREE.MeshStandardMaterial({ color, roughness: 0.35 }),
    );
    body.scale.y = 1.18;
    body.castShadow = true;
    group.add(body);

    // googly eyes, looking across the net
    const dir = side === 'L' ? 1 : -1;
    for (const dz of [-0.27, 0.27]) {
      const white = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }),
      );
      white.position.set(dir * 0.78, 0.5, dz * 1.15);
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.3 }),
      );
      pupil.position.set(dir * 0.13, 0.02, 0);
      white.add(pupil);
      group.add(white);
    }

    this.scene.add(group);
    return { side, x, y: 0, vy: 0, grounded: true, squash: 0, mesh: group, body };
  }

  /* ================= game flow ================= */

  private startMatch(): void {
    this.publish(this.scoreL, 0);
    this.publish(this.scoreR, 0);
    this.publish(this.server, 'L');
    this.startServe();
  }

  private startServe(): void {
    const sx = this.server() === 'L' ? -4.5 : 4.5;
    this.ball = { x: sx, y: 5.5, vx: 0, vy: 0 };
    this.touches = { L: 0, R: 0 };
    this.lastBallSide = this.server();
    this.touchingBlob = null;
    this.serveTimer = SERVE_DELAY;
    this.publish(this.phase, 'serve');
    this.publish(
      this.message,
      (this.server() === 'L' ? 'red' : 'blue') + ' serves',
    );
  }

  private endRally(winner: Side): void {
    if (winner === this.server()) {
      // classic rules: only the serving side can score
      const sig = winner === 'L' ? this.scoreL : this.scoreR;
      this.publish(sig, sig() + 1);
      if (sig() >= WIN_SCORE) {
        this.publish(this.phase, 'over');
        this.publish(
          this.message,
          (winner === 'L' ? 'red' : 'blue') + ' wins ' + this.scoreL() + '–' + this.scoreR(),
        );
        return;
      }
    } else {
      this.publish(this.server, winner); // side out — service changes hands
    }
    this.startServe();
  }

  /* ================= input ================= */

  private onKey(e: KeyboardEvent, down: boolean): void {
    const handled = [
      'KeyA', 'KeyD', 'KeyW', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyP', 'KeyR',
    ];
    if (!handled.includes(e.code)) return;
    e.preventDefault();
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
    if (!down) return;

    if (e.code === 'Space') {
      if (this.phase() === 'idle' || this.phase() === 'over') this.startMatch();
      else if (this.phase() === 'serve') this.serveTimer = 0; // serve now
    }
    if (e.code === 'KeyP' && this.phase() !== 'idle') {
      this.publish(this.paused, !this.paused());
    }
    if (e.code === 'KeyR') this.startMatch();
  }

  protected toggleCpu(): void {
    this.cpu.set(!this.cpu());
  }

  protected togglePause(): void {
    this.paused.set(!this.paused());
  }

  /* ================= simulation ================= */

  protected override onFrame(dt: number): void {
    if (this.paused()) return;

    this.stepBlob(this.blobL, dt, this.keys.has('KeyA'), this.keys.has('KeyD'), this.keys.has('KeyW'));
    if (this.cpu()) this.stepCpu(dt);
    else
      this.stepBlob(
        this.blobR, dt,
        this.keys.has('ArrowLeft'), this.keys.has('ArrowRight'), this.keys.has('ArrowUp'),
      );

    const phase = this.phase();
    if (phase === 'serve') {
      this.serveTimer -= dt;
      if (this.serveTimer <= 0) this.publish(this.phase, 'rally');
    } else if (phase === 'rally') {
      // sub-step the ball so fast frames can't tunnel through colliders
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        this.stepBall(dt / steps);
        if (this.phase() !== 'rally') break; // rally may end mid-step
      }
    }

    this.syncMeshes();
  }

  private stepBlob(blob: Blob, dt: number, left: boolean, right: boolean, jump: boolean): void {
    const move = (right ? 1 : 0) - (left ? 1 : 0);
    blob.x += move * BLOB_SPEED * dt;
    const min = blob.side === 'L' ? -COURT_HALF + BLOB_R : NET_HALF + BLOB_R * 0.8;
    const max = blob.side === 'L' ? -NET_HALF - BLOB_R * 0.8 : COURT_HALF - BLOB_R;
    blob.x = Math.min(max, Math.max(min, blob.x));

    if (jump && blob.grounded) {
      blob.vy = JUMP_V;
      blob.grounded = false;
    }
    blob.vy -= BLOB_G * dt;
    blob.y += blob.vy * dt;
    if (blob.y <= 0) {
      if (!blob.grounded) blob.squash = 1;
      blob.y = 0;
      blob.vy = 0;
      blob.grounded = true;
    }
    blob.squash = Math.max(0, blob.squash - dt * 5);
  }

  private stepCpu(dt: number): void {
    const blob = this.blobR;
    const ball = this.ball;
    const incoming = ball.x > -1 && (ball.vx > -2 || ball.x > 0);
    // standing slightly BEHIND the ball angles every bounce toward the net —
    // dead-centre contact would just pogo the ball straight up into a fault
    let target = 4.5;
    if (this.phase() === 'serve' && this.server() === 'R') target = 4.5 + 0.45;
    else if (this.phase() === 'rally' && incoming) target = ball.x + 0.45;
    const diff = target - blob.x;
    const left = diff < -0.15;
    const right = diff > 0.15;
    const jump =
      this.phase() === 'rally' &&
      ball.x > 0.5 &&
      Math.abs(ball.x - blob.x) < 1.7 &&
      ball.y < 4.6 &&
      ball.y > 2 &&
      ball.vy < 1;
    this.stepBlob(blob, dt, left, right, jump);
  }

  private stepBall(dt: number): void {
    const b = this.ball;
    b.vy -= BALL_G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // side walls
    if (b.x < -COURT_HALF + BALL_R) {
      b.x = -COURT_HALF + BALL_R;
      b.vx = Math.abs(b.vx);
    } else if (b.x > COURT_HALF - BALL_R) {
      b.x = COURT_HALF - BALL_R;
      b.vx = -Math.abs(b.vx);
    }

    // net: side faces…
    if (Math.abs(b.x) < NET_HALF + BALL_R && b.y < NET_TOP) {
      const fromLeft = b.vx > 0;
      b.x = fromLeft ? -(NET_HALF + BALL_R) : NET_HALF + BALL_R;
      b.vx = -b.vx * 0.7;
    }
    // …and the round top band
    const dxTop = b.x;
    const dyTop = b.y - NET_TOP;
    const dTop = Math.hypot(dxTop, dyTop);
    if (dTop < BALL_R + 0.12 && dTop > 0.0001) {
      const nx = dxTop / dTop;
      const ny = dyTop / dTop;
      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) {
        b.vx -= 2 * dot * nx;
        b.vy -= 2 * dot * ny;
        b.x = nx * (BALL_R + 0.12);
        b.y = NET_TOP + ny * (BALL_R + 0.12);
      }
    }

    // blobs
    let touched: Blob | null = null;
    for (const blob of [this.blobL, this.blobR]) {
      if (this.collideBlob(blob)) touched = blob;
    }
    if (touched && touched !== this.touchingBlob) {
      this.touches[touched.side]++;
      if (this.touches[touched.side] > MAX_TOUCHES) {
        this.endRally(touched.side === 'L' ? 'R' : 'L');
        return;
      }
    }
    this.touchingBlob = touched;

    // crossing the net resets the receiving side's touch budget
    const side: Side = b.x < 0 ? 'L' : 'R';
    if (side !== this.lastBallSide) {
      this.lastBallSide = side;
      this.touches[side] = 0;
    }

    // sand — rally over, point judged by which half the ball died in
    if (b.y < BALL_R) {
      this.endRally(b.x < 0 ? 'R' : 'L');
    }
  }

  /** Circle-vs-circle bounce against a blob. Returns true while touching. */
  private collideBlob(blob: Blob): boolean {
    const b = this.ball;
    const cx = blob.x;
    const cy = blob.y + BLOB_R; // collider centred in the body
    const dx = b.x - cx;
    const dy = b.y - cy;
    const dist = Math.hypot(dx, dy);
    const minDist = BLOB_R + BALL_R;
    if (dist >= minDist || dist < 0.0001) return false;

    const nx = dx / dist;
    const ny = dy / dist;
    // push the ball out of penetration
    b.x = cx + nx * minDist;
    b.y = cy + ny * minDist;

    const dot = b.vx * nx + b.vy * ny;
    if (dot < 0) {
      b.vx -= 2 * dot * nx;
      b.vy -= 2 * dot * ny;
    }
    // the blob's own motion adds english
    b.vy += Math.max(0, blob.vy) * 0.45;

    // keep the rally lively but bounded
    const speed = Math.hypot(b.vx, b.vy);
    const clamped = Math.min(BALL_SPEED_MAX, Math.max(BALL_SPEED_MIN, speed));
    if (speed > 0.0001) {
      b.vx = (b.vx / speed) * clamped;
      b.vy = (b.vy / speed) * clamped;
    }
    return true;
  }

  /* ================= presentation ================= */

  private syncMeshes(): void {
    for (const blob of [this.blobL, this.blobR]) {
      const squashY = 1.18 - blob.squash * 0.3;
      blob.body.scale.set(1 + blob.squash * 0.18, squashY, 1 + blob.squash * 0.18);
      blob.mesh.position.set(blob.x, blob.y + BLOB_R * 0.92, 0);
    }
    this.ballMesh.position.set(this.ball.x, this.ball.y, 0);
    this.ballMesh.rotation.z -= this.ball.vx * 0.02;
  }

  protected override onDispose(): void {
    if (this.keydownFn) window.removeEventListener('keydown', this.keydownFn);
    if (this.keyupFn) window.removeEventListener('keyup', this.keyupFn);
  }

  /** Publish loop-side state to an Angular signal without waking the zone for no-ops. */
  private publish<T>(sig: WritableSignal<T>, value: T): void {
    if (sig() !== value) this.zone.run(() => sig.set(value));
  }
}
