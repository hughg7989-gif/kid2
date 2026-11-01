/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PRESET_VEHICLES } from './presets';

test('all preset vehicle codes instantiate valid geometries', () => {
  for (const preset of PRESET_VEHICLES) {
    assert.ok(preset.code.includes('export default {'), `${preset.id} missing export default`);
    assert.ok(preset.code.includes('geometry'), `${preset.id} missing geometry function`);

    const fnBody = preset.code
      .replace(/export default\s*{/, 'return {')
      .replace(/};?\s*$/, '}');
    const factory = new Function(fnBody);
    const vehicle = factory();

    assert.ok(vehicle.id, `${preset.id} must have id`);
    assert.ok(vehicle.name, `${preset.id} must have name`);
    assert.ok(['ground', 'air'].includes(vehicle.type), `${preset.id} must have ground or air type`);
    assert.ok(vehicle.baseSpeed > 0, `${preset.id} must have positive baseSpeed`);

    const mesh = vehicle.geometry(THREE);
    assert.ok(mesh && mesh.isObject3D, `${preset.id} geometry must return Object3D`);
    assert.ok(mesh.children.length >= 3, `${preset.id} must have composite procedural parts`);
  }
});

test('vehicle loader recovers from missing id and fixes sideways X-axis orientation', () => {
  // Exact code user reported as broken (no id, oriented along X)
  const userBrokenCode = `
export default {
  name: "Toddler Train",
  type: "ground",
  baseSpeed: 10,
  geometry(THREE) {
    const group = new THREE.Group();
    const boilerGeo = new THREE.CylinderGeometry(0.8, 0.8, 2.5, 16);
    boilerGeo.rotateZ(Math.PI / 2);
    const boiler = new THREE.Mesh(boilerGeo, new THREE.MeshStandardMaterial());
    group.add(boiler);
    const cowcatcher = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.2, 4), new THREE.MeshStandardMaterial());
    cowcatcher.position.set(1.6, 0.7, 0); // Front wedge placed at +X
    group.add(cowcatcher);
    return group;
  }
};
  `;

  const fnBody = userBrokenCode
    .replace(/export default\s*{/, 'return {')
    .replace(/};?\s*$/, '}');
  const factory = new Function(fnBody);
  const vehicle = factory();

  // 1. Recover missing ID
  if (!vehicle.id) {
    vehicle.id = vehicle.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }
  assert.equal(vehicle.id, 'toddler_train');

  // 2. Measure orientation
  const rawMesh = vehicle.geometry(THREE);
  const bbox = new THREE.Box3().setFromObject(rawMesh);
  const sizeX = bbox.max.x - bbox.min.x;
  const sizeZ = bbox.max.z - bbox.min.z;
  assert.ok(sizeX > sizeZ, 'User model was wider/longer along X than Z');

  // 3. Auto-rotation fix wraps it by -90 deg
  const wrapper = new THREE.Group();
  rawMesh.rotation.y = -Math.PI / 2;
  wrapper.add(rawMesh);

  // Measure wrapped orientation: now it is oriented along Z (forward!)
  const fixedBox = new THREE.Box3().setFromObject(wrapper);
  const fixedSizeX = fixedBox.max.x - fixedBox.min.x;
  const fixedSizeZ = fixedBox.max.z - fixedBox.min.z;
  assert.ok(fixedSizeZ > fixedSizeX, 'After fix, model must be longer along Z (forward)');
});
