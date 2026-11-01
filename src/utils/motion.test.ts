/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CALIBRATION,
  applyDeadzone,
  decodePreset,
  encodePreset,
  normalizeAngleDeg,
  processMotionData,
} from './motion';

test('normalizeAngleDeg wraps angles within [-180, 180)', () => {
  assert.equal(normalizeAngleDeg(0), 0);
  assert.equal(normalizeAngleDeg(180), -180);
  assert.equal(normalizeAngleDeg(360), 0);
  assert.equal(normalizeAngleDeg(720), 0);
  assert.equal(normalizeAngleDeg(-270), 90);
  assert.equal(normalizeAngleDeg(270), -90);
});

test('applyDeadzone suppresses small angles below threshold', () => {
  assert.equal(applyDeadzone(0, 5), 0);
  assert.equal(applyDeadzone(4.9, 5), 0);
  assert.equal(applyDeadzone(-4.9, 5), 0);
  assert.equal(applyDeadzone(10, 5), 5);
  assert.equal(applyDeadzone(-10, 5), -5);
});

test('processMotionData in Flat Toy Car (Yaw) mode steers strictly by Z-axis rotation', () => {
  // Neutral forward
  const neutral = processMotionData(
    {
      orientation: { alpha: 0, beta: 0, gamma: 0 },
      acceleration: { x: 0, y: 0, z: 9.8 },
      timestamp: 1000,
    },
    { ...DEFAULT_CALIBRATION, steeringMode: 'yaw' }
  );
  assert.equal(neutral.steer, 0);
  assert.equal(neutral.pitch, 0);
  assert.equal(neutral.speedMultiplier, 1.0);

  // Turn physical toy car left on floor (alpha = -20 deg)
  const turnLeft = processMotionData(
    {
      orientation: { alpha: -20, beta: 5, gamma: -3 }, // slight pitch/roll from carpet
      acceleration: { x: 0, y: 0, z: 9.8 },
      timestamp: 1000,
    },
    { ...DEFAULT_CALIBRATION, steeringMode: 'yaw' }
  );
  assert.ok(turnLeft.steer < 0, 'Left turn must produce negative steer');
  assert.equal(turnLeft.pitch, 0, 'Pitch must be ignored in yaw mode');
  assert.equal(turnLeft.speedMultiplier, 1.0, 'Pitch must not alter speed in yaw mode');

  // Turn physical toy car right on floor (alpha = +20 deg)
  const turnRight = processMotionData(
    {
      orientation: { alpha: 20, beta: -6, gamma: 4 },
      acceleration: { x: 0, y: 0, z: 9.8 },
      timestamp: 1000,
    },
    { ...DEFAULT_CALIBRATION, steeringMode: 'yaw' }
  );
  assert.ok(turnRight.steer > 0, 'Right turn must produce positive steer');
  assert.equal(turnRight.pitch, 0);
  assert.equal(turnRight.speedMultiplier, 1.0);
});

test('processMotionData in Tilt mode detects pitch boost and slowdown', () => {
  const tiltCal = { ...DEFAULT_CALIBRATION, steeringMode: 'tilt' as const };

  // Forward tilt: beta = 25 deg
  const forwardResult = processMotionData(
    {
      orientation: { alpha: 0, beta: 25, gamma: 0 },
      acceleration: { x: 0, y: 0, z: 9.8 },
      timestamp: 1000,
    },
    tiltCal
  );
  assert.ok(forwardResult.speedMultiplier > 1.0);
  assert.ok(forwardResult.speedMultiplier <= 1.5);

  // Backward tilt: beta = -25 deg
  const backResult = processMotionData(
    {
      orientation: { alpha: 0, beta: -25, gamma: 0 },
      acceleration: { x: 0, y: 0, z: 9.8 },
      timestamp: 1000,
    },
    tiltCal
  );
  assert.ok(backResult.speedMultiplier < 1.0);
  assert.ok(backResult.speedMultiplier >= 0.4);
});

test('processMotionData detects vehicle flip when roll or pitch > 80 deg in all modes', () => {
  const flippedRoll = processMotionData(
    {
      orientation: { alpha: 0, beta: 0, gamma: 85 },
      acceleration: { x: 0, y: 0, z: 0 },
      timestamp: 1000,
    },
    DEFAULT_CALIBRATION
  );
  assert.equal(flippedRoll.isFlipped, true);

  const flippedPitch = processMotionData(
    {
      orientation: { alpha: 0, beta: -85, gamma: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      timestamp: 1000,
    },
    DEFAULT_CALIBRATION
  );
  assert.equal(flippedPitch.isFlipped, true);
});

test('encodePreset and decodePreset roundtrip calibration settings with steeringMode', () => {
  const original = {
    centerAlpha: 45,
    centerBeta: 12,
    centerGamma: -8,
    invertPitch: true,
    invertRoll: false,
    invertYaw: true,
    deadzone: 6,
    sensitivity: 1.5,
    maxTilt: 40,
    orientationMode: 'face-down' as const,
    steeringMode: 'yaw' as const,
    yawMode: 'relative' as const,
  };

  const encoded = encodePreset(original);
  assert.ok(typeof encoded === 'string');

  const decoded = decodePreset(encoded);
  assert.equal(decoded.centerAlpha, 45);
  assert.equal(decoded.centerBeta, 12);
  assert.equal(decoded.centerGamma, -8);
  assert.equal(decoded.invertPitch, true);
  assert.equal(decoded.invertRoll, false);
  assert.equal(decoded.invertYaw, true);
  assert.equal(decoded.deadzone, 6);
  assert.equal(decoded.sensitivity, 1.5);
  assert.equal(decoded.maxTilt, 40);
  assert.equal(decoded.orientationMode, 'face-down');
  assert.equal(decoded.steeringMode, 'yaw');
});
