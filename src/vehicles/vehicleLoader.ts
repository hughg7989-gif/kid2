/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { VehicleDefinition } from '../types/game';
import { PRESET_VEHICLES, RED_CAR_CODE } from './presets';

export const AI_SYSTEM_PROMPT = `You are an expert Three.js 3D vehicle generator for a modular toddler driving game. 
Generate a complete, fully valid JavaScript ES Module file according to the specifications below.

RULES:
1. Return strictly valid JavaScript ES module code starting with \`export default {\`. Do not wrap code in markdown tags if saving directly.
2. Use baseline reference speed \`baseSpeed: 10\` for normal ground vehicles. Adjust proportionally for high-speed jets (e.g., 18) or heavy excavators (e.g., 6).
3. \`type\` must be either "ground" or "air".
4. Build the vehicle visual representation strictly inside the \`geometry(THREE)\` function using THREE primitives (BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, ExtrudeGeometry, etc.).
5. Apply bright, toddler-friendly, high-contrast colors and materials.
6. Return a unified \`THREE.Group()\` object containing all components.

USER REQUEST:
[INSERT USER TEXT DESCRIPTION HERE OR ATTACH IMAGE ANALYSIS DETAILS, e.g., "Yellow construction excavator with big tread wheels and bucket arm"]`;

/**
 * Loads a vehicle definition from raw ES module JavaScript code string
 * using Dynamic Blob URL import.
 */
export async function loadVehicleFromCode(code: string): Promise<VehicleDefinition> {
  const cleanCode = code
    .replace(/^```(javascript|js)?\n?/im, '')
    .replace(/\n?```$/im, '')
    .trim();

  const blob = new Blob([cleanCode], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const module = await import(/* @vite-ignore */ blobUrl);
    const vehicle = module.default;

    if (!vehicle || typeof vehicle !== 'object') {
      throw new Error('Module must default-export an object.');
    }
    if (!vehicle.id || typeof vehicle.id !== 'string') {
      throw new Error('Vehicle must have an "id" string.');
    }
    if (!vehicle.name || typeof vehicle.name !== 'string') {
      vehicle.name = 'Custom Vehicle';
    }
    if (vehicle.type !== 'ground' && vehicle.type !== 'air') {
      vehicle.type = 'ground';
    }
    if (typeof vehicle.baseSpeed !== 'number' || vehicle.baseSpeed <= 0) {
      vehicle.baseSpeed = 10;
    }
    if (typeof vehicle.boostMultiplier !== 'number') {
      vehicle.boostMultiplier = 1.5;
    }
    if (typeof vehicle.slowMultiplier !== 'number') {
      vehicle.slowMultiplier = 0.4;
    }
    if (typeof vehicle.jumpForce !== 'number') {
      vehicle.jumpForce = 12;
    }
    if (typeof vehicle.geometry !== 'function') {
      throw new Error('Vehicle must have a "geometry(THREE)" function returning a THREE.Group.');
    }

    // Test geometry creation with Three.js to verify it renders without crashing
    const testMesh = vehicle.geometry(THREE);
    if (!testMesh || !testMesh.isObject3D) {
      throw new Error('geometry(THREE) must return a valid Three.js Object3D / Group.');
    }

    return vehicle as VehicleDefinition;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Loads the default vehicle.
 */
export async function loadDefaultVehicle(): Promise<VehicleDefinition> {
  return loadVehicleFromCode(RED_CAR_CODE);
}

/**
 * Finds a preset by ID or loads the first preset.
 */
export function getPresetCodeById(id: string): string {
  const match = PRESET_VEHICLES.find((p) => p.id === id);
  return match ? match.code : RED_CAR_CODE;
}
