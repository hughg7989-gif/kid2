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
    // Test that the module code contains required fields
    assert.ok(preset.code.includes('export default {'), `${preset.id} missing export default`);
    assert.ok(preset.code.includes('geometry: function(THREE)'), `${preset.id} missing geometry function`);

    // Extract and run geometry function in isolated scope
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
