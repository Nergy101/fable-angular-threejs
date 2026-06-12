import { Component, computed, signal } from '@angular/core';
import * as THREE from 'three';
import { ThreeDemo } from '../core/three/three-demo';
import { GENRES, MusicEvent, MusicGenre } from './music-data';

const TASTE_KEY = 'vector-atelier.music-taste';

/** Neutral tuning shown before any taste is picked: graphite field, accent peaks. */
const IDLE = {
  field: { speed: 0.7, swell: 1.6, spike: 0.6 },
  palette: { lo: '#182030', hi: '#d7ff3e', spark: '#9fb6c8' },
};

const FIELD_COLS = 56;
const FIELD_ROWS = 22;
const DUST_COUNT = 320;

interface EventVm {
  key: string;
  kind: string;
  name: string;
  venue: string;
  city: string;
  url: string;
  image: string | null;
  /** first genre's hi/lo colors drive the card accent & flyer fallback */
  accent: string;
  phA: string;
  initial: string;
  dow: string;
  dom: string;
  mon: string;
  tags: { label: string; color: string }[];
}

@Component({
  selector: 'app-music',
  templateUrl: './music.html',
  styleUrl: './music.scss',
})
export class Music extends ThreeDemo {
  readonly genres = GENRES;
  readonly selected = signal<ReadonlySet<string>>(loadTaste());
  /** bumped on every taste change so the agenda's stagger animation replays */
  private readonly generation = signal(0);

  readonly rangeLabel = rangeLabel();

  /** the scraped partyflock programme; null while loading */
  private readonly programme = signal<MusicEvent[] | null>(null);
  readonly scrapedAt = signal('');
  readonly loaded = computed(() => this.programme() !== null);

  constructor() {
    super();
    this.loadProgramme();
  }

  readonly events = computed<EventVm[]>(() => {
    const sel = this.selected();
    const gen = this.generation();
    return (this.programme() ?? [])
      .filter((e) => sel.size === 0 || e.genres.some((g) => sel.has(g)))
      .map((e) => {
        const first = GENRES.find((g) => g.id === e.genres[0]);
        return {
          key: `${e.id}·${gen}`,
          kind: e.kind,
          name: e.name,
          venue: e.venue,
          city: e.city,
          url: e.url,
          image: e.image && flyerUrl(e.image),
          accent: first?.palette.hi ?? '#d7ff3e',
          phA: first?.palette.lo ?? '#14161d',
          initial: e.name.trim().charAt(0).toUpperCase(),
          ...dateParts(e.date),
          tags: e.genres
            .map((id) => GENRES.find((g) => g.id === id))
            .filter((g): g is MusicGenre => !!g)
            .map((g) => ({ label: g.label, color: g.palette.hi })),
        };
      });
  });

  /** Fetch the scraped agenda and keep what falls in the coming month. */
  private async loadProgramme(): Promise<void> {
    try {
      const res = await fetch(new URL('partyflock-events.json', document.baseURI));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { scrapedAt: string; events: MusicEvent[] };
      const from = new Date().setHours(0, 0, 0, 0);
      const to = from + 30 * 864e5;
      this.scrapedAt.set(data.scrapedAt.slice(0, 10));
      this.programme.set(
        data.events
          .filter((e) => {
            const t = Date.parse(e.date);
            return t >= from && t <= to;
          })
          .sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
      );
    } catch {
      this.programme.set([]); // the template shows the silence state
    }
  }

