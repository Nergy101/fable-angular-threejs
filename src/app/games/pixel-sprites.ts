import * as THREE from 'three';

/**
 * Code-drawn pixel art, 1990 style: every sprite is a string grid, one
 * character per pixel, painted onto a tiny canvas and sampled with
 * NearestFilter so the pixels stay razor sharp when upscaled.
 */

/* ---- the palette (NES-ish hardware colors) ---- */
export const PAL: Record<string, string> = {
  k: '#0f0f0f', // black
  w: '#fcfcfc', // white
  s: '#fcb868', // skin
  g: '#3cbc3c', // tunic green
  G: '#1c7c1c', // dark green
  l: '#8cd600', // light leaf
  n: '#885020', // brown
  N: '#bc7c2c', // light brown
  e: '#9c9ca0', // stone gray
  E: '#54545c', // dark stone
  r: '#f83800', // red
  R: '#a81000', // dark red
  b: '#0058f8', // water blue
  c: '#3cbcfc', // wave cyan
  y: '#fcd838', // gold
  o: '#fc9838', // orange
  p: '#b53cfc', // purple
  P: '#7c21a8', // dark purple
  a: '#0aa30a', // grass base
  A: '#0c8f0c', // grass tuft
  d: '#fcd8a8', // sand
  D: '#e8b070', // sand fleck
  t: '#28b8a8', // rupee teal
  T: '#157f74', // rupee teal dark
};

