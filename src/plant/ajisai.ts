import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createFloretGeometry,
  createLeafGeometry,
  createPot,
  createShadowTexture,
  createTaperedTube,
} from './geometry';
import { clamp01, lerp, rnd, smoothstep } from './math';
import { glazeTexture } from '../scene/textures';

export interface AjisaiParams {
  /** Days of care (growth layer). Not capped: the plant keeps changing. */
  days: number;
  /** 0 = wilted, 1 = healthy (health layer). */
  health: number;
  seed?: number;
}

export interface AjisaiBuild {
  group: THREE.Group;
  height: number;
  /** Max horizontal distance from the pot axis. */
  spread: number;
  potRadius: number;
  stats: { stems: number; leaves: number; fallenLeaves: number; flowerHeads: number; florets: number };
  dispose(): void;
}

/** Day each stem sprouts. New stems keep arriving, so the plant fills out over the year. */
const STEM_BIRTHS = [0, 10, 24, 42, 64, 90, 125, 170, 230];
/** Days between leaf nodes on a stem. */
const NODE_INTERVAL = 7;
/** Leaf cap: each stem keeps only its top N leaf pairs; older ones fade and drop (as real hydrangeas do). */
export const VISIBLE_LEAF_PAIRS = 5;
const FLORETS_PER_HEAD = 80;
const MAX_FALLEN_LEAVES = 14;
/** So that day 0 already shows a sprout instead of bare soil. */
const SPROUT_HEAD_START = 5;
const GOLDEN_ANGLE = 2.39996;
const UP = new THREE.Vector3(0, 1, 0);

/** 0 → 1 asymptotically: fast visible change early, slower later, never fully stops. */
export const maturity = (days: number) => 1 - Math.exp(-Math.max(0, days) / 140);

/** Repotting milestones. */
export const potRadiusFor = (days: number) => (days < 40 ? 0.065 : days < 150 ? 0.095 : days < 290 ? 0.13 : 0.16);

const shadowTexture = createShadowTexture();
const materials = {
  leaf: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  floret: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
  stem: new THREE.MeshLambertMaterial({ vertexColors: true }),
  pot: new THREE.MeshPhongMaterial({ map: glazeTexture(), shininess: 80, specular: new THREE.Color('#4a4a4a') }),
  saucer: new THREE.MeshPhongMaterial({ color: '#2a3550', shininess: 60, specular: new THREE.Color('#3a3a3a') }),
  soil: new THREE.MeshLambertMaterial({ color: '#3a2a1f' }),
  shadow: new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
};
const floretGeometry = createFloretGeometry();
const coreGeometry = new THREE.IcosahedronGeometry(1, 1);

const hsl = (h: number, s: number, l: number) => new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);
const LEAF_HEALTHY = hsl(0.3, 0.5, 0.32);
const LEAF_THIRSTY = hsl(0.24, 0.32, 0.34);
const LEAF_WILTED = hsl(0.12, 0.45, 0.36);
const LEAF_EDGE = hsl(0.07, 0.5, 0.24);
const STEM_GREEN = hsl(0.27, 0.4, 0.35);
const STEM_WOOD = hsl(0.07, 0.35, 0.27);
const FLOWER_BUD = hsl(0.22, 0.35, 0.72);
const FLOWER_DRY = hsl(0.08, 0.32, 0.4);

function leafColorFor(health: number): THREE.Color {
  return health > 0.5
    ? LEAF_THIRSTY.clone().lerp(LEAF_HEALTHY, (health - 0.5) / 0.5)
    : LEAF_WILTED.clone().lerp(LEAF_THIRSTY, health / 0.5);
}

