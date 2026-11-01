/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { VehicleDefinition } from '../types/game';
import { PRESET_VEHICLES, RED_CAR_CODE } from './presets';

export const AI_SYSTEM_PROMPT = `You are an expert Three.js 3D vehicle generator for a modular toddler driving game. 
Generate a complete, fully valid JavaScript ES Module file according to the specifications below.

CRITICAL ORIENTATION & COORDINATE RULES:
1. Coordinate Axes:
   - +Z is FORWARD (Front of vehicle: headlights, front bumper, hood, propeller, train cowcatcher).
   - -Z is REAR / BACK (Back of vehicle: cabin, exhaust, tail lights, spoiler).
   - +X is RIGHT SIDE, -X is LEFT SIDE (Wheels and doors placed at left/right ±X, e.g. x = ±0.65).
   - +Y is UP (Ground is at y = 0, wheel centers at y ≈ 0.35, vehicle body at y ≈ 0.5 - 1.2).
   CRITICAL: DO NOT orient the vehicle along the X axis. The vehicle MUST face +Z.

REQUIRED CODE STRUCTURE:
1. Return strictly valid JavaScript ES module code starting with \`export default {\`. Do not wrap code in markdown tags if saving directly.
2. MUST include:
   - id: "unique_snake_case_id" (e.g., "toddler_train", "red_car") [REQUIRED]
   - name: "Human Friendly Name" (e.g., "Toddler Train") [REQUIRED]
   - type: "ground" or "air" [REQUIRED]
   - baseSpeed: 10 (use 8 for heavy trains/diggers, 10 for cars, 16 for jets)
   - boostMultiplier: 1.5
   - slowMultiplier: 0.4
   - jumpForce: 12
3. Build the vehicle visual representation strictly inside the \`geometry(THREE)\` function using standard THREE primitives (BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry).
4. Apply bright, toddler-friendly, high-contrast colors and materials (MeshStandardMaterial with roughness ~0.3).
5. Return a unified \`THREE.Group()\` object containing all components.

USER REQUEST:
[INSERT USER TEXT DESCRIPTION HERE, e.g., "Toddler steam train with red boiler, yellow cabin, black wheels, and front cowcatcher"]`;

/**
 * Loads a vehicle definition from raw ES module JavaScript code string
 * using Dynamic Blob URL import.
 * Automatically recovers from missing 'id' and sideways X-axis orientation!
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

    // Auto-generate missing ID from name so it never crashes on missing id
    if (!vehicle.id || typeof vehicle.id !== 'string') {
      const generated = vehicle.name && typeof vehicle.name === 'string'
        ? vehicle.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        : 'custom_vehicle';
      vehicle.id = generated || 'custom_vehicle';
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
    const rawMesh = vehicle.geometry(THREE);
    if (!rawMesh || !rawMesh.isObject3D) {
      throw new Error('geometry(THREE) must return a valid Three.js Object3D / Group.');
    }

    // Detect if the model was accidentally built along X axis instead of Z
    // (e.g. if length along X is > 1.25x width along Z)
    const bbox = new THREE.Box3().setFromObject(rawMesh);
    const sizeX = bbox.max.x - bbox.min.x;
    const sizeZ = bbox.max.z - bbox.min.z;
    const isSidewaysAlongX = sizeX > sizeZ * 1.25;

    if (isSidewaysAlongX) {
      // Auto-wrap the geometry function with a 90-degree yaw rotation
      // so +X (front cowcatcher/hood) rotates cleanly into +Z (forward)!
      const originalGeometryFn = vehicle.geometry;
      vehicle.geometry = function(threeInstance: typeof THREE) {
        const root = originalGeometryFn(threeInstance);
        const wrapper = new threeInstance.Group();
        root.rotation.y = -Math.PI / 2;
        wrapper.add(root);
        return wrapper;
      };
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
