import * as THREE from 'three';
import { cabinetTexture, plasterTexture, shojiTexture, woodTexture } from './textures';

/**
 * Tea-room corner after the Kyoto reference: a round window (marumado) in a plaster panel,
 * fixed shōji on both sides, a dark beam above, and a low lacquered counter with sliding
 * cabinet doors. Units are metres; counter top is y = 0, wall plane is z = 0.
 */
export const MARUMADO = { x: 0.1, y: 0.5, r: 0.42 };
export const PLANT_SPOT = new THREE.Vector3(MARUMADO.x, 0, 0.16);

const PANEL_HALF_W = 0.52;
const BEAM_Y = 1.02;
const COUNTER = { x0: -1.7, x1: 1.9, depth: 0.46, thick: 0.045, cabinetH: 0.5 };

export interface Room {
  group: THREE.Group;
  /** Paper is back-lit by the sky; the scene updates its glow per hour. */
  shoji: THREE.MeshLambertMaterial;
}

export function createRoom(): Room {
  const group = new THREE.Group();

  const plasterTex = plasterTexture();
  const plaster = (repeatX: number, repeatY: number) => {
    const map = plasterTex.clone();
    map.repeat.set(repeatX, repeatY);
    return new THREE.MeshLambertMaterial({ map });
  };
  const darkWoodTex = woodTexture('#3a271b', '#120a05', 2);
  const darkWood = new THREE.MeshLambertMaterial({ map: darkWoodTex });
  const shoji = new THREE.MeshLambertMaterial({ map: shojiTexture(), emissive: '#000000' });

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };

  // --- Plaster panel with the round window -------------------------------------------------
  const { x: cx, y: cy, r } = MARUMADO;
  const panel = new THREE.Shape();
  panel.moveTo(cx - PANEL_HALF_W, 0);
  panel.lineTo(cx + PANEL_HALF_W, 0);
  panel.lineTo(cx + PANEL_HALF_W, BEAM_Y);
  panel.lineTo(cx - PANEL_HALF_W, BEAM_Y);
  const hole = new THREE.Path();
  hole.absarc(cx, cy, r, 0, Math.PI * 2, true);
  panel.holes.push(hole);
  const panelGeo = new THREE.ShapeGeometry(panel, 64);
  remapPlanarUV(panelGeo, 1.6);
  add(panelGeo, plaster(1, 1), 0, 0, 0);

  // Depth of the opening (wall thickness), seen as a ring of plaster.
  const reveal = new THREE.CylinderGeometry(r, r, 0.07, 64, 1, true).rotateX(Math.PI / 2);
  add(reveal, new THREE.MeshLambertMaterial({ color: '#cdbfa6', side: THREE.BackSide }), cx, cy, -0.035);

  // --- Shōji either side, framed by posts ----------------------------------------------------
  const shojiW = 1.0;
  for (const side of [-1, 1]) {
    const x = cx + side * (PANEL_HALF_W + shojiW / 2 + 0.02);
    add(new THREE.PlaneGeometry(shojiW, BEAM_Y), shoji, x, BEAM_Y / 2, -0.015);
    // Inner and outer posts.
    for (const px of [cx + side * (PANEL_HALF_W + 0.01), cx + side * (PANEL_HALF_W + shojiW + 0.04)]) {
      add(new THREE.BoxGeometry(0.04, BEAM_Y, 0.05), darkWood, px, BEAM_Y / 2, 0.005);
    }
  }

  // --- Beam (nageshi) and upper wall ---------------------------------------------------------
  add(new THREE.BoxGeometry(5, 0.07, 0.06), darkWood, cx, BEAM_Y + 0.035, 0.01);
  add(new THREE.PlaneGeometry(6, 2), plaster(5, 1.6), cx, BEAM_Y + 0.07 + 1, -0.005);
  // Plaster beyond the outer posts.
  for (const side of [-1, 1]) {
    add(new THREE.PlaneGeometry(1.4, BEAM_Y), plaster(1.2, 1), cx + side * (PANEL_HALF_W + shojiW + 0.06 + 0.7), BEAM_Y / 2, -0.005);
  }

  // --- Low counter: lacquered top + sliding cabinet doors --------------------------------------
  const width = COUNTER.x1 - COUNTER.x0;
  const midX = (COUNTER.x0 + COUNTER.x1) / 2;
  const topTex = woodTexture('#2c1d14', '#0d0704', 4, 1024, 256);
  topTex.repeat.set(2, 1);
  const top = new THREE.MeshPhongMaterial({ map: topTex, shininess: 45, specular: new THREE.Color('#3b3128') });
  add(new THREE.BoxGeometry(width, COUNTER.thick, COUNTER.depth), top, midX, -COUNTER.thick / 2, COUNTER.depth / 2 - 0.02);

  const doors = new THREE.MeshLambertMaterial({ map: cabinetTexture(4) });
  add(
    new THREE.PlaneGeometry(width - 0.06, COUNTER.cabinetH),
    doors,
    midX,
    -COUNTER.thick - COUNTER.cabinetH / 2,
    COUNTER.depth - 0.06,
  );
  // Floor (tatami tone) so the cabinet doesn't float when the screen is tall.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 4).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#b9a97a' }));
  floor.position.set(midX, -COUNTER.thick - COUNTER.cabinetH, 1.5);
  group.add(floor);

  // --- Suiseki: a viewing stone on a sand tray, to the right of the plant -------------------
  const tray = add(new THREE.CylinderGeometry(0.12, 0.125, 0.014, 40), new THREE.MeshLambertMaterial({ color: '#c3b7a2' }), 0.78, 0.007, 0.22);
  tray.scale.set(1, 1, 0.8);
  const stoneGeo = new THREE.IcosahedronGeometry(1, 2);
  const pos = stoneGeo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 1 + 0.18 * Math.sin(v.x * 4.1 + v.y * 2.3) + 0.12 * Math.sin(v.z * 5.7 - v.x * 1.9);
    v.multiplyScalar(n);
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.2; // flat base
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  stoneGeo.computeVertexNormals();
  const stone = add(stoneGeo, new THREE.MeshLambertMaterial({ color: '#57524c', flatShading: true }), 0.78, 0.034, 0.22);
  stone.scale.set(0.085, 0.055, 0.06);
  stone.rotation.y = 0.6;

  return { group, shoji };
}

/** ShapeGeometry UVs are in world units; scale them so the plaster texture tiles sensibly. */
function remapPlanarUV(geo: THREE.BufferGeometry, scale: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * scale, uv.getY(i) * scale);
}
