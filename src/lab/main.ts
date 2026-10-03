import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildAjisai, VISIBLE_LEAF_PAIRS, type AjisaiBuild } from '../plant/ajisai';
import { clamp01, lerp, smoothstep } from '../plant/math';
import './style.css';

const STAGES = [
  { days: 0, label: 'Start' },
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
];
const HEALTH_PRESETS = [
  { value: 1, label: 'Healthy' },
  { value: 0.5, label: 'Thirsty' },
  { value: 0.1, label: 'Wilted' },
];

// URL params make any state linkable/screenshot-able: ?days=90&health=0.5&grid=1
const params = new URLSearchParams(location.search);
/** ?clean=1 hides the panel and centres the scene (used to render the explainer video). */
const CLEAN = params.get('clean') === '1';
if (CLEAN) document.documentElement.classList.add('clean');
const state = {
  days: Number(params.get('days') ?? 90),
  health: Number(params.get('health') ?? 1),
  grid: params.get('grid') === '1',
};

// --- Renderer, scene, camera --------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: params.has('capture') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('app')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#efe9df');

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 50);
const VIEW_DIR = new THREE.Vector3(0, 0.38, 1).normalize();
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 0.15;
controls.maxDistance = 8;
controls.autoRotateSpeed = 1.2;

scene.add(new THREE.HemisphereLight('#e4eeff', '#8a6f55', 1.6));
const sun = new THREE.DirectionalLight('#fff1dd', 2.0);
sun.position.set(1.2, 2, 1.5);
scene.add(sun);

const table = new THREE.Mesh(
  new THREE.CircleGeometry(8, 48).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ color: '#d9c6a8' }),
);
scene.add(table);

const plantRoot = new THREE.Group();
scene.add(plantRoot);

// --- Plant (re)building --------------------------------------------------------------------
type Placed = { build: AjisaiBuild; label?: string };
let placed: Placed[] = [];
let lastBuildMs = 0;

const slotWidths = new Map<number, number>();
function slotWidth(days: number) {
  if (!slotWidths.has(days)) {
    const ref = buildAjisai({ days, health: 1 });
    slotWidths.set(days, Math.max(ref.potRadius * 2.2, ref.spread * 1.7) + 0.05);
    ref.dispose();
  }
  return slotWidths.get(days)!;
}

function rebuild() {
  const t0 = performance.now();
  for (const { build } of placed) {
    plantRoot.remove(build.group);
    build.dispose();
  }
  placed = [];

  if (state.grid) {
    const builds = STAGES.map((s) => ({ build: buildAjisai({ days: s.days, health: state.health }), label: s.label }));
    // Slot widths come from the healthy plant so positions don't shift as plants wilt.
    const widths = STAGES.map((st) => slotWidth(st.days));
    let x = -widths.reduce((a, b) => a + b, 0) / 2;
    builds.forEach((p, i) => {
      p.build.group.position.x = x + widths[i] / 2;
      x += widths[i];
    });
    placed = builds;
  } else {
    placed = [{ build: buildAjisai({ days: state.days, health: state.health }) }];
  }
  placed.forEach(({ build }) => plantRoot.add(build.group));
  lastBuildMs = performance.now() - t0;
  syncLabels();
  requestRender();
}

/** Frame the camera on a box (keeps the current orbit direction unless `resetDir`). */
function fit(center: THREE.Vector3, radius: number, resetDir = false) {
  const dir = resetDir ? VIEW_DIR.clone() : camera.position.clone().sub(controls.target).normalize();
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect) * 1.05;
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(dir, dist);
  requestRender();
}

function fitToPlants(resetDir = false) {
  const box = new THREE.Box3();
  for (const { build } of placed) {
    const x = build.group.position.x;
    box.expandByPoint(new THREE.Vector3(x - build.spread, 0, -build.spread));
    box.expandByPoint(new THREE.Vector3(x + build.spread, build.height, build.spread));
  }
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  fit(sphere.center, sphere.radius * (state.grid ? (CLEAN ? 0.62 : 0.8) : 0.9), resetDir);
}

