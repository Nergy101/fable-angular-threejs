import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';

/**
 * Base class for every live demo in the lessons.
 *
 * It encapsulates the canonical Angular ⇄ three.js bridge:
 *  - `viewChild` signal to grab the <canvas #canvas>
 *  - `afterNextRender` so WebGL setup only happens in the browser,
 *    after the DOM exists
 *  - the requestAnimationFrame loop runs via `NgZone.runOutsideAngular`
 *    so 60fps frames never trigger change detection
 *  - `DestroyRef` tears down GPU resources when the component dies
 *  - a ResizeObserver keeps the drawing buffer in sync with CSS layout
 */
@Directive()
export abstract class ThreeDemo {
  protected readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  protected renderer!: THREE.WebGLRenderer;
  protected scene = new THREE.Scene();
  protected camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  protected readonly clock = new THREE.Clock();

  private rafId = 0;
  private resizeObserver?: ResizeObserver;
  private running = false;

  constructor() {
    afterNextRender(() => this.bootstrap());

    this.destroyRef.onDestroy(() => {
      this.running = false;
      cancelAnimationFrame(this.rafId);
      this.resizeObserver?.disconnect();
      this.onDispose();
      this.disposeSceneGraph(this.scene);
      this.renderer?.dispose();
    });
  }

  /** Build the scene here. Runs once, after the canvas exists. */
  protected abstract onInit(): void;

  /** Per-frame hook. `dt` is seconds since last frame, `t` total seconds. */
  protected onFrame(dt: number, t: number): void {}

  /** Extra cleanup for subclasses (controls, listeners, loaders…). */
  protected onDispose(): void {}

  /** Called whenever the canvas is resized; default updates camera aspect. */
  protected onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  protected get canvas(): HTMLCanvasElement {
    return this.canvasRef().nativeElement;
  }

  private bootstrap(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.onInit();

    const host = this.canvas.parentElement ?? this.canvas;
    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(host);
    this.syncSize();

    // The render loop lives outside Angular's zone: a tick per frame is
    // GPU work, not application state — change detection has no business here.
    this.running = true;
    this.zone.runOutsideAngular(() => {
      const loop = () => {
        if (!this.running) return;
        const dt = Math.min(this.clock.getDelta(), 0.1);
        this.onFrame(dt, this.clock.elapsedTime);
        this.renderer.render(this.scene, this.camera);
        this.rafId = requestAnimationFrame(loop);
      };
      loop();
    });
  }

  private syncSize(): void {
    const host = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.onResize(w, h);
  }

  /** Walk the graph and free geometries, materials and textures. */
  private disposeSceneGraph(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const value of Object.values(mat)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        mat.dispose();
      }
    });
  }
}
