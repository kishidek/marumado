import * as THREE from 'three';
import type { AjisaiBuild } from '../plant/ajisai';
import { celestialAt, skyAt } from './sky';

/** Window opening, in metres. The sill top is y = 0, the wall plane is z = 0. */
const WIN_W = 1.5;
const WIN_H = 0.9;
const FRAME = 0.06;
const DEPTH = 0.16;
const PLANT_SPOT = new THREE.Vector3(0.16, 0, 0.07);

export interface WindowScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  setHour(hour: number): void;
  setPlant(build: AjisaiBuild): void;
  resize(width: number, height: number): void;
}

/** Smooth 1D value noise from a few sines: cheap, deterministic, good enough for ridgelines. */
const ridgeNoise = (x: number, seed: number) =>
  0.5 * Math.sin(x * 0.9 + seed) + 0.3 * Math.sin(x * 2.1 + seed * 1.7) + 0.2 * Math.sin(x * 4.3 + seed * 2.3);

function ridgeGeometry(width: number, height: number, seed: number, opts: { bumps?: number } = {}) {
  const shape = new THREE.Shape();
  const bottom = -10;
  shape.moveTo(-width / 2, bottom);
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const x = -width / 2 + (width * i) / steps;
    let y = height * (0.6 + 0.4 * ridgeNoise(x * 0.18, seed));
    if (opts.bumps) y += opts.bumps * Math.abs(Math.sin(x * 2.6 + seed)); // rounded tree canopies
    shape.lineTo(x, y);
  }
  shape.lineTo(width / 2, bottom);
  return new THREE.ShapeGeometry(shape);
}

/** Five-storey pagoda silhouette (a nod to Yasaka / Tō-ji). */
function pagodaGeometry() {
  const shapes: THREE.Shape[] = [];
  const rect = (x0: number, y0: number, x1: number, y1: number) => {
    const s = new THREE.Shape();
    s.moveTo(x0, y0);
    s.lineTo(x1, y0);
    s.lineTo(x1, y1);
    s.lineTo(x0, y1);
    shapes.push(s);
  };
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const body = 0.42 - i * 0.05;
    const roof = 0.78 - i * 0.07;
    rect(-body / 2, y, body / 2, y + 0.24);
    const s = new THREE.Shape(); // roof with upturned eaves
    s.moveTo(-roof / 2, y + 0.24);
    s.lineTo(roof / 2, y + 0.24);
    s.lineTo(roof / 2 - 0.08, y + 0.31);
    s.lineTo(-roof / 2 + 0.08, y + 0.31);
    shapes.push(s);
    y += 0.31;
  }
  rect(-0.015, y, 0.015, y + 0.5); // sōrin spire
  return new THREE.ShapeGeometry(shapes);
}

