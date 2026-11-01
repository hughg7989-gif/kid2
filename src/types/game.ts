/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export type VehicleType = 'ground' | 'air';

export interface VehicleDefinition {
  id: string;
  name: string;
  type: VehicleType;
  baseSpeed: number;
  boostMultiplier: number;
  slowMultiplier: number;
  jumpForce: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  sounds?: {
    horn?: string;
    enginePitch?: number;
  };
  geometry: (three: typeof THREE) => THREE.Group;
}

export interface CalibrationSettings {
  centerAlpha: number;
  centerBeta: number;
  centerGamma: number;
  invertPitch: boolean;
  invertRoll: boolean;
  invertYaw: boolean;
  deadzone: number; // in degrees, e.g. 5
  sensitivity: number; // multiplier, e.g. 1.0
  maxTilt: number; // degrees for max steering, e.g. 45
  orientationMode: 'face-up' | 'face-down';
  steeringMode: 'yaw' | 'tilt'; // 'yaw' for flat toy car rotation on floor, 'tilt' for traditional tilting
  yawMode?: 'relative' | 'delta'; // 'relative' heading from zero or 'delta' rate of turn
}

export interface MotionDataPayload {
  orientation: {
    alpha: number; // yaw
    beta: number;  // pitch
    gamma: number; // roll
  };
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  actions?: {
    horn?: boolean;
    jump?: boolean;
    boost?: boolean;
  };
  timestamp: number;
}

export interface ProcessedInput {
  steer: number;     // -1 (full left) to +1 (full right)
  pitch: number;     // -1 (nose down/brake) to +1 (nose up/boost)
  yaw: number;       // raw calibrated yaw degrees
  isFlipped: boolean;// true if tilt angle > threshold (e.g. > 80 deg)
  isJumpTriggered: boolean;
  speedMultiplier: number;
}

export interface ObstacleInstance {
  id: string;
  type: 'tree' | 'fence' | 'present' | 'balloon' | 'cloud' | 'snowman' | 'flower';
  position: THREE.Vector3;
  mesh: THREE.Group;
  hit: boolean;
  hitTime: number;
  points: number;
}

export interface TerrainChunk {
  key: string;
  cx: number;
  cz: number;
  mesh: THREE.Mesh;
  roadMesh?: THREE.Mesh;
  obstacles: ObstacleInstance[];
}
