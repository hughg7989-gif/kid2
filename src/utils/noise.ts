/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Fast, deterministic 2D Perlin-like gradient noise generator.
 * Zero-dependency, purely mathematical.
 */
function pseudoRandom(x: number, z: number): number {
  const sin = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453123;
  return sin - Math.floor(sin);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function perlin2D(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;

  const dx = x - x0;
  const dz = z - z0;

  const sx = smoothstep(dx);
  const sz = smoothstep(dz);

  const n00 = pseudoRandom(x0, z0);
  const n10 = pseudoRandom(x1, z0);
  const n01 = pseudoRandom(x0, z1);
  const n11 = pseudoRandom(x1, z1);

  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;

  return nx0 * (1 - sz) + nx1 * sz;
}

/**
 * Fractal Brownian Motion for rich, gentle rolling terrain.
 */
export function getTerrainHeight(x: number, z: number): number {
  // Low frequency rolling hills (safe and gentle for toddlers)
  const h1 = perlin2D(x * 0.015, z * 0.015) * 4.5;
  const h2 = perlin2D(x * 0.04, z * 0.04) * 1.5;

  // Flatten area along the main winding road
  const roadDist = getDistanceToRoad(x, z);
  const roadFlatten = Math.min(1, Math.max(0, roadDist / 8));

  // Base elevation is slightly undulating, smoothed near roads
  const rawH = (h1 + h2) * roadFlatten;
  return Math.max(0, rawH);
}

/**
 * Winding cartoon road path: road center X coordinate for any given Z.
 */
export function getRoadCenterX(z: number): number {
  return Math.sin(z * 0.02) * 20 + Math.sin(z * 0.007) * 40;
}

/**
 * Distance from any (x, z) to the nearest road center.
 */
export function getDistanceToRoad(x: number, z: number): number {
  const roadX = getRoadCenterX(z);
  return Math.abs(x - roadX);
}

/**
 * Calculate ground normal at (x, z) using finite differences.
 */
export function getGroundNormal(
  x: number,
  z: number,
  delta = 0.5
): { nx: number; ny: number; nz: number } {
  const hL = getTerrainHeight(x - delta, z);
  const hR = getTerrainHeight(x + delta, z);
  const hD = getTerrainHeight(x, z - delta);
  const hU = getTerrainHeight(x, z + delta);

  // Gradient vectors
  const dx = (hR - hL) / (2 * delta);
  const dz = (hU - hD) / (2 * delta);

  // Normal is normalized (-dx, 1, -dz)
  const len = Math.hypot(-dx, 1, -dz);
  return {
    nx: -dx / len,
    ny: 1 / len,
    nz: -dz / len,
  };
}

export const CHUNK_SIZE = 100; // size of each terrain chunk in world units
export const CHUNK_SEGMENTS = 24;

export function getChunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}