/** Fit to how big the plant will be at `days`, so a playback doesn't need re-framing. */
function fitToDays(days: number) {
  const b = buildAjisai({ days, health: 1 });
  const center = new THREE.Vector3(0, b.height / 2, 0);
  fit(center, Math.hypot(b.height / 2, b.spread) * 0.9, true);
  b.dispose();
}

// --- Labels (compare mode) -----------------------------------------------------------------
const labelsEl = document.getElementById('labels')!;
function syncLabels() {
  labelsEl.replaceChildren(
    ...placed
      .filter((p) => p.label)
      .map((p) => {
        const el = document.createElement('div');
        el.textContent = p.label!;
        return el;
      }),
  );
}
const tmp = new THREE.Vector3();
function positionLabels() {
  const els = labelsEl.children;
  placed
    .filter((p) => p.label)
    .forEach((p, i) => {
      tmp.set(p.build.group.position.x, 0, p.build.potRadius * 1.6).project(camera);
      const el = els[i] as HTMLElement;
      el.style.left = `${((tmp.x + 1) / 2) * innerWidth}px`;
      el.style.top = `${((1 - tmp.y) / 2) * innerHeight + 8}px`;
    });
}

// --- UI ------------------------------------------------------------------------------------
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const daysInput = $<HTMLInputElement>('days');
const healthInput = $<HTMLInputElement>('health');
const gridInput = $<HTMLInputElement>('grid');
const rotateInput = $<HTMLInputElement>('rotate');
const playGrowthBtn = $<HTMLButtonElement>('playGrowth');
const playNeglectBtn = $<HTMLButtonElement>('playNeglect');

function chips(containerId: string, items: { label: string }[], onPick: (i: number) => void) {
  const el = $(containerId);
  const buttons = items.map((item, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = item.label;
    b.addEventListener('click', () => onPick(i));
    return b;
  });
  el.replaceChildren(...buttons);
  return buttons;
}

const stageButtons = chips('stageChips', STAGES, (i) => {
  stopAnimations();
  state.days = STAGES[i].days;
  setGrid(false);
  rebuild();
  fitToPlants(true);
  syncUI();
});
const healthButtons = chips('healthChips', HEALTH_PRESETS, (i) => {
  stopAnimations();
  state.health = HEALTH_PRESETS[i].value;
  rebuild();
  syncUI();
});

function describeDays(d: number) {
  if (d < 30) return `day ${d}`;
  if (d < 365) return `day ${d} · ~${(d / 30).toFixed(d < 60 ? 1 : 0)} months`;
  return `day ${d} · 1 year`;
}

function syncUI() {
  daysInput.value = String(state.days);
  healthInput.value = String(Math.round(state.health * 100));
  $('daysOut').textContent = state.grid ? 'all stages' : describeDays(Math.round(state.days));
  $('healthOut').textContent = `${Math.round(state.health * 100)}%`;
  stageButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(!state.grid && STAGES[i].days === state.days)));
  healthButtons.forEach((b, i) =>
    b.setAttribute('aria-pressed', String(Math.abs(HEALTH_PRESETS[i].value - state.health) < 0.005)),
  );
  gridInput.checked = state.grid;
  daysInput.disabled = state.grid;
  playGrowthBtn.disabled = state.grid;
}

function setGrid(on: boolean) {
  state.grid = on;
}

daysInput.addEventListener('input', () => {
  stopAnimations();
  state.days = Number(daysInput.value);
  rebuild();
  syncUI();
});
healthInput.addEventListener('input', () => {
  stopAnimations();
  state.health = Number(healthInput.value) / 100;
  rebuild();
  syncUI();
});
gridInput.addEventListener('change', () => {
  stopAnimations();
  setGrid(gridInput.checked);
  rebuild();
  fitToPlants(true);
  syncUI();
});
rotateInput.addEventListener('change', () => {
  controls.autoRotate = rotateInput.checked;
  requestRender();
});

// --- Animations ----------------------------------------------------------------------------
type Anim = { start: number; duration: number; step: (t: number) => void; done?: () => void };
let anim: Anim | null = null;