function shojiTexture() {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4eee2';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#7b5b41';
  ctx.lineWidth = 5;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo((w * i) / 3, 0);
    ctx.lineTo((w * i) / 3, h);
    ctx.stroke();
  }
  for (let j = 1; j < 6; j++) {
    ctx.beginPath();
    ctx.moveTo(0, (h * j) / 6);
    ctx.lineTo(w, (h * j) / 6);
    ctx.stroke();
  }
  ctx.lineWidth = 14;
  ctx.strokeRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWindowScene(): WindowScene {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 120);
  const target = new THREE.Vector3(0, 0.38, 0);

  // --- Outside (unlit materials: colours come straight from the time-of-day palette) -------
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 bottom;
      varying vec2 vUv;
      void main() {
        gl_FragColor = vec4(mix(bottom, top, smoothstep(0.35, 0.9, vUv.y)), 1.0);
        #include <colorspace_fragment>
      }`,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), skyMat);
  sky.position.set(0, 10, -45);
  scene.add(sky);

  const starPositions: number[] = [];
  for (let i = 0; i < 260; i++) {
    const r1 = Math.sin(i * 12.9898) * 43758.5453;
    const r2 = Math.sin(i * 78.233) * 12543.1234;
    starPositions.push((r1 - Math.floor(r1) - 0.5) * 70, 2 + (r2 - Math.floor(r2)) * 24, -44);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: '#fdf6e3', size: 0.12, transparent: true, depthWrite: false });
  scene.add(new THREE.Points(starGeo, starMat));

  const orbMat = new THREE.MeshBasicMaterial({ color: '#fff4e2' });
  const orb = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), orbMat);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#fff4e2', transparent: true, opacity: 0.25, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), glowMat);
  glow.position.z = -0.01;
  orb.add(glow);
  scene.add(orb);

  // Mountain layers far → near, each fading into the haze a different amount.
  const layers = [
    { geo: ridgeGeometry(110, 4.6, 1.3), z: -34, y: -3.2, haze: 0.72 },
    { geo: ridgeGeometry(80, 3.2, 4.1), z: -22, y: -3.0, haze: 0.45 },
    { geo: ridgeGeometry(50, 1.1, 7.7, { bumps: 0.35 }), z: -9, y: -2.0, haze: 0.12 },
  ].map((l) => {
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(l.geo, mat);
    mesh.position.set(0, l.y, l.z);
    scene.add(mesh);
    return { ...l, mat };
  });
  const pagoda = new THREE.Mesh(pagodaGeometry(), layers[1].mat);
  pagoda.scale.setScalar(1.35);
  pagoda.position.set(4.2, -0.75, -21.9);
  scene.add(pagoda);

  // --- Room ------------------------------------------------------------------------------
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-5, -3);
  wallShape.lineTo(5, -3);
  wallShape.lineTo(5, 4);
  wallShape.lineTo(-5, 4);
  const hole = new THREE.Path();
  hole.moveTo(-WIN_W / 2, 0);
  hole.lineTo(-WIN_W / 2, WIN_H);
  hole.lineTo(WIN_W / 2, WIN_H);
  hole.lineTo(WIN_W / 2, 0);
  wallShape.holes.push(hole);
  const wall = new THREE.Mesh(new THREE.ShapeGeometry(wallShape), new THREE.MeshLambertMaterial({ color: '#f1e8d8' }));
  scene.add(wall);

  const wood = new THREE.MeshLambertMaterial({ color: '#7d5a3f' });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = wood) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };
  // Frame: posts, lintel, and a deeper sill the plant sits on.
  box(FRAME, WIN_H + FRAME, DEPTH, -WIN_W / 2 - FRAME / 2 + 0.001, WIN_H / 2, -DEPTH / 2 + 0.01);
  box(FRAME, WIN_H + FRAME, DEPTH, WIN_W / 2 + FRAME / 2 - 0.001, WIN_H / 2, -DEPTH / 2 + 0.01);
  box(WIN_W + FRAME * 2, FRAME, DEPTH, 0, WIN_H + FRAME / 2, -DEPTH / 2 + 0.01);
  box(WIN_W + 0.34, 0.05, 0.4, 0, -0.025, 0.06, new THREE.MeshLambertMaterial({ color: '#9c7552' }));

  // Shōji panels slid to the sides.
  const shojiMat = new THREE.MeshLambertMaterial({ map: shojiTexture(), side: THREE.DoubleSide, emissive: '#000000' });
  const shojiW = WIN_W * 0.17;
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(shojiW, WIN_H), shojiMat);
    panel.position.set(side * (WIN_W / 2 - shojiW / 2), WIN_H / 2, -DEPTH + 0.03);
    scene.add(panel);
  }

  // --- Lights ----------------------------------------------------------------------------
  const ambient = new THREE.HemisphereLight('#e4eeff', '#8a6f55', 1.4);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff1dd', 2);
  sun.position.set(-1.5, 2.2, -2.5); // from outside, through the window
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#fff6ea', 0.9);
  fill.position.set(0.5, 1.2, 2.5);
  scene.add(fill);
  const lamp = new THREE.PointLight('#ffcf94', 0, 0, 2);
  lamp.position.set(-1.3, 0.75, 1.5);
  scene.add(lamp);

  let plant: AjisaiBuild | null = null;
  let size = { w: 1, h: 1 };

  function frame() {
    camera.aspect = size.w / size.h;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const plantTop = plant ? plant.height : 0.2;
    // Half the visible height at the wall plane: hug the plant, never tighter than the sill.
    let halfH = Math.max(0.36, plantTop * 0.72 + 0.12); // leave sky above the plant
    // Narrow (portrait) screens: keep at least the plant and a bit of window in view.
    halfH = Math.max(halfH, 0.42 / camera.aspect);
    const dist = halfH / tan;
    target.set(0.04, halfH - 0.09, 0);
    camera.position.set(target.x, target.y + dist * 0.1, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }

  return {
    scene,
    camera,
    setHour(hour) {
      const p = skyAt(hour);
      skyMat.uniforms.top.value.copy(p.top);
      skyMat.uniforms.bottom.value.copy(p.bottom);
      starMat.opacity = p.stars;
      for (const l of layers) l.mat.color.copy(p.ink).lerp(p.haze, l.haze);

      const o = celestialAt(hour);
      orb.position.set(o.x, o.y, -40);
      orbMat.color.set(o.isSun ? '#fff6e6' : '#f1efe6');
      glowMat.color.copy(o.isSun ? p.sunLight : new THREE.Color('#c9d2f2'));
      orb.scale.setScalar(o.isSun ? 1 : 0.6);

      ambient.color.copy(p.ambientSky);
      ambient.groundColor.copy(p.ambientGround);
      ambient.intensity = p.ambientIntensity;
      sun.color.copy(p.sunLight);
      sun.intensity = p.sunIntensity;
      fill.intensity = 0.3 + 0.9 * (1 - p.lamp);
      lamp.intensity = p.lamp * 2.6;
      // Paper is back-lit by the sky outside.
      shojiMat.emissive.copy(p.bottom).multiplyScalar(0.35 * (1 - p.lamp) + 0.05);
    },
    setPlant(build) {
      if (plant) {
        scene.remove(plant.group);
        plant.dispose();
      }
      plant = build;
      build.group.position.copy(PLANT_SPOT);
      scene.add(build.group);
      frame();
    },
    resize(width, height) {
      size = { w: width, h: height };
      frame();
    },
  };
}
