/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDistanceToRoad,
  getGroundNormal,
  getRoadCenterX,
  getTerrainHeight,
} from './noise';

test('getTerrainHeight returns smooth positive height values', () => {
  const h0 = getTerrainHeight(0, 0);
  const h10 = getTerrainHeight(10, 20);
  assert.ok(Number.isFinite(h0));
  assert.ok(Number.isFinite(h10));
  assert.ok(h0 >= 0);
  assert.ok(h10 >= 0);
});

test('getRoadCenterX is deterministic and continuous', () => {
  const x1 = getRoadCenterX(100);
  const x2 = getRoadCenterX(100);
  assert.equal(x1, x2);

  const xNear = getRoadCenterX(100.1);
  assert.ok(Math.abs(xNear - x1) < 0.5);
});

test('getDistanceToRoad returns zero at road center', () => {
  const z = 50;
  const centerX = getRoadCenterX(z);
  const dist = getDistanceToRoad(centerX, z);
  assert.equal(dist, 0);
});

test('getGroundNormal produces normalized upward vector', () => {
  const { nx, ny, nz } = getGroundNormal(15, 30);
  const len = Math.hypot(nx, ny, nz);
  assert.ok(Math.abs(len - 1.0) < 0.001);
  assert.ok(ny > 0.5); // Normal is pointing predominantly upward
});
