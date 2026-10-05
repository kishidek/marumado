import * as THREE from 'three';
import type { AjisaiBuild } from '../plant/ajisai';
import type { SkyPalette } from './sky';

/**
 * The garden seen through the round window (plans/002-garden.md): a terraced Japanese garden
 * with moss, stone walls, stepping stones, a lantern and a clipped hedge, below the counter,
 * ≈ 1–9 m out. Graduated plants stand on raised slots, visible above the potted plant.
 */
interface LayoutSpec {
  /** Ground height relative to the counter top (m). */
  y: number;
  terrain: Terrain;
  /** Centre-out: the first plant on top of the hill, then left / right alternating. */
  slots: { x: number; z: number }[];
  stones: [number, number][];
  lantern: [number, number];
}

/**
 * Terraced Japanese garden: a front lawn, two stone-walled terraces that rise toward a central
 * artificial hill (tsukiyama), and side mounds. Terrace edges wave so they don't look ruled.
 * Plants stand on raised ground, above the line of sight of the potted plant on the counter.
 */
interface Terrain {
  height(x: number, z: number): number;
  /** Retaining-wall lines: for each, z of the edge as a function of x, and how tall it is. */
  walls: { edge: (x: number) => number; rise: number }[];
}

const step = (v: number, edge: number, width: number) => {
  const t = Math.min(1, Math.max(0, (v - edge) / width + 0.5));
  return t * t * (3 - 2 * t);
};
const mound = (x: number, z: number, cx: number, cz: number, r: number, h: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));

const edge1 = (x: number) => -2.55 + 0.25 * Math.sin(x * 0.8 + 0.6);
const edge2 = (x: number) => -3.95 + 0.3 * Math.sin(x * 0.65 + 2.1);
const TERRACED: Terrain = {
  height(x, z) {
    let h = 0.2 * step(-z, -edge1(x), 0.1) + 0.2 * step(-z, -edge2(x), 0.1);
    h += mound(x, z, 0.15, -5.4, 1.7, 0.34); // tsukiyama behind the centre
    h += mound(x, z, -2.3, -4.6, 1.2, 0.22); // left mound
    h += mound(x, z, 2.5, -4.9, 1.3, 0.24); // right mound
    h += mound(x, z, 0.2, -7.6, 3.2, 0.1); // gentle rise to the hedge
    return h;
  },
  walls: [
    { edge: edge1, rise: 0.2 },
    { edge: edge2, rise: 0.2 },
  ],
};

/**
 * Validated in the lab (2026-10-05): five layouts were compared (flat path, slope, crown, open
 * shōji, bigger window); the terraced garden with centre-out slots won. See plans/002-garden.md.
 */
const SPEC: LayoutSpec = {
    y: -0.5,
    terrain: TERRACED,
    slots: [
      { x: 0.15, z: -4.9 }, // 1: top of the central hill
      { x: -1.05, z: -3.4 }, // 2: middle terrace, left
      { x: 1.25, z: -3.5 }, // 3: middle terrace, right
      { x: -2.2, z: -4.6 }, // 4: left mound
      { x: 2.45, z: -4.9 }, // 5: right mound
      { x: -0.9, z: -5.6 }, // 6: hill, left shoulder
      { x: 1.2, z: -5.8 }, // 7: hill, right shoulder
      { x: -2.6, z: -2.4 }, // 8: front lawn, far left
    ],
    stones: [[-0.15, -1.7], [0.15, -2.2], [-0.05, -3.0], [0.2, -3.5]],
    lantern: [-1.85, -6.3], // back-left: clear of every plant slot (bug #28)
};


function noiseTexture(base: string, dots: string[], size = 256, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * 6; i++) {
    ctx.fillStyle = dots[i % dots.length]!;
    const r = 1 + rand() * 3;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

function rakedGravelTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#cfc8b8';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = 'rgba(120, 110, 95, 0.35)';
  ctx.lineWidth = 2;
  for (let y = 4; y < 64; y += 8) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05) * 1.5);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 1);
  return tex;
}

function stone(radius: number, flat: number, seed: number, mat: THREE.Material) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + 0.15 * Math.sin(v.x * 3.1 + seed) + 0.1 * Math.sin(v.z * 4.3 - seed));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(radius, radius * flat, radius * 0.85);
  return m;
}

/** Kasuga-style stone lantern (tōrō); its window glows at night. */
function lantern(stoneMat: THREE.Material, glowMat: THREE.Material) {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, y: number, mat = stoneMat) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    g.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(0.2, 0.24, 0.08, 6), 0.04);
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.5, 8), 0.33);
  add(new THREE.CylinderGeometry(0.17, 0.13, 0.06, 6), 0.61);
  add(new THREE.BoxGeometry(0.22, 0.2, 0.22), 0.74);
  add(new THREE.BoxGeometry(0.14, 0.12, 0.23), 0.74, glowMat);
  add(new THREE.BoxGeometry(0.23, 0.12, 0.14), 0.74, glowMat);
  add(new THREE.ConeGeometry(0.3, 0.2, 6), 0.94);
  add(new THREE.SphereGeometry(0.05, 10, 8), 1.07);
  return g;
}

