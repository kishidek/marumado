import * as THREE from 'three';

/**
 * Short, cheap reactions on the plant after an answer:
 * - "water": droplets fall into the pot
 * - "sparkle": motes of light rise through the leaves
 * plus a small "perk up" sway of the whole plant. Everything is time-based and stops by itself,
 * so the page goes back to rendering on demand.
 */
export type Cheer = 'water' | 'sparkle';

const DROPS = 26;
const MOTES = 26;
const DURATION = 1.8; // s

interface Target {
  group: THREE.Object3D;
  height: number;
  potRadius: number;
}

export function createFeedback(scene: THREE.Scene) {
  const dropMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#5fa8e8', transparent: true, opacity: 0.9, depthWrite: false }),
    DROPS,
  );
  dropMesh.frustumCulled = false;
  dropMesh.visible = false;
  scene.add(dropMesh);

  const motePositions = new Float32Array(MOTES * 3);
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({
    map: softDot(),
    color: '#f2b93b',
    size: 0.012,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  motes.visible = false;
  scene.add(motes);

  let t = -1;
  let kind: Cheer = 'sparkle';
  /** Read on every frame: the plant may be rebuilt mid-effect (its health is animating too). */
  let getTarget: () => Target | null = () => null;
  let last: THREE.Object3D | null = null;
  const seeds = Array.from({ length: Math.max(DROPS, MOTES) }, (_, i) => ({
    a: (i * 2.39996) % (Math.PI * 2),
    r: ((i * 0.6180339) % 1) * 0.8 + 0.1,
    delay: ((i * 0.37) % 1) * 0.6,
    speed: 0.7 + ((i * 0.53) % 1) * 0.6,
  }));
  const m = new THREE.Matrix4();

  return {
    play(k: Cheer, plant: () => Target | null) {
      kind = k;
      getTarget = plant;
      t = 0;
      dropMesh.visible = k === 'water';
      motes.visible = k === 'sparkle';
    },
    /** Advances the effect; returns true while something is still moving. */
    update(dt: number): boolean {
      const target = getTarget();
      if (t < 0 || !target) return false;
      t += dt;
      const { group, height, potRadius } = target;
      if (last && last !== group) last.rotation.z = 0;
      last = group;
      const base = group.position;
      const soil = potRadius * 0.95;

      // Perk up: a decaying sway and a tiny lift.
      const k = Math.exp(-t * 3);
      group.rotation.z = 0.035 * Math.sin(t * 11) * k;
      group.scale.setScalar(1 + 0.025 * Math.sin(Math.min(t, 0.6) * Math.PI / 0.6) * (t < 0.6 ? 1 : 0));

      if (kind === 'water') {
        for (let i = 0; i < DROPS; i++) {
          const s = seeds[i]!;
          const local = Math.max(0, t - s.delay);
          const y = height + 0.12 - 0.5 * 1.6 * s.speed * local * local;
          const visible = local > 0 && y > soil;
          const r = s.r * potRadius * 0.75;
          const size = visible ? Math.max(0.006, potRadius * 0.085) : 0;
          m.makeScale(size * 0.65, size * 1.4, size * 0.65).setPosition(base.x + Math.cos(s.a) * r, base.y + y, base.z + Math.sin(s.a) * r);
          dropMesh.setMatrixAt(i, m);
        }
        dropMesh.instanceMatrix.needsUpdate = true;
      } else {
        for (let i = 0; i < MOTES; i++) {
          const s = seeds[i]!;
          const local = Math.max(0, t - s.delay);
          const r = s.r * Math.max(potRadius, height * 0.45);
          motePositions[i * 3] = base.x + Math.cos(s.a + local * 0.8) * r;
          motePositions[i * 3 + 1] = base.y + soil + (height - soil) * (0.3 + 0.5 * s.r) + local * 0.12 * s.speed;
          motePositions[i * 3 + 2] = base.z + Math.sin(s.a + local * 0.8) * r;
        }
        moteGeo.attributes.position!.needsUpdate = true;
        moteMat.size = Math.max(0.02, height * 0.09);
        moteMat.opacity = Math.sin(Math.min(1, t / DURATION) * Math.PI) * 0.95;
      }

      if (t >= DURATION) {
        t = -1;
        dropMesh.visible = motes.visible = false;
        group.rotation.z = 0;
        group.scale.setScalar(1);
        return true; // one last frame to clear
      }
      return true;
    },
  };
}

/** Round, soft-edged sprite so points read as glints, not squares. */
function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
