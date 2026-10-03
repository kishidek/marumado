export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic hash → [0, 1). Keys are small integers (stem index, node index, channel…),
 * so the same leaf always gets the same random values no matter how many days have passed.
 * That keeps growth continuous: nothing reshuffles between day 41 and day 42.
 */
export function rnd(...keys: number[]): number {
  let h = 0x811c9dc5;
  for (const k of keys) {
    h = Math.imul(h ^ (k | 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
