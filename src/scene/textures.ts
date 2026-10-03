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

/**
 * Namako-style glaze for the lathe pot. Canvas top = rim, bottom = foot.
 * Deep indigo body, pale blue "sea cucumber" drips from the rim, bare clay at the foot.
 */
export function glazeTexture() {
  const w = 512;
  const h = 256;
  return canvasTexture(w, h, (ctx) => {
    const r = prng(5);
    const body = ctx.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, '#1d2a48');
    body.addColorStop(0.5, '#253a63');
    body.addColorStop(0.9, '#1b2846');
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, w, h);

    // Drips: pale glaze pooling at the shoulder and running down.
    for (let x = 0; x < w; x += 3) {
      const len = 30 + r() * 90 + Math.sin(x * 0.05) * 25;
      const g = ctx.createLinearGradient(0, 18, 0, 18 + len);
      g.addColorStop(0, 'rgba(140, 175, 205, 0.85)');
      g.addColorStop(0.6, 'rgba(95, 135, 180, 0.45)');
      g.addColorStop(1, 'rgba(60, 95, 150, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 18, 3 + r() * 3, len);
    }
    // Speckles.
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() < 0.6 ? 'rgba(10, 15, 30, 0.35)' : 'rgba(170, 200, 230, 0.35)';
      ctx.fillRect(r() * w, r() * h * 0.9, 1.5, 1.5);
    }
    // Rim band, inside (top rows) and bare clay foot (bottom rows).
    ctx.fillStyle = '#9fbad3';
    ctx.fillRect(0, 10, w, 6);
    ctx.fillStyle = '#141c30';
    ctx.fillRect(0, 0, w, 10);
    const foot = ctx.createLinearGradient(0, h - 26, 0, h);
    foot.addColorStop(0, 'rgba(122, 88, 62, 0)');
    foot.addColorStop(0.25, '#7a583e');
    foot.addColorStop(1, '#5e432f');
    ctx.fillStyle = foot;
    ctx.fillRect(0, h - 26, w, 26);
  });
}