function stopAnimations() {
  anim = null;
}

playGrowthBtn.addEventListener('click', () => {
  setGrid(false);
  fitToDays(365);
  anim = {
    start: performance.now(),
    duration: 14000,
    step: (t) => {
      state.days = Math.round(t * 365);
    },
  };
});

// Healthy → thirsty → wilted, hold, then recovery after "watering".
playNeglectBtn.addEventListener('click', () => {
  const from = state.health;
  anim = {
    start: performance.now(),
    duration: 8000,
    step: (t) => {
      const s = t * 8;
      state.health =
        s < 2 ? lerp(from, 0.5, smoothstep(0, 2, s))
        : s < 4 ? lerp(0.5, 0.08, smoothstep(2, 4, s))
        : s < 5 ? 0.08
        : lerp(0.08, 1, smoothstep(5, 7.5, s));
    },
  };
});

// --- Render loop (renders on demand: idle = 0 GPU work) -----------------------------------
let needsRender = true;
function requestRender() {
  needsRender = true;
}
let frames = 0;
let fpsWindowStart = performance.now();
let fps = 0;

function updateStats() {
  const s = placed.reduce(
    (acc, { build }) => {
      acc.stems += build.stats.stems;
      acc.leaves += build.stats.leaves;
      acc.fallen += build.stats.fallenLeaves;
      acc.heads += build.stats.flowerHeads;
      acc.florets += build.stats.florets;
      return acc;
    },
    { stems: 0, leaves: 0, fallen: 0, heads: 0, florets: 0 },
  );
  const single = placed.length === 1 ? placed[0].build : null;
  const rows: [string, string][] = [
    ['Triangles', renderer.info.render.triangles.toLocaleString()],
    ['Draw calls', String(renderer.info.render.calls)],
    ['Build time', `${lastBuildMs.toFixed(1)} ms`],
    ['FPS (while animating)', fps ? String(fps) : 'idle'],
    ['Stems', String(s.stems)],
    [`Leaves (cap ${VISIBLE_LEAF_PAIRS * 2}/stem)`, String(s.leaves)],
    ['Fallen leaves', String(s.fallen)],
    ['Flower heads', String(s.heads)],
    ['Florets', String(s.florets)],
  ];
  if (single) {
    rows.push(['Height', `${Math.round(single.height * 100)} cm`]);
    rows.push(['Pot Ø', `${Math.round(single.potRadius * 200)} cm`]);
  }
  $('stats').replaceChildren(
    ...rows.flatMap(([k, v]) => {
      const a = document.createElement('span');
      a.textContent = k;
      const b = document.createElement('b');
      b.textContent = v;
      return [a, b];
    }),
  );
}

function loop(now: number) {
  requestAnimationFrame(loop);

  if (anim) {
    const t = clamp01((now - anim.start) / anim.duration);
    anim.step(t);
    rebuild();
    syncUI();
    if (t >= 1) anim = null;
  }
  if (controls.update()) needsRender = true;
  if (!needsRender) {
    fps = 0;
    frames = 0;
    fpsWindowStart = now;
    return;
  }

  renderer.render(scene, camera);
  positionLabels();
  needsRender = false;

  frames++;
  if (now - fpsWindowStart > 500) {
    fps = Math.round((frames * 1000) / (now - fpsWindowStart));
    frames = 0;
    fpsWindowStart = now;
  }
  updateStats();
}

/** Shift the projection so the scene is centred in the area not covered by the side panel. */
function applyViewOffset() {
  camera.aspect = innerWidth / innerHeight;
  const panelShift = innerWidth > 640 && !CLEAN ? 156 : 0;
  camera.setViewOffset(innerWidth, innerHeight, -panelShift, 0, innerWidth, innerHeight);
  camera.updateProjectionMatrix();
}

addEventListener('resize', () => {
  applyViewOffset();
  renderer.setSize(innerWidth, innerHeight);
  requestRender();
});
applyViewOffset();

rebuild();
fitToPlants(true);
syncUI();
requestAnimationFrame(loop);
