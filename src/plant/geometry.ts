import * as THREE from 'three';
import { clamp01 } from './math';

/** Ovate hydrangea blade on a short petiole; returns half-width at u (0 = base, 1 = tip). */
function leafHalfWidth(u: number): number {
  const petiole = 0.018;
  if (u < 0.1) return petiole;
  const s = (u - 0.1) / 0.9;
  return Math.max(petiole * (1 - s * 5), 0.36 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.75)), 0.85));
}

export interface LeafShape {
  /** How much the blade bends down along its length (0 = flat). */
  droop: number;
  /** 0 = cupped upward (healthy), 1 = edges rolled down (wilted). */
  curl: number;
  base: THREE.Color;
  edge: THREE.Color;
  /** 0 = no browning, 1 = brown creeps in from edges and tip. */
  edgeAmount: number;
}

/**
 * Unit-length leaf (base at origin, tip at +Z, face normal ~+Y). One geometry is shared by
 * every leaf instance, and since health is plant-wide it is rebuilt only when health changes.
 */
export function createLeafGeometry(shape: LeafShape): THREE.BufferGeometry {
  const SL = 10;
  const SW = 6;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();

  for (let i = 0; i <= SL; i++) {
    const u = i / SL;
    const w = leafHalfWidth(u) * (1 - 0.25 * shape.curl);
    for (let j = 0; j <= SW; j++) {
      const v = (j / SW) * 2 - 1;
      // Coarse serration on the rim.
      const serr = Math.abs(v) === 1 && u > 0.15 && u < 0.95 ? (i % 2 ? 1.06 : 0.97) : 1;
      const x = v * w * serr;
      let y = 0.06 * Math.sin(Math.PI * u) + (0.6 - 1.8 * shape.curl) * x * x;
      y -= shape.droop * u * u;
      const z = u * (1 - 0.15 * shape.droop);
      pos.push(x, y, z);

      const e = Math.max(v * v * (0.35 + 0.65 * u), Math.pow(u, 4));
      const brownT =
        shape.edgeAmount > 0 ? clamp01((e - (1 - shape.edgeAmount)) / Math.max(shape.edgeAmount * 0.6, 1e-3)) : 0;
      c.copy(shape.base).lerp(shape.edge, brownT);
      if (j === SW / 2) c.offsetHSL(0, -0.05, 0.05); // lighter midrib
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < SL; i++) {
    for (let j = 0; j < SW; j++) {
      const a = i * (SW + 1) + j;
      const b = a + SW + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Four-sepal hydrangea floret, unit radius, lying in XZ with normal +Y, slightly cupped. */
export function createFloretGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const SEG = 6;
  for (let p = 0; p < 4; p++) {
    const a = (p * Math.PI) / 2 + Math.PI / 4;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const cx = ca * 0.5;
    const cz = sa * 0.5;
    const center = pos.length / 3;
    pos.push(cx, 0.18 * 0.25, cz);
    for (let j = 0; j < SEG; j++) {
      const t = (j / SEG) * Math.PI * 2;
      const lx = Math.cos(t) * 0.5;
      const lz = Math.sin(t) * 0.36;
      const x = cx + lx * ca - lz * sa;
      const z = cz + lx * sa + lz * ca;
      pos.push(x, 0.18 * (x * x + z * z), z);
    }
    for (let j = 0; j < SEG; j++) idx.push(center, center + 1 + ((j + 1) % SEG), center + 1 + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Tube along a smooth curve whose radius tapers from r0 to r1, with per-ring vertex colors. */
export function createTaperedTube(
  points: THREE.Vector3[],
  r0: number,
  r1: number,
  colorAt: (t: number, out: THREE.Color) => void,
  tubular = 12,
  radial = 5,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const c = new THREE.Color();

  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, p);
    const r = r0 + (r1 - r0) * t;
    const N = frames.normals[i];
    const B = frames.binormals[i];
    colorAt(t, c);
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      const s = Math.sin(v);
      const k = -Math.cos(v);
      n.set(k * N.x + s * B.x, k * N.y + s * B.y, k * N.z + s * B.z).normalize();
      pos.push(p.x + r * n.x, p.y + r * n.y, p.z + r * n.z);
      nor.push(n.x, n.y, n.z);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export interface Pot {
  geometry: THREE.BufferGeometry;
  saucer: THREE.BufferGeometry;
  height: number;
  soilY: number;
  soilRadius: number;
}

/**
 * Round-bellied Japanese pot on a foot ring, standing on a shallow saucer.
 * UV v runs foot (0) → rim → inside (1), which the glaze texture relies on.
 */
export function createPot(r: number): Pot {
  const saucerH = r * 0.07;
  const h = r * 1.05;
  const base = saucerH * 0.6;
  const outline = new THREE.SplineCurve(
    [
      [0.66, 0.05],
      [0.8, 0.12],
      [0.96, 0.32],
      [1.03, 0.55],
      [1.0, 0.78],
      [0.93, 0.92],
      [0.95, 0.98],
    ].map(([x, y]) => new THREE.Vector2(r * x, h * y)),
  ).getPoints(26);
  const profile = [
    new THREE.Vector2(0, h * 0.02),
    new THREE.Vector2(r * 0.6, h * 0.02),
    new THREE.Vector2(r * 0.62, 0),
    new THREE.Vector2(r * 0.68, 0),
    ...outline,
    new THREE.Vector2(r * 1.0, h), // lip
    new THREE.Vector2(r * 0.97, h * 1.01),
    new THREE.Vector2(r * 0.9, h * 0.97),
    new THREE.Vector2(r * 0.88, h * 0.86),
  ].map((v) => new THREE.Vector2(v.x, v.y + base));

  const saucer = new THREE.LatheGeometry(
    [
      [0, 0],
      [r * 0.92, 0],
      [r * 0.99, saucerH * 0.4],
      [r * 1.03, saucerH],
      [r * 0.98, saucerH],
      [r * 0.9, saucerH * 0.45],
      [0, saucerH * 0.45],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    40,
  );

  return {
    geometry: new THREE.LatheGeometry(profile, 40),
    saucer,
    height: h + base,
    soilY: base + h * 0.9,
    soilRadius: r * 0.9,
  };
}

/** Soft radial blob used as a fake contact shadow (no shadow maps = cheaper). */
export function createShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(60, 42, 25, 0.38)');
  g.addColorStop(0.55, 'rgba(60, 42, 25, 0.16)');
  g.addColorStop(1, 'rgba(60, 42, 25, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
