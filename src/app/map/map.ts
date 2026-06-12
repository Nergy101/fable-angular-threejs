import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  COLS,
  PALETTE,
  PALETTE_GROUPS,
  ROWS,
  TILE,
  TileId,
  drawTile,
  emptyGrid,
  generateMap,
} from './map-engine';

@Component({
  selector: 'app-map',
  imports: [FormsModule],
  templateUrl: './map.html',
  styleUrl: './map.scss',
})
export class MapStudio {
  private readonly mapCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('mapCanvas');
  private readonly zone      = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  /* ---- template-visible state ---- */
  readonly palette    = PALETTE;
  readonly groups     = PALETTE_GROUPS;
  readonly selected   = signal<TileId>('grass');
  readonly seedInput  = signal(1337);
  readonly showGrid   = signal(false);
  /** pre-rendered thumbnail data-URLs for the palette */
  readonly thumbs     = signal<Partial<Record<TileId, string>>>({});

  paletteByGroup(group: string): typeof PALETTE {
    return this.palette.filter((p) => p.group === group);
  }

  /* ---- private canvas state ---- */
  private ctx!: CanvasRenderingContext2D;
  private map: TileId[][] = emptyGrid();
  private drawing = false;
  private t       = 0;
  private lastMs  = 0;
  private rafId   = 0;
  private running = false;

  constructor() {
    afterNextRender(() => this.init());
    this.destroyRef.onDestroy(() => {
      this.running = false;
      cancelAnimationFrame(this.rafId);
    });
  }

  /* ================================================================
     INITIALISATION
     ================================================================ */

  private init(): void {
    const canvas = this.mapCanvas().nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = COLS * TILE * dpr;
    canvas.height = ROWS * TILE * dpr;
    canvas.style.width  = `${COLS * TILE}px`;
    canvas.style.height = `${ROWS * TILE}px`;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);

    this.prerenderThumbs();

    // Attach mouse/touch events outside Angular's zone
    this.zone.runOutsideAngular(() => {
      canvas.addEventListener('mousedown', (e) => { this.drawing = true;  this.paint(e); });
      canvas.addEventListener('mousemove', (e) => { if (this.drawing) this.paint(e); });
      canvas.addEventListener('mouseup',   ()  => { this.drawing = false; });
      canvas.addEventListener('mouseleave',()  => { this.drawing = false; });
      canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.erase(e as MouseEvent); });
    });

    // Generate the initial town
    this.zone.run(() => this.generate());

    // Start render loop
    this.running = true;
    this.zone.runOutsideAngular(() => {
      this.lastMs = performance.now();
      const loop = (ms: number) => {
        if (!this.running) return;
        this.t      += Math.min((ms - this.lastMs) / 1000, 0.1);
        this.lastMs  = ms;
        this.render();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    });
  }

  private prerenderThumbs(): void {
    const out: Partial<Record<TileId, string>> = {};
    for (const p of PALETTE) {
      const c = document.createElement('canvas');
      c.width = c.height = TILE;
      const x = c.getContext('2d')!;
      drawTile(x, p.id, 0, 0, 0, p.id.charCodeAt(0) * 157 + 42);
      out[p.id] = c.toDataURL();
    }
    this.zone.run(() => this.thumbs.set(out));
  }

  /* ================================================================
     RENDER
     ================================================================ */

  private render(): void {
    const ctx = this.ctx;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const seed = r * 1031 + c * 97;
        drawTile(ctx, this.map[r][c], c * TILE, r * TILE, this.t, seed);
      }
    }
    if (this.showGrid()) {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= COLS; c++) {
        ctx.beginPath(); ctx.moveTo(c * TILE, 0); ctx.lineTo(c * TILE, ROWS * TILE); ctx.stroke();
      }
      for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * TILE); ctx.lineTo(COLS * TILE, r * TILE); ctx.stroke();
      }
    }
  }

  /* ================================================================
     PAINTING
     ================================================================ */

  private tileAt(e: MouseEvent): [number, number] {
    const canvas = this.mapCanvas().nativeElement;
    const rect   = canvas.getBoundingClientRect();
    return [
      Math.floor((e.clientY - rect.top)  / TILE),
      Math.floor((e.clientX - rect.left) / TILE),
    ];
  }

  private paint(e: MouseEvent): void {
    const [row, col] = this.tileAt(e);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS)
      this.map[row][col] = this.selected();
  }

  private erase(e: MouseEvent): void {
    const [row, col] = this.tileAt(e);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS)
      this.map[row][col] = 'grass';
  }

  /* ================================================================
     CONTROLS
     ================================================================ */

  generate(): void {
    this.map = generateMap(this.seedInput());
  }

  clearMap(): void {
    this.map = emptyGrid();
  }

  randomSeed(): void {
    this.seedInput.set(Math.floor(Math.random() * 99999));
    this.generate();
  }

  exportPng(): void {
    const canvas  = this.mapCanvas().nativeElement;
    const link    = document.createElement('a');
    link.download = `rpg-map-seed-${this.seedInput()}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  }
}
