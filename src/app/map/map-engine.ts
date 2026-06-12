/* ============================================================
   RPG Map Studio — tile drawing and procedural generation.
   All pure functions; no Angular here.
   ============================================================ */

export const TILE = 38; // px per tile
export const COLS = 22;
export const ROWS = 15;

export type TileId =
  | 'grass'   | 'stone'   | 'dirt'    | 'water'
  | 'tree'    | 'bush'    | 'flower'
  | 'house_r' | 'house_b' | 'house_g'
  | 'shop'    | 'inn'     | 'church'
  | 'well'    | 'fence_h' | 'fence_v';

export interface PaletteTile {
  id: TileId;
  label: string;
  group: string;
}

export const PALETTE: PaletteTile[] = [
  { id: 'grass',   label: 'Grass',   group: 'Terrain'  },
  { id: 'stone',   label: 'Cobble',  group: 'Terrain'  },
  { id: 'dirt',    label: 'Dirt',    group: 'Terrain'  },
  { id: 'water',   label: 'Water',   group: 'Terrain'  },
  { id: 'tree',    label: 'Tree',    group: 'Nature'   },
  { id: 'bush',    label: 'Bush',    group: 'Nature'   },
  { id: 'flower',  label: 'Flower',  group: 'Nature'   },
  { id: 'house_r', label: 'House ①', group: 'Building' },
  { id: 'house_b', label: 'House ②', group: 'Building' },
  { id: 'house_g', label: 'House ③', group: 'Building' },
  { id: 'shop',    label: 'Shop',    group: 'Building' },
  { id: 'inn',     label: 'Inn',     group: 'Building' },
  { id: 'church',  label: 'Church',  group: 'Building' },
  { id: 'well',    label: 'Well',    group: 'Detail'   },
  { id: 'fence_h', label: 'Fence ——', group: 'Detail'  },
  { id: 'fence_v', label: 'Fence |', group: 'Detail'   },
];

export const PALETTE_GROUPS = ['Terrain', 'Nature', 'Building', 'Detail'] as const;

export function emptyGrid(): TileId[][] {
  return Array.from({ length: ROWS }, () => Array<TileId>(COLS).fill('grass'));
}

/* ---- Seeded RNG (mulberry32) ---- */
export function mkrng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Rounded rect helper ---- */
type C2D = CanvasRenderingContext2D;
const T = TILE;

