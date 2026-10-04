/**
 * Garden previews for plans/002-garden.md (no engine involved). Look days: the potted plant's
 * full look is 365 (reached at 6 months of care); garden plants keep growing past it.
 *   ?scene=stage&stage=1|2|3   moving day / ~2 years (4 in the garden) / ~5 years (8)
 *   ?scene=growth             one garden plant over 5 years
 *   ?scene=styles             generation styles (flowers · leaves · pot)
 * Optional &hour=0–24.
 */
import * as THREE from 'three';
import { buildAjisai, FIRST_STYLE, LEAF_GREENS, type AjisaiBuild, type PlantStyle } from '../plant/ajisai';
import { GLAZES } from '../scene/textures';
import { createWindowScene } from '../scene/window-scene';

const params = new URLSearchParams(location.search);
const hour = Number(params.get('hour') ?? 11);
const FULL = 365;
const HALF_YEAR = 365; // garden growth per 6 months of care, in look days

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const caption = document.getElementById('caption')!;
const labelsEl = document.getElementById('labels')!;

const FLOWERS = ['blue', 'pink', 'violet', 'white'] as const;
const styleOf = (gen: number): PlantStyle => (gen === 0 ? FIRST_STYLE : { flowers: FLOWERS[gen % 4]!, leaves: gen % LEAF_GREENS.length, pot: gen % GLAZES.length });
const gardenPlant = (look: number, style: PlantStyle, seed: number) => buildAjisai({ days: look, health: 1, style, potted: false, detail: 'low', seed });

function stage(n: string) {
  const st = { '1': { label: 'moving day', inGarden: 1, potLook: 0 }, '2': { label: '~2 years, 4 in the garden', inGarden: 4, potLook: 180 }, '3': { label: '~5 years, 8 in the garden', inGarden: 8, potLook: 365 } }[n]!;
  const view = createWindowScene();
  view.setHour(hour);
  view.setPlant(buildAjisai({ days: st.potLook, health: 1, style: styleOf(st.inGarden), seed: 7 + st.inGarden * 13 }), st.potLook);
  // Generation 0 moved first, so it has grown the longest.
  view.setGarden(Array.from({ length: st.inGarden }, (_, gen) => ({ build: gardenPlant(FULL + (st.inGarden - 1 - gen) * HALF_YEAR, styleOf(gen), 7 + gen * 13), slot: gen })));
  view.resize(innerWidth, innerHeight);
  caption.textContent = `Garden · ${st.label}`;
  renderer.render(view.scene, view.camera);
}

/** Neutral row of plants with labels (growth and style comparisons). */
function row(title: string, ground: string, items: { build: AjisaiBuild; label: string }[]) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#efe9df');
  scene.add(new THREE.HemisphereLight('#e4eeff', '#8a6f55', 1.6));
  const sun = new THREE.DirectionalLight('#fff1dd', 2);
  sun.position.set(1.2, 2.5, 2);
  scene.add(sun);
  scene.add(new THREE.Mesh(new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: ground })));
  const widths = items.map((i) => Math.max(0.35, i.build.spread * 2.1));
  const total = widths.reduce((a, b) => a + b, 0);
  let x = -total / 2;
  items.forEach((it, i) => {
    it.build.group.position.x = x + widths[i]! / 2;
    scene.add(it.build.group);
    x += widths[i]!;
  });
  const maxH = Math.max(...items.map((i) => i.build.height));
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 100);
  const dist = (Math.max(total / 2 / (innerWidth / innerHeight), maxH) * 1.15) / Math.tan(THREE.MathUtils.degToRad(16));
  camera.position.set(0, maxH * 0.55 + dist * 0.28, dist);
  camera.lookAt(0, maxH * 0.42, 0);
  caption.textContent = title;
  renderer.render(scene, camera);
  items.forEach((it) => {
    const p = new THREE.Vector3(it.build.group.position.x, 0, it.build.spread * 0.6).project(camera);
    const el = Object.assign(document.createElement('div'), { textContent: it.label });
    el.style.left = `${((p.x + 1) / 2) * innerWidth}px`;
    el.style.top = `${((1 - p.y) / 2) * innerHeight + 10}px`;
    labelsEl.append(el);
  });
}

switch (params.get('scene') ?? 'stage') {
  case 'growth':
    row('In the garden it keeps growing, more and more slowly', '#7c8a5a', [
      { build: gardenPlant(FULL, FIRST_STYLE, 7), label: 'Moving day' },
      { build: gardenPlant(FULL + HALF_YEAR, FIRST_STYLE, 7), label: '+6 months' },
      { build: gardenPlant(FULL + HALF_YEAR * 4, FIRST_STYLE, 7), label: '+2 years' },
      { build: gardenPlant(FULL + HALF_YEAR * 10, FIRST_STYLE, 7), label: '+5 years' },
    ]);
    break;
  case 'styles':
    row(
      'Generation styles: flowers (your choice) · leaves · pot',
      '#d9c6a8',
      GLAZES.map((g, i) => ({
        build: buildAjisai({ days: FULL, health: 1, style: { flowers: FLOWERS[i % 4]!, leaves: i % LEAF_GREENS.length, pot: i }, seed: 7 + i * 13 }),
        label: `${FLOWERS[i % 4]} · ${LEAF_GREENS[i % LEAF_GREENS.length]!.name} · ${g.name}`,
      })),
    );
    break;
  default:
    stage(params.get('stage') ?? '1');
}
document.body.dataset.ready = '1';
