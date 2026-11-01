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

test('processMotionData calculates neutral steer and speed correctly', () => {
  const result = processMotionData(
    {
      orientation: { alpha: 0, beta: 0, gamma: 0 },
      acceleration: { x: 0, y: 0, z: 9.8 },
      timestamp: 1000,
    },
    DEFAULT_CALIBRATION
  );

  assert.equal(result.steer, 0);
  assert.equal(result.pitch, 0);
  assert.equal(result.speedMultiplier, 1.0);
  assert.equal(result.isFlipped, false);
  assert.equal(result.isJumpTriggered, false);
});

test('processMotionData detects forward tilt boost and backward tilt slowdown', () => {
  // Forward tilt: beta = 25 deg
  const forwardResult = processMotionData(
    {
      orientation: { alpha: 0, beta: 25, gamma: 0 },
      acceleration: { x: 0, y: 0, z: 9.8 },
      timestamp: 1000,
    },
    DEFAULT_CALIBRATION
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
    DEFAULT_CALIBRATION
  );
  assert.ok(backResult.speedMultiplier < 1.0);
  assert.ok(backResult.speedMultiplier >= 0.4);
});

test('processMotionData detects vehicle flip when roll or pitch > 80 deg', () => {
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

  const upright = processMotionData(
    {
      orientation: { alpha: 0, beta: 30, gamma: 30 },
      acceleration: { x: 0, y: 0, z: 0 },
      timestamp: 1000,
    },
    DEFAULT_CALIBRATION
  );
  assert.equal(upright.isFlipped, false);
});

test('processMotionData detects jump on high accelerometer impulse', () => {
  const jumpResult = processMotionData(
    {
      orientation: { alpha: 0, beta: 0, gamma: 0 },
      acceleration: { x: 0, y: 0, z: 18.5 },
      timestamp: 1000,
    },
    DEFAULT_CALIBRATION
  );
  assert.equal(jumpResult.isJumpTriggered, true);
});

test('encodePreset and decodePreset roundtrip calibration settings correctly', () => {
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
});
