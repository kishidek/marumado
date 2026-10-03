import * as THREE from 'three';

/** Everything that changes with the local time of day. */
export interface SkyPalette {
  top: THREE.Color;
  bottom: THREE.Color;
  /** Colour distant mountains fade into (atmospheric haze). */
  haze: THREE.Color;
  /** Darkest silhouette colour (nearest ridge). */
  ink: THREE.Color;
  sunLight: THREE.Color;
  sunIntensity: number;
  ambientSky: THREE.Color;
  ambientGround: THREE.Color;
  ambientIntensity: number;
  /** Warm interior lamp, on at night. */
  lamp: number;
  stars: number;
}

interface Key {
  h: number;
  top: string;
  bottom: string;
  haze: string;
  ink: string;
  sun: string;
  sunI: number;
  amb: number;
  lamp: number;
  stars: number;
}

// Hand-picked keys over a day; values in between are interpolated, so the sky is continuous.
const KEYS: Key[] = [
  { h: 0, top: '#0a1230', bottom: '#1c2850', haze: '#25325c', ink: '#0b1024', sun: '#6d7bb0', sunI: 0.15, amb: 0.35, lamp: 1, stars: 1 },
  { h: 4.8, top: '#101a40', bottom: '#2a3462', haze: '#2f3a68', ink: '#0d1228', sun: '#6d7bb0', sunI: 0.15, amb: 0.35, lamp: 1, stars: 0.9 },
  { h: 5.8, top: '#3b4a85', bottom: '#d89a8c', haze: '#8a7ea0', ink: '#2a2440', sun: '#f2b48a', sunI: 0.6, amb: 0.6, lamp: 0.6, stars: 0.2 },
  { h: 7, top: '#6f9ad0', bottom: '#f4d2b0', haze: '#b9b8c6', ink: '#4a5468', sun: '#ffd9b0', sunI: 1.4, amb: 1.1, lamp: 0, stars: 0 },
  { h: 10, top: '#6aa6e0', bottom: '#d6ebf6', haze: '#b4cadb', ink: '#4f6474', sun: '#fff4e2', sunI: 2.0, amb: 1.5, lamp: 0, stars: 0 },
  { h: 15.5, top: '#6aa2dc', bottom: '#dbeaf2', haze: '#b6c9d6', ink: '#506270', sun: '#fff0d8', sunI: 1.9, amb: 1.45, lamp: 0, stars: 0 },
  { h: 17.3, top: '#7a95cf', bottom: '#f6c592', haze: '#c9aa9e', ink: '#4b4558', sun: '#ffc98a', sunI: 1.4, amb: 1.1, lamp: 0.1, stars: 0 },
  { h: 18.4, top: '#3c4180', bottom: '#e38a72', haze: '#8c6d86', ink: '#2c2440', sun: '#f39a6e', sunI: 0.7, amb: 0.7, lamp: 0.6, stars: 0.1 },
  { h: 19.4, top: '#1a2253', bottom: '#4a4c86', haze: '#3c3f70', ink: '#141632', sun: '#8890c8', sunI: 0.25, amb: 0.45, lamp: 1, stars: 0.6 },
  { h: 21, top: '#0c1434', bottom: '#1f2b55', haze: '#27345e', ink: '#0b1024', sun: '#6d7bb0', sunI: 0.15, amb: 0.35, lamp: 1, stars: 1 },
  { h: 24, top: '#0a1230', bottom: '#1c2850', haze: '#25325c', ink: '#0b1024', sun: '#6d7bb0', sunI: 0.15, amb: 0.35, lamp: 1, stars: 1 },
];

const c = (hex: string) => new THREE.Color(hex);

export function skyAt(hour: number): SkyPalette {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = (h - a.h) / (b.h - a.h);
  const mix = (x: string, y: string) => c(x).lerp(c(y), t);
  const num = (x: number, y: number) => x + (y - x) * t;
  const night = num(a.lamp, b.lamp);
  return {
    top: mix(a.top, b.top),
    bottom: mix(a.bottom, b.bottom),
    haze: mix(a.haze, b.haze),
    ink: mix(a.ink, b.ink),
    sunLight: mix(a.sun, b.sun),
    sunIntensity: num(a.sunI, b.sunI),
    ambientSky: c('#e4eeff').lerp(c('#5a6aa0'), night),
    ambientGround: c('#8a6f55').lerp(c('#3a2c22'), night),
    ambientIntensity: num(a.amb, b.amb),
    lamp: night,
    stars: num(a.stars, b.stars),
  };
}

/** Sun (day) or moon (night) position on an arc behind the mountains. */
export function celestialAt(hour: number): { isSun: boolean; x: number; y: number } {
  const h = ((hour % 24) + 24) % 24;
  const isSun = h >= 6 && h < 18.5;
  // Map the visible part of the arc to 0..1 (rise → set).
  const t = isSun ? (h - 6) / 12.5 : ((h - 18.5 + 24) % 24) / 11.5;
  return { isSun, x: -14 + 28 * t, y: -1.5 + 9 * Math.sin(Math.PI * t) };
}