export interface Garden {
  group: THREE.Group;
  /** Places garden plants on their slots (generation % 8). Builds are owned by the caller. */
  setPlants(plants: { build: AjisaiBuild; slot: number }[]): void;
  /** World position of a slot (for the move ceremony). */
  slotPosition(slot: number): THREE.Vector3;
  setHour(p: SkyPalette): void;
}

export function createGarden(): Garden {
  const spec = SPEC;
  const heightAt = (x: number, z: number) => spec.terrain.height(x, z);
    const group = new THREE.Group();
  group.position.y = spec.y;

  const moss = new THREE.MeshLambertMaterial({ map: noiseTexture('#55663a', ['#4a5a33', '#627442', '#3f4e2c', '#6b7a48'], 256, 10) });
  const groundGeo = new THREE.PlaneGeometry(18, 9.5, 120, 110).rotateX(-Math.PI / 2).translate(0, 0, -4.9);
  const gp = groundGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < gp.count; i++) gp.setY(i, heightAt(gp.getX(i), gp.getZ(i)));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, moss);
  group.add(ground);

  const gravel = new THREE.Mesh(new THREE.PlaneGeometry(18, 1.0).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: rakedGravelTexture() }));
  gravel.position.set(0, 0.004, -1.2);
  group.add(gravel);

  const stoneMat = new THREE.MeshLambertMaterial({ color: '#8b8780', flatShading: true });
  // Stepping stones run between the slots, toward the lantern.
  spec.stones.forEach(([x, z], i) => {
    const s = stone(0.24, 0.18, i * 1.7, stoneMat);
    s.position.set(x, 0.01 + heightAt(x, z), z);
    s.rotation.y = i * 0.9;
    group.add(s);
  });

  const glowMat = new THREE.MeshLambertMaterial({ color: '#d8cfc0', emissive: '#ffcf7a', emissiveIntensity: 0 });
  const toro = lantern(stoneMat, glowMat);
  toro.position.set(spec.lantern[0], heightAt(spec.lantern[0], spec.lantern[1]), spec.lantern[1]);
  group.add(toro);

  // Retaining walls (ishigaki) along each terrace edge: a row of stones, one instanced mesh.
  {
    const wallGeo = new THREE.DodecahedronGeometry(1, 0);
    const wallMat = new THREE.MeshLambertMaterial({ color: '#8a857b', flatShading: true });
    const placed: THREE.Matrix4[] = [];
    for (const w of spec.terrain.walls) {
      // Mixed sizes, slightly jittered, so the wall reads as stacked natural stone (nozura-zumi).
      for (let x = -6; x <= 6; x += 0.17) {
        const z = w.edge(x) + 0.03 * Math.sin(x * 11.7);
        const r = 0.06 + 0.04 * Math.abs(Math.sin(x * 7.3)) + 0.02 * Math.abs(Math.sin(x * 2.9));
        placed.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x, heightAt(x, z + 0.25) + w.rise * 0.4, z + 0.04),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2 * Math.sin(x * 5), x * 3.1, 0)),
            new THREE.Vector3(r * 1.4, Math.min(r * 1.1, w.rise * 0.55), r * 0.9),
          ),
        );
      }
    }
    const walls = new THREE.InstancedMesh(wallGeo, wallMat, placed.length);
    placed.forEach((mm, i) => walls.setMatrixAt(i, mm));
    group.add(walls);
  }

  // Clipped hedge along the back (karikomi), one instanced mesh.
  const hedgeGeo = new THREE.SphereGeometry(1, 14, 10);
  const hedgeMat = new THREE.MeshLambertMaterial({ color: '#2f4426' });
  const hedge = new THREE.InstancedMesh(hedgeGeo, hedgeMat, 26);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 26; i++) {
    const r = 0.45 + 0.2 * Math.abs(Math.sin(i * 1.7));
    m.makeScale(r * 1.3, r * 0.5, r).setPosition(-9 + i * 0.72, r * 0.25 + heightAt(-9 + i * 0.72, -8.4), -8.4 - 0.3 * Math.sin(i));
    hedge.setMatrixAt(i, m);
  }
  group.add(hedge);

  const plants = new THREE.Group();
  group.add(plants);

  return {
    group,
    setPlants(list) {
      plants.clear();
      for (const { build, slot } of list) {
        const p = spec.slots[slot % spec.slots.length]!;
        build.group.position.set(p.x, heightAt(p.x, p.z), p.z);
        build.group.rotation.y = slot * 1.3;
        plants.add(build.group);
      }
    },
    slotPosition(slot) {
      const p = spec.slots[slot % spec.slots.length]!;
      return new THREE.Vector3(p.x, heightAt(p.x, p.z), p.z).add(group.position);
    },
    setHour(p) {
      glowMat.emissiveIntensity = p.lamp * 1.4;
    },
  };
}
