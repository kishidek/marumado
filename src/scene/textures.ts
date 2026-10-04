import * as THREE from 'three';

/** Small deterministic PRNG so procedural textures look the same on every load. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void, repeat = false) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Wood grain running along X. */
export function woodTexture(base: string, grain: string, seed = 1, w = 512, h = 256) {
  return canvasTexture(
    w,
    h,
    (ctx) => {
      const r = prng(seed);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const y0 = r() * h;
        const amp = 2 + r() * 6;
        const freq = 0.004 + r() * 0.01;
        const phase = r() * 10;
        ctx.strokeStyle = grain;
        ctx.globalAlpha = 0.08 + r() * 0.22;
        ctx.lineWidth = 0.6 + r() * 2.2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase) * amp * 0.3;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    true,
  );
}

/** Pale clay plaster with a faint mottle. */
export function plasterTexture() {
  return canvasTexture(
    256,
    256,
    (ctx) => {
      const r = prng(7);
      ctx.fillStyle = '#e6d9c2';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1400; i++) {
        ctx.fillStyle = r() < 0.5 ? 'rgba(120, 95, 60, 0.05)' : 'rgba(255, 250, 240, 0.08)';
        const s = 1 + r() * 4;
        ctx.fillRect(r() * 256, r() * 256, s, s);
      }
    },
    true,
  );
}

/** Shōji: fine kumiko lattice over washi paper (5 columns × 12 rows, like the reference). */
export function shojiTexture() {
  const w = 256;
  const h = 512;
  return canvasTexture(w, h, (ctx) => {
    const r = prng(3);
    ctx.fillStyle = '#f2ece0';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = 'rgba(160, 140, 110, 0.05)';
      ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1);
    }
    ctx.strokeStyle = '#5c4636';
    ctx.lineWidth = 3;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo((w * i) / 5, 0);
      ctx.lineTo((w * i) / 5, h);
      ctx.stroke();
    }
    for (let j = 1; j < 12; j++) {
      ctx.beginPath();
      ctx.moveTo(0, (h * j) / 12);
      ctx.lineTo(w, (h * j) / 12);
      ctx.stroke();
    }
    ctx.lineWidth = 12;
    ctx.strokeRect(0, 0, w, h);
  });
}