export function pixelTexture(rows: string[]): THREE.CanvasTexture {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PAL[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ================= characters ================= */

export const HERO_DOWN = [
  '................',
  '.....gggggg.....',
  '....gggggggg....',
  '...gggggggggg...',
  '....ssssssss....',
  '....skssssks....',
  '....ssssssss....',
  '.....ssooss.....',
  '...gggggggggg...',
  '..gggggggggggg..',
  '..sggggggggggs..',
  '..sgggGGGGgggs..',
  '....gggggggg....',
  '....nn....nn....',
  '...nnn....nnn...',
  '................',
];

export const HERO_UP = [
  '................',
  '.....gggggg.....',
  '....gggggggg....',
  '...gggggggggg...',
  '....nnnnnnnn....',
  '....nnnnnnnn....',
  '....nnnnnnnn....',
  '.....nnnnnn.....',
  '...gggggggggg...',
  '..gggggggggggg..',
  '..sggggggggggs..',
  '..sgggGGGGgggs..',
  '....gggggggg....',
  '....nn....nn....',
  '...nnn....nnn...',
  '................',
];

export const HERO_SIDE = [
  '................',
  '.....gggggg.....',
  '....gggggggg....',
  '...gggggggggg...',
  '.....sssssss....',
  '.....sssksss....',
  '.....sssssss....',
  '......ssoos.....',
  '....gggggggg....',
  '...ggggggggg....',
  '...sggggggggw...',
  '...sgggGGggww...',
  '.....gggggg.....',
  '.....nn.nn......',
  '....nnn.nnn.....',
  '................',
];

export const SWORD = [
  '.......ww.......',
  '.......ww.......',
  '.......ww.......',
  '.......ww.......',
  '.......ww.......',
  '.......ww.......',
  '......nyyn......',
  '.......yy.......',
  '.......yy.......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

export const OCTOROK = [
  '................',
  '....rrrrrrrr....',
  '...rrrrrrrrrr...',
  '..rrwwrrrrwwrr..',
  '..rwkwrrrrwkwr..',
  '..rrwwrrrrwwrr..',
  '..rrrrrrrrrrrr..',
  '..rrrRrrrrRrrr..',
  '..rrrrrrrrrrrr..',
  '...RrrrrrrrrR...',
  '....rrRRRRrr....',
  '...RR..RR..RR...',
  '..RR...RR...RR..',
  '................',
  '................',
  '................',
];

export const GUARD = OCTOROK.map((row) => row.replace(/r/g, 'p').replace(/R/g, 'P'));

/* ================= tiles ================= */

export const TREE = [
  '......llll......',
  '....llGGGGll....',
  '...lGGGGGGGGl...',
  '..lGGglGGGlGGl..',
  '..GGGGGGGGGGGG..',
  '.lGGlGGGGGGlGGl.',
  '.GGGGGGglGGGGGG.',
  '.GGglGGGGGGglGG.',
  '..GGGGGGGGGGGG..',
  '...GGGGGGGGGG...',
  '....GGGnnGGG....',
  '.......nn.......',
  '......nnnn......',
  '.....nnnnnn.....',
  '....nnnnnnnn....',
  '................',
];

export const ROCK = [
  '................',
  '......eeee......',
  '....eeeeeeee....',
  '...eewweeeeee...',
  '..eewweeeeeeee..',
  '..eeeeeeeeeeEe..',
  '.eeeeeeeeeeeeEe.',
  '.eeeeeeeeeeeeEe.',
  '.eEeeeeeeeeeEEe.',
  '.eEEeeeeeeeEEEe.',
  '..EEEeeeeeEEEE..',
  '...EEEEEEEEEE...',
  '....EEEEEEEE....',
  '................',
  '................',
  '................',
];

export const GRASS = [
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaAaaaaaaaaaAaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaAaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aAaaaaaaaaaAaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaAaaaaaaaaaa',
  'aaaaaaaaaaaaaAaa',
  'aaaaaaaaaaaaaaaa',
  'aaAaaaaaaAaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaaaaaaaaa',
  'aaaaaaaaAaaaaaaa',
];

export const SAND = [
  'dddddddddddddddd',
  'dddddddddddddddd',
  'ddDdddddddddDddd',
  'dddddddddddddddd',
  'dddddddDdddddddd',
  'dddddddddddddddd',
  'ddddddddddddddDd',
  'dDdddddddddddddd',
  'dddddddddddddddd',
  'dddddDdddddddddd',
  'ddddddddddddDddd',
  'dddddddddddddddd',
  'ddDddddddDdddddd',
  'dddddddddddddddd',
  'dddddddddddddddd',
  'ddddddddDddddddd',
];

export const WATER_A = [
  'bbbbbbbbbbbbbbbb',
  'bbccbbbbbbbbbbbb',
  'bbbbbbbbbbccbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbccbbbbbbbb',
  'bbbbbbbbbbbbbbcc',
  'ccbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbccbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbccbbbbbbbbccbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbccbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbccbb',
];

/** second water frame: the same waves scrolled half a tile */
export const WATER_B = WATER_A.map((row) => row.slice(8) + row.slice(0, 8));

export const BRIDGE = [
  'nnnnnnnnnnnnnnnn',
  'NNNNNNNNNNNNNNNN',
  'nnnnnnnnnnnnnnnn',
  'nnnnnnnnnnnnnnnn',
  'NNNNNNNNNNNNNNNN',
  'nnnnnnnnnnnnnnnn',
  'kkkkkkkkkkkkkkkk',
  'NNNNNNNNNNNNNNNN',
  'nnnnnnnnnnnnnnnn',
  'NNNNNNNNNNNNNNNN',
  'kkkkkkkkkkkkkkkk',
  'nnnnnnnnnnnnnnnn',
  'NNNNNNNNNNNNNNNN',
  'nnnnnnnnnnnnnnnn',
  'nnnnnnnnnnnnnnnn',
  'NNNNNNNNNNNNNNNN',
];

/* ================= items ================= */

export const HEART = [
  '................',
  '................',
  '...rr.....rr....',
  '..rwrr...rrrr...',
  '..rwrrr.rrrrr...',
  '..rrrrrrrrrrr...',
  '..rrrrrrrrrrr...',
  '...rrrrrrrrr....',
  '....rrrrrrr.....',
  '.....rrrrr......',
  '......rrr.......',
  '.......r........',
  '................',
  '................',
  '................',
  '................',
];

export const RUPEE = [
  '................',
  '.......tt.......',
  '......tttt......',
  '.....tttttt.....',
  '.....twtttt.....',
  '.....ttttTt.....',
  '.....tttttt.....',
  '.....ttttTt.....',
  '.....tttttt.....',
  '.....tTttTt.....',
  '......tTTt......',
  '.......tt.......',
  '................',
  '................',
  '................',
  '................',
];

export const TRIFORCE = [
  '................',
  '.......yy.......',
  '......yyyy......',
  '......yoyy......',
  '.....yyyyyy.....',
  '.....yyyyoy.....',
  '....yyyyyyyy....',
  '...yy......yy...',
  '...yyy....yyy...',
  '..yyyyy..yyyyy..',
  '..yoyyy..yyyoy..',
  '.yyyyyyyyyyyyyy.',
  '.yyyoyyyyyyoyyy.',
  'yyyyyyyyyyyyyyyy',
  '................',
  '................',
];