  isOn(id: string): boolean {
    return this.selected().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.selected());
    if (!next.delete(id)) next.add(id);
    this.selected.set(next);
    this.generation.update((n) => n + 1);
    saveTaste(next);
    this.retune(true);
  }

  /* ============================================================
     The spectrum field — an instanced "equalizer terrain" whose
     tempo, swell, spikiness and palette lerp toward the selected
     tastes. Toggling a taste fires a shockwave ring through it.
     ============================================================ */

  private field!: THREE.InstancedMesh;
  private dust!: THREE.Points;
  private dustMat!: THREE.PointsMaterial;
  private readonly dummy = new THREE.Object3D();
  private readonly tmpColor = new THREE.Color();

  private readonly cur = { ...IDLE.field };
  private readonly tgt = { ...IDLE.field };
  private readonly curLo = new THREE.Color(IDLE.palette.lo);
  private readonly curHi = new THREE.Color(IDLE.palette.hi);
  private readonly curSpark = new THREE.Color(IDLE.palette.spark);
  private readonly tgtLo = new THREE.Color(IDLE.palette.lo);
  private readonly tgtHi = new THREE.Color(IDLE.palette.hi);
  private readonly tgtSpark = new THREE.Color(IDLE.palette.spark);

  /** seconds since the last retune; drives the expanding shockwave ring */
  private pulseT = 10;

  protected onInit(): void {
    this.camera.position.set(0, 12, 34);
    this.camera.lookAt(0, 2.5, 0);
    this.scene.fog = new THREE.FogExp2(0x0a0b0e, 0.022);

    this.scene.add(new THREE.AmbientLight(0x6a7388, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-8, 22, 14);
    this.scene.add(key);

    const geo = new THREE.BoxGeometry(0.78, 1, 0.78);
    geo.translate(0, 0.5, 0); // bars grow upward from the floor
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.15 });
    this.field = new THREE.InstancedMesh(geo, mat, FIELD_COLS * FIELD_ROWS);
    this.field.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < FIELD_COLS * FIELD_ROWS; i++) {
      this.field.setColorAt(i, this.curLo);
    }
    this.scene.add(this.field);

    // rising dust — the room's "notes in the air"
    const positions = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 36;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustMat = new THREE.PointsMaterial({
      size: 0.22,
      color: this.curSpark,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.dust = new THREE.Points(dustGeo, this.dustMat);
    this.scene.add(this.dust);

    this.retune(false); // apply a persisted taste without the entrance pulse
  }

  protected override onFrame(dt: number, t: number): void {
    // ease everything toward the target tuning — this *is* the transition
    const k = 1 - Math.exp(-dt * 2.6);
    this.cur.speed += (this.tgt.speed - this.cur.speed) * k;
    this.cur.swell += (this.tgt.swell - this.cur.swell) * k;
    this.cur.spike += (this.tgt.spike - this.cur.spike) * k;
    this.curLo.lerp(this.tgtLo, k);
    this.curHi.lerp(this.tgtHi, k);
    this.curSpark.lerp(this.tgtSpark, k);
    this.dustMat.color.copy(this.curSpark);

    this.pulseT += dt;
    const pulseR = this.pulseT * 14;
    const pulseAmp = Math.exp(-this.pulseT * 2.4);

    const sp = this.cur.speed;
    let i = 0;
    for (let r = 0; r < FIELD_ROWS; r++) {
      for (let c = 0; c < FIELD_COLS; c++) {
        const x = c - (FIELD_COLS - 1) / 2;
        const z = r - (FIELD_ROWS - 1) / 2;

        const w1 = Math.sin(x * 0.34 + t * sp) * Math.cos(z * 0.3 - t * sp * 0.72);
        const w2 = Math.sin((x + z) * 0.16 + t * sp * 0.5);
        let h = 1.1 + this.cur.swell * (1.05 + 0.75 * w1 + 0.55 * w2);

        const s = Math.sin(x * 0.9 + t * sp * 1.1) * Math.sin(z * 1.1 - t * sp * 0.85);
        h += this.cur.spike * Math.pow(Math.max(0, s), 6) * 2.8;

        if (pulseAmp > 0.01) {
          const d = Math.hypot(x, z) - pulseR;
          h += Math.exp(-(d * d) / 7) * pulseAmp * 3.5;
        }

        this.dummy.position.set(x, 0, z);
        this.dummy.scale.set(1, h, 1);
        this.dummy.updateMatrix();
        this.field.setMatrixAt(i, this.dummy.matrix);

        const mix = Math.min(1, Math.max(0, (h - 0.8) / 7.5));
        this.tmpColor.copy(this.curLo).lerp(this.curHi, mix);
        this.field.setColorAt(i, this.tmpColor);
        i++;
      }
    }
    this.field.instanceMatrix.needsUpdate = true;
    this.field.instanceColor!.needsUpdate = true;

    // dust drifts upward, faster when the music is faster
    const pos = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    const rise = dt * (0.7 + sp * 0.35);
    for (let p = 0; p < DUST_COUNT; p++) {
      let y = pos.getY(p) + rise * (0.5 + ((p * 37) % 10) / 10);
      if (y > 20) y = 0;
      pos.setY(p, y);
    }
    pos.needsUpdate = true;

    // slow camera sway, like nodding along
    this.camera.position.x = Math.sin(t * 0.05) * 2.5;
    this.camera.position.y = 12 + Math.sin(t * 0.035) * 0.6;
    this.camera.lookAt(0, 2.5, 0);
  }

  /** Blend the field params & palette of every selected taste; none = idle tuning. */
  private retune(pulse: boolean): void {
    const picked = GENRES.filter((g) => this.selected().has(g.id));
    if (picked.length === 0) {
      Object.assign(this.tgt, IDLE.field);
      this.tgtLo.set(IDLE.palette.lo);
      this.tgtHi.set(IDLE.palette.hi);
      this.tgtSpark.set(IDLE.palette.spark);
    } else {
      const n = picked.length;
      this.tgt.speed = picked.reduce((a, g) => a + g.field.speed, 0) / n;
      this.tgt.swell = picked.reduce((a, g) => a + g.field.swell, 0) / n;
      this.tgt.spike = picked.reduce((a, g) => a + g.field.spike, 0) / n;
      blendColors(this.tgtLo, picked.map((g) => g.palette.lo));
      blendColors(this.tgtHi, picked.map((g) => g.palette.hi));
      blendColors(this.tgtSpark, picked.map((g) => g.palette.spark));
    }
    if (pulse) this.pulseT = 0;
  }
}

function blendColors(out: THREE.Color, hexes: string[]): void {
  out.setRGB(0, 0, 0);
  const c = new THREE.Color();
  for (const hex of hexes) {
    c.set(hex);
    out.r += c.r / hexes.length;
    out.g += c.g / hexes.length;
    out.b += c.b / hexes.length;
  }
}

/**
 * partyflock serves flyers with Cross-Origin-Resource-Policy: same-site, so
 * browsers refuse to embed them directly. wsrv.nl is an image-proxy/CDN built
 * for exactly this; it caches at its edge, sparing partyflock the traffic.
 */
function flyerUrl(src: string): string {
  return `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=640&output=webp&q=78`;
}

function dateParts(iso: string): { dow: string; dom: string; mon: string } {
  const d = new Date(iso);
  return {
    dow: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    dom: String(d.getDate()),
    mon: d.toLocaleDateString('en-GB', { month: 'short' }),
  };
}

function rangeLabel(): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 30);
  return `${fmt(from)} — ${fmt(to)}`;
}

function loadTaste(): Set<string> {
  try {
    const raw = localStorage.getItem(TASTE_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as string[];
    return new Set(ids.filter((id) => GENRES.some((g) => g.id === id)));
  } catch {
    return new Set();
  }
}

function saveTaste(taste: ReadonlySet<string>): void {
  try {
    localStorage.setItem(TASTE_KEY, JSON.stringify([...taste]));
  } catch {
    /* private mode etc. — taste just won't persist */
  }
}