export function buildAjisai({ days, health, seed = 7 }: AjisaiParams): AjisaiBuild {
  const h = clamp01(health);
  const wilt = 1 - h;
  const d = Math.max(0, days) + SPROUT_HEAD_START;
  const mat = maturity(d);

  const group = new THREE.Group();
  const ownedGeometries: THREE.BufferGeometry[] = [];
  const instanced: THREE.InstancedMesh[] = [];

  // --- Pot, soil, contact shadow -------------------------------------------------------
  const potR = potRadiusFor(days);
  const pot = createPot(potR);
  ownedGeometries.push(pot.geometry, pot.saucer);
  group.add(new THREE.Mesh(pot.geometry, materials.pot));
  group.add(new THREE.Mesh(pot.saucer, materials.saucer));

  const soilGeo = new THREE.CircleGeometry(pot.soilRadius, 28).rotateX(-Math.PI / 2);
  ownedGeometries.push(soilGeo);
  const soil = new THREE.Mesh(soilGeo, materials.soil);
  soil.position.y = pot.soilY;
  group.add(soil);

  const shadowGeo = new THREE.PlaneGeometry(potR * 3.8, potR * 3.8).rotateX(-Math.PI / 2);
  ownedGeometries.push(shadowGeo);
  const shadow = new THREE.Mesh(shadowGeo, materials.shadow);
  shadow.position.y = 0.0015;
  shadow.renderOrder = -1;
  group.add(shadow);

  // --- Health → shared shape/colour parameters ----------------------------------------
  const leafGeo = createLeafGeometry({
    droop: 0.08 + 0.5 * Math.pow(wilt, 1.3),
    curl: Math.pow(wilt, 1.2) * 0.9,
    base: leafColorFor(h),
    edge: LEAF_EDGE,
    edgeAmount: clamp01((0.65 - h) / 0.6),
  });
  ownedGeometries.push(leafGeo);
  const stemDroop = Math.pow(wilt, 1.4);
  const dropChance = clamp01((0.4 - h) / 0.4) * 0.6;
  const leafPitchWilted = -1.05;

  const leafMatrices: THREE.Matrix4[] = [];
  const leafTints: THREE.Color[] = [];
  const fallen: { x: number; z: number; yaw: number; len: number }[] = [];
  const floretMatrices: THREE.Matrix4[] = [];
  const floretColors: THREE.Color[] = [];
  const coreMatrices: THREE.Matrix4[] = [];
  const coreColors: THREE.Color[] = [];
  const stemGeos: THREE.BufferGeometry[] = [];
  let height = pot.height;
  let spread = potR * 1.05;
  let flowerHeads = 0;

  const track = (p: THREE.Vector3, pad = 0) => {
    height = Math.max(height, p.y + pad);
    spread = Math.max(spread, Math.hypot(p.x, p.z) + pad);
  };

  STEM_BIRTHS.forEach((birth, s) => {
    if (birth > d) return;
    const age = d - birth;
    const vigor = 0.78 + 0.22 * rnd(seed, s, 1);
    const maxNodes = 3 + 6 * mat;
    const nodesF = Math.min(maxNodes, age / NODE_INTERVAL + 0.3);
    const nodeCount = Math.ceil(nodesF);
    if (nodeCount <= 0) return;

    // Internode lengths: each node elongates over its first interval.
    const internode = (0.016 + 0.026 * mat) * vigor;
    const nodeArc: number[] = [];
    let H = 0;
    for (let i = 0; i < nodeCount; i++) {
      const g = clamp01(nodesF - i);
      H += internode * (1 - (1 - g) * (1 - g));
      nodeArc.push(H);
    }
    H = Math.max(H, 0.004);

    const bloom = nodesF >= 3.5 ? smoothstep(72, 105, age) : 0;

    // Stem path: leans out from the centre, straightens when healthy,
    // arches over when thirsty (flower heads add weight).
    const theta = s * GOLDEN_ANGLE + (rnd(seed, s, 2) - 0.5) * 0.5;
    const out = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const tilt = s === 0 ? 0.05 : 0.28 + 0.34 * rnd(seed, s, 3);
    const baseR = s === 0 ? 0 : Math.min(potR * 0.55, 0.01 + 0.012 * Math.sqrt(s));
    const base = new THREE.Vector3(out.x * baseR, pot.soilY, out.z * baseR);
    const bend = stemDroop * (0.55 + 0.9 * bloom) * (0.7 + 0.3 * mat);
    const angleAt = (t: number) => tilt * (1 - 0.4 * t) + bend * Math.pow(t, 1.6) * 1.5;

    const M = 20;
    const step = H / M;
    const pts: THREE.Vector3[] = [base.clone()];
    const dirs: THREE.Vector3[] = [];
    for (let k = 0; k < M; k++) {
      const a = angleAt((k + 0.5) / M);
      const dir = out.clone().multiplyScalar(Math.sin(a)).addScaledVector(UP, Math.cos(a));
      dirs.push(dir);
      pts.push(pts[k].clone().addScaledVector(dir, step));
    }
    const sample = (arc: number) => {
      const f = Math.min(Math.max(arc / step, 0), M - 1e-6);
      const k = Math.floor(f);
      return { p: pts[k].clone().lerp(pts[k + 1], f - k), dir: dirs[k] };
    };
    pts.forEach((p) => track(p));

    const r0 = (0.0022 + 0.0065 * clamp01(age / 220)) * vigor;
    const woodiness = clamp01(age / 200);
    stemGeos.push(
      createTaperedTube(
        [0, 4, 8, 12, 16, 20].map((k) => pts[k]),
        r0,
        r0 * 0.45,
        (t, c) => c.copy(STEM_GREEN).lerp(STEM_WOOD, woodiness * Math.pow(1 - t, 1.5)).lerp(LEAF_WILTED, wilt * 0.3),
      ),
    );

    // Leaves: opposite pairs, each pair rotated 90° (decussate).
    for (let i = 0; i < nodeCount; i++) {
      const rank = nodesF - 1 - i; // 0 ≈ top pair
      if (rank >= VISIBLE_LEAF_PAIRS) continue;
      const fade = rank > VISIBLE_LEAF_PAIRS - 1 ? VISIBLE_LEAF_PAIRS - rank : 1;
      const grow = clamp01((nodesF - i) / 1.3);
      if (grow < 0.02) continue;
      const { p } = sample(nodeArc[i]);

      for (let side = 0; side < 2; side++) {
        const phi = theta + (i * Math.PI) / 2 + side * Math.PI + (rnd(seed, s, i, side, 4) - 0.5) * 0.35;
        const len =
          (0.04 + 0.08 * mat) *
          vigor *
          (0.85 + 0.3 * rnd(seed, s, i, side, 5)) *
          Math.pow(grow, 0.8) *
          fade *
          (0.86 + 0.14 * h);

        const lowBias = (rank + 1) / VISIBLE_LEAF_PAIRS;
        if (rnd(seed, s, i, side, 6) < dropChance * (0.4 + 0.8 * lowBias)) {
          if (fallen.length < MAX_FALLEN_LEAVES) {
            const rr = pot.soilRadius * 0.75 * Math.sqrt(rnd(seed, s, i, side, 7));
            const ang = rnd(seed, s, i, side, 8) * Math.PI * 2;
            fallen.push({ x: Math.cos(ang) * rr, z: Math.sin(ang) * rr, yaw: rnd(seed, s, i, side, 9) * 6.28, len: len * 0.9 });
          }
          continue;
        }

        const dh = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
        const pitchHealthy = 0.25 + 0.55 * (1 - grow) + 0.1 * rnd(seed, s, i, side, 10);
        const pitch = lerp(leafPitchWilted, pitchHealthy, smoothstep(0, 1, h));
        const F = dh.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(UP, Math.sin(pitch));
        const S = new THREE.Vector3().crossVectors(UP, F).normalize();
        const N = new THREE.Vector3().crossVectors(F, S);
        const at = p.clone().addScaledVector(dh, r0);
        leafMatrices.push(
          new THREE.Matrix4()
            .makeBasis(S.multiplyScalar(len), N.multiplyScalar(len), F.clone().multiplyScalar(len))
            .setPosition(at),
        );
        track(at.clone().addScaledVector(F, len));

        // Young leaves a touch lighter; leaves about to drop turn yellow (tint > 1 is allowed).
        const tint = new THREE.Color(1, 1, 1);
        tint.lerp(new THREE.Color(1.12, 1.18, 1.0), 1 - grow);
        tint.lerp(new THREE.Color(1.9, 1.35, 0.5), 1 - fade);
        leafTints.push(tint);
      }
    }

    // Flower head (mophead): florets on ~7/8 of a sphere, unfolding with `bloom`.
    if (bloom > 0.01) {
      flowerHeads++;
      const { p: tip, dir: tipDir } = sample(H);
      const R = (0.025 + 0.055 * mat) * vigor * (0.3 + 0.7 * bloom) * (0.85 + 0.15 * h);
      const center = tip.clone().addScaledVector(tipDir, R * 0.55);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, tipDir);
      track(center, R);

      // Darker core so gaps between florets read as depth, not as holes.
      const coreR = R * 0.9 * smoothstep(0, 0.6, bloom);
      if (coreR > 0) {
        coreMatrices.push(new THREE.Matrix4().makeScale(coreR, coreR, coreR).setPosition(center));
        const core = hsl(0.66, 0.4 * (0.35 + 0.65 * h), 0.4);
        core.lerp(FLOWER_BUD, 1 - smoothstep(0.25, 0.85, bloom)).multiplyScalar(0.7);
        core.lerp(FLOWER_DRY.clone().multiplyScalar(0.7), 1 - smoothstep(0.05, 0.45, h));
        coreColors.push(core);
      }

      for (let k = 0; k < FLORETS_PER_HEAD; k++) {
        const z = 1 - ((k + 0.5) / FLORETS_PER_HEAD) * 1.75;
        const rr = Math.sqrt(Math.max(0, 1 - z * z));
        const a = k * GOLDEN_ANGLE;
        const nrm = new THREE.Vector3(rr * Math.cos(a), z, rr * Math.sin(a)).applyQuaternion(q);
        const open = clamp01(bloom * 1.6 - rnd(seed, s, k, 11) * 0.6);
        if (open <= 0.02) continue;
        const size = R * 0.26 * (0.75 + 0.5 * rnd(seed, s, k, 12)) * (0.4 + 0.6 * open);

        const ref = Math.abs(nrm.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0);
        const X = new THREE.Vector3().crossVectors(ref, nrm).normalize();
        X.applyAxisAngle(nrm, rnd(seed, s, k, 13) * Math.PI);
        const Z = new THREE.Vector3().crossVectors(X, nrm);
        floretMatrices.push(
          new THREE.Matrix4()
            .makeBasis(X.multiplyScalar(size), nrm.clone().multiplyScalar(size), Z.multiplyScalar(size))
            .setPosition(center.clone().addScaledVector(nrm, R)),
        );

        // Kyoto blue → violet; opens from pale green; fades and browns when neglected.
        const hue = 0.62 + 0.1 * rnd(seed, s, k, 14) + 0.03 * (1 - z);
        const c = hsl(hue, 0.55 * (0.35 + 0.65 * h), (0.6 + 0.08 * z) * (0.85 + 0.15 * h));
        c.lerp(FLOWER_BUD, 1 - smoothstep(0.25, 0.85, bloom));
        c.lerp(FLOWER_DRY, 1 - smoothstep(0.05, 0.45, h));
        floretColors.push(c);
      }
    }
  });

  // Fallen leaves on the soil (only when health is poor).
  const fallenTint = new THREE.Color(1.5, 1.0, 0.6);
  for (const f of fallen) {
    const F = new THREE.Vector3(Math.cos(f.yaw), 0.35, Math.sin(f.yaw)).normalize();
    const S = new THREE.Vector3().crossVectors(UP, F).normalize();
    const N = new THREE.Vector3().crossVectors(F, S);
    leafMatrices.push(
      new THREE.Matrix4()
        .makeBasis(S.multiplyScalar(f.len), N.multiplyScalar(f.len), F.multiplyScalar(f.len))
        .setPosition(f.x, pot.soilY + 0.003, f.z),
    );
    leafTints.push(fallenTint);
  }

  // --- Assemble: 1 draw call for stems, 1 for leaves, 1 for florets --------------------
  if (stemGeos.length) {
    const merged = mergeGeometries(stemGeos);
    stemGeos.forEach((g) => g.dispose());
    ownedGeometries.push(merged);
    group.add(new THREE.Mesh(merged, materials.stem));
  }
  const addInstanced = (
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    matrices: THREE.Matrix4[],
    colors: THREE.Color[],
  ) => {
    if (!matrices.length) return;
    const mesh = new THREE.InstancedMesh(geo, material, matrices.length);
    matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, colors[i]);
    });
    mesh.computeBoundingSphere();
    instanced.push(mesh);
    group.add(mesh);
  };
  addInstanced(leafGeo, materials.leaf, leafMatrices, leafTints);
  addInstanced(coreGeometry, materials.floret, coreMatrices, coreColors);
  addInstanced(floretGeometry, materials.floret, floretMatrices, floretColors);

  return {
    group,
    height,
    spread,
    potRadius: potR,
    stats: {
      stems: STEM_BIRTHS.filter((b) => b <= d).length,
      leaves: leafMatrices.length - fallen.length,
      fallenLeaves: fallen.length,
      flowerHeads,
      florets: floretMatrices.length,
    },
    dispose() {
      ownedGeometries.forEach((g) => g.dispose());
      instanced.forEach((m) => m.dispose());
    },
  };
}