function rr(ctx: C2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,   x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ================================================================
   TERRAIN
   ================================================================ */

function drawGrass(ctx: C2D, seed: number): void {
  const rng = mkrng(seed);
  ctx.fillStyle = '#6eb83e';
  ctx.fillRect(0, 0, T, T);
  ctx.strokeStyle = '#52a028'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    const x = 2 + rng() * (T - 4), y = 4 + rng() * (T - 8);
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.bezierCurveTo(x - 1, y + 2, x + rng() * 4 - 2, y, x + rng() * 3 - 1.5, y - 3);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(180,255,90,0.15)';
  ctx.beginPath();
  ctx.arc(3 + rng() * (T - 6), 3 + rng() * (T - 6), 4 + rng() * 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawStone(ctx: C2D, seed: number): void {
  const rng = mkrng(seed);
  ctx.fillStyle = '#8c8c7e'; ctx.fillRect(0, 0, T, T);
  const stones = [[2, 2, 15, 14], [19, 2, 15, 14], [2, 18, 15, 15], [19, 18, 15, 15]];
  for (const [sx, sy, sw, sh] of stones) {
    const l = 50 + rng() * 15;
    ctx.fillStyle = `hsl(55,6%,${l}%)`;
    rr(ctx, sx, sy, sw, sh, 3); ctx.fill();
    ctx.strokeStyle = '#686860'; ctx.lineWidth = 1; ctx.stroke();
  }
}

function drawDirt(ctx: C2D, seed: number): void {
  const rng = mkrng(seed);
  ctx.fillStyle = '#b48050'; ctx.fillRect(0, 0, T, T);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = rng() < 0.5 ? '#9a6a40' : '#c89060';
    ctx.beginPath();
    ctx.arc(rng() * T, rng() * T, 1 + rng() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWater(ctx: C2D, t: number): void {
  ctx.fillStyle = '#2e80d8'; ctx.fillRect(0, 0, T, T);
  // darker bottom half
  ctx.fillStyle = 'rgba(0,30,80,0.15)'; ctx.fillRect(0, T / 2, T, T / 2);
  ctx.strokeStyle = 'rgba(160,220,255,0.70)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const y0 = 7 + i * 11 + Math.sin(t * 1.3 + i * 1.1) * 2;
    ctx.beginPath(); ctx.moveTo(1, y0);
    for (let x = 1; x < T - 1; x += 3) {
      ctx.lineTo(x, y0 + Math.sin((x / T) * Math.PI * 2.5 + t * 1.2 + i * 0.9) * 2.5);
    }
    ctx.stroke();
  }
  // sparkle
  ctx.fillStyle = 'rgba(230,248,255,0.8)';
  ctx.beginPath();
  ctx.arc(5 + Math.sin(t * 2.0) * 2, 5 + Math.cos(t * 1.6) * 1.5, 2, 0, Math.PI * 2);
  ctx.fill();
}

/* ================================================================
   NATURE
   ================================================================ */

function drawTree(ctx: C2D, seed: number): void {
  drawGrass(ctx, seed + 9901);
  const cx = T / 2, base = T - 2;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.ellipse(cx + 2, base - 1, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a4e28'; ctx.fillRect(cx - 3, base - 13, 6, 12);
  const layers: [number, number, number, string][] = [
    [cx, base - 20, 14, '#255e10'],
    [cx - 1, base - 26, 10, '#2e7c18'],
    [cx + 1, base - 30, 7,  '#3a9424'],
    [cx - 2, base - 33, 5,  '#44aa2c'],
  ];
  for (const [lx, ly, lr, lc] of layers) {
    ctx.fillStyle = lc as string;
    ctx.beginPath(); ctx.arc(lx as number, ly as number, lr as number, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(200,255,100,0.2)';
  ctx.beginPath(); ctx.arc(cx - 4, base - 33, 4, 0, Math.PI * 2); ctx.fill();
}

function drawBush(ctx: C2D, seed: number): void {
  drawGrass(ctx, seed + 8801);
  const cx = T / 2, base = T - 5;
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.beginPath(); ctx.ellipse(cx + 1, base + 1, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
  const bumps: [number, number, number, string][] = [
    [cx - 6, base - 4, 7,  '#326010'],
    [cx + 6, base - 4, 7,  '#326010'],
    [cx,     base - 8, 9,  '#3e7a18'],
    [cx - 4, base - 10, 6, '#4a9020'],
    [cx + 4, base - 10, 6, '#4a9020'],
    [cx,     base - 13, 5, '#56a828'],
  ];
  for (const [bx, by, br, bc] of bumps) {
    ctx.fillStyle = bc as string;
    ctx.beginPath(); ctx.arc(bx as number, by as number, br as number, 0, Math.PI * 2); ctx.fill();
  }
}

function drawFlower(ctx: C2D, seed: number): void {
  drawGrass(ctx, seed);
  const rng = mkrng(seed + 7701);
  const COLORS = ['#ff4477', '#ffcc18', '#cc33ff', '#ff7733', '#33ccdd', '#ff88aa'];
  for (let i = 0; i < 4; i++) {
    const fx = 5 + rng() * (T - 10), fy = 5 + rng() * (T - 10);
    const fc = COLORS[Math.floor(rng() * COLORS.length)];
    ctx.fillStyle = fc;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffee44';
    ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, Math.PI * 2); ctx.fill();
  }
}

/* ================================================================
   BUILDINGS
   ================================================================ */

function drawHouse(ctx: C2D, roofFill: string, roofEdge: string, seed: number): void {
  drawGrass(ctx, seed + 1001);
  const rng = mkrng(seed);
  const ww = 26, wh = 14, wx = (T - ww) / 2, wy = T - wh - 3;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(wx + 2, wy + wh, ww, 3);
  // walls
  ctx.fillStyle = '#f0e0c0';
  rr(ctx, wx, wy, ww, wh, 2); ctx.fill();
  ctx.strokeStyle = '#c4a878'; ctx.lineWidth = 1; ctx.stroke();
  // door
  ctx.fillStyle = '#7a4c20';
  rr(ctx, wx + ww / 2 - 3, wy + wh - 9, 6, 9, 1); ctx.fill();
  ctx.fillStyle = '#d4a038';
  ctx.beginPath(); ctx.arc(wx + ww / 2 + 1, wy + wh - 5, 1, 0, Math.PI * 2); ctx.fill();
  // windows
  for (const wndx of [wx + 3, wx + ww - 11]) {
    ctx.fillStyle = '#ffe860'; ctx.fillRect(wndx, wy + 3, 8, 5);
    ctx.strokeStyle = '#c4a878'; ctx.lineWidth = 0.5; ctx.strokeRect(wndx, wy + 3, 8, 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(wndx + 4, wy + 3); ctx.lineTo(wndx + 4, wy + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wndx, wy + 5.5); ctx.lineTo(wndx + 8, wy + 5.5); ctx.stroke();
  }
  // roof
  ctx.fillStyle = roofFill;
  ctx.beginPath();
  ctx.moveTo(wx - 3, wy + 1); ctx.lineTo(T / 2, wy - 13); ctx.lineTo(wx + ww + 3, wy + 1);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = roofEdge; ctx.lineWidth = 1; ctx.stroke();
  // chimney (60 % chance)
  if (rng() < 0.60) {
    const chx = T / 2 + 3;
    ctx.fillStyle = '#b04828'; ctx.fillRect(chx, wy - 16, 5, 8);
    ctx.fillStyle = '#cc5c38'; ctx.fillRect(chx - 1, wy - 18, 7, 3);
    ctx.strokeStyle = '#903020'; ctx.lineWidth = 0.5;
    ctx.strokeRect(chx - 1, wy - 18, 7, 3);
  }
}

function drawShop(ctx: C2D, seed: number): void {
  drawGrass(ctx, seed + 2002);
  const ww = 28, wh = 13, wx = (T - ww) / 2, wy = T - wh - 2;
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(wx + 2, wy + wh, ww, 3);
  // walls
  ctx.fillStyle = '#ede4cc';
  rr(ctx, wx, wy, ww, wh, 2); ctx.fill();
  ctx.strokeStyle = '#c0a060'; ctx.lineWidth = 1; ctx.stroke();
  // flat roof / parapet
  ctx.fillStyle = '#c09048'; ctx.fillRect(wx - 3, wy - 5, ww + 6, 6);
  ctx.strokeStyle = '#9a6c28'; ctx.lineWidth = 1; ctx.strokeRect(wx - 3, wy - 5, ww + 6, 6);
  // awning
  ctx.fillStyle = '#e09818';
  ctx.beginPath();
  ctx.moveTo(wx - 2, wy); ctx.lineTo(wx + ww + 2, wy);
  ctx.lineTo(wx + ww, wy + 7); ctx.lineTo(wx, wy + 7);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#a87010'; ctx.lineWidth = 0.5; ctx.stroke();
  for (let s = 1; s < 4; s++) {
    ctx.strokeStyle = '#b87808'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(wx + s * ww / 4, wy); ctx.lineTo(wx + s * ww / 4 - 1, wy + 7); ctx.stroke();
  }
  // sign
  ctx.fillStyle = '#f4cc54';
  rr(ctx, T / 2 - 9, wy - 11, 18, 7, 2); ctx.fill();
  ctx.strokeStyle = '#a87820'; ctx.lineWidth = 0.5; ctx.stroke();
  // display window
  ctx.fillStyle = '#c8ecff'; ctx.fillRect(wx + 3, wy + 1, ww - 6, 8);
  ctx.strokeStyle = '#80b0cc'; ctx.lineWidth = 0.5; ctx.strokeRect(wx + 3, wy + 1, ww - 6, 8);
}

function drawInn(ctx: C2D, seed: number): void {
  drawGrass(ctx, seed + 3003);
  const ww = 30, wh = 16, wx = (T - ww) / 2, wy = T - wh - 1;
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(wx + 2, wy + wh, ww, 3);
  // walls
  ctx.fillStyle = '#e4cc98';
  rr(ctx, wx, wy, ww, wh, 2); ctx.fill();
  ctx.strokeStyle = '#b08850'; ctx.lineWidth = 1; ctx.stroke();
  // half-timber beams
  ctx.strokeStyle = '#7a4c18'; ctx.lineWidth = 1.8;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(wx, wy + i * 6); ctx.lineTo(wx + ww, wy + i * 6); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
  // arched door
  const dx = T / 2 - 4, dy = wy + wh - 11;
  ctx.fillStyle = '#6a3810';
  ctx.fillRect(dx, dy + 4, 8, 7);
  ctx.beginPath(); ctx.arc(dx + 4, dy + 4, 4, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#3a1808'; ctx.lineWidth = 0.5; ctx.stroke();
  // windows
  ctx.fillStyle = '#ffe860';
  for (const wwx of [wx + 2, wx + ww - 12]) {
    rr(ctx, wwx, wy + 2, 10, 7, 2); ctx.fill();
    ctx.strokeStyle = '#b08850'; ctx.lineWidth = 0.5; ctx.stroke();
  }
  // hip roof
  ctx.fillStyle = '#6a3810';
  ctx.beginPath();
  ctx.moveTo(wx - 3, wy + 1); ctx.lineTo(T / 2, wy - 11); ctx.lineTo(wx + ww + 3, wy + 1);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#4a2408'; ctx.lineWidth = 1; ctx.stroke();
  // hanging sign
  ctx.fillStyle = '#8c6228'; ctx.fillRect(wx + 1, wy - 8, 3, 12);
  ctx.fillStyle = '#f4cc54';
  rr(ctx, wx - 7, wy - 9, 15, 8, 2); ctx.fill();
  ctx.strokeStyle = '#a07820'; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.strokeStyle = '#8a6010'; ctx.lineWidth = 1;
  ctx.strokeRect(wx - 4, wy - 7, 4, 4);
  ctx.beginPath(); ctx.arc(wx + 1, wy - 5, 1.5, -Math.PI / 2, Math.PI / 2); ctx.stroke();
}

function drawChurch(ctx: C2D, seed: number): void {
  drawGrass(ctx, seed + 4004);
  const ww = 20, wh = 15, wx = (T - ww) / 2, wy = T - wh - 2;
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(wx + 2, wy + wh, ww, 3);
  // body
  ctx.fillStyle = '#e6e0d6';
  rr(ctx, wx, wy, ww, wh, 2); ctx.fill();
  ctx.strokeStyle = '#b4aea4'; ctx.lineWidth = 1; ctx.stroke();
  // arched door
  const dx = T / 2 - 3, dy = wy + wh - 10;
  ctx.fillStyle = '#5a3614';
  ctx.fillRect(dx, dy + 3, 6, 7);
  ctx.beginPath(); ctx.arc(dx + 3, dy + 3, 3, Math.PI, 0); ctx.fill();
  // lancet windows
  ctx.fillStyle = '#a8d4ff';
  for (const awx of [wx + 1, wx + ww - 8]) {
    ctx.fillRect(awx, wy + 3, 7, 6);
    ctx.beginPath(); ctx.arc(awx + 3.5, wy + 3, 3.5, Math.PI, 0); ctx.fill();
  }
  // roof
  ctx.fillStyle = '#909090';
  ctx.beginPath();
  ctx.moveTo(wx - 3, wy + 1); ctx.lineTo(T / 2, wy - 8); ctx.lineTo(wx + ww + 3, wy + 1);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6c6c6c'; ctx.lineWidth = 1; ctx.stroke();
  // tower
  const tx = T / 2 - 4, ty = wy - 22;
  ctx.fillStyle = '#d0ccc4'; ctx.fillRect(tx, ty, 8, 14);
  ctx.strokeStyle = '#b4aea4'; ctx.lineWidth = 1; ctx.strokeRect(tx, ty, 8, 14);
  ctx.fillStyle = '#7c9ab0'; ctx.fillRect(tx + 1, ty + 2, 6, 5);
  // tower spire
  ctx.fillStyle = '#686868';
  ctx.beginPath();
  ctx.moveTo(tx - 2, ty); ctx.lineTo(T / 2, ty - 11); ctx.lineTo(tx + 10, ty);
  ctx.closePath(); ctx.fill();
  // cross
  ctx.strokeStyle = '#f0ece4'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(T / 2, ty - 10); ctx.lineTo(T / 2, ty - 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(T / 2 - 3, ty - 7.5); ctx.lineTo(T / 2 + 3, ty - 7.5); ctx.stroke();
}

/* ================================================================
   DETAIL
   ================================================================ */

function drawWell(ctx: C2D, seed: number): void {
  drawStone(ctx, seed + 5005);
  const cx = T / 2, cy = T / 2 + 1;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.ellipse(cx + 1, cy + 12, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
  // support posts
  ctx.fillStyle = '#7c4e22'; ctx.fillRect(cx - 11, cy - 8, 4, 18); ctx.fillRect(cx + 7, cy - 8, 4, 18);
  // crossbeam
  ctx.fillStyle = '#c09040'; ctx.fillRect(cx - 12, cy - 9, 24, 4);
  ctx.strokeStyle = '#906020'; ctx.lineWidth = 1; ctx.strokeRect(cx - 12, cy - 9, 24, 4);
  // stone cylinder
  ctx.fillStyle = '#9a9888';
  ctx.beginPath(); ctx.ellipse(cx, cy + 8, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - 9, cy - 2, 18, 11);
  ctx.fillStyle = '#aaa898'; ctx.fillRect(cx - 8, cy - 1, 16, 9);
  ctx.strokeStyle = '#6a6858'; ctx.lineWidth = 0.5;
  for (let s = 0; s < 3; s++) ctx.strokeRect(cx - 8 + s * 6, cy - 1, 6, 9);
  // rope + bucket
  ctx.strokeStyle = '#c8a840'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 1); ctx.stroke();
  ctx.fillStyle = '#b88828';
  rr(ctx, cx - 2, cy + 1, 4, 4, 1); ctx.fill();
  ctx.strokeStyle = '#886018'; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.fillStyle = '#2e80d8'; ctx.fillRect(cx - 1.5, cy + 1, 3, 2);
}

function drawFenceH(ctx: C2D): void {
  drawGrass(ctx, 0xf00f);
  const y = T / 2 - 5;
  ctx.fillStyle = '#bc8048';
  ctx.fillRect(0, y, T, 3); ctx.fillRect(0, y + 8, T, 3);
  ctx.strokeStyle = '#8a5420'; ctx.lineWidth = 0.5;
  ctx.strokeRect(0, y, T, 3); ctx.strokeRect(0, y + 8, T, 3);
  for (let px = 0; px <= T; px += 9) {
    ctx.fillStyle = '#a46830'; ctx.fillRect(px - 2, y - 3, 4, 17);
    ctx.strokeStyle = '#784010'; ctx.lineWidth = 0.5; ctx.strokeRect(px - 2, y - 3, 4, 17);
    ctx.fillStyle = '#c08848'; ctx.fillRect(px - 3, y - 5, 6, 3);
  }
}

function drawFenceV(ctx: C2D): void {
  drawGrass(ctx, 0x0ff0);
  const x = T / 2 - 5;
  ctx.fillStyle = '#bc8048';
  ctx.fillRect(x, 0, 3, T); ctx.fillRect(x + 8, 0, 3, T);
  ctx.strokeStyle = '#8a5420'; ctx.lineWidth = 0.5;
  ctx.strokeRect(x, 0, 3, T); ctx.strokeRect(x + 8, 0, 3, T);
  for (let py = 0; py <= T; py += 9) {
    ctx.fillStyle = '#a46830'; ctx.fillRect(x - 3, py - 2, 17, 4);
    ctx.strokeStyle = '#784010'; ctx.lineWidth = 0.5; ctx.strokeRect(x - 3, py - 2, 17, 4);
  }
}

/* ================================================================
   PUBLIC: draw one tile at pixel (px, py)
   ================================================================ */

export function drawTile(
  ctx: C2D,
  id: TileId,
  px: number,
  py: number,
  t: number,
  tileSeed: number,
): void {
  ctx.save();
  ctx.translate(px, py);
  ctx.beginPath(); ctx.rect(0, 0, T, T); ctx.clip();

  switch (id) {
    case 'grass':   drawGrass(ctx, tileSeed);                           break;
    case 'stone':   drawStone(ctx, tileSeed);                           break;
    case 'dirt':    drawDirt(ctx, tileSeed);                            break;
    case 'water':   drawWater(ctx, t);                                  break;
    case 'tree':    drawTree(ctx, tileSeed);                            break;
    case 'bush':    drawBush(ctx, tileSeed);                            break;
    case 'flower':  drawFlower(ctx, tileSeed);                          break;
    case 'house_r': drawHouse(ctx, '#c03828', '#8c2010', tileSeed);    break;
    case 'house_b': drawHouse(ctx, '#3460b0', '#1e3e88', tileSeed);    break;
    case 'house_g': drawHouse(ctx, '#38863c', '#246028', tileSeed);    break;
    case 'shop':    drawShop(ctx, tileSeed);                            break;
    case 'inn':     drawInn(ctx, tileSeed);                             break;
    case 'church':  drawChurch(ctx, tileSeed);                          break;
    case 'well':    drawWell(ctx, tileSeed);                            break;
    case 'fence_h': drawFenceH(ctx);                                    break;
    case 'fence_v': drawFenceV(ctx);                                    break;
  }

  ctx.restore();
}

/* ================================================================
   PROCEDURAL MAP GENERATOR
   ================================================================ */

export function generateMap(seed: number): TileId[][] {
  const rng = mkrng(seed * 1009 + 7);
  const map: TileId[][] = emptyGrid();

  const put = (r: number, c: number, id: TileId) => {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) map[r][c] = id;
  };
  const at = (r: number, c: number): TileId | null =>
    r >= 0 && r < ROWS && c >= 0 && c < COLS ? map[r][c] : null;
  const is = (r: number, c: number, id: TileId) => at(r, c) === id;

  const cr = Math.floor(ROWS / 2);  // 7
  const cc = Math.floor(COLS / 2);  // 11

  // 1. Town square — 3×3 cobblestone
  for (let r = cr - 1; r <= cr + 1; r++)
    for (let c = cc - 1; c <= cc + 1; c++)
      put(r, c, 'stone');

  // 2. Well in the centre
  put(cr, cc, 'well');

  // 3. Main cross roads
  for (let r = 1; r < ROWS - 1; r++) if (is(r, cc, 'grass')) put(r, cc, 'dirt');
  for (let c = 1; c < COLS - 1; c++) if (is(cr, c, 'grass')) put(cr, c, 'dirt');

  // 4. Two side streets per axis
  const sideRows: number[] = [];
  const sideCols: number[] = [];
  for (const sign of [-1, 1]) {
    const sr = cr + sign * (3 + Math.floor(rng() * 2));
    for (let c = 1; c < COLS - 1; c++) if (is(sr, c, 'grass')) put(sr, c, 'dirt');
    sideRows.push(sr);

    const sc = cc + sign * (4 + Math.floor(rng() * 2));
    for (let r = 1; r < ROWS - 1; r++) if (is(r, sc, 'grass')) put(r, sc, 'dirt');
    sideCols.push(sc);
  }

  // 5. Houses along main + side roads
  const houses: TileId[] = ['house_r', 'house_b', 'house_g'];

  // Along the vertical main road
  for (let r = 2; r < ROWS - 2; r++) {
    if (Math.abs(r - cr) <= 1) continue;
    for (const dc of [-2, 2]) {
      const c = cc + dc;
      if (c > 0 && c < COLS - 1 && is(r, c, 'grass') && rng() < 0.55)
        put(r, c, houses[Math.floor(rng() * 3)]);
    }
  }

  // Along the horizontal main road
  for (let c = 2; c < COLS - 2; c++) {
    if (Math.abs(c - cc) <= 1) continue;
    for (const dr of [-2, 2]) {
      const r = cr + dr;
      if (r > 0 && r < ROWS - 1 && is(r, c, 'grass') && rng() < 0.55)
        put(r, c, houses[Math.floor(rng() * 3)]);
    }
  }

  // Along side streets
  for (const sr of sideRows) {
    for (let c = 2; c < COLS - 2; c++) {
      if (!is(sr, c, 'dirt')) continue;
      for (const dr of [-1, 1]) {
        const r = sr + dr;
        if (r > 0 && r < ROWS - 1 && is(r, c, 'grass') && rng() < 0.45)
          put(r, c, houses[Math.floor(rng() * 3)]);
      }
    }
  }
  for (const sc of sideCols) {
    for (let r = 2; r < ROWS - 2; r++) {
      if (!is(r, sc, 'dirt')) continue;
      for (const dc of [-1, 1]) {
        const c = sc + dc;
        if (c > 0 && c < COLS - 1 && is(r, c, 'grass') && rng() < 0.45)
          put(r, c, houses[Math.floor(rng() * 3)]);
      }
    }
  }

  // 6. Special buildings near the town square
  const specials: [number, number, TileId][] = [
    [cr - 3, cc - 5, 'church'],
    [cr + 3, cc - 5, 'inn'],
    [cr - 3, cc + 5, 'shop'],
    [cr + 3, cc + 5, 'shop'],
  ];
  for (const [r, c, id] of specials) if (is(r, c, 'grass')) put(r, c, id);

  // 7. Water feature (pond) in a random corner
  const pr = rng() < 0.5 ? 1 : ROWS - 4;
  const pc = rng() < 0.5 ? 1 : COLS - 6;
  for (let r = pr; r < Math.min(pr + 3, ROWS - 1); r++)
    for (let c = pc; c < Math.min(pc + 5, COLS - 1); c++)
      if (is(r, c, 'grass')) put(r, c, 'water');

  // 8. Dense trees at edges
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!is(r, c, 'grass')) continue;
      const edge = Math.min(r, c, ROWS - 1 - r, COLS - 1 - c);
      if      (edge === 0 && rng() < 0.88) put(r, c, 'tree');
      else if (edge === 1 && rng() < 0.65) put(r, c, rng() < 0.8 ? 'tree' : 'bush');
      else if (edge === 2 && rng() < 0.28) put(r, c, rng() < 0.7 ? 'tree' : 'bush');
    }
  }

  // 9. Scattered nature on remaining open grass
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!is(r, c, 'grass')) continue;
      const roll = rng();
      if      (roll < 0.06) put(r, c, 'tree');
      else if (roll < 0.10) put(r, c, 'bush');
      else if (roll < 0.18) put(r, c, 'flower');
    }
  }

  return map;
}