/** Front of the low cabinet: sliding wooden doors with recessed round pulls. */
export function cabinetTexture(doors: number) {
  const w = 1024;
  const h = 160;
  return canvasTexture(w, h, (ctx) => {
    const r = prng(11);
    ctx.fillStyle = '#7a5434';
    ctx.fillRect(0, 0, w, h);
    const dw = w / doors;
    for (let d = 0; d < doors; d++) {
      const x0 = d * dw;
      // Grain per door, slightly different tone each.
      ctx.fillStyle = `rgba(${90 + r() * 30}, ${60 + r() * 20}, ${35 + r() * 10}, 0.35)`;
      ctx.fillRect(x0, 0, dw, h);
      for (let i = 0; i < 30; i++) {
        ctx.strokeStyle = 'rgba(50, 30, 15, 0.18)';
        ctx.lineWidth = 0.5 + r() * 1.5;
        const y0 = r() * h;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x0 + dw * 0.3, y0 + (r() - 0.5) * 20, x0 + dw * 0.7, y0 + (r() - 0.5) * 20, x0 + dw, y0);
        ctx.stroke();
      }
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(x0, 0, 3, h); // gap between doors
      ctx.beginPath(); // hikite pull
      ctx.arc(x0 + (d % 2 ? 22 : dw - 22), h * 0.5, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(0, 0, w, 5);
  });
}

/** Pot glazes, one per generation (see plans/002-garden.md): index 0 is the original indigo namako. */
export interface Glaze {
  name: string;
  body: [string, string, string]; // gradient rim → middle → lower body
  drip: [string, string] | null; // pooled glaze running down from the shoulder
  speckle: [string, string];
  rim: string;
  inside: string;
  foot: string;
  shininess: number;
  saucer: string;
}

export const GLAZES: Glaze[] = [
  { name: 'indigo namako', body: ['#1d2a48', '#253a63', '#1b2846'], drip: ['rgba(140, 175, 205, 0.85)', 'rgba(95, 135, 180, 0.45)'], speckle: ['rgba(10, 15, 30, 0.35)', 'rgba(170, 200, 230, 0.35)'], rim: '#9fbad3', inside: '#141c30', foot: '#7a583e', shininess: 80, saucer: '#2a3550' },
  { name: 'celadon', body: ['#7f9f8c', '#93b39f', '#7a9886'], drip: ['rgba(200, 222, 205, 0.7)', 'rgba(170, 200, 180, 0.35)'], speckle: ['rgba(60, 80, 70, 0.25)', 'rgba(230, 240, 232, 0.3)'], rim: '#c3d8c8', inside: '#5d7769', foot: '#8a6a50', shininess: 90, saucer: '#6f8c7b' },
  { name: 'black tenmoku', body: ['#17110e', '#22180f', '#140f0c'], drip: ['rgba(150, 82, 38, 0.85)', 'rgba(110, 58, 26, 0.4)'], speckle: ['rgba(0, 0, 0, 0.4)', 'rgba(180, 110, 60, 0.35)'], rim: '#8a4b24', inside: '#0f0b09', foot: '#6b4a33', shininess: 95, saucer: '#1e1713' },
  { name: 'white shino', body: ['#ece4d6', '#e4d9c6', '#d9cbb4'], drip: ['rgba(222, 160, 115, 0.55)', 'rgba(222, 170, 130, 0.2)'], speckle: ['rgba(120, 80, 50, 0.35)', 'rgba(255, 255, 255, 0.4)'], rim: '#d79b6f', inside: '#c9b9a1', foot: '#a07a5a', shininess: 55, saucer: '#d8ccb8' },
  { name: 'terracotta', body: ['#a8603f', '#b06a48', '#9c5638'], drip: null, speckle: ['rgba(80, 40, 20, 0.3)', 'rgba(220, 160, 120, 0.3)'], rim: '#bb7653', inside: '#6e3d27', foot: '#8e4e33', shininess: 6, saucer: '#9d5a3c' },
];

/** Glaze texture for the lathe pot. Canvas top = rim, bottom = foot. */
export function glazeTexture(variant = 0) {
  const gl = GLAZES[variant % GLAZES.length]!;
  const w = 512;
  const h = 256;
  return canvasTexture(w, h, (ctx) => {
    const r = prng(5 + variant);
    const body = ctx.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, gl.body[0]);
    body.addColorStop(0.5, gl.body[1]);
    body.addColorStop(0.9, gl.body[2]);
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, w, h);

    if (gl.drip) {
      // Drips: glaze pooling at the shoulder and running down.
      for (let x = 0; x < w; x += 3) {
        const len = 30 + r() * 90 + Math.sin(x * 0.05) * 25;
        const g = ctx.createLinearGradient(0, 18, 0, 18 + len);
        g.addColorStop(0, gl.drip[0]);
        g.addColorStop(0.6, gl.drip[1]);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, 18, 3 + r() * 3, len);
      }
    }
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() < 0.6 ? gl.speckle[0] : gl.speckle[1];
      ctx.fillRect(r() * w, r() * h * 0.9, 1.5, 1.5);
    }
    // Rim band, inside (top rows) and bare clay foot (bottom rows).
    ctx.fillStyle = gl.rim;
    ctx.fillRect(0, 10, w, 6);
    ctx.fillStyle = gl.inside;
    ctx.fillRect(0, 0, w, 10);
    const foot = ctx.createLinearGradient(0, h - 26, 0, h);
    foot.addColorStop(0, 'rgba(0, 0, 0, 0)');
    foot.addColorStop(0.25, gl.foot);
    foot.addColorStop(1, gl.foot);
    ctx.fillStyle = foot;
    ctx.fillRect(0, h - 26, w, 26);
  });
}

/** Soft disc of soil and moss where a garden plant meets the ground. */
export function moundTexture() {
  return canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(58, 44, 30, 0.95)');
    g.addColorStop(0.55, 'rgba(62, 70, 40, 0.75)');
    g.addColorStop(1, 'rgba(62, 70, 40, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}
